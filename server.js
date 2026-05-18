const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/*
  Backend server setup.
  The server runs on port 3000. HOST 0.0.0.0 allows other devices on the same
  network to open the dashboard while the Raspberry Pi runs the app.
*/
const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";

const uploadsDir = path.join(__dirname, "uploads");
const configPath = path.join(__dirname, "config.json");
const durationsPath = path.join(__dirname, "durations.json");

function loadDurations() {
  if (!fs.existsSync(durationsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(durationsPath, "utf-8"));
  } catch (e) {
    return {};
  }
}

function saveDurations(durations) {
  fs.writeFileSync(durationsPath, JSON.stringify(durations, null, 2));
}

/*
  The uploads folder stores media files uploaded from the dashboard.
  If the folder does not exist, the server creates it automatically.
*/
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

/*
  Multer handles file uploads.
  Uploaded files are saved with a timestamp in the filename so upload order is clear.
*/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, safeName);
  },
});

/*
  Basic MVP file validation.
  The first version supports common image formats and MP4 videos.
*/
const allowedTypes = [".jpg", ".jpeg", ".png", ".mp4"];

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and MP4 files are allowed."));
    }
  },
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadsDir));

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "A3 Info Screen server is running",
  });
});

/*
  Sends slideshow settings to the frontend.
  The image duration is read from config.json so it can be changed without editing slideshow code.
*/
app.get("/api/config", (req, res) => {
  if (!fs.existsSync(configPath)) {
    return res.json({ imageDurationSeconds: 10 });
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    res.json({ imageDurationSeconds: 10, ...config });
  } catch (e) {
    res.json({ imageDurationSeconds: 10 });
  }
});

/*
  Sends the uploaded media list to the slideshow and dashboard.
  Files are sorted so the slideshow shows media from oldest upload to newest upload.
*/
app.get("/api/media", (req, res) => {
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

    res.json(files);
  } catch (e) {
    res.status(500).json({ error: "Could not load media files." });
  }
});

/*
  Receives one uploaded media file from the dashboard and saves it to the uploads folder.
*/
app.post("/api/upload", upload.single("media"), (req, res) => {
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
        // duration save failed but the file upload still succeeded
      }
    }
  }

  res.json({
    message: "File uploaded successfully",
    file: req.file.filename,
  });
});

/*
  Deletes one uploaded media file.
  This lets users remove old or incorrect content from the dashboard.
*/
app.delete("/api/media/:filename", (req, res) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "File not found",
    });
  }

  fs.unlinkSync(filePath);

  const durations = loadDurations();
  if (durations[safeFilename] != null) {
    delete durations[safeFilename];
    saveDurations(durations);
  }

  res.json({
    message: "File deleted successfully",
    file: safeFilename,
  });
});

/*
  Handles upload errors and sends a clear message back to the dashboard.
*/
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large. Maximum size is 100MB." });
  }
  res.status(400).json({ error: err.message || "Something went wrong." });
});

app.listen(PORT, HOST, () => {
  console.log(`A3 Info Screen server running at http://${HOST}:${PORT}`);
});