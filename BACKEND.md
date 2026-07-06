# Backend specification — Viewer Balance System

Technical specification for the **StreamKit+ Viewer Balance** backend service. The desktop addon (`balance-system`) implements the client side only; this document is the contract for the server implementation.

## Overview

| Component | Responsibility |
| --- | --- |
| **StreamKit+ addon** | Owns viewer balances, tracks untriggered donations, syncs state to server RAM, receives spend commands via Socket.IO |
| **Backend server** | Serves viewer web page `?streamkit=LICENSE_ID`, Twitch OAuth for viewers, relays spend intents to addon via Socket.IO |
| **Viewer browser page** | Auth via Twitch, shows balance (from server RAM), lists purchasable triggers, requests spend |

The server **does not** store or mutate balances. It mirrors addon state in memory and forwards spend requests to the connected addon session.

## Hosts and URLs

Same host selection as StreamKit+ main app:

| Constant | URL |
| --- | --- |
| `DEFAULT_API_SERVER` | `https://rocketman-streams.com:443` |
| `AUTH_SERVER_RU_URL` | `https://ru.rocketman-streams.com:443` |
| `AUTH_SERVER_LOCAL_URL` | `https://local.rocketman-streams.com:443` |

The addon picks `DEFAULT_API_SERVER` vs `AUTH_SERVER_RU_URL` from app config `proxy`. In developer mode the addon can override the host manually (all three URLs).

| Surface | Path |
| --- | --- |
| REST API prefix | `/api/streamkit-balance` |
| Socket.IO HTTP path | `/api/streamkit-balance/socket.io` |
| Socket.IO namespace | `/streamkit-balance` |
| Viewer page | `https://{host}/?streamkit={LICENSE_ID}` |

Reference layout (similar to legacy `?rmkit=384` page): https://rocketman-streams.com/?rmkit=384

## Session model

1. Addon starts → `POST /api/streamkit-balance/register`
2. Server validates StreamKit+ license (via `accessToken` MD5 key fingerprint + `licenseId`), returns `licenseId`, `sessionToken`, `viewerPageUrl`
3. Addon → `POST /api/streamkit-balance/sync` with full state payload
4. Addon opens Socket.IO (`websocket` transport only) with `sessionToken`
5. On socket disconnect or server restart → addon re-registers and re-syncs; server drops in-memory state for that session

### In-memory storage (per `LICENSE_ID`)

| Key | Description |
| --- | --- |
| `streamer` | Broadcaster display name, avatar, login |
| `currency` | Balance currency code (e.g. `USD`, `RUB`, `UAH`) |
| `viewers` | `{ twitchId, login, displayName, balance }[]` |
| `addons` | Shop catalog (see below) |
| `categories` | Category list for UI tabs |
| `connected` | Whether addon socket is connected |
| `licenseValid` | License check result |

**Persistence:** RAM only. On disconnect/restart, data is cleared except temporarily saved addon logos (see below).

### Addon logos

- Addon sends optional `logoBase64` per addon entry in sync payload
- Server saves decoded files under `tmp/streamkit-balance/{LICENSE_ID}/logos/{addonId}.png`
- Delete the entire `tmp/streamkit-balance/{LICENSE_ID}/` folder when:
  - Addon socket disconnects
  - Backend process restarts

## REST API

### `POST /api/streamkit-balance/register`

Registers a new addon session.

**Request body:**

```json
{
  "addonId": "XXanderWP/streamkit-addon-balance-system",
  "accessToken": "<MD5 hex digest of device license key (license.keyMd5)>",
  "licenseId": "384",
  "streamer": {
    "twitchId": "123",
    "login": "streamer",
    "displayName": "StreamerName",
    "avatar": "https://..."
  }
}
```

**Server actions:**

1. Resolve license from `accessToken` (MD5 device key fingerprint) and `licenseId` (order ID from StreamKit+ settings)
2. If license invalid → `403` with `{ success: false, code: "license_invalid" }`
3. Generate `sessionToken` (random, opaque)
4. Store session keyed by `licenseId`
5. Build `viewerPageUrl`: `https://{publicHost}/?streamkit={licenseId}`

