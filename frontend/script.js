const mediaArea = document.getElementById("mediaArea");

let mediaFiles = [];
let currentIndex = 0;
let imageTimer = null;
let videoTimer = null;
let imageDuration = 10000;
let maxVideoDuration = 60;
let currentVideoEl = null;

/*
  Refresh interval for pulling updated media and config from the server.
  5 seconds is frequent enough for changes to appear quickly but not so fast
  it hammers the Pi's CPU with constant file system reads.
*/
const refreshInterval = 5000;

/*
  updateClock — updates the date/time display at the bottom of the screen.
  en-GB locale gives "Monday, 25/05/2026" and 24-hour time, which matches
  Finnish convention and avoids AM/PM confusion on a public display.
*/
function updateClock() {
  const clockElement = document.getElementById("clock");

  const now = new Date();

  const dateText = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeText = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  clockElement.textContent = `${dateText} · ${timeText}`;
}

/*
  loadConfig — fetches imageDurationSeconds from the backend config.
  This makes the default image display time configurable through config.json
  without editing code. Falls back to 10 seconds on any error.
*/
async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();

    if (config.imageDurationSeconds) {
      imageDuration = config.imageDurationSeconds * 1000;
    }
    if (config.maxVideoDurationSeconds) {
      maxVideoDuration = config.maxVideoDurationSeconds;
    }

    // Show or hide the QR code based on whether a URL is configured
    const qrImg = document.getElementById("qrCode");
    if (config.qrUrl) {
      if (qrImg.dataset.url !== config.qrUrl) {
        qrImg.dataset.url = config.qrUrl;
        qrImg.src = "/api/qr?" + Date.now();
      }
      qrImg.hidden = false;
    } else {
      qrImg.hidden = true;
    }
  } catch (error) {
    imageDuration = 10000;
  }
}

/*
  loadMediaFiles — fetches the current file list from the server and updates
  the slideshow state without interrupting what is currently playing.

  On every refresh it handles three scenarios:
    1. Current file was deleted → skip to its former index position immediately.
    2. File order changed → keep currentIndex pointing at the same filename.
    3. Duration changed for the playing video → recalculate the remaining timer
       from currentVideoEl.currentTime so the change takes effect live without
       waiting for the next file transition.

  Tracking by filename (not index) is important because the user can reorder
  files in the dashboard at any time, so the same index may point to a
  different file after a refresh.
*/
async function loadMediaFiles(firstLoad = false) {
  try {
    const response = await fetch("/api/media");
    if (!response.ok) {
      if (firstLoad) {
        mediaArea.innerHTML = `
          <div class="placeholder">
            <h1>Error loading media</h1>
            <p>Server returned an error. Please check the server.</p>
          </div>
        `;
      }
      return;
    }
    const newMediaFiles = (await response.json()).filter(f => f.enabled !== false);

    const wasEmpty = mediaFiles.length === 0;
    const currentFile = mediaFiles[currentIndex] ?? null;

    mediaFiles = newMediaFiles;

    if (mediaFiles.length === 0) {
      showPlaceholder();
      return;
    }

    if (firstLoad || wasEmpty) {
      currentIndex = 0;
      showCurrentMedia();
      return;
    }

    // Current file was deleted — skip to its former position immediately
    if (currentFile && !mediaFiles.find(f => f.name === currentFile.name)) {
      currentIndex = currentIndex % mediaFiles.length;
      showCurrentMedia();
      return;
    }

    // Keep currentIndex tracking the same file even if order changed
    if (currentFile) {
      const newIdx = mediaFiles.findIndex(f => f.name === currentFile.name);
      if (newIdx !== -1) currentIndex = newIdx;
    }

    if (currentIndex >= mediaFiles.length) currentIndex = 0;

    // Duration changed for the currently playing video — update the timer live
    if (currentVideoEl && currentFile) {
      const updatedFile = mediaFiles[currentIndex];
      if (updatedFile && updatedFile.duration !== currentFile.duration) {
        clearTimeout(videoTimer);
        if (updatedFile.duration != null) {
          const elapsed = currentVideoEl.currentTime;
          const remaining = Math.max(0, updatedFile.duration - elapsed);
          if (remaining <= 0) {
            currentVideoEl.pause();
            showNextMedia();
          } else {
            videoTimer = setTimeout(() => {
              currentVideoEl.pause();
              showNextMedia();
            }, remaining * 1000);
          }
        }
      }
    }
  } catch (error) {
    mediaArea.innerHTML = `
      <div class="placeholder">
        <h1>Error loading media</h1>
        <p>Please check the server.</p>
      </div>
    `;
  }
}

