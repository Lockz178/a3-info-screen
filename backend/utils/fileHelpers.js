const path = require("path");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "../../uploads");
const configPath = path.join(__dirname, "../../config.json");
const durationsPath = path.join(__dirname, "../../durations.json");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

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

function loadConfig() {
  const defaults = { imageDurationSeconds: 10 };
  if (!fs.existsSync(configPath)) return defaults;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return { ...defaults, ...config };
  } catch (e) {
    return defaults;
  }
}

module.exports = { uploadsDir, configPath, durationsPath, loadDurations, saveDurations, loadConfig };
