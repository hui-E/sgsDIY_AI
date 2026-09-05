# Repository Guidelines

A Capacitor 7 project for the "三国杀武将 DIY" card generator. The web app lives in `public/` and is wrapped into Android via Capacitor. The browser is a debugging surface; the installed APK is the source of truth.

## Project Structure & Module Organization

- `public/index.html` — single-page entry; views are toggled with `.view.hidden`.
- `public/css/style.css` — all styling.
- `public/js/*` — ES modules. `main.js` binds UI and routing; `random.js`/`data.js` are pure logic; `render.js`/`export.js`/`gestures.js` handle canvas, export, and touch; `ai.js`/`image.js` handle APIs and native detection.
- `server.js` — zero-dependency dev server (port `5173`); proxies external image/AI requests to avoid CORS. Browser-only, not shipped in the APK.
- `android/` — generated Capacitor shell, synced from `public/` with `npx cap sync`.
- Never staged: `docs/`, `tools/`, `tmp/`, `素材/`, plus secrets and build outputs.

## Build, Test, and Development Commands

```bash
npm start                  # runs node server.js -> http://localhost:5173
node server.js 8080        # pick another port

npx cap sync android       # copy public/ into android/
cd android
.\gradlew assembleRelease  # outputs android/app/build/outputs/apk/release/app-release.apk
```

If the system `npx` (node 18) fails to run `cap`, use the runtime npx:

```powershell
& "C:\Users\HUIE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\npx.cmd" cap sync android
```

No test runner or linter; `npm test` is a placeholder.

## Coding Style & Naming Conventions

- ES modules with `import`/`export`; two-space indent; single quotes.
- Kebab-case IDs (`#rnd-draw`), camelCase functions (`onRndDrawClick`), UPPER_SNAKE constants.
- Brief Chinese comments; no auto-formatter.

## Testing Guidelines

- No framework. `random.js` (draw / sort / clamp) is pure — verify it with a throwaway node script.
- Keep platform-specific behavior out of pure logic; verify in the browser, then on the APK.

## Commit & Pull Request Guidelines

- Short, plain titles; avoid AI-sounding text. Common prefixes: `feat:`, `fix:`, `chore:`, `docs:`, scoped like `feat(ai):`. Examples: `feat: 新增随机抽取模块`, `修复bug`.
- Stage only relevant source files, e.g. `git add public/index.html public/css/style.css public/js/main.js`; never add `docs/` or `README.md` (line-ending churn).
- Do not push; wait for confirmation. Releases are signed via `keystore.properties` and `sgsdiy-release.jks`.

## Security & Configuration

- `keystore.properties`, `*.jks`, `.env*`, `*.key`, `*.apk` are gitignored — never commit them. API keys and app config live in `localStorage`.

## Agent-Specific Instructions

- Treat the installed APK/WebView as the acceptance target; the browser is a debug surface. WebView and desktop browsers differ (pointer events, audio autoplay, CORS/proxy).
- Consolidate platform differences (`isNative()`, `capPlugin`, external HTTP) behind one module instead of scattering checks through `main.js`.
