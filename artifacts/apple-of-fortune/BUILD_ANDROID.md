# Building the Android APK (Apple of Fortune)

This Expo project can't be compiled into an `.apk` inside Replit — there's no
Android SDK/Gradle here. Instead you build it for free on **EAS Build** (Expo's
cloud), which returns a downloadable, installable `.apk`.

The project is already configured for this:

- `eas.json` has a **`preview`** profile that outputs an APK (`buildType: "apk"`).
- `app.json` has the required Android settings (`package`, `versionCode`,
  `adaptiveIcon`).

## One-time setup

1. Create a free Expo account: https://expo.dev/signup
2. Install the EAS CLI (needs Node.js installed):
   ```bash
   npm install -g eas-cli
   ```
3. Log in:
   ```bash
   eas login
   ```

## Build the APK

Run these from the app folder (`artifacts/apple-of-fortune/`):

1. Link the project to your Expo account (sets the EAS project id):
   ```bash
   eas init
   ```
2. Start the cloud build:
   ```bash
   eas build -p android --profile preview
   ```
   - When prompted to generate an Android **keystore**, accept the EAS-managed
     keystore (just press Enter / choose "Yes"). This is fine for a test/preview
     build.
3. The build runs on Expo's servers (usually a few minutes). When it finishes,
   the CLI prints a **download URL** for the `.apk`. You can also find it later:
   ```bash
   eas build:list
   ```
   or in the Expo dashboard at https://expo.dev (your project → Builds).

## Install on a phone

1. Download the `.apk` from the URL above onto your Android phone.
2. Open it. Android will ask to allow installing from this source — enable
   **"Install unknown apps"** for your browser/file manager, then install.

## Notes

- `preview` = installable `.apk` for sideloading/testing.
- `production` (in `eas.json`) builds an Android **App Bundle** (`.aab`) for
  publishing to the Google Play Store — use that only when you're ready to submit
  to Play, not for direct install.
- To bump the app version later, increase `version` and `android.versionCode` in
  `app.json` before rebuilding.
