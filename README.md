# A3 Info Screen

This repository contains the project work for the A3 Info Screen project in Practical Training 2, summer 2026. Designed, built, and deployed solo by **Loc Phan**.

## Project goal

A Raspberry Pi-powered information screen system for the A3 corridor TV at TAMK. The system displays uploaded images and short videos as a fullscreen slideshow. Teachers and staff manage content through a web dashboard — no technical knowledge required.

## Documentation

- [User Guide](docs/USER_GUIDE.md) — how to upload and manage content (for teachers)
- [Installation Guide](docs/INSTALLATION_GUIDE.md) — how to set up the system on a new Pi or VM

## System overview

- A **Raspberry Pi** connected to the corridor TV runs the slideshow fullscreen via Chromium kiosk.
- A **VM** (`a3info.project.tamk.cloud`) hosts the dashboard so teachers can upload from anywhere.
- The Pi syncs content from the VM automatically every 5 minutes.

## Author

This project was developed entirely by **Loc Phan** — from design and backend to the Raspberry Pi deployment and dashboard.

## Project information

- Course: Practical Training 2
- Project ID: 004
- Project name: A3 Info Screen
- Author: Loc Phan
- Version control: TAMK GitLab

## Technologies

- Node.js / Express
- Multer (file uploads)
- fluent-ffmpeg / ffprobe (video processing)
- HTML / CSS / JavaScript
- Raspberry Pi (kiosk display)
- nginx + pm2 (VM deployment)

## Features

- Fullscreen slideshow — images, GIFs, and videos (JPG, PNG, GIF, MP4, MOV)
- Web dashboard accessible from any device
- Upload, delete, and reorder slides
- Per-slide display duration
- Enable/disable individual slides or the entire slideshow
- Emergency alert with one-tap presets (Fire Alarm, Evacuation, Emergency, Fire Drill)
- Optional dashboard password protection
- QR code display on the TV
- Automatic VM→Pi sync every 5 minutes
- Videos capped at 60 seconds
- Thumbnail generation
- Live "Now Showing" indicator on the dashboard

## How to run locally

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Open the slideshow at `http://localhost:3000` and the dashboard at `http://localhost:3000/dashboard.html`.

## Deployment

See [Installation Guide](docs/INSTALLATION_GUIDE.md) for full setup instructions for the Raspberry Pi and VM.