**Response:**

```json
{
  "success": true,
  "licenseId": "384",
  "sessionToken": "…",
  "viewerPageUrl": "https://rocketman-streams.com/?streamkit=384"
}
```

### `POST /api/streamkit-balance/sync`

Replaces in-memory state for the session.

**Request body:** `BalanceSyncPayload` (see addon `src/types.ts`):

```json
{
  "licenseId": "384",
  "sessionToken": "…",
  "streamer": { "displayName": "…", "avatar": "…", "login": "…" },
  "currency": "RUB",
  "viewers": [
    { "twitchId": "1", "login": "viewer", "displayName": "Viewer", "balance": 150.5 }
  ],
  "categories": [
    { "id": "default", "name": { "en": "Actions", "ru": "Действия", "uk": "Дії" } }
  ],
  "addons": [
    {
      "addonId": "overlay_bsod",
      "name": { "en": "BSOD", "ru": "…", "uk": "…" },
      "description": { "en": "…" },
      "categoryId": "default",
      "logoBase64": "…",
      "triggers": [
        { "id": "auto:shop:addon:11", "price": 11 }
      ]
    }
  ],
  "sounds": {
    "name": { "en": "Sounds", "ru": "Звуки", "uk": "Звуки" },
    "description": { "en": "…" },
    "logoBase64": "…",
    "triggers": [
      { "id": "auto:shop:sounds:3", "price": 3, "label": { "en": "Spider Test" } }
    ]
  },
  "allowSpendMessage": false
}
```

**Response:** `{ "success": true }`

**Errors:** `401` invalid session, `403` license invalid

### `GET /api/streamkit-balance/page-state?streamkit={LICENSE_ID}&lang={en|ru|uk}`

Public endpoint for the viewer web page (no session token).

**Response when offline / no license / addon disconnected:**

```json
{
  "success": true,
  "status": "unavailable",
  "reason": "offline" | "license" | "disconnected",
  "message": { "en": "…", "ru": "…", "uk": "…" }
}
```

**Response when available:**

```json
{
  "success": true,
  "status": "online",
  "streamer": { "displayName": "…", "avatar": "…" },
  "currency": "RUB",
  "allowSpendMessage": false,
  "categories": [ … ],
  "addons": [ … ],
  "viewer": null
}
```

After Twitch OAuth (below), include authenticated viewer balance:

```json
"viewer": {
  "twitchId": "…",
  "login": "…",
  "displayName": "…",
  "avatar": "…",
  "balance": 120.5
}
```

## Twitch OAuth (viewers)

Reuse the OAuth flow from the legacy RocketMan page (`?rmkit=`):

1. Viewer clicks **Login with Twitch** on `?streamkit=LICENSE_ID` page
2. Redirect to Twitch OAuth (server-side client id/secret)
3. Callback establishes viewer session (HTTP-only cookie or JWT)
4. Server maps `twitchId` → balance from in-memory `viewers` array (match by `twitchId`, fallback `login` case-insensitive)
5. Page header shows viewer avatar + display name from Twitch profile

Required Twitch scopes: `user:read:email` (minimum), `openid` if using OIDC — align with existing `rmkit` implementation.

## Socket.IO protocol

### Addon connection (server ← addon)

Connect:

```
wss://{host}/api/streamkit-balance/socket.io/?EIO=4&transport=websocket
```

Namespace auth packet:

```json
["/streamkit-balance", {
  "sessionToken": "…",
  "licenseId": "384",
  "addonId": "balance-system"
}]
```

**Server → addon events:**

| Event | Payload | Description |
| --- | --- | --- |
| `balance:spend` | `{ requestId, viewerTwitchId, viewerLogin?, itemId, message? }` | Viewer requested purchase on web page. `message` is optional viewer text (max 200 chars); only accepted when `allowSpendMessage` is `true` in synced state. |

**Addon → server events:**

| Event | Payload | Description |
| --- | --- | --- |
| `balance:spend-result` | `{ requestId, success, message?, balance?, itemId? }` | Spend processing result |

