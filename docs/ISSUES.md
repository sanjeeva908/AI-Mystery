# Completion audit and remaining issues

Audit date: 2026-10-26. This continues the existing AI Mystery Room project.

## Verified

- The MERN application, deterministic fixture game, asynchronous case lifecycle, and answer-key allowlisting remain in place.
- The frontend at localhost:5173 returns HTTP 200. The Express API at localhost:4000 returns health status ok and allows CORS from the configured frontend origin. The user-visible fetch failure was caused by the API process not running; the API is now running and connected.
- The updated local GEMINI_MODEL is gemini-3.5-flash-lite. The configured gemini-2.5-flash appeared in the model catalog but generateContent returned 404 as unavailable to new users. gemini-3.5-flash-lite passed content generation and complete-case checks.
- Two real Gemini API cases reached ready with gemini-3.5-flash-lite: one in 11.9 seconds after a single repair, and a second in 6.2 seconds without repair. Both ready responses omitted answerKey. The cases had 6 and 5 evidence items.
- The one-call generator records per-call and per-stage latency, uses difficulty-specific output budgets, applies schema/fairness/reference checks, bounds transient retries, and allows one repair call. Mock tests cover successful output, malformed output, partial generation, timeout, and bounded retry behavior.
- MongoDB authentication and the configured database selection now work. The server selected ai_mystery_room via MONGODB_DB_NAME even though the Atlas URI had no database path. A real Gemini case reached ready through the Mongo-backed API in 17.9 seconds, progress was saved, answerKey was absent, and the temporary case was deleted.
- The opt-in Mongo integration test passed: it created a case record, saved progress, reconnected, retrieved that progress, and observed TTL deletion after about 59 seconds.
- A live API-created fixture case backed by Mongo reached ready, saved progress, survived a real API process restart, remained answer-key private, and was deleted after verification.
- Fixture tests, lint, typecheck, desktop/mobile Playwright, and production build passed. The regular tests report 11 server tests and 2 client tests passed; the Mongo integration suite is opt-in.

## Remaining / partially implemented

- Fairness checks are structural and cannot prove semantic uniqueness or consistency of every alibi. Human review remains necessary.
- No image provider or polished fallback illustration is configured. Generated content uses text evidence and does not claim image output.
- Fixture cases vary premise, setting, and difficulty, but not tone or case length. The landing expiry notice is fixed at 30 days and should match deployments that change CASE_TTL_DAYS.
- Case deletion is available in the API but not exposed in the case-room UI. Content reporting is not implemented; analytics are optional.
- Desktop/mobile flow is browser-tested, but WCAG 2.2 AA, screen-reader behavior, and full keyboard-only operation have not been audited.
- The production build passes, with a Vite warning for the main client chunk at about 541 KB minified (about 160 KB gzip).
- gemini-3.8-flash and gemini-flash-latest returned temporary 503 high-demand errors during the audit. They are not the configured model; gemini-3.5-flash-lite was tested successfully.

## Operational notes

- In development, the client uses the Vite `/api` proxy. This avoids CORS failures when Vite selects a port other than 5173. Direct API access still requires CLIENT_ORIGIN to match the browser origin.
- No test case remains in MongoDB.

## Next actions

1. Review semantic fairness, image placeholder/media support, accessibility, and the production bundle warning before public deployment.
2. Keep GEMINI_MODEL set to a model confirmed to support generateContent for the configured key.
