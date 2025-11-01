# 🆘 SOS App / Site v1.0

**Offline-first humanitarian web app**  
Built for communication, safety, and faith during crisis — even without internet.  
Developed by **Magnus T. Gustav Sandberg (Kalix, Sweden)** as part of the *Vision Framtid* ecosystem.

---

## 🌍 Overview

SOS is a modular, lightweight web system that works **entirely offline**.  
It connects families, shelters, and rescuers through cached communication, local data storage, and faith-based comfort tools.

### 🧱 Core Modules

| Module | Description |
|:-------|:-------------|
| 🏠 **Dashboard** | Main screen with status, links, verse of hope. |
| 💬 **Message Center** | Offline text communication between shelters. |
| 📻 **Radio System** | Local & international emergency radio + calm loop. |
| 👨‍👩‍👧‍👦 **Family Section** | Prayers, Spotify playlists, and comfort for children. |
| 🚑 **Rescue & Health Center** | Health tracking, injuries, medicine, and reports. |
| 🗺️ **Shelter Map** | Offline map with markers and shelter ID sync. |

---

## ⚙️ Offline & Safety Features

- Progressive Web App (PWA) – works in browser or installed
- Offline cache via Service Worker
- Local data (encrypted in `localStorage.sos.*`)
- No external servers required
- Calm-mode sounds and voice fallback
- Designed for low-light / crisis conditions

---

## 🛠️ Installation

1. Copy all files into a web server or GitHub Pages repo.  
2. Make sure your Service Worker is registered:
   ```html
   <script>
     if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
   </script>