### Spend flow

1. Authenticated viewer clicks trigger on web page (optionally enters message when `allowSpendMessage` is enabled)
2. Server checks `viewer.balance >= item.price` (from RAM mirror)
3. Server emits `balance:spend` to connected addon socket
4. Addon deducts balance locally, fires dashboard trigger, calls `/sync`
5. Addon emits `balance:spend-result`
6. Server updates RAM viewer balance from new sync **or** from result payload
7. Page UI updates via polling or server-push (Socket.IO room per viewer optional)

If addon socket is disconnected → show trigger buttons disabled + toast “stream offline”.

## Viewer backup API

License auth uses `resolveLicense` (`licenseId` + MD5 HWID as `accessToken`).

### `GET /api/streamkit-balance/backup`

Query: `licenseId`, `accessToken`

Response:

```json
{ "success": true, "data": { "viewers": [...] } }
```

`data` is `null` when no backup file exists yet.

### `POST /api/streamkit-balance/backup`

Body:

```json
{
  "licenseId": "12345",
  "accessToken": "a1b2c3d4...",
  "data": { "viewers": [...] }
}
```

Response: `{ "success": true }`

Request body limit: **32 MB**.

| Code | HTTP |
| --- | --- |
| `invalid_request` | 400 |
| `license_invalid` | 403 |
| `backup_read_failed` / `backup_write_failed` | 500 |

## Viewer web page (`?streamkit=LICENSE_ID`)

### Languages

Russian, Ukrainian, English — language switcher in header. Use localized fields from payload with fallback to `en`.

### Layout (match legacy `rmkit` structure)

1. **Header**
   - Streamer avatar + display name (from sync payload)
   - Viewer avatar + name (after Twitch login)
   - Language selector (`en` / `ru` / `uk`)
   - Viewer balance + currency
2. **Unavailable state** (addon offline / app closed / invalid license)
   - Full-page styled placeholder with localized message
3. **Category tabs** from `categories`
4. **Addon cards** grouped by addon (`addons[]`), logo from `logoBase64` (saved server-side per addon id)
5. **Sounds card** optional top-level `sounds` block with its own `logoBase64` and trigger buttons (`label` = sound name)
6. **Trigger buttons** show price; optional `label` when the card title is not enough (sounds)
7. **Twitch login button** when viewer not authenticated

### Styling

Follow legacy RocketMan balance page visual structure (cards, header, primary buttons). Responsive layout, dark theme default.

## Security

| Topic | Rule |
| --- | --- |
| Balance authority | Only the desktop addon mutates balances |
| Session token | Required for `/sync` and socket auth; rotate on re-register |
| License | Validate on register and periodically on page-state |
| Rate limits | Apply on spend requests per viewer (e.g. 1 req / 2s) |
| CORS | Public page on same domain as API |

## Error codes

| Code | Meaning |
| --- | --- |
| `license_invalid` | No active StreamKit+ license |
| `session_invalid` | Bad or expired `sessionToken` |
| `addon_offline` | No active socket for `licenseId` |
| `insufficient_balance` | Viewer cannot afford item |
| `unknown_item` | `itemId` not in catalog |

## Deployment checklist

- [ ] Express (or existing app server) routes under `/api/streamkit-balance`
- [ ] Socket.IO v4 mounted at `/api/streamkit-balance/socket.io`
- [ ] Static viewer page bundle served at `/` with `streamkit` query param handler
- [ ] Twitch OAuth credentials (same app as legacy rmkit or new Twitch app)
- [ ] License validation service (shared with StreamKit+ API)
- [ ] `tmp/streamkit-balance/` cleanup job on process start
- [ ] TLS on port 443 for all three domains

## Addon RPC (reference)

Other addons can credit balance when enabled in settings:

```js
await addons.request('balance-system', 'creditBalance', {
  login: 'viewer_name',
  // or twitchId: '12345',
  amount: 10,
});
```

## Version

Document version: **1.0.0** — matches addon `manifest.version` 1.0.0.
