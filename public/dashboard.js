/*
  Dashboard frontend logic.
  This file controls media upload, media listing, and delete actions.
*/
const uploadForm = document.getElementById("uploadForm");
const mediaFileInput = document.getElementById("mediaFile");
const uploadMessage = document.getElementById("uploadMessage");
const fileList = document.getElementById("fileList");
const refreshInterval = 5000;

/*
  Loads uploaded files from the backend and displays them in the dashboard.
  This makes the dashboard show the same media list that the slideshow uses.
*/
async function loadFiles() {
  try {
    const response = await fetch("/api/media");
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

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete-button";

      /*
        Sends a delete request to the backend when the user removes a media file.
      */
      deleteButton.addEventListener("click", async () => {
        const confirmDelete = confirm(`Delete ${file.name}?`);

        if (!confirmDelete) {
          return;
        }

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
      });

      listItem.appendChild(fileName);
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

  const formData = new FormData();
  formData.append("media", file);

  uploadMessage.textContent = "Uploading...";

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      uploadMessage.textContent = result.error || "Upload failed.";
      return;
    }

    uploadMessage.textContent = `Uploaded successfully: ${result.file}`;
    mediaFileInput.value = "";
    await loadFiles();
  } catch (error) {
    uploadMessage.textContent = "Upload failed. Please try again.";
  }
});

loadFiles();

/*
  Refreshes the dashboard file list automatically.
  This helps multiple devices stay updated when files are uploaded or deleted.
*/
setInterval(loadFiles, refreshInterval);