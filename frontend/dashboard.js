/*
  apiFetch — wraps fetch for write API calls. If the server returns 401
  (session expired while the page was open), redirects to login so the user
  is not left staring at a silent failure.
*/
async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = "/login.html";
    return null;
  }
  return res;
}

// Show the logout button only when a password is configured
fetch("/api/auth/status").then(r => r.json()).then(data => {
  const btn = document.getElementById("logoutBtn");
  if (data.authenticated && btn) btn.hidden = false;
}).catch(() => {});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
});

const uploadForm      = document.getElementById("uploadForm");
const mediaFileInput  = document.getElementById("mediaFile");
const uploadMessage   = document.getElementById("uploadMessage");
const fileList        = document.getElementById("fileList");
const fileCountBadge  = document.getElementById("fileCount");
const durationRow     = document.getElementById("durationRow");
const videoDurationSlider = document.getElementById("videoDurationSlider");
const videoDurationValue  = document.getElementById("videoDurationValue");
const dropZone        = document.getElementById("dropZone");
const dropIdle        = document.getElementById("dropIdle");
const dropSelected    = document.getElementById("dropSelected");
const filePreview     = document.getElementById("filePreview");

/*
  refreshInterval — how often the file list is reloaded from the server.
  5 seconds keeps the dashboard in sync with changes made from other devices
  (e.g. another tab or a future multi-user scenario) without overloading the Pi.
*/
const refreshInterval = 5000;
let selectedFiles = [];

// ── Drop zone ─────────────────────────────────────────────────────────────

/*
  setSelectedFiles — updates the selected files array and re-renders the drop
  zone. Supports single or multiple files. Duration slider is shown only when
  a single file is selected (multiple uploads use each file's default duration).
*/
function setSelectedFiles(files) {
  selectedFiles = Array.from(files);
  renderDropZone();
  renderDurationRow();
}

function clearSelectedFiles() {
  selectedFiles = [];
  mediaFileInput.value = "";
  renderDropZone();
  renderDurationRow();
}

function renderDropZone() {
  if (selectedFiles.length === 0) {
    dropIdle.hidden = false;
    dropSelected.hidden = true;
    return;
  }

  dropIdle.hidden = true;
  dropSelected.hidden = false;

  if (selectedFiles.length === 1) {
    const file = selectedFiles[0];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isVideo = ext === ".mp4" || ext === ".mov";
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);

    const icon = isVideo
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
         </svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
         </svg>`;

    filePreview.innerHTML = `
      <div class="file-preview__icon file-preview__icon--${isVideo ? "video" : "image"}">${icon}</div>
      <div class="file-preview__info">
        <span class="file-preview__name">${file.name}</span>
        <span class="file-preview__meta">${ext.slice(1).toUpperCase()} &middot; ${sizeMB} MB</span>
      </div>
      <button type="button" class="file-preview__clear" id="clearFileBtn" aria-label="Remove selected file">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    document.getElementById("clearFileBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      clearSelectedFiles();
    });
  } else {
    const totalMB = (selectedFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1);
    const names = selectedFiles.map(f => {
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      const sizeMB = (f.size / 1024 / 1024).toFixed(1);
      return `<li class="multi-file-item">${f.name} <span class="multi-file-meta">${ext.slice(1).toUpperCase()} · ${sizeMB} MB</span></li>`;
    }).join("");

    filePreview.innerHTML = `
      <div class="multi-file-header">
        <span class="multi-file-count">${selectedFiles.length} files selected &mdash; ${totalMB} MB total</span>
        <button type="button" class="file-preview__clear" id="clearFileBtn" aria-label="Remove selected files">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <ul class="multi-file-list">${names}</ul>
    `;
    document.getElementById("clearFileBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      clearSelectedFiles();
    });
  }
}

