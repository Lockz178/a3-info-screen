const express = require("express");
const router = express.Router();
const { loadConfig } = require("../utils/fileHelpers");

router.get("/", (req, res) => {
  res.status(200).json(loadConfig());
});

module.exports = router;
