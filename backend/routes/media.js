const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const upload = require("../middleware/upload");
const { uploadsDir, thumbnailsDir, loadDurations, saveDurations, loadOrder, saveOrder, loadConfig } = require("../utils/fileHelpers");

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

function probeVideoCodec(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const stream = metadata.streams.find(s => s.codec_type === "video");
      resolve(stream ? stream.codec_name : null);
    });
  });
}

function probeVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format && metadata.format.duration;
      resolve(duration != null ? parseFloat(duration) : null);
    });
  });
}

function generateThumbnail(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .inputOptions(["-ss 1"])
      .outputOptions(["-vframes 1", "-vf scale=320:-2"])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

function transcodeToMp4(inputPath, outputPath, copyStreams) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath);
    if (copyStreams) {
      cmd.videoCodec("copy").audioCodec("copy");
    } else {
      cmd.videoCodec("libx264").audioCodec("aac")
         .outputOptions(["-movflags faststart", "-preset fast", "-crf 23"]);
    }
    cmd.on("end", resolve).on("error", reject).save(outputPath);
  });
}

router.get("/", (req, res) => {
  try {
    const durations = loadDurations();
    const order = loadOrder();
    const allFiles = fs.readdirSync(uploadsDir).sort();
    const ordered = [
      ...order.filter(f => allFiles.includes(f)),
      ...allFiles.filter(f => !order.includes(f)),
    ];
    const files = ordered.map((file) => {
      const ext = path.extname(file).toLowerCase();
      const item = { name: file, url: `/uploads/${file}`, type: ext };
      if (VIDEO_EXTS.has(ext)) {
        if (durations[file] != null) item.duration = durations[file];
        const thumbPath = path.join(thumbnailsDir, file + ".jpg");
        if (fs.existsSync(thumbPath)) item.thumbnail = `/thumbnails/${file}.jpg`;
      } else {
        item.thumbnail = `/uploads/${file}`;
      }
      return item;
    });
    res.status(200).json(files);
  } catch (e) {
    res.status(500).json({ error: "Could not load media files." });
  }
});

router.put("/order", express.json(), (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: "order must be an array" });
  }
  const sanitized = order.map(f => path.basename(String(f))).filter(f => f && f !== "." && f !== "..");
  try {
    saveOrder(sanitized);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not save order." });
  }
});

router.post("/", upload.single("media"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file received." });
    }

    let ext = path.extname(req.file.filename).toLowerCase();
    let filePath = path.join(uploadsDir, req.file.filename);
    let filename = req.file.filename;

    if (!checkFileSignature(filePath, ext)) {
      try { fs.unlinkSync(filePath); } catch {}
      return res.status(400).json({
        error: `File appears corrupted or is not a valid ${ext.slice(1).toUpperCase()} file.`,
      });
    }

    if (VIDEO_EXTS.has(ext)) {
      try {
        const codec = await probeVideoCodec(filePath);
        const isH264 = codec === "h264";
        const needsRemux = ext === ".mov";

        if (!isH264 || needsRemux) {
          const newFilename = filename.slice(0, filename.lastIndexOf(".")) + ".mp4";
          const newFilePath = path.join(uploadsDir, newFilename);
          try {
            await transcodeToMp4(filePath, newFilePath, isH264);
            try { fs.unlinkSync(filePath); } catch {}
            filename = newFilename;
            filePath = newFilePath;
            ext = ".mp4";
          } catch {
            try { fs.unlinkSync(newFilePath); } catch {}
            try { fs.unlinkSync(filePath); } catch {}
            return res.status(500).json({ error: "Video processing failed. The format may not be supported." });
          }
        }

        const maxDuration = (loadConfig().maxVideoDurationSeconds) || 60;
        const videoDurationSecs = await probeVideoDuration(filePath);
        if (videoDurationSecs !== null && videoDurationSecs > maxDuration) {
          try { fs.unlinkSync(filePath); } catch {}
          return res.status(400).json({
            error: `Video is too long (${Math.round(videoDurationSecs)}s). Maximum allowed is ${maxDuration} seconds.`,
          });
        }
      } catch {
        // ffprobe not available — skip transcoding and duration check
      }
    }

    if (VIDEO_EXTS.has(ext) && req.body.duration) {
      const duration = Math.max(5, Math.min(60, parseInt(req.body.duration)));
      if (!isNaN(duration)) {
        try {
          const durations = loadDurations();
          durations[filename] = duration;
          saveDurations(durations);
        } catch (e) {}
      }
    }

    try {
      const order = loadOrder();
      if (!order.includes(filename)) {
        order.push(filename);
        saveOrder(order);
      }
    } catch (e) {}

    if (VIDEO_EXTS.has(ext)) {
      const thumbPath = path.join(thumbnailsDir, filename + ".jpg");
      generateThumbnail(filePath, thumbPath).catch(() => {});
    }

    res.status(201).json({
      message: "File uploaded successfully",
      file: filename,
    });
  } catch (e) {
    res.status(500).json({ error: "An unexpected error occurred during upload." });
  }
});

router.patch("/:filename/duration", express.json(), (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);
  const ext = path.extname(safeFilename).toLowerCase();

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }
  if (!VIDEO_EXTS.has(ext)) {
    return res.status(400).json({ error: "Duration can only be set for video files." });
  }

  const raw = parseInt(req.body.duration);
  if (isNaN(raw)) {
    return res.status(400).json({ error: "duration must be a number." });
  }

  const maxDuration = (loadConfig().maxVideoDurationSeconds) || 60;
  const duration = Math.max(5, Math.min(maxDuration, raw));

  try {
    const durations = loadDurations();
    durations[safeFilename] = duration;
    saveDurations(durations);
    res.status(200).json({ duration });
  } catch (e) {
    res.status(500).json({ error: "Could not save duration." });
  }
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

    const order = loadOrder();
    const idx = order.indexOf(safeFilename);
    if (idx !== -1) {
      order.splice(idx, 1);
      saveOrder(order);
    }

    const thumbPath = path.join(thumbnailsDir, safeFilename + ".jpg");
    try { fs.unlinkSync(thumbPath); } catch {}

    res.status(200).json({ message: "File deleted successfully", file: safeFilename });
  } catch (e) {
    res.status(500).json({ error: "Could not delete file." });
  }
});

(async () => {
  try {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;
      const thumbPath = path.join(thumbnailsDir, file + ".jpg");
      if (fs.existsSync(thumbPath)) continue;
      generateThumbnail(path.join(uploadsDir, file), thumbPath).catch(() => {});
    }
  } catch {}
})();

module.exports = router;
