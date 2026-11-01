# RallyUp — Pickleball Open Play Manager (Phase 1 Offline MVP)

An offline-first, mobile-friendly pickleball open play manager built with Next.js, React, Tailwind CSS, IndexedDB (Dexie.js), and Capacitor.

![RallyUp Logo](public/logo.png)

---

## 📱 Generated Android APK

A fully compiled, standalone native Android APK is ready in the root directory:

```
C:\Users\Kia\Desktop\RallyUp\RallyUp-Pickleball-Manager.apk
```

You can copy this file directly to any Android smartphone or tablet and install it. It works **100% offline** with full local IndexedDB persistence, live scoring, and rotation management.

---

## 🎾 Key Features

### 1. Pickleball Skill Level Selection
- Visual skill level selector matching standard pickleball ratings:
  - `Newbie / 2.0`, `2.25`, `2.5`, `2.75`, `3.0`, `3.25`, `3.5`, `3.75`, `4.0`, `4.25`, `4.5`, `4.75`, `5.0+`
- Available when adding/editing players in the roster and in the session wizard inline modal.
- Calibrates initial player ratings for matchmaking and ranking.

### 2. Profile Picture (Take Photo or Upload Photo)
- **Take Photo**: Directly opens device camera to capture profile photo.
- **Upload Photo**: Pick any image file from your device gallery.
- **Automatic Client Compression**: Resizes and optimizes photos to lightweight square base64 JPEG format to maintain ultra-fast IndexedDB offline performance.
- Displayed across player roster cards, detail modals, session chips, and rankings.

### 3. Dynamic Rating System (Est. DUPR / Performance Rating)
- **Does the app generate a rating like DUPR?**
  - **Yes!** RallyUp includes an offline **Dynamic Performance Rating (Est. DUPR)** system.
  - Players start with a rating baseline derived from their self-assessed skill level (e.g., 2.0 to 5.0+).
  - After every match (live-scored or manual), the dynamic rating engine:
    1. Evaluates opponent and partner ratings (expected win probability).
    2. Takes into account match outcome (win/loss) and **point differential** (e.g., winning 11-2 vs. 11-9).
    3. Dynamically adjusts player ratings to two decimal places (e.g. `3.62 ★`).
  - Sortable on the **Rankings & Leaderboard** screen alongside Wins, Win %, Games Played, and Point Differential.

### 4. Dashboard & Quick Actions
- Real-time summary cards: Saved players, total sessions, matches completed, and recent session.
- Prominent **Start New Open Play** button.
- Active session resume banner with round, court, and format status.
- Toggleable Dark / Light mode (with dark theme matching the RallyUp logo's deep forest green `#02160f` and electric neon lime `#bbf226`).

### 5. Open Play Creation Wizard
- Configure session name, date, start time, facility location, and court count (1 to 24 courts).
- Match format: **Doubles (4p)** or **Singles (2p)**.
- Target scores: 11, 15, 21, or custom.
- Win conditions: **Win by 2** or **Win by 1**.
- Scoring format: **Traditional Side-Out Scoring** or **Rally Scoring**.
- Player rotation modes: **Fair Rotation**, **Partner Rotation**, and **Random Rotation**.
- Roster selection: Multi-select saved players, add temporary guests, or add new players inline.
- Real-time court spot and waiting queue calculator.
- Automatic round 1 court assignment upon session start.

### 6. Court Assignment & Player Rotation Engine
- **Fair Rotation**: Prioritizes waiting players with fewest games played in the session, then longest waiting time.
- **Partner Rotation**: Minimizes repeated partnerships and opponent matchups in doubles play.
- **Random Rotation**: Shuffles available players into valid matches without duplicates.
- Safeguards: No player can ever be double-booked across multiple active matches.
- Ordered waiting queue displaying player names, wait time, and games played.
- One-click **Next Round** match generator for available courts.

### 7. Optional Live Scoring Per Court
- Dedicated split-color scoreboard interface (Team A on one side, Team B on the other).
- Full **Traditional Side-Out Scoring** engine:
  - Official USA Pickleball doubles start rule ("0-0-2" server 2 sequence).
  - First server to second server fault transitions.
  - Side-outs and server court-side positioning (even score = right court, odd = left court).
  - Live doubles score call banner (`Serving – Receiving – Server`).
- Full **Rally Scoring** engine with points on every rally and serve transitions.
- Large touch-friendly score buttons.
- Infallible **Undo** button restoring exact previous score, server number, and court positions.
- **Finish Match** validation checking target score and lead requirements, with optional administrative override.

### 8. Manual Final Score Entry
- Independent manual final score entry modal available on every court card.
- Real-time win condition validation with override capabilities.
- Stores results in the exact same format as live-scored matches.

### 9. Saved Player Management
- Add, edit, and archive players.
- Soft-deletion safeguards preserving historical match records.
- Lifetime stats tracking: Games played, wins, losses, win percentage, points scored, points conceded, point differential, and dynamic rating.
- Match history breakdown showing all past matches, partners, opponents, and scores.

### 10. Rankings & Leaderboards
- **Session Leaderboard**: Standings for any active or past session.
- **All-Time Rankings**: Lifetime roster standings.
- Sortable by: **Rating (Est. DUPR)**, **Wins**, **Win %**, **Games Played**, and **Point Diff**.
- Shows games played clearly beside every ranking to avoid small-sample bias.

### 11. Game History
- Search and browse all past open play sessions by name, date, or facility location.
- Detailed session summary showing all completed matches, courts, and scores.

### 12. Offline Storage & Data Backup
- Local persistence using IndexedDB (Dexie.js).
- Versioned JSON backup export and validated JSON backup restore (powered by Zod).
- CSV exports for **Players**, **Matches**, and **Sessions**.
- Safe database reset with explicit confirmation phrase.
- PWA service worker caching static assets for offline usage.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router, static export `output: 'export'`)
- **UI Library**: React 18, Tailwind CSS, Lucide React
- **Local Database**: IndexedDB managed via Dexie.js (`dexie` & `dexie-react-hooks`)
- **Data Validation**: Zod
- **Mobile Hybrid**: Capacitor 8 (`@capacitor/android`, `@capacitor/cli`, `@capacitor/core`)
- **Testing**: Vitest (22 automated tests passing)

---

## 🚀 Running the App Locally

### Web / Development Server
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Unit Tests
```powershell
npm test
```

### Static Production Build
```powershell
npm run build
```
Generates an optimized static distribution in `out/`.

### Rebuilding the Android APK
```powershell
# 1. Build and sync static assets into Android
npm run build
npx cap sync android

# 2. Build APK via Gradle (using JDK 21)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
cd android
.\gradlew.bat assembleDebug
```
The output APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk` and copied to `RallyUp-Pickleball-Manager.apk`.
