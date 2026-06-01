const multer = require("multer");
const path = require("path");
const { uploadsDir } = require("../utils/fileHelpers");

const allowedTypes = [".jpg", ".jpeg", ".png", ".gif", ".mp4", ".mov"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, GIF, MP4, and MOV files are allowed."));
    }
  },
});

module.exports = upload;
