const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const upload = require("../middleware/upload");
const { uploadsDir, loadDurations, saveDurations } = require("../utils/fileHelpers");

router.get("/", (req, res) => {
  try {
    const durations = loadDurations();
    const files = fs.readdirSync(uploadsDir)
      .sort()
      .map((file) => {
        const ext = path.extname(file).toLowerCase();
        const item = { name: file, url: `/uploads/${file}`, type: ext };
        if (ext === ".mp4" && durations[file] != null) {
          item.duration = durations[file];
        }
        return item;
      });
    res.status(200).json(files);
  } catch (e) {
    res.status(500).json({ error: "Could not load media files." });
  }
});

router.post("/", upload.single("media"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file received." });
  }

  const ext = path.extname(req.file.filename).toLowerCase();
  if (ext === ".mp4" && req.body.duration) {
    const duration = Math.max(5, Math.min(60, parseInt(req.body.duration)));
    if (!isNaN(duration)) {
      try {
        const durations = loadDurations();
        durations[req.file.filename] = duration;
        saveDurations(durations);
      } catch (e) {
        // duration save failed but file upload succeeded
      }
    }
  }

  res.status(201).json({
    message: "File uploaded successfully",
    file: req.file.filename,
  });
});

router.delete("/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }

  try {
    fs.unlinkSync(filePath);

    const durations = loadDurations();
    if (durations[safeFilename] != null) {
      delete durations[safeFilename];
      saveDurations(durations);
    }

    res.status(200).json({
      message: "File deleted successfully",
      file: safeFilename,
    });
  } catch (e) {
    res.status(500).json({ error: "Could not delete file." });
  }
});

module.exports = router;