/*
  reportCurrent — tells the server which file is currently on screen.
  The dashboard polls GET /api/media/current every 2 seconds and uses this
  value to highlight the active file in the media library. Without this POST,
  the dashboard never knows what is playing and the "Live" indicator stays off.
  Errors are silently swallowed so a network hiccup does not interrupt playback.
*/
function reportCurrent(name) {
  fetch("/api/media/current", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name || null }),
  }).catch(() => {});
}

function showPlaceholder() {
  clearTimeout(imageTimer);
  reportCurrent(null);

  mediaArea.innerHTML = `
    <div class="placeholder">
      <h1>A3 Info Screen</h1>
      <p>No media uploaded yet.</p>
      <p class="small-text">Upload images or videos from the dashboard.</p>
    </div>
  `;
}

/*
  showCurrentMedia — renders the current file and sets the timer to advance
  to the next one when it is time.

  For images: uses the per-file duration from durations.json if set,
  otherwise falls back to imageDuration from config.
  For videos: plays until the video ends naturally (onended), or until the
  per-file duration timer fires — whichever comes first. The timer is started
  on the "play" event (not immediately) so it counts from when the video
  actually starts playing, not from when the element was created.

  currentVideoEl is kept so loadMediaFiles can recalculate a live timer
  change using the video's current playback position.
*/
function showCurrentMedia() {
  clearTimeout(imageTimer);
  clearTimeout(videoTimer);

  if (mediaFiles.length === 0) {
    showPlaceholder();
    return;
  }

  const file = mediaFiles[currentIndex];
  const isVideo = file.type === ".mp4" || file.type === ".mov";

  reportCurrent(file.name);
  currentVideoEl = null;

  const oldEl = mediaArea.querySelector(".media-item");
  let newEl;

  if (isVideo) {
    const video = document.createElement("video");
    video.src = file.url;
    video.autoplay = true;
    video.muted = true;
    video.controls = false;
    video.className = "media-item";
    currentVideoEl = video;

    video.onended = () => {
      clearTimeout(videoTimer);
      showNextMedia();
    };

    video.onerror = () => {
      clearTimeout(videoTimer);
      showNextMedia();
    };

    const videoCap = file.duration != null ? file.duration : maxVideoDuration;
    video.addEventListener("play", () => {
      videoTimer = setTimeout(() => {
        video.pause();
        showNextMedia();
      }, videoCap * 1000);
    }, { once: true });

    newEl = video;
  } else {
    const image = document.createElement("img");
    image.src = file.url;
    image.alt = file.name;
    image.className = "media-item";
    image.onerror = showNextMedia;

    // Pick a random Ken Burns pattern and run it for the full slide duration
    const kbVariants = ["kb-1", "kb-2", "kb-3", "kb-4"];
    image.classList.add(kbVariants[Math.floor(Math.random() * kbVariants.length)]);
    const slideSecs = file.duration != null ? file.duration : imageDuration / 1000;
    image.style.animationDuration = slideSecs + "s";

    imageTimer = setTimeout(showNextMedia, slideSecs * 1000);

    newEl = image;
  }

  // Append new element (invisible), force reflow, then fade it in
  mediaArea.appendChild(newEl);
  newEl.getBoundingClientRect();
  newEl.classList.add("active");

  // Fade out old element and remove it after the transition finishes
  if (oldEl) {
    oldEl.classList.remove("active");
    setTimeout(() => {
      if (oldEl.parentNode === mediaArea) oldEl.remove();
    }, 1000);
  }
}

function showNextMedia() {
  if (mediaFiles.length === 0) {
    showPlaceholder();
    return;
  }
  currentIndex = (currentIndex + 1) % mediaFiles.length;
  showCurrentMedia();
}

/*
  startSlideshow — entry point. Config is loaded first so imageDuration is set
  correctly before the first file is displayed. If loadConfig is skipped the
  first image would always show for the hardcoded 10s default even if config.json
  says otherwise.
*/
async function startSlideshow() {
  await loadConfig();
  await loadMediaFiles(true);
}

/*
  checkAlert — polls the server for an active emergency alert.
  When a message is set, it overlays the entire screen so it is impossible
  to miss. Clears automatically when the dashboard user removes the message.
*/
async function checkAlert() {
  try {
    const res = await fetch("/api/alert");
    if (!res.ok) return;
    const data = await res.json();
    const overlay = document.getElementById("alertOverlay");
    const alertText = document.getElementById("alertText");
    if (data.message) {
      alertText.textContent = data.message;
      overlay.hidden = false;
    } else {
      overlay.hidden = true;
    }
  } catch {}
}

updateClock();
setInterval(updateClock, 1000);

startSlideshow();
checkAlert();

setInterval(() => {
  loadConfig();
  loadMediaFiles(false);
}, refreshInterval);

setInterval(checkAlert, 5000);
