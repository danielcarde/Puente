# Puente

A public-ready hackathon prototype for a bilingual AI assistant connecting El Paso and Ciudad Juárez community resources.

## Project structure

- `puente_borderhack_2026.html` — main frontend page, AI/chat UI, Google Maps, and Firestore data loading
- `src/firebaseConfig.js` — Firebase app initialization using local key imports
- `src/keys.example.js` — example key file for setup
- `src/keys.js` — local ignored key file for your secret API keys
- `.gitignore` — excludes local secret files and editor artifacts

## Setup

1. Run `npm install`.
2. Copy `src/keys.example.js` to `src/keys.js`.
3. Replace placeholder values with your real keys and Firebase config values.
4. Start a local server and open `puente_borderhack_2026.html`.

Example:

```bash
npm install
npx serve .
```

## Notes

- `src/keys.js` is ignored by Git to keep secret keys out of the public repo.
- `src/firebaseConfig.js` is safe to commit because it only imports the local key file.
- If you want to deploy, make sure your Firebase and Google Maps keys are properly restricted.
