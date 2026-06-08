# A3 Info Screen — Installation Guide

This guide covers setting up the system from scratch on a new Raspberry Pi or a new VM.

---

## Requirements

- Raspberry Pi (any model with WiFi/Ethernet and HDMI output)
- Raspberry Pi OS with Desktop (64-bit recommended)
- A Linux server or VM (Ubuntu 22.04 or later recommended)
- Node.js 18 or later (required on both Pi and VM)
- Git

---

## Part 1 — Raspberry Pi setup

### 1. Install Raspberry Pi OS

Flash Raspberry Pi OS with Desktop onto an SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/). During setup:
- Set a hostname (e.g. `raspberrypi`)
- Create a user (this guide uses `admin`)
- Enable SSH
- Configure WiFi if needed

### 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

### 3. Clone the repository

```bash
cd ~
git clone https://gitlab.tamk.cloud/tamk-projects/summer-projects/2026/004-a3-info-screen.git
cd 004-a3-info-screen
```

If prompted for credentials, use your TAMK GitLab username and a personal access token with `read_repository` scope.

### 4. Install dependencies

```bash
npm install
```

### 5. Create the systemd service

This makes the server start automatically on boot and restart if it crashes.

```bash
sudo nano /etc/systemd/system/a3-info-screen.service
```

Paste the following (replace the VM URL if it has changed):

```ini
[Unit]
Description=A3 Info Screen Node Server
After=network.target

[Service]
Type=simple
User=admin
WorkingDirectory=/home/admin/004-a3-info-screen
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=VM_SYNC_URL=http://a3info.project.tamk.cloud

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable a3-info-screen
sudo systemctl start a3-info-screen
```

Check it is running:

```bash
sudo systemctl status a3-info-screen
```

### 6. Set up Chromium kiosk autostart

This opens the slideshow in fullscreen automatically when the Pi boots.

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/chromium-kiosk.desktop
```

Paste the following:

```ini
[Desktop Entry]
Type=Application
Name=Chromium Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 --password-store=basic http://localhost:3000
```

Save and close. On next reboot, Chromium will open automatically in fullscreen.

### 7. Reboot and verify

```bash
sudo reboot
```

After reboot, the TV should show the slideshow (or the placeholder if no files are uploaded yet). The dashboard is accessible from any device on the same network at:

```
http://<pi-ip-address>:3000/dashboard.html
```

To find the Pi's IP address:

```bash
hostname -I
```

---

## Part 2 — VM / Server setup

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

### 2. Install pm2

pm2 keeps the server running and restarts it after reboots.

```bash
sudo npm install -g pm2
```

### 3. Clone the repository

```bash
cd ~
git clone https://gitlab.tamk.cloud/tamk-projects/summer-projects/2026/004-a3-info-screen.git
cd 004-a3-info-screen
```

### 4. Install dependencies

```bash
npm install
```

### 5. Start the server with pm2

```bash
pm2 start server.js --name a3-info-screen
pm2 save
pm2 startup
```

Run the command that `pm2 startup` outputs (it will look like `sudo env PATH=... pm2 startup systemd ...`).

### 6. Install and configure nginx

nginx sits in front of Node and serves the app on port 80 (no port number needed in the URL).

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/a3-info-screen
```

Paste the following (replace `a3info.project.tamk.cloud` with the actual public hostname):

```nginx
server {
    listen 80;
    server_name a3info.project.tamk.cloud;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart nginx:

```bash
sudo ln -s /etc/nginx/sites-available/a3-info-screen /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Verify

Open a browser and go to:

```
http://a3info.project.tamk.cloud/dashboard.html
```

The dashboard should load. Upload a file to confirm everything is working end to end.

---

## Updating the code

### On the Pi

```bash
cd ~/004-a3-info-screen
git pull
sudo systemctl restart a3-info-screen
```

### On the VM

```bash
cd ~/004-a3-info-screen
git pull
pm2 restart all
```

---

## Deploying to a second location

### Same content (mirror)

If the second screen should show the same slides as the first, you only need to set up a new Pi — no new VM needed.

Follow Part 1 exactly as written. In step 5 (systemd service), use the same `VM_SYNC_URL`:

```ini
Environment=VM_SYNC_URL=http://a3info.project.tamk.cloud
```

The Pi will sync from the existing VM. Both screens will always show the same content.

### Different content (separate screen)

If the second screen should show different slides, you need a new VM and a new Pi.

1. **Set up a new VM** — follow Part 2. In step 6 (nginx), replace `a3info.project.tamk.cloud` with the new VM's public hostname (e.g. `a3info-hallway.project.tamk.cloud`).
2. **Set up a new Pi** — follow Part 1. In step 5 (systemd service), point `VM_SYNC_URL` to the new VM's URL:

```ini
Environment=VM_SYNC_URL=http://a3info-hallway.project.tamk.cloud
```

Each VM has its own dashboard and its own uploads folder. Teachers manage each screen independently.

---

## Troubleshooting

| Problem | What to check |
|---|---|
| Service not starting on Pi | `sudo journalctl -u a3-info-screen -f` |
| Chromium not opening on boot | Check `~/.config/autostart/chromium-kiosk.desktop` exists |
| Dashboard not reachable on VM | Check nginx: `sudo systemctl status nginx` |
| Pi not syncing from VM | Check VM_SYNC_URL in the systemd service file |
| GitLab personal access token expired | Create a new token at gitlab.tamk.cloud → Profile → Access Tokens (scope: `read_repository`) and update the remote URL on the Pi |
