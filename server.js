const express = require("express");
const path = require("path");
const mediaRoutes = require("./backend/routes/media");
const configRoutes = require("./backend/routes/config");

const app = express();
const PORT = 3000;

/*
  HOST is 0.0.0.0 so the server listens on all network interfaces, not just
  localhost. This is required on the Raspberry Pi so other devices on the
  same network (e.g. a laptop accessing the dashboard) can reach it by IP.
  On a local dev machine it has no security impact since there is no public IP.
*/
const HOST = "0.0.0.0";

/*
  Static file serving. The frontend folder contains the HTML/CSS/JS for both
  the slideshow screen (index.html) and the dashboard (dashboard.html).
  Uploads and thumbnails are served from their own paths so the browser can
  reference them directly as /uploads/<file> and /thumbnails/<file>.jpg
  without the files living inside the frontend folder.
*/
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/thumbnails", express.static(path.join(__dirname, "thumbnails")));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "A3 Info Screen server is running" });
});

app.use("/api/media", mediaRoutes);
app.use("/api/config", configRoutes);

/*
  Global error handler. Express passes errors here when middleware calls
  next(err). The LIMIT_FILE_SIZE code comes from multer when the uploaded
  file exceeds the size cap. Without this handler multer errors would return
  a generic 500 with a stack trace instead of a readable 400 message.
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
