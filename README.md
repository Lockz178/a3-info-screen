# A3 Info Screen

This repository contains the project work for the A3 Info Screen project in Practical Training 2, summer 2026.

## Project goal

The goal is to develop a Raspberry Pi-powered information screen system for the A3 corridor TV. The system displays uploaded images and short videos as a fullscreen slideshow.

Teachers or staff can manage the media through a simple web dashboard. Uploaded files are saved on the Raspberry Pi, and the slideshow updates automatically.

## Team

- Mari Mailisalo
- Lauri Tanhuanpää
- Sofia Tuomiranta
- Loc Phan

## Project information

- Course: Practical Training 2
- Project ID: 004
- Project name: A3 Info Screen
- Team: 4
- Version control: TAMK GitLab

## Technologies

- Node.js
- Express
- Multer
- HTML
- CSS
- JavaScript
- Raspberry Pi

## Current features

- Fullscreen slideshow page
- Upload dashboard page
- JPG, PNG, and MP4 upload
- Uploaded media stored locally in the uploads folder
- Media list API
- Delete uploaded media from dashboard
- Configurable image duration using config.json
- Automatic media refresh
- Media sorted by upload order
- Raspberry Pi network access using IP address

## How to run locally

Install dependencies:

```bash
npm install