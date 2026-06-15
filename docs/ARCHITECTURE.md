# A3 Info Screen — System Architecture

## Overview

The system has two main components: a **VM** that hosts the dashboard for content management, and a **Raspberry Pi** that drives the corridor TV. The Pi syncs content from the VM automatically so teachers only need to upload to one place.

```
                        INTERNET
                            │
                            │  http://a3info.project.tamk.cloud
                            │
                    ┌───────▼────────┐
                    │      VM        │
                    │  Node.js :3000 │
                    │  nginx :80     │
                    │  pm2           │
                    └───────┬────────┘
                            │
                            │  sync every 5 minutes
                            │  GET /api/media
                            │  GET /uploads/:file
                            │
                    ┌───────▼────────┐
                    │  Raspberry Pi  │
                    │  Node.js :3000 │
                    │  systemd       │
                    └───────┬────────┘
                            │
                            │  localhost:3000
                            │
                    ┌───────▼────────┐
                    │    Chromium    │
                    │  kiosk mode    │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  Corridor TV   │
                    │   (HDMI)       │
                    └────────────────┘


  Teacher/Staff
       │
       │  browser (any device)
       ▼
  http://a3info.project.tamk.cloud/dashboard.html
```

## Component details

### VM
- Hosted at TAMK on `project-vm-team-4` (172.16.101.51)
- Public URL: `a3info.project.tamk.cloud` (nginx proxies port 80 → Node.js port 3000)
- pm2 keeps the Node.js process running and restarts it on reboot
- Stores uploaded media in the `uploads/` folder
- Teachers upload here — it is the single source of truth for content

### Raspberry Pi
- Connected to the A3 corridor TV via HDMI
- Runs the same Node.js server locally on port 3000
- Chromium opens `localhost:3000` in kiosk mode on boot (fullscreen, no browser UI)
- systemd starts the Node.js server on boot and restarts it on crash
- Syncs content and config from the VM every 5 minutes — downloads new files, removes deleted ones, and overwrites local `config.json` with the VM's version so settings like screen schedule take effect automatically
- Sends a heartbeat to the VM every 2 minutes so the health panel can show Pi status
- If the VM is unreachable, the Pi keeps showing its last known local content
- Keeps the HDMI output on during the scheduled window and off outside it using `vcgencmd display_power`, re-applying the correct state every minute so a missed on/off minute can't leave the screen stuck

### Dashboard
- Single-page web app served by the Node.js server
- Accessible from any browser — no app or VPN needed
- Teachers upload, reorder, and manage slides from here
- Shows a live "Now Showing" indicator for whichever slide is currently on the TV
- System Health panel shows live status of VM, Pi, sync, alerts, uploads, and disk space
- Screen Schedule card controls the daily on/off times for the corridor TV

### Slideshow
- Fullscreen page served at the root URL (`/`)
- Polls the server every 5 seconds for content changes
- Plays images, GIFs, and videos in order
- Switches to a placeholder screen if no content is available

## Data flow

**Media and config sync (every 5 minutes):**
```
Teacher uploads file or changes setting on dashboard
        │
        ▼
VM stores file / updates config.json
        │
        │  (up to 5 minutes later)
        ▼
Pi syncs files + config from VM
        │
        ▼
Chromium reloads media list
        │
        ▼
New slide appears on corridor TV
```

**Pi heartbeat (every 2 minutes):**
```
Pi server POSTs to VM /api/heartbeat
        │  (includes currently playing file)
        ▼
VM stores last seen time + now playing
        │
        ▼
Health panel shows Pi status + now playing
```

## File structure on disk

```
004-a3-info-screen/
├── server.js          # Node.js server (API + file serving + sync + schedule)
├── config.json        # Application settings (synced from VM to Pi)
├── order.json         # Slide order
├── durations.json     # Per-file display durations
├── disabled.json      # List of disabled slides
├── heartbeat.json     # Last Pi check-in time (VM only, not in git)
├── lastSync.json      # Last successful sync time (Pi only, not in git)
├── uploads/           # Uploaded media files
├── thumbnails/        # Auto-generated thumbnails
├── backend/
│   ├── routes/
│   │   ├── media.js   # File upload, list, delete, reorder
│   │   ├── config.js  # Settings read/write
│   │   ├── alert.js   # Emergency alert
│   │   └── health.js  # System health endpoint + heartbeat receiver
│   ├── middleware/
│   │   └── auth.js    # Session auth middleware
│   └── utils/
│       └── fileHelpers.js  # Shared file paths and helpers
├── frontend/
│   ├── index.html     # Slideshow page
│   ├── script.js      # Slideshow logic
│   ├── dashboard.html # Dashboard page
│   ├── dashboard.js   # Dashboard logic
│   └── style.css      # Styles
└── docs/              # Documentation
```
