const express = require("express");
const router = express.Router();

/*
  alertMessage is stored in memory only. It resets when the server restarts,
  which is the right behavior — a stale emergency message should not persist
  indefinitely across reboots. Teachers re-enter it if still needed after restart.
*/
let alertMessage = null;

router.get("/", (req, res) => {
  res.json({ message: alertMessage });
});

router.post("/", express.json(), (req, res) => {
  const message = (req.body.message || "").trim();
  alertMessage = message || null;
  res.json({ ok: true, message: alertMessage });
});

router.delete("/", (req, res) => {
  alertMessage = null;
  res.json({ ok: true });
});

module.exports = router;
