const express = require("express");
const router = express.Router();
const { loadConfig, saveConfig } = require("../utils/fileHelpers");

router.get("/", (req, res) => {
  res.status(200).json(loadConfig());
});

/*
  PATCH /api/config — updates allowed config fields.
  dashboardPassword is intentionally excluded; change it directly in config.json.
*/
router.patch("/", express.json(), (req, res) => {
  const current = loadConfig();
  const allowed = ["imageDurationSeconds", "maxVideoDurationSeconds", "qrUrl"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
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
