const mediaArea = document.getElementById("mediaArea");

let mediaFiles = [];
let currentIndex = 0;
let imageTimer = null;

const imageDuration = 10000; 

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

async function loadMediaFiles(firstLoad = false) {
  try {
    const response = await fetch("/api/media");
    const newMediaFiles = await response.json();

    mediaFiles = newMediaFiles;

    if (mediaFiles.length === 0) {
      showPlaceholder();
      return;
    }

    
    if (firstLoad) {
      currentIndex = 0;
      showCurrentMedia();
    }

    
    if (currentIndex >= mediaFiles.length) {
      currentIndex = 0;
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

function showPlaceholder() {
  clearTimeout(imageTimer);

  mediaArea.innerHTML = `
    <div class="placeholder">
      <h1>A3 Info Screen</h1>
      <p>No media uploaded yet.</p>
      <p class="small-text">Upload images or videos from the dashboard.</p>
    </div>
  `;
}

function showCurrentMedia() {
  clearTimeout(imageTimer);

  if (mediaFiles.length === 0) {
    showPlaceholder();
    return;
  }

  const file = mediaFiles[currentIndex];
  const isVideo = file.type === ".mp4";

  mediaArea.innerHTML = "";

  if (isVideo) {
    const video = document.createElement("video");
    video.src = file.url;
    video.autoplay = true;
    video.muted = true;
    video.controls = false;
    video.className = "media-item";

    video.onended = showNextMedia;

    mediaArea.appendChild(video);
  } else {
    const image = document.createElement("img");
    image.src = file.url;
    image.alt = file.name;
    image.className = "media-item";

    mediaArea.appendChild(image);

    imageTimer = setTimeout(showNextMedia, imageDuration);
  }
}

function showNextMedia() {
  currentIndex = (currentIndex + 1) % mediaFiles.length;
  showCurrentMedia();
}

updateClock();
setInterval(updateClock, 1000);

// First load starts the slideshow
loadMediaFiles(true);

// Later checks for new uploaded files without restarting the slideshow
setInterval(() => {
  loadMediaFiles(false);
}, 30000);