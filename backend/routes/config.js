const express = require("express");
const router = express.Router();
const { loadConfig, saveConfig } = require("../utils/fileHelpers");

/*
  GET /api/config is public (the dashboard and Pi read it without auth), so we
  must never expose the login secret. Strip dashboardPassword from the response;
  the login route reads it server-side from config directly.
*/
router.get("/", (req, res) => {
  const { dashboardPassword, ...safe } = loadConfig();
  res.status(200).json(safe);
});

/*
  PATCH /api/config — updates allowed config fields.
  dashboardPassword is intentionally excluded; change it directly in config.json.
*/
router.patch("/", express.json(), (req, res) => {
  const current = loadConfig();
  const allowed = ["imageDurationSeconds", "maxVideoDurationSeconds", "qrUrl", "screenOnTime", "screenOffTime", "screenScheduleEnabled", "alertPresets"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  // Sanitise alert presets: keep only well-formed {label, message} entries
  // with non-empty trimmed text, and cap the count so the dashboard grid and
  // config file can't be flooded with junk.
  if (updates.alertPresets !== undefined) {
    updates.alertPresets = (Array.isArray(updates.alertPresets) ? updates.alertPresets : [])
      .map(p => ({ label: String(p?.label ?? "").trim().slice(0, 40), message: String(p?.message ?? "").trim().slice(0, 200) }))
      .filter(p => p.label && p.message)
      .slice(0, 8);
  }
  const updated = { ...current, ...updates };
  try {
    saveConfig(updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Could not save config." });
  }
});

module.exports = router;
