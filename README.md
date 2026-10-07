# Tracker

A single-file weight-tracking web app built around your own fat-loss plan. Plots actual weight against a target trajectory, installs to the iOS home screen as a standalone web app, and stores all data locally on the device — no backend, no accounts, no tracking.

Features
Set up your own plan — first launch asks for start weight, goal weight and dates, then draws a steady target line between them and warns if the pace is faster than ~1% of body weight a week.
Target vs actual chart — a hand-rolled SVG line chart showing your weigh-ins against the planned trajectory.
Live readouts — current weight, total lost from baseline, distance to goal, and per-week variance from target.
Weekly entry table and daily weigh-ins — the chart and stats update instantly, in kg or st/lb.
Customisable habits, weekly sessions and meals — edit them under ⚙︎ Plan & settings, along with an optional event countdown.
Backup and restore — export a .txt backup from the share sheet and restore it on any device.
iOS home-screen install — full-screen standalone mode, custom app icon, safe-area handling for the notch.
Local-only storage — entries are saved in the browser's `localStorage`. Nothing leaves the device.

How to use
Open the published URL in Safari on iPhone.
Share → Add to Home Screen to install it as an app.

Each week: weigh in on the same day (after waking, after toilet, before food or drink) and enter the number.
Built with Plain HTML, CSS, and vanilla JavaScript in a single file. No frameworks, no build step, no dependencies. The chart is drawn directly as SVG; persistence uses the browser `localStorage` API.

Deployment
Hosted on GitHub Pages from the `main` branch (root). Because the free GitHub Pages tier serves only from public repositories, the repo is public — but note that no personal data is committed: the repository contains only the blank app, and all weight entries live in the browser on the device.

Notes
The target line is a guide, not a verdict. Weekly weight fluctuates with water, glycogen, and digestion, so a single week above the line means little. Waist measurements and progress photos tell the fuller story.

Upgrading from the original version
If this device already has data from before plans were configurable, the app keeps the original 32-week programme (including its held weeks over Christmas) and moves weekly weigh-ins into the date-based log automatically. The old `tracker_actuals_v3` entry is left in place as a fallback.
