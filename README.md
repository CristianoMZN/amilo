# Amilo

Amilo is a local-first companion for tracking nutrition, calories,
macronutrients, hydration, weight, and training. Your profile and activity data
stay on the device, with the same experience available in the browser during
development and in the Android app through Capacitor.

## Requirements

- Node.js 22.12 or newer
- pnpm 10 or newer

## Install

```bash
pnpm install
```

## Run in development

```bash
pnpm dev
```

The browser development build uses an in-memory database stub. Native SQLite
persistence is used by the Android build.

## Validate and build

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Main areas

- **Dashboard** — profile, weight, metabolic estimates, and daily summary.
- **Nutrition** — meals, foods, calories, macro targets, and daily totals.
- **Exercise** — aerobic and strength exercise logging.
- **Workouts** — workout sheets, sessions, sets, and history.
- **Onboarding** — measurement preferences and profile setup.

Amilo ships with English, Spanish, Brazilian Portuguese, German, French,
Japanese, Korean, and Italian translations. The interface is designed for
mobile screens first and uses the same responsive layouts on larger displays.

## Project structure

The application is a Quasar Vite + Vue 3 app. Domain rules live in
`src/domain`, persistence is organized into `src/database` and
`src/repositories`, shared state uses Pinia in `src/stores`, and translated
interface text lives in `src/i18n`.

## Android release

Pushing or merging to `main` triggers `.github/workflows/android-release.yml`,
which builds a signed release APK and publishes it to GitHub Releases.

Required repository secrets (set under **Settings > Secrets and variables >
Actions**):

- `RELEASE_KEYSTORE_BASE64` — Base64-encoded signing keystore (`.jks` or
  `.keystore`). Generate with:
  ```bash
  keytool -genkey -v -keystore release.keystore -alias amilokey \
    -keyalg RSA -keysize 2048 -validity 10000
  base64 -w 0 release.keystore > release.keystore.b64
  ```
- `RELEASE_KEY_ALIAS` — key alias used when creating the keystore.
- `RELEASE_KEY_PASSWORD` — key password.
- `RELEASE_STORE_PASSWORD` — keystore password.

Keep the keystore file and passwords out of the repository; they are only used
inside the workflow run.
