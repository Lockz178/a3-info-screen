const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

const uploadsDir = path.join(__dirname, "uploads");

// Create uploads folder if it does not exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, safeName);
  },
});

// Allow only basic MVP formats
const allowedTypes = [".jpg", ".jpeg", ".png", ".mp4"];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and MP4 files are allowed for the MVP."));
    }
  },
});

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Serve uploaded media files
app.use("/uploads", express.static(uploadsDir));

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "A3 Info Screen server is running",
  });
});

// Get uploaded media list
app.get("/api/media", (req, res) => {
  const files = fs.readdirSync(uploadsDir).map((file) => {
    return {
      name: file,
      url: `/uploads/${file}`,
      type: path.extname(file).toLowerCase(),
    };
  });

  res.json(files);
});

// Upload one media file
app.post("/api/upload", upload.single("media"), (req, res) => {
  res.json({
    message: "File uploaded successfully",
    file: req.file.filename,
  });
});

// Error handler for upload errors
app.use((err, req, res, next) => {
  res.status(400).json({
    error: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`A3 Info Screen server running at http://localhost:${PORT}`);
});