const express = require("express");
const path = require("path");
const mediaRoutes = require("./backend/routes/media");
const configRoutes = require("./backend/routes/config");

const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";

app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/thumbnails", express.static(path.join(__dirname, "thumbnails")));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "A3 Info Screen server is running" });
});

app.use("/api/media", mediaRoutes);
app.use("/api/config", configRoutes);

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large. Maximum size is 100MB." });
  }
  res.status(400).json({ error: err.message || "Something went wrong." });
});

app.listen(PORT, HOST, () => {
  console.log(`A3 Info Screen server running at http://${HOST}:${PORT}`);
});
