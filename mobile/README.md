# Tidemark — iPhone app

The native version of Tracker, now called **Tidemark**, built with Expo (React Native) so it can be developed without a Mac.
Same idea as the web app: no account, nothing leaves the phone, and the target line is a guide, not a verdict.

## Try it on your iPhone (free, no Apple developer account)

You need a computer (Windows is fine) and your iPhone on the same Wi-Fi.

1. Install **Node.js LTS** from nodejs.org.
2. On your iPhone, install **Expo Go** from the App Store.
3. In a terminal:
   ```bash
   git clone https://github.com/yameenbux/Tracker.git
   cd Tracker/mobile
   npm install
   npx expo start
   ```
4. Scan the QR code that appears with the iPhone **Camera** app. It opens in Expo Go.

If the phone can't connect (work or university Wi-Fi often blocks it), run `npx expo start --tunnel` instead.
If Expo Go says the project needs a different SDK version, update Expo Go from the App Store.

## What's in it

- **Setup**: one question per screen — current weight, goal, then a pace (Gentle / Steady / Brisk / Fast, as a share of
  body weight per week), with a "How is this worked out?" explainer. Optional Face ID lock at the end.
- **Today**: current weight and progress, insight tiles (trend with sparkline, weekly pace and goal date, habits,
  body or calories) that open their tab, today's habits as one-tap ticks, and an event countdown.
- **Trend**: trend weight and the honest weekly rate, a 3 / 7 / 14 / 30-day change table, the chart (4W / 12W / Plan),
  the jump explainer, "Re-plan from here", and the full weigh-in history (tap to edit).
- **Habits**: this week's checklist with sessions and meals, 30-day dot grids (consistency, not streaks), and Patterns
  after 8 weeks.
- **Body**: waist/hips/chest/arm measurements, private progress photos with then-and-now, and optional calories with an
  estimate of what you really burn.
- **Log weight** (the + in the tab bar): opens on your last weight with −/+ steppers, so most weigh-ins are two taps.
  Deleting shows an Undo.
- **Settings**: an iOS grouped list — plan and breaks, event, units, habits, sessions, meals, calories, a daily weigh-in
  reminder, Face ID lock, export (backup or CSV), restore, clear, erase everything, privacy policy.
- **Safety**: saved data that can't be read is copied aside rather than overwritten; a snapshot is taken before restore;
  the lock hides everything (including the app-switcher preview).
- **Backups** use the same format as the web app, so a `.txt` exported from the website restores here, and the other way round.

## Security

What each protection is, and what it isn't:

- **No network surface.** No server, account, analytics or third-party SDKs. EAS builds with the `production` profile have no
  App Transport Security exceptions and no URL scheme (`plugins/withProductionHardening.js`); development builds and local
  builds without that profile keep local networking so they can load code from Metro.
- **iOS file encryption.** `NSFileProtectionComplete`: while the phone is locked, the app's files are encrypted with a key
  tied to the device passcode and can't be read. **Not yet verified in a signed device build** (only in generated config).
- **Face ID lock and app-switcher cover.** The lock is a screen in front of the app, asked for on every return; it is not a
  separate encryption key. The cover blanks the app switcher whenever the app isn't active (lock on or off).
- **Device backups.** iCloud/computer backups include the app's data, as for every app; that's what makes a lost phone
  recoverable. Backups can be password-protected (`src/core/vault.ts`: scrypt N=2^15 key, XChaCha20-Poly1305, audited
  `@noble` libraries, system randomness via expo-crypto); unprotected backups and the CSV are plain text.
- **Untrusted input.** Restored backups are size-limited (10 MB), parsed defensively and cleaned field by field (dates,
  ranges, lengths, counts, prototype keys); nothing is evaluated. A snapshot is kept for 30 days before any restore.
- **Notifications** never contain a weight or other figure; there's no push entitlement.
- **Dependencies.** `npm audit --omit=dev` reports advisories only in build-time tooling (Metro's `braces`, the Expo CLI's
  `node-forge`, the Jest preset's `sprintf-js`, the Xcode project editor's `uuid`). None of these ship in the app binary.
  Re-check after each Expo SDK upgrade.
- **Not done (by design):** jailbreak detection (easily bypassed, and a jailbroken owner already has their own data) and
  certificate pinning (no network calls to pin).

## Not in this version yet

- **Apple Health sync** — Expo Go can't use HealthKit. Needs the Apple Developer Program (£79/year)
  and a development build with EAS. Planned as step 2b.
- **iCloud sync and widgets** — also need a development build.

## Development

```bash
npm test            # unit tests (src/core) plus UI and storage tests (src/__tests__)
npm run typecheck
npx expo lint
npx expo export --platform web   # web build, used for screenshot testing
```

`src/core` is plain TypeScript with no React and is close to fully unit-tested. `src/__tests__/app.test.tsx` drives the
whole app (setup, logging, tabs, the lock, deleting all data) on top of that. Overall coverage, counting every source
file (`npx jest --coverage`), is about 70% of statements; the gaps are mainly the thin wrappers around native features
(camera, files, Face ID) that need a device, which no automated test here runs on yet. CI runs all of this on every push
(`.github/workflows/ci.yml`).
The `ios/` and `android/` folders are generated by Expo when building and are not committed.
