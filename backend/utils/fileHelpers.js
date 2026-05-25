const path = require("path");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "../../uploads");
const configPath = path.join(__dirname, "../../config.json");
const durationsPath = path.join(__dirname, "../../durations.json");
const orderPath = path.join(__dirname, "../../order.json");

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

function loadOrder() {
  if (!fs.existsSync(orderPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(orderPath, "utf-8"));
  } catch (e) {
    return [];
  }
}

function saveOrder(order) {
  fs.writeFileSync(orderPath, JSON.stringify(order, null, 2));
}

function loadConfig() {
  const defaults = { imageDurationSeconds: 10, maxVideoDurationSeconds: 60 };
  if (!fs.existsSync(configPath)) return defaults;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return { ...defaults, ...config };
  } catch (e) {
    return defaults;
  }
}

module.exports = { uploadsDir, configPath, durationsPath, orderPath, loadDurations, saveDurations, loadOrder, saveOrder, loadConfig };
