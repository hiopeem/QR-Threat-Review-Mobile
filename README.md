# QR Threat Review Mobile

An anti-**quishing** (QR-code phishing) app. Stock phone cameras decode a QR code and open the link immediately. This app adds a safety check in between: it decodes the QR code, checks the URL against **VirusTotal**, and shows a clear **Safe** or **Malicious** verdict *before* you decide to open it.

## Quick guide: what do I need to do?

| You are... | Need a computer? | What to do |
|---|---|---|
| 📱 **iPhone user** | No | [Try it on iPhone](#iphone) |
| 🤖 **Android user** | No | [Try it on Android](#android) |
| 🖥️ **Host** (sharing the demo) | Yes | [Share it with phone users](#5-share-it-with-phone-users-temporary-public-links) |
| 💻 **Developer** (own copy) | Yes | [Run it yourself](#run-it-yourself-for-developers) |

> Phone users connect to the host's computer, so the links only work while the host's computer is **on, awake, and online**.

### iPhone

- 🌐 **Website**: open the shared website link in Safari, paste a URL into **"Scan a new URL"**, and get a Safe or Malicious verdict. No app or account needed.
- 📱 **App**
  1. Install **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779).
  2. Scan the app QR code with the **Camera** app, then tap **"Open in Expo Go"**.
  3. Allow camera access, then scan any QR code.

### Android

- 🌐 **Website**: open the shared website link in Chrome and use it the same way.
- 📱 **App**
  1. Install **Expo Go** from [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent).
  2. Open Expo Go and scan the app QR code **inside Expo Go**.
  3. Allow camera access, then scan any QR code.

## Features

- **Scanner (mobile)**: scan QR codes with the live camera or from a photo in your gallery.
- **Verdict**
  - 🟢 **Safe**: "Open anyway" is enabled.
  - 🔴 **Malicious**: "Open anyway" is disabled.
  - ⚪ **Error** (no internet / server unreachable): no open button. The app never guesses "Safe".
- **Dashboard (web)**: scan history, timestamps, verdicts, search, a **Total Threats Blocked** counter, and a form to check a URL manually.
- **Cache**: every result is saved in MongoDB. A URL that was already checked is answered instantly without calling VirusTotal again, which protects the API rate limit.

## How it works

```
QR code → Mobile app (decode URL) → POST /api/scan → Backend
                                                     │
                                  1. Look up URL in MongoDB (cache)
                                  2. Not found → ask VirusTotal
                                  3. Save result to MongoDB
                                                     │
          Mobile app ← Safe / Malicious ←────────────┘
          Dashboard  ← history & stats from MongoDB
```

## Tech stack

| Part      | Tech                                         | Folder       |
|-----------|----------------------------------------------|--------------|
| Mobile    | React Native + Expo (`expo-camera`, `expo-image-picker`) | `mobile/`    |
| Dashboard | React (Vite) + Tailwind CSS                  | `dashboard/` |
| Backend   | Node.js + Express                            | `src/`       |
| Database  | MongoDB Atlas (Mongoose)                     | cloud        |
| Threat intel | VirusTotal API v3                         | cloud        |

## Project structure

```
├── src/                     # Backend (Express)
│   ├── server.js
│   ├── models/ScanLog.js
│   ├── routes/scan.js
│   └── services/virusTotal.js
├── dashboard/               # Web dashboard (React + Vite)
│   └── src/components/DashboardView.jsx
└── mobile/                  # Mobile app (Expo)
    └── src/screens/QRScannerScreen.js
```

## Run it yourself (for developers)

This section is only for people who want to run their own copy on a computer. To just try the app on a phone, see the [Quick guide](#quick-guide-what-do-i-need-to-do).

### Requirements

- Node.js 18+
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- A free [VirusTotal](https://www.virustotal.com) API key
- [Expo Go](https://expo.dev/go) on your phone (for the mobile app)

### 1. Install everything (one command)

```bash
npm run setup
```

This installs the packages for the backend, dashboard, and mobile app.

### 2. Add your settings

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/scamsite
VIRUSTOTAL_API_KEY=<your key>
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

> In MongoDB Atlas, add your IP (or `0.0.0.0/0`) under **Network Access → IP Access List**.

### 3. Start the backend + dashboard (one command)

```bash
npm run dev:all
```

- Backend → http://localhost:3000
- Dashboard → http://localhost:5173 (it forwards `/api` requests to the backend)

Press `Ctrl + C` to stop both.

### 4. Start the mobile app (in a second terminal)

The phone needs your computer's address on the Wi-Fi network (not `localhost`). Find it first:

- **macOS:** `ipconfig getifaddr en0`
- **Windows:** `ipconfig`, then look for "IPv4 Address" (e.g. `192.168.1.42`)

Then start the app, using your own address:

```bash
cd mobile
EXPO_PUBLIC_API_URL="http://192.168.1.42:3000" npx expo start
```

Connect your phone to the **same Wi-Fi** as your computer, then scan the QR code in the terminal: with the **Camera** app on iPhone, or inside **Expo Go** on Android.

### 5. Share it with phone users (temporary public links)

To let people on **any network** try it from their phone, with no computer of their own, expose your running app with free [Cloudflare quick tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/).

1. Install `cloudflared` (macOS: `brew install cloudflared`).
2. Start the backend + dashboard: `npm run dev:all`
3. In two more terminals, open the tunnels:
   ```bash
   cloudflared tunnel --url http://localhost:5173   # website + API
   cloudflared tunnel --url http://localhost:8081   # phone app
   ```
   Each one prints a link like `https://random-words.trycloudflare.com`.
4. Start the phone app using those links (log in first with `npx expo login`):
   ```bash
   cd mobile
   EXPO_PUBLIC_API_URL="https://<website-link>" EXPO_PACKAGER_PROXY_URL="https://<app-link>" npx expo start
   ```
5. Share:
   - 🌐 **Website**: `https://<website-link>`, which opens in any browser
   - 📱 **Phone app**: `exps://<app-link>`, which opens in Expo Go

> ⚠️ The links only work while your computer is on, awake, and running everything. They change every time the tunnels restart. Anyone with the link can use it, and each new URL checked uses your VirusTotal quota.

## API

| Method | Path         | Description                                                  |
|--------|--------------|--------------------------------------------------------------|
| POST   | `/api/scan`  | Body `{ "url": "..." }`. Returns `{ url, verdict, stats, cached, scannedAt }` |
| GET    | `/api/scans` | Scan history (newest first). Supports `?q=` and `?limit=`    |
| GET    | `/api/stats` | `{ total, malicious, safe }`                                 |
| GET    | `/health`    | Server and database status                                   |

## Notes

- **Strict verdict**: a URL is marked **Malicious** if *any* VirusTotal engine flags it.
- **Rate limit**: the free VirusTotal key allows about 4 new lookups per minute. Cached URLs are unlimited.
- **No background interception**: phones don't let apps intercept other apps' traffic, so this is a manual check-before-you-open tool.
- **Test URL**: `http://malware.testing.google.test/testing/malware/` is Google's harmless test URL and should come back **Malicious**.
