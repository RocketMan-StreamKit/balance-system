# Viewer balance system

StreamKit+ application addon for **Twitch** streamers: tracks donations that did not trigger overlays/sounds/hotkeys, maintains per-viewer balances with currency conversion, and exposes a public web page where viewers spend balance on configured stream actions.

- **Addon id:** `balance-system`
- **Type:** `application`
- **Depends on:** `twitch`
- **Minimum StreamKit+:** `1.0.21`

## Features

- Credits balance from dashboard **donation** events with **empty** `attach` (no overlay/sound/hotkey/timer fired)
- Stores viewers by **Twitch id + login** (login change safe)
- Balance currency: app default or USD / RUB / UAH / EUR / KZT / BYN; changing currency converts viewer balances, shop prices, and site-activation trigger thresholds
- In-app window: search, sort, add/edit/delete viewers; **Shop** tab to bind overlay/sound/timer triggers to purchasable items (StreamKit+ `styles.css`)
- Registers **Site activation** dashboard trigger (`valueType: number`, cost in balance currency) for overlays/sounds
- Backend sync + Socket.IO spend commands (see [BACKEND.md](./BACKEND.md))
- Server backup of viewer balances (restore from server on startup when local list is empty, debounced upload on changes)
- RPC `creditBalance` for other addons (opt-in setting)
- Optional viewer message on web page spend (opt-in setting)

## Development

```bash
npm install
npm run build
```

Install the `dist/` folder in **StreamKit+ → Settings → Applications**.

Enable **Twitch** addon and authorize the broadcaster account before using balance sync.

In **developer mode**, choose API server in addon settings (`rocketman-streams.com`, `ru.rocketman-streams.com`, or `local.rocketman-streams.com`).

## Settings

| Option | Description |
| --- | --- |
| Balance currency | Storage/display currency (default: same as app); all stored amounts are converted when this or the app currency (in app mode) changes |
| Allow other addons to credit balance | Lets other addons credit viewer balances through this addon (RPC `creditBalance`); does not affect donation-based top-ups registered in the app |
| Add message to activation | Lets viewers attach an optional message on the web page before spend |
| Backup viewer balances on server | Uploads viewer data to backend backup API (default: on) |
| API server (dev only) | Manual backend host selection |
| Viewer page URL | Auto-filled after backend registration |

**Shop** items are configured automatically from overlay/sound balance trigger rules, or via backend sync.

## Viewer page

After the addon connects to the backend, copy **Viewer page URL** from settings or the application window.

Format: `https://rocketman-streams.com/?streamkit={LICENSE_ID}`

## RPC example

```js
const res = await addons.request(
  'balance-system',
  'creditBalance',
  { login: 'viewer_login', amount: 5 }
);
```

## Backend

Server implementation is **not** part of this repository. Full API and page specification: **[BACKEND.md](./BACKEND.md)**.

## Release

Push to `main` or run the **Release addon** GitHub Action. Tag `v{version}` from `manifest.json`.

Docs: [StreamKit+ addon developer docs](https://rocketman-streamkit.github.io/types/)
