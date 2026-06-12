const fs = require("fs");
const path = require("path");
const { uploadsDir } = require("../utils/fileHelpers");

const heartbeatPath = path.join(__dirname, "../../heartbeat.json");

function handleHeartbeat(req, res) {
  try {
    fs.writeFileSync(heartbeatPath, JSON.stringify({ lastSeen: new Date().toISOString() }));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to write heartbeat." });
  }
}

function handleHealth(req, res) {
  const now = Date.now();

  const uptimeSeconds = Math.floor(process.uptime());

  // Pi heartbeat — ok < 5 min, warning 5–15 min, offline > 15 min
  let pi = { status: "unknown", lastSeenSeconds: null };
  if (fs.existsSync(heartbeatPath)) {
    try {
      const hb = JSON.parse(fs.readFileSync(heartbeatPath, "utf8"));
      const lastSeenSeconds = Math.floor((now - new Date(hb.lastSeen).getTime()) / 1000);
      const status = lastSeenSeconds < 300 ? "ok" : lastSeenSeconds < 900 ? "warning" : "offline";
      pi = { status, lastSeenSeconds };
    } catch {}
  }

  let fileCount = 0;
  let totalMB = 0;
  try {
    const files = fs.readdirSync(uploadsDir);
    fileCount = files.length;
    const totalBytes = files.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(uploadsDir, f)).size; } catch { return sum; }
    }, 0);
    totalMB = Math.round(totalBytes / 1024 / 1024 * 10) / 10;
  } catch {}

  res.json({
    server: { status: "ok", uptimeSeconds },
    pi,
    uploads: { status: "ok", fileCount, totalMB },
  });
}

module.exports = { handleHeartbeat, handleHealth };
