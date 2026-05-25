/*
  Slideshow frontend logic.
  This file controls what is shown on the A3 info screen.
*/
const mediaArea = document.getElementById("mediaArea");

let mediaFiles = [];
let currentIndex = 0;
let imageTimer = null;
let videoTimer = null;
let imageDuration = 10000;
let currentVideoEl = null;
const refreshInterval = 5000;

/*
  Updates the clock shown at the bottom of the slideshow screen.
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
  Loads slideshow settings from the backend.
  This makes image duration configurable through config.json.
*/
async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();

    if (config.imageDurationSeconds) {
      imageDuration = config.imageDurationSeconds * 1000;
    }
  } catch (error) {
    imageDuration = 10000;
  }
}

/*
  Loads the uploaded media list from the backend.
  The slideshow uses this list to decide which image or video to show.
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
    const newMediaFiles = await response.json();

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
  Shows a default message when no media has been uploaded yet.
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
  Displays the current media item.
  Images stay on screen for the configured duration.
  Videos play until they finish.
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
  mediaArea.innerHTML = "";
  currentVideoEl = null;

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

    if (file.duration != null) {
      video.addEventListener("play", () => {
        videoTimer = setTimeout(() => {
          video.pause();
          showNextMedia();
        }, file.duration * 1000);
      }, { once: true });
    }

    mediaArea.appendChild(video);
  } else {
    const image = document.createElement("img");
    image.src = file.url;
    image.alt = file.name;
    image.className = "media-item";

    image.onerror = showNextMedia;

    mediaArea.appendChild(image);

    imageTimer = setTimeout(showNextMedia, file.duration != null ? file.duration * 1000 : imageDuration);
  }
}

/*
  Moves the slideshow to the next uploaded media item.
*/
function showNextMedia() {
  if (mediaFiles.length === 0) {
    showPlaceholder();
    return;
  }
  currentIndex = (currentIndex + 1) % mediaFiles.length;
  showCurrentMedia();
}

/*
  Starts the slideshow by loading settings first and then loading media files.
*/
async function startSlideshow() {
  await loadConfig();
  await loadMediaFiles(true);
}

updateClock();
setInterval(updateClock, 1000);

startSlideshow();

/*
  Checks for updated settings and new media regularly.
  This lets the info screen update without manual refresh.
*/
setInterval(() => {
  loadConfig();
  loadMediaFiles(false);
}, refreshInterval);
