const crypto = require("crypto");
const fs = require("fs");
const session = require("express-session");
const express = require("express");
const path = require("path");
const mediaRoutes = require("./backend/routes/media");
const configRoutes = require("./backend/routes/config");
const alertRoutes = require("./backend/routes/alert");
const { requireAuth, requireAuthPage } = require("./backend/middleware/auth");
const { loadConfig, uploadsDir, saveOrder, saveDurations, saveDisabled } = require("./backend/utils/fileHelpers");

const app = express();
const PORT = 3000;

/*
  HOST is 0.0.0.0 so the server listens on all network interfaces, not just
  localhost. This is required on the Raspberry Pi so other devices on the
  same network (e.g. a laptop accessing the dashboard) can reach it by IP.
  On a local dev machine it has no security impact since there is no public IP.
*/
const HOST = "0.0.0.0";

/*
  Session secret is random per startup. Sessions are invalidated when the
  server restarts, which is acceptable — teachers just log in again after a
  reboot. Using a fixed secret would persist sessions across restarts but
  would need to be stored and rotated, adding unnecessary complexity.
*/
app.use(session({
  secret: crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" },
}));

app.use(express.json());

/*
  Auth routes — login and logout.
  POST /api/auth/login: compares submitted password against dashboardPassword
  in config.json. Empty dashboardPassword means no protection is active.
  POST /api/auth/logout: destroys the session.
  GET  /api/auth/status: lets the login page know if auth is needed.
*/
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  const config = loadConfig();
  if (!config.dashboardPassword || password === config.dashboardPassword) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Incorrect password." });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/status", (req, res) => {
  const config = loadConfig();
  const needsPassword = !!config.dashboardPassword;
  res.json({ authenticated: !needsPassword || !!(req.session && req.session.authenticated) });
});

/*
  GET /api/qr — generates a QR code PNG for the configured qrUrl.
  Returns 404 when no URL is set so the slideshow img element can hide itself.
  Purple on white matches the TAMK brand color used throughout the UI.
*/
app.get("/api/qr", async (req, res) => {
  const config = loadConfig();
  if (!config.qrUrl) return res.status(404).end();
  try {
    const QRCode = require("qrcode");
    const png = await QRCode.toBuffer(config.qrUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#4e008e", light: "#ffffff" },
    });
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache");
    res.send(png);
  } catch {
    res.status(500).end();
  }
});

/*
  Protect the dashboard page. This route intercepts /dashboard.html before
  the static middleware so unauthenticated requests are redirected to login
  instead of receiving the raw HTML file.
*/
app.get("/dashboard.html", requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dashboard.html"));
});

/*
  Static file serving. The frontend folder contains the HTML/CSS/JS for both
  the slideshow screen (index.html) and the dashboard (dashboard.html).
  Uploads and thumbnails are served from their own paths so the browser can
  reference them directly as /uploads/<file> and /thumbnails/<file>.jpg
  without the files living inside the frontend folder.
*/
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/thumbnails", express.static(path.join(__dirname, "thumbnails")));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "A3 Info Screen server is running" });
});

/*
  Protect write operations on /api/media. GET requests (used by the slideshow)
  and /current (used by the slideshow to report what's playing) stay public.
  POST, DELETE, PATCH, and PUT require an authenticated session.
*/
app.use("/api/media", (req, res, next) => {
  if (req.path === "/current") return next();
  const writeMethods = ["POST", "DELETE", "PATCH", "PUT"];
  if (writeMethods.includes(req.method)) return requireAuth(req, res, next);
  next();
});
app.use("/api/media", mediaRoutes);

/*
  PATCH /api/config requires auth (saves QR URL and other settings).
  GET /api/config stays public — the slideshow reads it for image durations.
*/
app.use("/api/config", (req, res, next) => {
  if (req.method === "PATCH") return requireAuth(req, res, next);
  next();
});
app.use("/api/config", configRoutes);

/*
  GET /api/alert is public — the slideshow polls it to show/hide the overlay.
  POST and DELETE require auth so only dashboard users can set/clear alerts.
*/
app.use("/api/alert", (req, res, next) => {
  if (["POST", "DELETE"].includes(req.method)) return requireAuth(req, res, next);
  next();
});
app.use("/api/alert", alertRoutes);

/*
  Global error handler. Express passes errors here when middleware calls
  next(err). The LIMIT_FILE_SIZE code comes from multer when the uploaded
  file exceeds the size cap. Without this handler multer errors would return
  a generic 500 with a stack trace instead of a readable 400 message.
*/
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large. Maximum size is 100MB." });
  }
  res.status(400).json({ error: err.message || "Something went wrong." });
});

/*
  syncFromVM — keeps the Pi's uploads folder in sync with the VM.
  On startup and every 5 minutes it fetches the VM's media list, downloads
  any files that exist on the VM but not locally, and deletes any local files
  that were removed from the VM. Order, durations, and disabled state are also
  synced from the VM response. If the VM is unreachable the function exits
  silently so the Pi keeps showing its last known local slides.

  Only runs when VM_SYNC_URL is set (e.g. in the Pi's systemd service file).
  The VM itself does not set this variable so it never tries to sync from itself.
*/
async function syncFromVM() {
  const vmUrl = process.env.VM_SYNC_URL;
  if (!vmUrl) return;

  console.log(`[sync] syncing from ${vmUrl}`);
  try {
    const base = vmUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/media`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) { console.log(`[sync] VM returned ${res.status}`); return; }

    const vmFiles = await res.json();
    const localFiles = new Set(fs.readdirSync(uploadsDir));
    const vmFileNames = new Set(vmFiles.map(f => f.name));

    for (const file of vmFiles) {
      if (!localFiles.has(file.name)) {
        try {
          const fileRes = await fetch(`${base}${file.url}`, { signal: AbortSignal.timeout(60000) });
          if (!fileRes.ok) continue;
          fs.writeFileSync(path.join(uploadsDir, file.name), Buffer.from(await fileRes.arrayBuffer()));
          console.log(`[sync] downloaded ${file.name}`);
        } catch {}
      }
    }

    for (const localFile of localFiles) {
      if (!vmFileNames.has(localFile)) {
        try { fs.unlinkSync(path.join(uploadsDir, localFile)); console.log(`[sync] deleted ${localFile}`); } catch {}
      }
    }

    saveOrder(vmFiles.map(f => f.name));

    const durations = {};
    for (const file of vmFiles) {
      if (file.duration != null) durations[file.name] = file.duration;
    }
    saveDurations(durations);
    saveDisabled(vmFiles.filter(f => !f.enabled).map(f => f.name));
    console.log(`[sync] done — ${vmFiles.length} file(s) on VM`);

  } catch (err) {
    console.log(`[sync] VM unreachable (${err.message}) — keeping local files`);
  }
}

syncFromVM();
setInterval(syncFromVM, 5 * 60 * 1000);

app.listen(PORT, HOST, () => {
  console.log(`A3 Info Screen server running at http://${HOST}:${PORT}`);
});
