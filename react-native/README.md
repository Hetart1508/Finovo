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
```

Host selection depends on the runtime:

- iOS simulator uses `EXPO_PUBLIC_API_URL_IOS`.
- Android emulator uses `EXPO_PUBLIC_API_URL_ANDROID`.
- Physical device: use the computer's LAN address, and ensure both devices are on the same network.
- Production: use the HTTPS Render/backend origin.

For a physical device or production build, set the shared `EXPO_PUBLIC_API_URL`; it takes precedence over the platform-specific development values.

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

## Current authentication limitation

The existing backend returns the user and expiry while setting an HTTP-only web cookie. The client supports an optional `accessToken` already, but reliable restart-safe native authentication requires the mobile Bearer/refresh-token contract described in [docs/BACKEND_CONTRACT.md](./docs/BACKEND_CONTRACT.md).

Until that backend phase is authorized, login uses the existing cookie response and is intended for development validation only.
