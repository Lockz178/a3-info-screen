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

## Screen schedule

The Screen Schedule card lets you set a daily on and off time for the corridor TV.

1. Set the **Turn on** time (e.g. 07:00)
2. Set the **Turn off** time (e.g. 21:00)
3. Toggle the switch on
4. Click **Save**

The Pi picks up the new schedule within 5 minutes. During the on-window the HDMI output is kept on, and outside it the screen is kept off to save power — the Pi re-checks every minute, so the screen always matches the schedule even if the exact on/off minute is missed. The server keeps running in the background. If the Pi reboots during scheduled hours, the screen turns back on straight away.

To disable the schedule, toggle the switch off and click Save.

---

## System health

The System Health panel on the right side of the dashboard shows the live status of each part of the system. It refreshes every 30 seconds.

| Indicator | What it shows |
|---|---|
| **VM Server** | Always green when the dashboard is reachable. Shows server uptime. |
| **Pi Display** | Green if the Pi checked in within the last 5 minutes, amber if 5–15 minutes, red if over 15 minutes. |
| **Now Playing** | The file currently showing on the corridor TV. |
| **Last Sync** | How long ago the Pi last synced files from the VM. |
| **Alert** | Green if no alert is active, amber if an emergency alert is currently showing. |
| **Uploads** | Number of files and total size in the uploads folder. |
| **Disk Space** | Free and total disk space on the VM. |

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
| Pi Display showing red in health panel | The Pi has not sent a heartbeat recently. Check that the Pi is powered on and connected to the network. |
| Screen not turning on/off at scheduled time | Check that the schedule is enabled and saved. The Pi applies the schedule within 5 minutes of saving. |
| Last Sync showing red in health panel | The Pi cannot reach the VM. Check the Pi's network connection. |
