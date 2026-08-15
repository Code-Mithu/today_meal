# Today Meal Offline

Standalone Expo Android app for household meal, expense, contribution, menu, member, vendor, and category management. All runtime data is stored in SQLite on the device. No Base44 account, API, sync service, or internet connection is required.

## Run on Ubuntu

Install Node.js 20 or newer, then:

```bash
corepack enable
pnpm install
pnpm start
```

Open Expo Go on Android and scan the QR code, or press `a` with an Android emulator running.

## Build an APK with EAS Cloud

```bash
pnpm exec eas login
pnpm exec eas init
pnpm build:apk
```

Open the build URL shown by EAS and download the APK.

## Build an APK locally on Ubuntu

Install JDK 17 and Android Studio/SDK. Ensure `JAVA_HOME` and `ANDROID_HOME` are configured, accept Android SDK licenses, then run:

```bash
pnpm install
pnpm exec eas login
pnpm exec eas init
pnpm build:apk:local
```

The completed `.apk` is written to the project directory. If EAS asks to generate Android credentials, allow it to create a new keystore and keep a secure backup.

## First launch

The app creates a private local household and realistic sample members, expenses, contributions, meals, menu items, categories, and vendors. Use Settings → Restore sample data to restore those examples later.
