# Changelog — Our Cycle

All notable changes and architectural features introduced to the Our Cycle codebase are documented here.

---

## [0.3.0] — 2026-10-30

### 🚀 Major Feature Additions

#### 1. 💑 Partner View & Daily Care Guide (The "Two-Person" Experience)
- Added an instant perspective switcher on the Today screen (`[ 🌸 Her View | 🤝 Partner Care ]`).
- Biological phase-specific care advice for partners covering hormonal dynamics, actionable comfort tips, and topics to avoid.
- Real-time symptom awareness: automatically surfaces logged symptoms (cramps, headaches, fatigue) with targeted relief steps.
- Pre-crafted caring check-in messages with 1-tap clipboard copy.

#### 2. 📅 Calendar Integration (.ics Export & Alarms)
- Implemented `/api/calendar/ics` route generating standard RFC 5545 iCalendar feeds.
- Exports past period history, upcoming 3-cycle predictions with 1-day advance reminder alarms, fertile windows, and PMS heads-up alerts.
- Integrated 1-tap download buttons in both `CalendarGrid` and `SettingsView` (Data Portability).

#### 3. 📊 Advanced Health Charts & Analytics
- Added **Basal Body Temperature (BBT)** tracking chart with unit switching (°C / °F) and baseline reference indicator.
- Integrated **Correlation Intelligence Engine**: identifies recurring rhythms such as cramp peak day and estrogen-drop headaches.
- Added **Cycle-by-Cycle Comparison**: side-by-side assessment of the last 6 cycles against historical averages with outlier tagging.

#### 4. 🩺 Clinical Doctor Summary Report (Print & PDF)
- Created `/report` clinical report page formatted for OB/GYN and primary care consultations.
- Includes vital menstrual parameters, chronological cycle logs table, symptom incidence frequency, and physician consultation notes.
- Configured print-optimized CSS (`@media print`) for clean single/two-page PDF generation via system print dialog.

#### 5. ⚡ Quick-Log Enhancements & Lifestyle Tracking
- Added 1-tap symptom presets in `DaySheet`: *High Energy*, *Cramp & Rest*, *PMS Comfort*, *Gentle Reset*.
- Added sleep hours and water intake stepper.
- Added quick hashtag pills (`#heatingpad`, `#painkiller`, `#tea`, `#yoga`, etc.) that toggle directly into journal entries.

#### 6. 🎨 Aesthetic Theme Palettes & Discreet Privacy Mode
- Introduced 4 curated color palettes: **Rose** (signature), **Lavender** (calming violet), **Sage** (botanical green), **Terracotta** (earthy clay).
- Added **Discreet Privacy Mode**: disguises the application header to *"Personal Notes"* with a minimalist journal icon for privacy in public spaces.

#### 7. 📚 Comprehensive System Documentation
- Added `ARCHITECTURE.md`, `API.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`, `SECURITY.md`, and `CHANGELOG.md`.

---

## [0.2.1] — Earlier Releases
- Pure prediction engine with MAD outlier rejection and exponential recency weighting.
- Argon2id passphrase hashing and HMAC-SHA256 session management with sliding refresh.
- Dual storage architecture supporting local file store and Supabase Postgres.
- Offline-first mutation queue with automatic reconnect synchronization.

