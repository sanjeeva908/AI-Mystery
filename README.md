# AI Mystery Room

A browser based fictional mystery investigation. Players create a premise, inspect suspects and fictional evidence, request graduated hints, and make one final accusation. The server keeps the answer key private until the accusation is submitted.

## Stack and requirements

- Node.js 24 LTS recommended; npm workspaces.
- Lockfile-selected versions include React 19.3, Vite 8.3, TypeScript 5.9 for the API and 6.0 for the client, Express 5.3, Mongoose 9.11, Zod 4.6, and the official Google GenAI SDK 1.52.

## Run locally

1. `npm install`
2. Copy `.env.example` to the workspace root as `.env`; set `MONGODB_URI` for persistent storage. Set MONGODB_DB_NAME for the database name, which defaults to ai_mystery_room. `GEMINI_API_KEY` is optional for fixture mode. Configure `GEMINI_MODEL` to a model enabled for your API key and `GENERATION_TIMEOUT_MS` for the complete generation budget.
3. `npm run dev` starts the API at port 4000 and Vite at port 5173 (or the next available port). In development, Vite proxies `/api` to the API so an automatic port change does not cause a browser CORS failure. Set `VITE_API_URL` only when the client must call a separately hosted API directly.
4. Open `http://localhost:5173`.

Leave `MONGODB_URI` empty for temporary in-memory development cases, or point it at a local MongoDB instance. Only an unreachable loopback MongoDB is allowed to fall back in development; a configured remote URI that fails authentication or network selection stops the server rather than pretending that cases are persistent. For Atlas, use a Database Access database user (not your Atlas web login) with readWrite access to ai_mystery_room. Percent-encode reserved characters in the username or password and confirm the current client IP is allowed. The app selects MONGODB_DB_NAME even when the URI has no database path. Production requires MongoDB. Case expiry defaults to 30 days through `CASE_TTL_DAYS`; activity refreshes expiry and MongoDB TTL cleanup uses the `expiresAt` index.

## Scripts

- `npm run dev`: client and server watch processes.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- `npm run test:e2e`: Playwright desktop Chromium and 360px mobile Chromium full gameplay flow. Installs the Playwright Chromium browser once with `npx playwright install chromium`.
- `npm start`: run compiled API server. Run npm run test:mongo --workspace server to verify MongoDB persistence, progress across reconnect, and TTL cleanup when Atlas authentication works.

## Architecture

`client/` is the React investigation interface, `server/` owns validation, case lifecycle, access control, persistence, fixture generation and Gemini integration, and `shared/` contains Zod contracts and TypeScript DTOs. Mongo cases contain public content and the private answer key, but API DTOs are explicit allowlists until reveal. Gemini credentials and prompts never enter the browser bundle.

## API and privacy

See [docs/API.md](docs/API.md) for endpoints. Case access requires the one-time bearer token. It is kept in local storage so a refresh can resume. No names or contact details are requested. Premises and case details are stored with the case until expiry or deletion. Set `CLIENT_ORIGIN` to the exact web origin.

## AI behavior and limitations

Without GEMINI_API_KEY, deterministic fictional cases exercise the complete fixture gameplay loop. With a key, the server makes one structured complete-case request, validates schema, difficulty counts, references, and fairness rules, then makes one repair request only if validation fails. Progress is asynchronous with safe polling stages, bounded provider retries, a configurable generation timeout, and one explicit case retry after failure. The configured model gemini-3.5-flash-lite has completed real generation checks for this API key.

The 2026-10-26 live audit verified two real cases reaching ready through the API, one after a repair and one without. Both ready responses omitted answerKey. MongoDB-backed case creation, progress, retrieval after API process restart, and TTL cleanup are also verified. A Gemini-generated case reached ready through MongoDB, saved progress, omitted answerKey, and was deleted after verification. See docs/ISSUES.md for results and remaining gaps. The fairness validator cannot prove subtle story logic. Do not treat generated content as authentic evidence. No image provider or polished placeholder is configured, so image generation is not claimed.
## Deploy on Render

This repo includes a `render.yaml` Blueprint for one Node web service. The service builds the Vite client and serves it with the Express API from the same HTTPS origin.

1. **Rotate credentials before deploying.** The earlier `.env.example` in this working tree contained credential-looking values. Replace any exposed MongoDB database-user password and Google AI key in their provider consoles, then use the new values only in Render's environment settings. Never commit `.env` or production secrets.
2. **Push the project to a Git provider** supported by Render. Confirm the repository includes `render.yaml`, `package-lock.json`, and the updated `.env.example`.
3. **Create a MongoDB Atlas database** (or use an existing one). Create a database user with read/write access to `ai_mystery_room`, allow connections from Render (Atlas network access may require `0.0.0.0/0` for Render's changing outbound IPs), and copy the URI. URL-encode reserved characters in the username/password.
4. **Create the Render service.** In Render, choose **New → Blueprint**, connect the repository, and apply the `ai-mystery-room` service. The build command is `npm ci && npm run build`; start command is `npm start` and health check is `/health`.
5. **Set the service environment values** in Render before the first deploy:
   - `CLIENT_ORIGIN`: the exact public origin Render assigns, such as `https://ai-mystery-room.onrender.com` (no trailing slash).
   - `MONGODB_URI`: your rotated Atlas connection string.
   - `GEMINI_API_KEY`: your rotated Google AI key. The app can run without it in fixture mode, but AI case generation will be unavailable.
   - `NODE_ENV` and `MONGODB_DB_NAME` are set by the Blueprint. Render supplies `PORT` automatically.
6. **Deploy and verify.** Wait for the build to finish, open the service URL, then visit `/health` and confirm it returns `{"status":"ok"}`. Create a case in the UI to check generation and database persistence.
7. **Keep secrets in Render only.** For local development, copy `.env.example` to `.env` and add credentials there. Do not put API keys in `VITE_*` variables; those are embedded in the public browser bundle.

For a custom domain, add it in Render, update `CLIENT_ORIGIN` to that exact HTTPS origin, and redeploy. The client calls `/api/v1` on its own origin, so no separate frontend API URL is needed.
## Project contract

The full requirements are in [docs/SPEC.md](docs/SPEC.md). Decisions and known limitations are in [docs/DECISIONS.md](docs/DECISIONS.md).

