const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const upload = require("../middleware/upload");
const { uploadsDir, loadDurations, saveDurations } = require("../utils/fileHelpers");

const VIDEO_EXTS = new Set([".mp4", ".mov"]);

function checkFileSignature(filePath, ext) {
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    if (bytesRead < 8) return false;

    if (ext === ".jpg" || ext === ".jpeg") {
      return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    }
    if (ext === ".png") {
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
             buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A;
    }
    if (ext === ".mp4" || ext === ".mov") {
      const boxType = buf.slice(4, 8).toString("ascii");
      return ["ftyp", "mdat", "moov", "wide", "free", "skip"].includes(boxType);
    }
    return false;
  } catch (e) {
    return false;
  }
}

router.get("/", (req, res) => {
  try {
    const durations = loadDurations();
    const files = fs.readdirSync(uploadsDir)
      .sort()
      .map((file) => {
        const ext = path.extname(file).toLowerCase();
        const item = { name: file, url: `/uploads/${file}`, type: ext };
        if (VIDEO_EXTS.has(ext) && durations[file] != null) {
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
  const filePath = path.join(uploadsDir, req.file.filename);

  if (!checkFileSignature(filePath, ext)) {
    try { fs.unlinkSync(filePath); } catch {}
    return res.status(400).json({
      error: `File appears corrupted or is not a valid ${ext.slice(1).toUpperCase()} file.`,
    });
  }

  if (VIDEO_EXTS.has(ext) && req.body.duration) {
    const duration = Math.max(5, Math.min(60, parseInt(req.body.duration)));
    if (!isNaN(duration)) {
      try {
        const durations = loadDurations();
        durations[req.file.filename] = duration;
        saveDurations(durations);
      } catch (e) {}
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

    res.status(200).json({ message: "File deleted successfully", file: safeFilename });
  } catch (e) {
    res.status(500).json({ error: "Could not delete file." });
  }
});

module.exports = router;
