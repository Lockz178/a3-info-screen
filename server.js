const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;


app.use(express.static(path.join(__dirname, "public")));


app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "A3 Info Screen server is running",
  });
});


app.listen(PORT, () => {
  console.log(`A3 Info Screen server running at http://localhost:${PORT}`);
});