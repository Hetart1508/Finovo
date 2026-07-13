# Mobile Backend Contract

This document records backend capabilities needed by the mobile application. It does not authorize edits outside the `react-native/` folder.

## Existing endpoints already consumed

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/wallets
GET  /api/transactions?wallet_id=:id&limit=:limit&offset=:offset
```

The existing authentication middleware already accepts `Authorization: Bearer <JWT>`, so finance endpoints do not need mobile-specific duplicates.

## Required production authentication response

The mobile app accepts this shape:

```json
{
  "user": {
    "id": 1,
    "name": "Finovo User",
    "email": "user@example.com",
    "daily_threshold": 1000
  },
  "expiresAt": 1780000000000,
  "accessToken": "short-lived-jwt",
  "refreshToken": "rotating-refresh-token"
}
```

Recommended endpoints:

```text
POST /api/auth/mobile/login
POST /api/auth/mobile/register/verify-otp
POST /api/auth/mobile/google
POST /api/auth/mobile/refresh
POST /api/auth/mobile/logout
```

Requirements:

- Keep the website's HTTP-only cookie behavior unchanged.
- Hash refresh tokens in MySQL.
- Rotate refresh tokens on every successful refresh.
- Revoke them on logout, password reset and account deletion.
- Return a stable machine-readable error code in addition to the user-facing error.

## Statement import requirement

Preferred request:

```text
POST /api/statement-import/file-preview
Content-Type: multipart/form-data

file=<PDF or image>
password=<optional PDF password>
```

The response should match the existing preview response: transactions, statement hash, duplicate status, provider and model. The current mobile UI limit and Multer limit must agree; 10 MB is the proposed maximum.

## Document storage requirement

Production bill files must use private persistent object storage and signed URLs. Local `uploads/` storage is not considered durable for the mobile release.
