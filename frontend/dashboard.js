/*
  Dashboard frontend logic.
  This file controls media upload, media listing, and delete actions.
*/
const uploadForm = document.getElementById("uploadForm");
const mediaFileInput = document.getElementById("mediaFile");
const uploadMessage = document.getElementById("uploadMessage");
const fileList = document.getElementById("fileList");
const durationRow = document.getElementById("durationRow");
const videoDurationSlider = document.getElementById("videoDurationSlider");
const videoDurationValue = document.getElementById("videoDurationValue");
const refreshInterval = 5000;

mediaFileInput.addEventListener("change", () => {
  const file = mediaFileInput.files[0];
  if (!file) return;
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (ext === ".mp4") {
    durationRow.style.display = "block";
  } else {
    durationRow.style.display = "none";
    videoDurationSlider.value = 60;
    videoDurationValue.textContent = "60";
  }
});

videoDurationSlider.addEventListener("input", () => {
  videoDurationValue.textContent = videoDurationSlider.value;
});

/*
  Loads uploaded files from the backend and displays them in the dashboard.
  This makes the dashboard show the same media list that the slideshow uses.
*/
async function loadFiles() {
  try {
    const response = await fetch("/api/media");

    if (!response.ok) {
      fileList.innerHTML = "<li>Could not load files.</li>";
      return;
    }

    const files = await response.json();

    fileList.innerHTML = "";

    if (files.length === 0) {
      fileList.innerHTML = "<li>No files uploaded yet.</li>";
      return;
    }

    files.forEach((file) => {
      const listItem = document.createElement("li");

      const fileName = document.createElement("span");
      fileName.textContent = file.name;

      listItem.appendChild(fileName);

      if (file.type === ".mp4" && file.duration != null) {
        const durationBadge = document.createElement("span");
        durationBadge.textContent = `${file.duration}s`;
        durationBadge.className = "duration-badge";
        listItem.appendChild(durationBadge);
      }

      const deleteButton = document.createElement("button");
      deleteButton.className = "button button--delete";
      deleteButton.innerHTML = `
        <div class="wave"></div>
        <div class="wave"></div>
        <div class="wave"></div>
        <div class="wave"></div>
        <div class="fish"></div>
        <div class="bubble"></div>
        <div class="bubble"></div>
        <div class="bubble"></div>
        <div class="bubble"></div>
        <span class="button__text">Delete</span>
      `;

      deleteButton.addEventListener("click", async () => {
        const confirmDelete = confirm(`Delete ${file.name}?`);

        if (!confirmDelete) {
          return;
        }

        try {
          const response = await fetch(`/api/media/${encodeURIComponent(file.name)}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok) {
            uploadMessage.textContent = result.error || "Delete failed.";
            return;
          }

          uploadMessage.textContent = `Deleted: ${result.file}`;
          await loadFiles();
        } catch (error) {
          uploadMessage.textContent = "Delete failed. Please check your connection.";
        }
      });

      listItem.appendChild(deleteButton);
      fileList.appendChild(listItem);
    });
  } catch (error) {
    fileList.innerHTML = "<li>Could not load files.</li>";
  }
}

/*
  Sends the selected file to the backend when the user uploads media.
  The backend saves the file and the dashboard reloads the media list.
*/
uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = mediaFileInput.files[0];

  if (!file) {
    uploadMessage.textContent = "Please choose a file first.";
    return;
  }

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".mp4"];
  const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    uploadMessage.textContent = "Only JPG, PNG, and MP4 files are allowed.";
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    uploadMessage.textContent = "File is too large. Maximum size is 100MB.";
    return;
  }

  const formData = new FormData();
  formData.append("media", file);

  if (fileExt === ".mp4") {
    formData.append("duration", videoDurationSlider.value);
  }

  uploadMessage.textContent = "Uploading...";

  try {
    const response = await fetch("/api/media", {
      method: "POST",
      body: formData,
    });

    let result;
    try {
      result = await response.json();
    } catch (e) {
      uploadMessage.textContent = "Upload failed. Unexpected server response.";
      return;
    }

    if (!response.ok) {
      uploadMessage.textContent = result.error || "Upload failed.";
      return;
    }

    uploadMessage.textContent = `Uploaded: ${result.file}`;
    mediaFileInput.value = "";
    durationRow.style.display = "none";
    videoDurationSlider.value = 60;
    videoDurationValue.textContent = "60";
    await loadFiles();
  } catch (error) {
    uploadMessage.textContent = "Upload failed. Please check your connection.";
  }
});

loadFiles();

/*
  Refreshes the dashboard file list automatically.
  This helps multiple devices stay updated when files are uploaded or deleted.
*/
setInterval(loadFiles, refreshInterval);
