const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const ffmpeg = require("fluent-ffmpeg");

/*
  Set ffmpeg and ffprobe paths from bundled npm packages.
  ffmpeg-static and @ffprobe-installer/ffprobe include pre-built binaries for
  Windows, macOS, and Linux ARM (Raspberry Pi). The try/catch means that if
  the bundled binary fails (e.g. missing, wrong architecture), fluent-ffmpeg
  falls back to whatever system ffmpeg is in PATH instead of crashing the app.
*/
try {
  const ffmpegPath = require("ffmpeg-static");
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch {}
try {
  const { path: ffprobePath } = require("@ffprobe-installer/ffprobe");
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
} catch {}

const upload = require("../middleware/upload");
const { uploadsDir, thumbnailsDir, loadDurations, saveDurations, loadOrder, saveOrder, loadConfig } = require("../utils/fileHelpers");

const VIDEO_EXTS = new Set([".mp4", ".mov"]);

/*
  checkFileSignature — validates the file's magic bytes, not just its extension.
  Users can rename any file to .jpg or .mp4 to bypass extension checks.
  Magic bytes are the first few bytes of a real file that identify its true
  format (e.g. JPEG always starts with FF D8 FF). This prevents uploading
  malicious or corrupt files disguised as images or videos.
*/
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

/*
  probeVideoCodec — reads the video codec without decoding the whole file.
  Used before transcoding to check if the video is already H.264. If it is,
  we can remux (copy streams) instead of re-encoding, which is much faster
  and preserves quality. Only re-encodes when absolutely necessary.
*/
function probeVideoCodec(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const stream = metadata.streams.find(s => s.codec_type === "video");
      resolve(stream ? stream.codec_name : null);
    });
  });
}

/*
  probeVideoDuration — reads the video duration in seconds via ffprobe.
  Used after upload to enforce the maximum video duration limit from config.json.
  Runs after transcoding so the duration is accurate for the final output file.
*/
function probeVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format && metadata.format.duration;
      resolve(duration != null ? parseFloat(duration) : null);
    });
  });
}

/*
  generateThumbnail — extracts a single frame from a video as a JPEG preview.
  -ss 1 seeks to 1 second in to avoid black title frames at the very start.
  scale=320:-2 resizes to 320px wide, keeping aspect ratio with an even height
  (required by some codecs). Thumbnails are stored in /thumbnails/<file>.jpg
  and served to the dashboard so users can identify videos without playing them.
*/
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

/*
  transcodeToMp4 — converts a video to H.264 MP4, the only format browsers
  can reliably play without plugins. MOV files are remuxed (stream copy) if
  already H.264 since remuxing is near-instant and lossless. Non-H.264 videos
  are re-encoded with libx264 + AAC at CRF 23 (good quality, reasonable size).
  faststart moves the MP4 index to the front so browsers can start playing
  before the full file is downloaded (important for large videos on slow Pi SD).
*/
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

/*
  GET /api/media — returns the full file list with order, durations, and thumbnails.
  Order is merged so files in order.json come first in the user's chosen sequence,
  and any newly uploaded files not yet in order.json are appended at the end.
  Thumbnail generation is triggered here for any video missing its thumbnail file,
  so thumbnails appear automatically after a git pull + server restart on the Pi
  without needing to re-upload the videos.
*/
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
        const thumbPath = path.join(thumbnailsDir, file + ".jpg");
        if (fs.existsSync(thumbPath)) {
          item.thumbnail = `/thumbnails/${file}.jpg`;
        } else {
          generateThumbnail(path.join(uploadsDir, file), thumbPath).catch(() => {});
        }
      } else {
        item.thumbnail = `/uploads/${file}`;
      }
      if (durations[file] != null) item.duration = durations[file];
      return item;
    });
    res.status(200).json(files);
  } catch (e) {
    res.status(500).json({ error: "Could not load media files." });
  }
});

/*
  currentlyShowing — in-memory store for which file is currently on screen.
  The slideshow page (script.js) POSTs here every time it switches to a new
  file. The dashboard polls GET /current every 2 seconds to highlight the
  active file. Stored in memory (not a file) because it is live state that
  only matters while the server is running; it resets to null on restart.
*/
let currentlyShowing = null;

router.get("/current", (req, res) => {
  res.json({ name: currentlyShowing });
});

router.post("/current", express.json(), (req, res) => {
  currentlyShowing = req.body.name || null;
  res.json({ ok: true });
});

/*
  PUT /api/media/order — saves the user's custom playback order.
  path.basename strips any directory traversal (e.g. "../../etc/passwd")
  from filenames before saving, preventing path injection through the order array.
*/
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

/*
  POST /api/media — handles file upload with validation and video processing.
  Steps in order:
    1. Magic byte check — rejects corrupt or misnamed files immediately.
    2. Transcode — converts any video to H.264 MP4 so the browser can play it.
       MOV files and non-H.264 videos are converted; H.264 MP4s are left as-is.
    3. Duration check — enforces the maxVideoDurationSeconds limit from config.json.
       Runs after transcoding because the original file may be in a format ffprobe
       cannot read accurately before conversion.
    4. Persist duration — saves the user's chosen display duration for any file type.
    5. Persist order — appends the new file to order.json so it keeps its position.
    6. Generate thumbnail — fires async so the upload response is not delayed.
*/
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

    if (req.body.duration) {
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

/*
  PATCH /api/media/:filename/duration — updates the display duration for any file.
  Duration is clamped between 5s and maxVideoDurationSeconds so the slideshow
  never gets stuck on a single file indefinitely or advances too quickly to read.
  Applies to both images and videos; images use this same value in the slideshow.
*/
router.patch("/:filename/duration", express.json(), (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);
  const ext = path.extname(safeFilename).toLowerCase();

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
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

/*
  DELETE /api/media/:filename — removes a file and all its associated data.
  Cleans up durations.json, order.json, and the thumbnail so no orphaned data
  accumulates over time. The thumbnail delete is wrapped in try/catch because
  images never have thumbnails and it should not cause the whole delete to fail.
*/
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

/*
  Startup thumbnail scan — generates missing thumbnails for videos already on disk.
  This runs once when the server starts, which covers the case where the Pi pulls
  new code (or new thumbnails were deleted) and needs to rebuild them without
  requiring the files to be re-uploaded. Generation is async and non-blocking
  so the server is ready to serve requests immediately.
*/
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