/*
  renderDurationRow — shows the duration slider for single-file uploads only.
  Videos default to the max (60s from config), images default to imageDurationSeconds.
  For multi-file uploads the slider is hidden and each file gets its type default.
*/
function renderDurationRow() {
  if (selectedFiles.length !== 1) {
    durationRow.hidden = true;
    return;
  }
  durationRow.hidden = false;
  const file = selectedFiles[0];
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  const isVideo = ext === ".mp4" || ext === ".mov";
  const defaultVal = isVideo ? maxVideoDuration : defaultImageDuration;
  videoDurationSlider.value = defaultVal;
  videoDurationValue.textContent = defaultVal;
}

dropZone.addEventListener("click", (e) => {
  if (e.target.closest("#clearFileBtn")) return;
  mediaFileInput.click();
});

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    mediaFileInput.click();
  }
});

mediaFileInput.addEventListener("change", () => {
  if (mediaFileInput.files.length > 0) setSelectedFiles(mediaFileInput.files);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files.length > 0) setSelectedFiles(e.dataTransfer.files);
});

videoDurationSlider.addEventListener("input", () => {
  videoDurationValue.textContent = videoDurationSlider.value;
});

// ── Duration popover ──────────────────────────────────────────────────────

/*
  openDurationEditor — shows a floating popover slider to edit a file's duration.
  Uses PATCH /api/media/:filename/duration instead of re-uploading the file.
  The popover is positioned below the badge and flips above it if there is not
  enough space at the bottom of the viewport. Only one popover can be open at
  a time; opening a new one closes the previous one automatically.
  The setTimeout(0) on outside-click listeners prevents the same click that
  opened the popover from immediately closing it.
*/
let activeDurationPopover = null;
let isDragging = false;

function closeDurationPopover() {
  if (activeDurationPopover) {
    activeDurationPopover.remove();
    activeDurationPopover = null;
  }
}

