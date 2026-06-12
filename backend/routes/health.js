const fs = require("fs");
const path = require("path");
const { uploadsDir } = require("../utils/fileHelpers");
const { getAlertMessage } = require("./alert");

const heartbeatPath = path.join(__dirname, "../../heartbeat.json");

function handleHeartbeat(req, res) {
  try {
    const body = req.body || {};
    const record = { lastSeen: new Date().toISOString() };
    if (body.nowPlaying !== undefined) record.nowPlaying = body.nowPlaying;
    if (body.lastSyncAt !== undefined) record.lastSyncAt = body.lastSyncAt;
    fs.writeFileSync(heartbeatPath, JSON.stringify(record));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to write heartbeat." });
  }
}

function handleHealth(req, res) {
  const now = Date.now();

  // VM server uptime
  const uptimeSeconds = Math.floor(process.uptime());

  // Pi heartbeat — ok < 5 min, warning 5–15 min, offline > 15 min
  let pi = { status: "unknown", lastSeenSeconds: null, nowPlaying: null };
  if (fs.existsSync(heartbeatPath)) {
    try {
      const hb = JSON.parse(fs.readFileSync(heartbeatPath, "utf8"));
      const lastSeenSeconds = Math.floor((now - new Date(hb.lastSeen).getTime()) / 1000);
      const status = lastSeenSeconds < 300 ? "ok" : lastSeenSeconds < 900 ? "warning" : "offline";
      const lastSyncSeconds = hb.lastSyncAt ? Math.floor((now - new Date(hb.lastSyncAt).getTime()) / 1000) : null;
      const syncStatus = lastSyncSeconds === null ? "unknown" : lastSyncSeconds < 600 ? "ok" : lastSyncSeconds < 1200 ? "warning" : "offline";
      pi = { status, lastSeenSeconds, nowPlaying: hb.nowPlaying || null, lastSyncSeconds, syncStatus };
    } catch {}
  }

  // Last sync — reported by Pi via heartbeat
  const lastSync = pi.lastSyncSeconds !== undefined
    ? { status: pi.syncStatus, lastSyncSeconds: pi.lastSyncSeconds }
    : { status: "unknown", lastSyncSeconds: null };

  // Uploads folder — file count and total size
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

  // Disk space on VM
  let disk = { status: "ok", freeMB: null, totalMB: null };
  try {
    const st = fs.statfsSync(uploadsDir);
    const free  = Math.round(st.bavail * st.bsize / 1024 / 1024);
    const total = Math.round(st.blocks * st.bsize / 1024 / 1024);
    const usedPct = Math.round((1 - st.bavail / st.blocks) * 100);
    // warning > 80% used, offline (critical) > 95% used
    const status = usedPct > 95 ? "offline" : usedPct > 80 ? "warning" : "ok";
    disk = { status, freeMB: free, totalMB: total, usedPct };
  } catch {}

  // Active emergency alert
  const alertMsg = getAlertMessage();
  const alert = {
    status: alertMsg ? "warning" : "ok",
    message: alertMsg || null,
  };

  res.json({ server: { status: "ok", uptimeSeconds }, pi, lastSync, uploads: { status: "ok", fileCount, totalMB }, disk, alert });
}

module.exports = { handleHeartbeat, handleHealth };
