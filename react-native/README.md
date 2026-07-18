# Finovo Mobile

The isolated Expo/React Native application for Finovo AI. This folder owns all mobile-specific code and dependencies. It reuses the existing Express API but does not import UI code from the web application.

## Current phase

Phase 1 foundation is implemented:

- Expo SDK 57, React Native 0.86 and TypeScript.
- Stable Expo Router stack and bottom-tab navigation.
- Finovo design tokens and reusable native presentation components.
- Axios and TanStack Query API foundation.
- SecureStore-backed session persistence with web fallback.
- Persisted wallet selection.
- Live read-only Dashboard and Transactions screens.
- Placeholder routes for all later Finovo modules.

See [ROADMAP.md](./ROADMAP.md) for phase ownership and acceptance criteria.

## Configure

Copy `.env.example` to `.env.local` and set the backend origins without `/api`:

```env
EXPO_PUBLIC_API_URL_IOS=http://localhost:3000
EXPO_PUBLIC_API_URL_ANDROID=http://10.0.2.2:3000

# Google OAuth client IDs (the shared value is used as a fallback)
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=your-web-client-id.apps.googleusercontent.com
```

Host selection depends on the runtime:

- iOS simulator uses `EXPO_PUBLIC_API_URL_IOS`.
- Android emulator uses `EXPO_PUBLIC_API_URL_ANDROID`.
- Physical device: use the computer's LAN address, and ensure both devices are on the same network.
- Production: use the HTTPS Render/backend origin.

For a physical device or production build, set the shared `EXPO_PUBLIC_API_URL`; it takes precedence over the platform-specific development values.

For Google sign-in, add the iOS and Android OAuth client IDs to `.env.local`. Add the same IDs as a comma-separated `GOOGLE_MOBILE_CLIENT_IDS` value in the backend environment. The Android OAuth client must use package `com.hetarth123.finovomobile`; the iOS OAuth client must use the same bundle identifier. Google sign-in requires a development/production build and is not supported by Expo Go.

## Run

```bash
npm install
npm run ios
npm run android
```

Validation:

```bash
npm run check
npx expo export --platform web --output-dir /tmp/finovo-mobile-web
```

## Authentication

Mobile login, signup with email OTP, Google sign-in, forgot password and password reset use the same endpoints as the website. Authentication responses include the short-lived JWT as `accessToken`; the app stores it in SecureStore and sends it as a Bearer token. A rotating refresh-token flow remains a production hardening item described in [docs/BACKEND_CONTRACT.md](./docs/BACKEND_CONTRACT.md).