function openDurationEditor(badge, file, maxDuration) {
  closeDurationPopover();

  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  const isVideo = ext === ".mp4" || ext === ".mov";
  const current = file.duration ?? maxDuration;

  const popover = document.createElement("div");
  popover.className = "duration-popover";
  popover.innerHTML = `
    <div class="duration-popover__title">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Display duration
    </div>
    <div class="duration-popover__value-line">
      <span class="duration-popover__value">${current}</span>
      <span class="duration-popover__unit">seconds</span>
    </div>
    <input type="range" min="5" max="${maxDuration}" value="${current}">
    <div class="duration-popover__warning" hidden></div>
    <div class="duration-popover__ticks"><span>5s</span><span>${maxDuration}s</span></div>
    <div class="duration-popover__actions">
      <button class="duration-popover__btn duration-popover__btn--cancel">Cancel</button>
      <button class="duration-popover__btn duration-popover__btn--save">Save</button>
    </div>
  `;

  const rect = badge.getBoundingClientRect();
  const popoverWidth = 248;
  let top = rect.bottom + 8;
  let left = rect.left;
  if (top + 190 > window.innerHeight) top = rect.top - 190 - 8;
  if (left + popoverWidth > window.innerWidth - 8) left = window.innerWidth - popoverWidth - 8;
  popover.style.top = top + "px";
  popover.style.left = left + "px";

  document.body.appendChild(popover);
  activeDurationPopover = popover;

  const slider = popover.querySelector("input[type=range]");
  const valueDisplay = popover.querySelector(".duration-popover__value");
  const warning = popover.querySelector(".duration-popover__warning");

  let actualVideoDuration = null;

  if (isVideo) {
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = file.url;
    tempVideo.addEventListener("loadedmetadata", () => {
      actualVideoDuration = Math.floor(tempVideo.duration);
      checkWarning(parseInt(slider.value));
    });
  }

  function checkWarning(val) {
    if (actualVideoDuration !== null && val > actualVideoDuration) {
      warning.textContent = `Video is only ${actualVideoDuration}s long — extra time will be ignored.`;
      warning.hidden = false;
    } else {
      warning.hidden = true;
    }
  }

  slider.addEventListener("input", () => {
    valueDisplay.textContent = slider.value;
    checkWarning(parseInt(slider.value));
  });

  popover.querySelector(".duration-popover__btn--cancel").addEventListener("click", closeDurationPopover);

  popover.querySelector(".duration-popover__btn--save").addEventListener("click", async () => {
    const newDuration = parseInt(slider.value);
    closeDurationPopover();
    try {
      const res = await apiFetch(`/api/media/${encodeURIComponent(file.name)}/duration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: newDuration }),
      });
      if (!res) return;
      let result;
      try { result = await res.json(); } catch { result = {}; }
      if (!res.ok) {
        showMessage(result.error || "Could not save duration.", "error");
        return;
      }
      file.duration = result.duration;
      badge.querySelector(".duration-badge__value").textContent = result.duration;
      showMessage(`Duration updated to ${result.duration}s.`, "success");
    } catch {
      showMessage("Could not save duration. Please check your connection.", "error");
    }
  });

  function onOutsideClick(e) {
    if (!popover.contains(e.target) && e.target !== badge) {
      closeDurationPopover();
      document.removeEventListener("pointerdown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    }
  }
  function onEscape(e) {
    if (e.key === "Escape") {
      closeDurationPopover();
      document.removeEventListener("pointerdown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    }
  }
  setTimeout(() => {
    document.addEventListener("pointerdown", onOutsideClick);
    document.addEventListener("keydown", onEscape);
  }, 0);
}

// ── File list ─────────────────────────────────────────────────────────────

function fileIcon(ext) {
  if (ext === ".mp4" || ext === ".mov") {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>`;
}

function updateOrderNumbers() {
  fileList.querySelectorAll(".file-item").forEach((item, i) => {
    const badge = item.querySelector(".file-item__order");
    if (badge) badge.textContent = i + 1;
  });
}

/*
  persistOrder — saves the current DOM order of files to the server.
  Called after every drag-and-drop so the slideshow picks up the new order
  on its next refresh cycle. Without this the reorder only affects the dashboard
  view and resets the next time loadFiles() runs.
*/
async function persistOrder() {
  const order = [...fileList.querySelectorAll(".file-item")].map(li => li.dataset.filename);
  try {
    const res = await apiFetch("/api/media/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    if (res && !res.ok) showMessage("Order could not be saved. It will reset on next refresh.", "error");
  } catch {
    showMessage("Order could not be saved. Please check your connection.", "error");
  }
}

/*
  buildFileItem — creates a single <li> row for the media library.
  Each row contains: drag handle, order number, thumbnail, file info,
  "Live" badge (hidden unless active), visibility toggle, duration badge,
  and delete button. Disabled files are shown greyed out.
*/
function buildFileItem(file, index, maxDuration) {
  const li = document.createElement("li");
  li.className = "file-item";
  if (file.enabled === false) li.classList.add("file-item--disabled");
  li.dataset.filename = file.name;

  const ext = file.type;
  const isVideo = ext === ".mp4" || ext === ".mov";

  li.innerHTML = `
    <div class="drag-handle" aria-label="Drag to reorder">
      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
        <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
        <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
        <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
      </svg>
    </div>
    <span class="file-item__order">${index + 1}</span>
    <div class="file-item__thumb file-item__thumb--${isVideo ? "video" : "image"}">
      ${file.thumbnail
        ? `<img class="file-item__thumb-img" src="${file.thumbnail}" alt="">`
        : `<div class="file-item__thumb-icon">${fileIcon(ext)}</div>`}
    </div>
    <div class="file-item__info">
      <span class="file-item__name" title="${file.name}">${file.name}</span>
      <span class="file-item__meta">${ext.slice(1).toUpperCase()}</span>
    </div>
    <span class="now-showing-badge">
      <span class="now-showing-badge__dot"></span>
      Live
    </span>
  `;

  if (file.thumbnail) {
    const img = li.querySelector(".file-item__thumb-img");
    img.onerror = () => {
      img.replaceWith(Object.assign(document.createElement("div"), {
        className: "file-item__thumb-icon",
        innerHTML: fileIcon(ext),
      }));
    };
  }

  // Visibility toggle button
  const toggleBtn = document.createElement("button");
  const isEnabled = file.enabled !== false;
  toggleBtn.className = `file-toggle ${isEnabled ? "file-toggle--on" : "file-toggle--off"}`;
  toggleBtn.title = isEnabled ? "Visible — click to hide" : "Hidden — click to show";
  toggleBtn.innerHTML = isEnabled
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  toggleBtn.addEventListener("click", async () => {
    const newEnabled = file.enabled === false;
    const res = await apiFetch(`/api/media/${encodeURIComponent(file.name)}/enabled`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newEnabled }),
    });
    if (!res) return;
    if (res.ok) {
      file.enabled = newEnabled;
      li.classList.toggle("file-item--disabled", !newEnabled);
      toggleBtn.className = `file-toggle ${newEnabled ? "file-toggle--on" : "file-toggle--off"}`;
      toggleBtn.title = newEnabled ? "Visible — click to hide" : "Hidden — click to show";
      toggleBtn.innerHTML = newEnabled
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    }
  });
  li.appendChild(toggleBtn);

  const badgeDefault = isVideo ? (file.duration ?? maxDuration) : (file.duration ?? defaultImageDuration);
  const badge = document.createElement("span");
  badge.className = "duration-badge";
  badge.title = "Click to edit display duration";
  badge.innerHTML = `
    <span class="duration-badge__value">${badgeDefault}</span>s
    <svg class="duration-badge__edit-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  `;
  badge.addEventListener("click", () => openDurationEditor(badge, file, maxDuration));
  li.appendChild(badge);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "button button--delete";
  deleteBtn.innerHTML = `
    <div class="wave"></div><div class="wave"></div>
    <div class="wave"></div><div class="wave"></div>
    <div class="fish"></div>
    <div class="bubble"></div><div class="bubble"></div>
    <div class="bubble"></div><div class="bubble"></div>
    <span class="button__text">Delete</span>
  `;

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete ${file.name}?`)) return;
    try {
      const res = await apiFetch(`/api/media/${encodeURIComponent(file.name)}`, { method: "DELETE" });
      if (!res) return;
      let result;
      try { result = await res.json(); } catch { result = {}; }
      if (!res.ok) { showMessage(result.error || "Delete failed.", "error"); return; }
      showMessage(`Deleted: ${result.file}`, "success");
      await loadFiles();
    } catch {
      showMessage("Delete failed. Please check your connection.", "error");
    }
  });

  li.appendChild(deleteBtn);

  /*
    Drag-to-reorder — custom pointer-based drag, not the native HTML drag API.
    Native drag API has poor cross-browser behaviour for list reordering and
    does not work in some kiosk/touch environments. This approach:
      1. Clones the item as a "ghost" that follows the pointer visually.
      2. Hides the original with drag-placeholder styling (keeps the space).
      3. Inserts the real item before the first candidate whose midpoint is
         below the pointer, so the list reorders in real time during drag.
      4. On release, saves the new order to the server via persistOrder().
  */
  const handle = li.querySelector(".drag-handle");
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    isDragging = true;
    closeDurationPopover();

    const rect = li.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;

    const ghost = li.cloneNode(true);
    ghost.className = "file-item drag-ghost";
    ghost.style.width = rect.width + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.left = rect.left + "px";
    document.body.appendChild(ghost);

    li.classList.add("drag-placeholder");

    let lastTarget = null;

    function onMove(e) {
      ghost.style.top = (e.clientY - offsetY) + "px";

      const candidates = [...fileList.querySelectorAll(".file-item:not(.drag-placeholder)")];
      let newTarget = null;
      for (const item of candidates) {
        const r = item.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          newTarget = item;
          break;
        }
      }

      if (newTarget !== lastTarget) {
        lastTarget = newTarget;
        if (newTarget) {
          fileList.insertBefore(li, newTarget);
        } else {
          fileList.appendChild(li);
        }
        updateOrderNumbers();
      }
    }

    async function onUp() {
      isDragging = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      ghost.remove();
      li.classList.remove("drag-placeholder");
      updateOrderNumbers();
      await persistOrder();
      await loadFiles();
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });

  return li;
}

/*
  maxVideoDuration and defaultImageDuration are read from /api/config on every
  loadFiles() call so that changes to config.json take effect without restarting
  the server or refreshing the page. They are used as the defaults for duration
  badges and the upload slider.
*/
let maxVideoDuration = 60;
let defaultImageDuration = 10;

/*
  loadFiles — fetches the media list and config together, then rebuilds the
  file list DOM. Both requests run in parallel (Promise.all) to save time.
  After building the list, updateNowShowing() is called immediately so the
  active file is highlighted right away instead of waiting up to 2 seconds
  for the next polling interval to fire.
*/
async function loadFiles() {
  if (isDragging) return;
  try {
    const [mediaRes, configRes] = await Promise.all([
      fetch("/api/media"),
      fetch("/api/config"),
    ]);

    if (configRes.ok) {
      const cfg = await configRes.json().catch(() => ({}));
      if (cfg.maxVideoDurationSeconds) maxVideoDuration = cfg.maxVideoDurationSeconds;
      if (cfg.imageDurationSeconds) defaultImageDuration = cfg.imageDurationSeconds;
    }

    if (!mediaRes.ok) {
      fileList.innerHTML = '<li class="file-list__empty"><span>Could not load files.</span></li>';
      return;
    }

    const files = await mediaRes.json();
    fileList.innerHTML = "";

    fileCountBadge.hidden = files.length === 0;
    fileCountBadge.textContent = files.length === 1 ? "1 file" : `${files.length} files`;

    if (files.length === 0) {
      fileList.innerHTML = `<li class="file-list__empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
        <span>No files uploaded yet</span>
      </li>`;
      return;
    }

    files.forEach((file, index) => fileList.appendChild(buildFileItem(file, index, maxVideoDuration)));
    await updateNowShowing();
  } catch {
    fileList.innerHTML = '<li class="file-list__empty"><span>Could not load files.</span></li>';
  }
}

// ── Upload ────────────────────────────────────────────────────────────────

function showMessage(text, type = "info") {
  uploadMessage.textContent = text;
  uploadMessage.className = `upload-msg upload-msg--${type}`;
}

/*
  uploadSingleFile — uploads one file and returns true on success.
  Used by the upload handler to process files one at a time so the server
  is not overwhelmed and progress can be reported per-file.
*/
async function uploadSingleFile(file, duration) {
  const formData = new FormData();
  formData.append("media", file);
  formData.append("duration", duration);

  const response = await apiFetch("/api/media", { method: "POST", body: formData });
  if (!response) return false;
  let result;
  try { result = await response.json(); } catch {
    showMessage("Upload failed. Unexpected server response.", "error");
    return false;
  }
  if (!response.ok) {
    showMessage(`${file.name}: ${result.error || "Upload failed."}`, "error");
    return false;
  }
  return true;
}

/*
  Upload handler — validates files on the client before sending to the server.
  Client-side checks (extension, size) give instant feedback without a network
  round-trip. The server still validates independently, so these are a UX layer
  only, not a security boundary.
  For multiple files, uploads proceed sequentially and a summary is shown at the end.
*/
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (selectedFiles.length === 0) {
    showMessage("Please select or drop a file first.", "error");
    return;
  }

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".mp4", ".mov"];
  for (const file of selectedFiles) {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      showMessage(`${file.name}: only JPG, PNG, MP4, and MOV files are allowed.`, "error");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      showMessage(`${file.name}: file is too large (max 100 MB).`, "error");
      return;
    }
  }

  const uploadBtn = document.getElementById("uploadBtn");
  uploadBtn.disabled = true;

  const duration = selectedFiles.length === 1 ? videoDurationSlider.value : maxVideoDuration;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isVideo = ext === ".mp4" || ext === ".mov";
    const label = selectedFiles.length > 1 ? `(${i + 1}/${selectedFiles.length}) ` : "";
    showMessage(`${label}${isVideo ? "Processing" : "Uploading"} ${file.name}…`, "info");

    const ok = await uploadSingleFile(file, duration);
    if (ok === false && !document.body.contains(uploadBtn)) return; // redirected to login
    if (ok) { succeeded++; } else { failed++; }
  }

  if (selectedFiles.length === 1) {
    if (succeeded) showMessage(`Uploaded: ${selectedFiles[0].name}`, "success");
  } else {
    if (failed === 0) {
      showMessage(`All ${succeeded} files uploaded successfully.`, "success");
    } else if (succeeded === 0) {
      showMessage(`All ${failed} files failed to upload.`, "error");
    } else {
      showMessage(`${succeeded} uploaded, ${failed} failed.`, "error");
    }
  }

  clearSelectedFiles();
  uploadBtn.disabled = false;
  await loadFiles();
});

/*
  updateNowShowing — polls the server for the currently playing file and
  applies the .file-item--active class to the matching row.
  This is called both on the 2-second interval AND immediately after loadFiles()
  rebuilds the DOM, because loadFiles() wipes all classes with innerHTML = "".
  Without the immediate call after loadFiles(), the active highlight would
  disappear for up to 2 seconds every time the list refreshes.
*/
async function updateNowShowing() {
  try {
    const res = await fetch("/api/media/current");
    if (!res.ok) return;
    const data = await res.json();
    const name = data.name || null;
    document.querySelectorAll(".file-item").forEach(li => {
      li.classList.toggle("file-item--active", !!name && li.dataset.filename === name);
    });
  } catch {}
}

// ── Emergency alert ───────────────────────────────────────────────────────

async function loadAlert() {
  try {
    const res = await fetch("/api/alert");
    if (!res.ok) return;
    const data = await res.json();
    const badge = document.getElementById("alertActiveBadge");
    const status = document.getElementById("alertStatus");
    const statusText = document.getElementById("alertCurrentText");
    const clearBtn = document.getElementById("clearAlertBtn");
    if (data.message) {
      badge.hidden = false;
      status.hidden = false;
      statusText.textContent = `"${data.message}"`;
      clearBtn.hidden = false;
    } else {
      badge.hidden = true;
      status.hidden = true;
      clearBtn.hidden = true;
    }
  } catch {}
}

async function activateAlert(message) {
  const res = await apiFetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res) return;
  if (res.ok) {
    document.getElementById("alertInput").value = "";
    await loadAlert();
  }
}

document.getElementById("activateAlertBtn").addEventListener("click", async () => {
  const message = document.getElementById("alertInput").value.trim();
  if (!message) return;
  await activateAlert(message);
});

document.querySelectorAll(".alert-preset-btn").forEach(btn => {
  btn.addEventListener("click", () => activateAlert(btn.dataset.message));
});

document.getElementById("clearAlertBtn").addEventListener("click", async () => {
  const res = await apiFetch("/api/alert", { method: "DELETE" });
  if (!res) return;
  if (res.ok) await loadAlert();
});

// ── QR code ───────────────────────────────────────────────────────────────

async function loadQrConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const config = await res.json();
    const input = document.getElementById("qrUrlInput");
    if (input && config.qrUrl) input.value = config.qrUrl;
  } catch {}
}

document.getElementById("saveQrBtn").addEventListener("click", async () => {
  const url = document.getElementById("qrUrlInput").value.trim();
  const msg = document.getElementById("qrMessage");
  const res = await apiFetch("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qrUrl: url }),
  });
  if (!res) return;
  if (res.ok) {
    msg.textContent = url ? "QR code saved." : "QR code cleared.";
    msg.className = "upload-msg upload-msg--success";
  } else {
    msg.textContent = "Could not save.";
    msg.className = "upload-msg upload-msg--error";
  }
});

document.getElementById("clearQrBtn").addEventListener("click", () => {
  document.getElementById("qrUrlInput").value = "";
  document.getElementById("saveQrBtn").click();
});

// ── Init ──────────────────────────────────────────────────────────────────

loadFiles();
updateNowShowing();
loadAlert();
loadQrConfig();

setInterval(loadFiles, refreshInterval);
setInterval(updateNowShowing, 2000);
