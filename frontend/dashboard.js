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

const refreshInterval = 5000;
let selectedFile = null;

// ── Drop zone ─────────────────────────────────────────────────────────────

function setSelectedFile(file) {
  selectedFile = file;
  renderDropZone();
  renderDurationRow();
}

function clearSelectedFile() {
  selectedFile = null;
  mediaFileInput.value = "";
  renderDropZone();
  renderDurationRow();
}

function renderDropZone() {
  if (!selectedFile) {
    dropIdle.hidden = false;
    dropSelected.hidden = true;
    return;
  }

  const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
  const isVideo = ext === ".mp4" || ext === ".mov";
  const sizeMB = (selectedFile.size / 1024 / 1024).toFixed(1);

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
      <span class="file-preview__name">${selectedFile.name}</span>
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
    clearSelectedFile();
  });

  dropIdle.hidden = true;
  dropSelected.hidden = false;
}

function renderDurationRow() {
  if (!selectedFile) {
    durationRow.hidden = true;
    return;
  }
  const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
  if (ext === ".mp4" || ext === ".mov") {
    durationRow.hidden = false;
  } else {
    durationRow.hidden = true;
    videoDurationSlider.value = 60;
    videoDurationValue.textContent = "60";
  }
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
  if (mediaFileInput.files[0]) setSelectedFile(mediaFileInput.files[0]);
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
  const file = e.dataTransfer.files[0];
  if (file) setSelectedFile(file);
});

videoDurationSlider.addEventListener("input", () => {
  videoDurationValue.textContent = videoDurationSlider.value;
});

// ── File list ─────────────────────────────────────────────────────────────

function fileIcon(ext) {
  if (ext === ".mp4") {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>`;
}

async function loadFiles() {
  try {
    const response = await fetch("/api/media");
    if (!response.ok) {
      fileList.innerHTML = '<li class="file-list__empty"><span>Could not load files.</span></li>';
      return;
    }

    const files = await response.json();
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

    files.forEach((file) => {
      const li = document.createElement("li");
      li.className = "file-item";

      const ext = file.type;
      const isVideo = ext === ".mp4" || ext === ".mov";

      li.innerHTML = `
        <div class="file-item__icon file-item__icon--${isVideo ? "video" : "image"}">${fileIcon(ext)}</div>
        <div class="file-item__info">
          <span class="file-item__name" title="${file.name}">${file.name}</span>
          <span class="file-item__meta">${ext.slice(1).toUpperCase()}</span>
        </div>
        ${isVideo && file.duration != null ? `<span class="duration-badge">${file.duration}s</span>` : ""}
      `;

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
          const res = await fetch(`/api/media/${encodeURIComponent(file.name)}`, { method: "DELETE" });
          const result = await res.json();
          if (!res.ok) { showMessage(result.error || "Delete failed.", "error"); return; }
          showMessage(`Deleted: ${result.file}`, "success");
          await loadFiles();
        } catch {
          showMessage("Delete failed. Please check your connection.", "error");
        }
      });

      li.appendChild(deleteBtn);
      fileList.appendChild(li);
    });
  } catch {
    fileList.innerHTML = '<li class="file-list__empty"><span>Could not load files.</span></li>';
  }
}

// ── Upload ────────────────────────────────────────────────────────────────

function showMessage(text, type = "info") {
  uploadMessage.textContent = text;
  uploadMessage.className = `upload-msg upload-msg--${type}`;
}

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedFile) {
    showMessage("Please select or drop a file first.", "error");
    return;
  }

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".mp4", ".mov"];
  const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();

  if (!allowedExtensions.includes(fileExt)) {
    showMessage("Only JPG, PNG, MP4, and MOV files are allowed.", "error");
    return;
  }

  if (selectedFile.size > 100 * 1024 * 1024) {
    showMessage("File is too large. Maximum size is 100 MB.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("media", selectedFile);
  if (fileExt === ".mp4") formData.append("duration", videoDurationSlider.value);

  showMessage("Uploading…", "info");
  document.getElementById("uploadBtn").disabled = true;

  try {
    const response = await fetch("/api/media", { method: "POST", body: formData });
    let result;
    try { result = await response.json(); } catch {
      showMessage("Upload failed. Unexpected server response.", "error");
      return;
    }
    if (!response.ok) { showMessage(result.error || "Upload failed.", "error"); return; }
    showMessage(`Uploaded: ${result.file}`, "success");
    clearSelectedFile();
    videoDurationSlider.value = 60;
    videoDurationValue.textContent = "60";
    await loadFiles();
  } catch {
    showMessage("Upload failed. Please check your connection.", "error");
  } finally {
    document.getElementById("uploadBtn").disabled = false;
  }
});

loadFiles();
setInterval(loadFiles, refreshInterval);
