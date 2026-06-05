# A3 Info Screen — User Guide

This guide explains how to manage the A3 corridor TV screen. No technical knowledge is needed.

---

## Accessing the dashboard

Open a web browser and go to:

```
http://a3info.project.tamk.cloud/dashboard.html
```

This works from any device — laptop, phone, or tablet — without needing to be on the school network.

If a password has been set, you will be asked to enter it before the dashboard loads.

---

## Uploading files

1. Click **Choose files** (or drag and drop files onto the upload area).
2. Select one or more images or videos from your device.
3. Click **Upload**.

The files will appear in the media list and start showing on the corridor TV within a few seconds.

**Supported formats:** JPG, PNG, GIF, MP4, MOV  
**Video limit:** Videos longer than 60 seconds are automatically trimmed to 60 seconds.

---

## Deleting files

Click the **trash icon** next to any file in the media list to delete it. The file is removed immediately and will no longer appear on the TV.

---

## Changing the order of slides

Click and drag any file in the media list to move it to a different position. The TV will follow the new order on the next refresh.

---

## Changing how long a slide is shown

Each file has a **clock icon** next to it. Click it to open the duration setting for that file.

- Drag the slider to set how many seconds that slide stays on screen.
- Click anywhere outside the popover to save.

The default duration for all slides is set in the configuration (10 seconds by default).

---

## Enabling and disabling individual slides

Each file has a **toggle switch**. Turn it off to hide that slide from the TV without deleting it. Turn it back on to show it again.

---

## Turning the slideshow on or off

At the top of the dashboard there is an **Enable / Disable** toggle for the entire slideshow.

- **Enabled** — the TV shows the slideshow normally.
- **Disabled** — the TV shows the default placeholder screen (TAMK logo).

---

## Emergency alert

The dashboard has an **Emergency Alert** section. Use this to display an urgent message on the TV immediately.

1. Choose a preset — **Fire Alarm**, **Evacuation**, **Emergency**, or **Fire Drill** — or type a custom message.
2. Click **Show Alert**.

The TV will switch to a full-screen alert immediately. To clear it, click **Clear Alert**.

---

## QR code

If a QR code URL has been configured, a QR code is shown on the dashboard. Visitors can scan it to open a related link on their phone.

---

## What the TV shows when there are no files

If no files have been uploaded, or all slides are disabled, the TV shows a placeholder screen with the TAMK logo and the text "A3 Info Screen".

---

## Troubleshooting

| Problem | What to do |
|---|---|
| Dashboard not loading | Check your internet connection. Try refreshing the page. |
| File not appearing on TV | Wait a few seconds — the TV refreshes automatically. |
| Video not playing | Make sure the file is MP4 or MOV format. |
| TV showing old content | The Pi syncs from the server every 5 minutes. Wait and check again. |
| Alert not clearing | Refresh the dashboard and click Clear Alert again. |
