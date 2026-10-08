# Compliance checklist

Checked against what Plumb actually does on 8 October 2026: local-only, no account, no payments, no network calls,
no analytics, no ads. Re-check this list if any of those change (an account, a subscription, a server, an SDK).

| Item | Needed? | Why | What exists |
|---|---|---|---|
| Delete account | **No account exists** | App Store guideline 5.1.1(v) applies to apps that let people create an account. Plumb has none. | Settings → **Delete all my data** erases everything (plan, weigh-ins, habits, measurements, photos, preferences, reminders, cached files) after two confirmations. The privacy policy explains there's nothing held elsewhere. |
| Restore purchases | **No** | Only required for apps that sell non-consumable in-app purchases or subscriptions (guideline 3.1.1). Plumb sells nothing. | Not added. **Add it the day a purchase is added.** |
| Privacy policy | **Yes** (required for every app) | | `privacy.html` at the repo root, served at `https://yameenbux.github.io/Tracker/privacy.html` and linked from Settings → About. Includes support email, data protection, deletion, children and a not-medical-advice note. |
| Terms of service | **No** | Apple's Standard EULA applies to every App Store app that doesn't supply its own. There are no accounts, payments or user content to govern. The not-medical-advice wording sits in the app and the privacy policy. | Not added. In App Store Connect, leave the licence agreement as Apple's standard EULA. |
| Refund policy | **No** | Plumb is free. App Store refunds are handled by Apple, never by the developer. | Not added. |
| Cookie policy | **No** | The app has no web views and sets no cookies. The privacy page sets none and loads nothing from third parties (no Google Fonts, no analytics; GitHub Pages sets no cookies). | Not added. |
| Cookie consent banner | **No** | There are no cookies or trackers to consent to (UK PECR / ePrivacy only apply when something is stored on or read from the visitor's device beyond what's strictly necessary). | Not added. Adding one with nothing behind it would be misleading. |
| Form consents | **No consent boxes needed** | Nothing a person types leaves their phone, so there's no processing by us that would need consent. Each iOS permission is asked for only at the moment it's used, with a plain reason. | Camera (progress photos), Photos (pick a progress photo), Face ID (optional lock) and Notifications (optional reminder): each with a usage string, each optional. No microphone, location, contacts, tracking or advertising ID. |
| Don't collect unnecessary data | **Done** | Plumb stores only what the person enters, on their phone. Optional features (photos, measurements, calories, sessions, meals) stay empty unless used. No device identifiers, no logs, no analytics. | App Privacy answer in App Store Connect: **Data Not Collected**. |
| Audit third-party SDKs | **Done** (below) | | |

## Third-party SDK audit

Every runtime dependency, what it does, and whether it collects or sends data. Build-time tools (Metro, Babel, Jest,
the Expo CLI) aren't in the app binary and aren't listed.

| Package | Purpose | Network | Collects data | Notes |
|---|---|---|---|---|
| `expo`, `expo-constants`, `expo-application` | Runtime, app version | No | No | Version number for Settings → About only. |
| `expo-font`, `@expo-google-fonts/*` | Fonts | No | No | Font files are bundled in the app. Nothing is fetched from Google at runtime. |
| `expo-splash-screen`, `expo-status-bar` | Launch screen, status bar | No | No | |
| `react`, `react-native`, `react-dom`, `react-native-web`, `@expo/metro-runtime` | UI framework (web packages only power the browser preview) | No | No | |
| `react-native-safe-area-context`, `react-native-svg`, `expo-linear-gradient` | Layout, icons, gradients | No | No | |
| `@react-native-async-storage/async-storage` | Saves data on the phone | No | No | Protected by `NSFileProtectionComplete`. |
| `@react-native-community/datetimepicker` | Native date and time pickers | No | No | |
| `expo-local-authentication` | Face ID / passcode lock | No | No | iOS does the check. The app only learns "passed" or "failed". |
| `expo-notifications` | Local daily reminder | **No** | No | Local notifications only. The push entitlement is removed (`plugins/withoutPushEntitlement.js`), and no push token is ever requested. |
| `expo-image-picker` | Progress photos | No | No | The photo is copied into the app's private folder. The picker's temp copy is deleted. |
| `expo-document-picker`, `expo-file-system`, `expo-sharing` | Restore and export backups | No | No | The person chooses where an export goes. Temp files are deleted. |
| `expo-haptics` | Taps and success feedback | No | No | |
| `expo-web-browser` | Opens the privacy policy | Only when tapped | No | Opens one fixed https URL in Safari View Controller. |

No analytics, crash reporting, advertising, attribution or social SDKs are included. `npm audit --omit=dev`
advisories are confined to build tooling (see README → Security).
