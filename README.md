# Puente

Team hackathon prototype for a bilingual community-resource assistant for El Paso and Ciudad Juarez. Daniel Cardenas contributed Firebase resource loading and Google Maps integration. Existing team contributions remain credited in repository history.

## What is implemented

A JavaScript browser interface provides English/Spanish controls, resource cards, an optional Google map, Firestore loading with fallback sample resources, and a chat interface. Chat requests go through a same-origin Node endpoint that holds the Gemini service credential on the server. Chat and resource content render as text nodes, including markup-like input.

This is an educational prototype. Resource information and model answers require independent verification. Authentication, an admin dashboard, retrieval-augmented generation, analytics infrastructure, and offline operation are future ideas rather than completed features. The embedded pitch reflects this scope.

## Local setup

Requires Node 22 or newer.

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` locally. Keep this file private.
2. Set `ALLOWED_ORIGINS=http://127.0.0.1:8000` (or the exact origin you use).
3. Optionally configure public Firebase identifiers and a restricted Maps browser key in `src/browserConfig.js`. With these blank, fallback resources work and the map is unavailable.
4. Run `npm start` and open `http://127.0.0.1:8000`.

No dependency installation is required by the local server or native Node tests. The existing Firebase npm dependency remains available; the current browser initializes Firebase through its CDN modules. Never put the Gemini credential in a browser module or `src/keys.js`. Git ignore rules alone do not protect a file served to a browser.

## Hosting design

The proposed hosting target is Vercel with the static frontend and Node function `api/chat.mjs` on the same origin. Configure `GEMINI_API_KEY` and an exact comma-separated `ALLOWED_ORIGINS` list as server environment variables. The function calls Gemini 2.5 Flash; it sends the key in a request header. `vercel.json` and `.vercelignore` exclude/block legacy key and environment paths. Deploying or rotating credentials is a separate action and has not been performed.

The endpoint validates origin, method, content type, message schema, and actual request size (8 KiB); it limits messages to 12 with 2,000 characters each. It applies per-client and global request limits, a concurrency cap, and an upstream timeout. These in-memory limits are best-effort per process. A production service needs a shared quota store and appropriate abuse protection across instances. Origin checks are not authentication. Review Firestore rules and restrict Maps keys by API and HTTP referrer before public hosting. Protect preview environments with the same configuration rules.

## Verification

```sh
npm test
```

Nine native Node tests cover server-only credential use, missing configuration, invalid input, size limits, rate windows, upstream failure redaction, and text-only rendering. Model calls are mocked; tests do not spend API credits. CI runs the suite on Node 22. `/tests/browser-harness.html` is available only in the local development server for manual rendering checks.

## Structure

- `index.html`: frontend and prototype pitch.
- `src/safeRender.js`: safe chat/resource DOM construction.
- `src/browserConfig.js`, `src/firebaseConfig.js`: public browser configuration and optional Firestore initialization.
- `server/chat.mjs`: bounded Gemini proxy.
- `api/chat.mjs`: hosting adapter; `scripts/dev-server.mjs`: local static/API server.
- `tests/`: mocked endpoint and rendering checks.
