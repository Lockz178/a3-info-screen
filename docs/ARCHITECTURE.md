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
- Syncs content from the VM every 5 minutes — downloads new files, removes deleted ones
- If the VM is unreachable, the Pi keeps showing its last known local content

### Dashboard
- Single-page web app served by the Node.js server
- Accessible from any browser — no app or VPN needed
- Teachers upload, reorder, and manage slides from here
- Shows a live "Now Showing" indicator for whichever slide is currently on the TV

### Slideshow
- Fullscreen page served at the root URL (`/`)
- Polls the server every 5 seconds for content changes
- Plays images, GIFs, and videos in order
- Switches to a placeholder screen if no content is available

## Data flow

```
Teacher uploads file
        │
        ▼
VM stores file in uploads/
        │
        │  (up to 5 minutes later)
        ▼
Pi syncs file from VM
        │
        ▼
Chromium reloads media list
        │
        ▼
New slide appears on corridor TV
```

## File structure on disk

```
004-a3-info-screen/
├── server.js          # Node.js server (API + file serving)
├── config.json        # Application settings
├── order.json         # Slide order
├── durations.json     # Per-file display durations
├── disabled.json      # List of disabled slides
├── uploads/           # Uploaded media files
├── thumbnails/        # Auto-generated thumbnails
├── frontend/
│   ├── index.html     # Slideshow page
│   ├── script.js      # Slideshow logic
│   ├── dashboard.html # Dashboard page
│   ├── dashboard.js   # Dashboard logic
│   └── style.css      # Styles
└── docs/              # Documentation
```
