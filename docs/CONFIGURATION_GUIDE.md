# A3 Info Screen — Configuration Guide

All configuration is done through two files: `config.json` (application settings) and the systemd service file (Pi-specific settings).

---

## config.json

Located at the root of the project folder. Edit this file to change application behaviour.

```json
{
  "imageDurationSeconds": 10,
  "maxVideoDurationSeconds": 60,
  "dashboardPassword": "",
  "qrUrl": ""
}
```

### Settings

#### `imageDurationSeconds`
How long each image or GIF is shown on screen, in seconds.

- Default: `10`
- Example: `5` shows each image for 5 seconds

This is the default for all slides. Individual slides can override this from the dashboard.

#### `maxVideoDurationSeconds`
The maximum time a video is allowed to play before the slideshow moves to the next slide.

- Default: `60`
- Example: `30` cuts videos off after 30 seconds

Videos shorter than this value play to their natural end.

#### `dashboardPassword`
An optional password to protect the dashboard. If set, anyone opening the dashboard must enter this password before they can make changes.

- Default: `""` (no password — dashboard is open to anyone on the network)
- Example: `"tamk2026"` requires the password `tamk2026`

To remove the password, set it back to an empty string `""`.

#### `qrUrl`
A URL to display as a QR code in the corner of the corridor TV screen. Leave empty to hide the QR code.

- Default: `""` (no QR code shown)
- Example: `"https://www.tamk.fi"` shows a scannable QR code linking to that URL

---

## Applying config changes

After editing `config.json`:

**On the Pi:**
```bash
sudo systemctl restart a3-info-screen
```

**On the VM:**
```bash
pm2 restart all
```

---

## VM sync URL (Pi only)

The Pi's systemd service file controls where the Pi syncs content from. Edit it if the VM address changes.

```bash
sudo nano /etc/systemd/system/a3-info-screen.service
```

Find the line:
```
Environment=VM_SYNC_URL=http://a3info.project.tamk.cloud
```

Replace the URL with the new VM address, then reload:

```bash
sudo systemctl daemon-reload
sudo systemctl restart a3-info-screen
```

If `VM_SYNC_URL` is removed or left empty, the Pi will not sync from any VM and will only show files uploaded directly to it.
