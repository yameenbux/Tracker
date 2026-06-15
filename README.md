# Tracker

A single-file weight-tracking web app for an 8-week fat-loss programme. Plots actual weight against a target trajectory, installs to the iOS home screen as a standalone web app, and stores all data locally on the device — no backend, no accounts, no tracking.

Features
Target vs actual chart — a hand-rolled SVG line chart showing your weekly weigh-ins against the planned trajectory (83.9 → 79.5 kg over 8 weeks).
Live readouts — current weight, total lost from baseline, distance to goal, and per-week variance from target.
Weekly entry table — type each Monday-morning weight; the chart and stats update instantly.
iOS home-screen install — full-screen standalone mode, custom app icon, safe-area handling for the notch.
Local-only storage — entries are saved in the browser's `localStorage`. Nothing leaves the device.

How to use
Open the published URL in Safari on iPhone.
Share → Add to Home Screen to install it as an app.

Each Monday: weigh in (after waking, after toilet, before food or drink) and enter the number.
Built with Plain HTML, CSS, and vanilla JavaScript in a single file. No frameworks, no build step, no dependencies. The chart is drawn directly as SVG; persistence uses the browser `localStorage` API.

Deployment
Hosted on GitHub Pages from the `main` branch (root). Because the free GitHub Pages tier serves only from public repositories, the repo is public — but note that no personal data is committed: the repository contains only the blank app, and all weight entries live in the browser on the device.

Notes
The target line is a guide, not a verdict. Weekly weight fluctuates with water, glycogen, and digestion, so a single week above the line means little. Waist measurements and progress photos tell the fuller story.
