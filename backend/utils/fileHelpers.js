const path = require("path");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "../../uploads");
const thumbnailsDir = path.join(__dirname, "../../thumbnails");
const configPath = path.join(__dirname, "../../config.json");
const durationsPath = path.join(__dirname, "../../durations.json");
const orderPath = path.join(__dirname, "../../order.json");
const disabledPath = path.join(__dirname, "../../disabled.json");

/*
  Create the uploads and thumbnails directories when this module is first
  loaded. This ensures the folders exist before any route tries to read or
  write files, avoiding crashes on a fresh install or after a clean clone.
*/
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir);

/*
  loadDurations / saveDurations — per-file display duration store.
  Each entry maps a filename to a number of seconds. Both images and videos
  can have a custom duration; the slideshow uses this to decide how long to
  show each file. Returns an empty object on any read failure so the app
  keeps running even if the file is missing or corrupted.
*/
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
  loadOrder / saveOrder — slideshow playback order store.
  Stores an array of filenames in the order the user dragged them to.
  The GET /api/media route merges this with the actual files on disk so
  newly uploaded files that aren't in order.json yet still appear at the end.
  Returns an empty array on failure so the slideshow still runs in default order.
*/
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

/*
  loadConfig — reads config.json and merges with hardcoded defaults.
  The spread { ...defaults, ...config } means any key missing from config.json
  falls back to the default, so partial config files are safe. The defaults
  are also used if the file doesn't exist yet (fresh install).
*/
function loadConfig() {
  const defaults = { imageDurationSeconds: 10, maxVideoDurationSeconds: 60, qrUrl: "" };
  if (!fs.existsSync(configPath)) return defaults;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return { ...defaults, ...config };
  } catch (e) {
    return defaults;
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function loadDisabled() {
  if (!fs.existsSync(disabledPath)) return [];
  try { return JSON.parse(fs.readFileSync(disabledPath, "utf-8")); }
  catch { return []; }
}

function saveDisabled(disabled) {
  fs.writeFileSync(disabledPath, JSON.stringify(disabled, null, 2));
}

module.exports = { uploadsDir, thumbnailsDir, configPath, durationsPath, orderPath, loadDurations, saveDurations, loadOrder, saveOrder, loadConfig, saveConfig, loadDisabled, saveDisabled };
