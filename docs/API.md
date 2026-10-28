# API reference

Base URL: `http://localhost:4000/api/v1`. JSON uses UTF-8. Case endpoints other than create require `Authorization: Bearer <accessToken>`. The token is returned once at creation; keep it in browser storage and never place it in the URL.

## `GET /health`

Liveness only. Returns `{ "status": "ok" }`.

## `POST /cases`

Creates a generating case shell. Request fields: `premise` (20–1,500 chars) and optional `settings` (`setting`, `tone`: cozy/classic/thriller, `difficulty`: easy/medium/hard, `length`: short/standard/long). Returns `202` promptly with `caseId`, one-time `accessToken`, initial safe generation stage, and `pollUrl`. Poll the case URL until it is `ready` or `failed`. When Gemini credentials are absent, the service uses deterministic fictional fixtures. With Gemini configured, the server generates the complete structured case in one model call, validates it, and permits one repair call.

## `GET /cases/:caseId`

Returns the case lifecycle. While generating, it returns only the current safe stage. On failure it returns a safe code and whether one retry remains. Once ready, it returns the public case DTO and progress. Before accusation it omits all answer key fields and unrevealed hints. After accusation it includes `reveal`.

## `POST /cases/:caseId/retry`

Retries a failed case once. Requires the case access token. Returns `202` with the generating state. A second retry is rejected.

## `GET /cases/:caseId/evidence/:evidenceId`

Returns one fictional evidence item after access validation.

## `PATCH /cases/:caseId/progress`

Idempotently records valid `reviewedEvidenceIds` and `inspectedSuspectIds` arrays. Unknown IDs are rejected.

## `POST /cases/:caseId/hints`

Body `{ "hintIndex": 0 }`. Only the next sequential hint is returned. The server enforces the generated hint cap.

## `POST /cases/:caseId/accusation`

Body `{ "suspectId": "S-02" }`. The first valid submission is final and server graded. Returns the outcome and reveal. Duplicate submissions return `ALREADY_SUBMITTED`.

## `DELETE /cases/:caseId`

Deletes the case after access validation. MongoDB TTL cleanup removes expired cases by `expiresAt`.

Errors use `{ "error": { "code", "message", "requestId" } }`. Creation is rate limited. A configured but unavailable MongoDB returns a safe `DATABASE_UNAVAILABLE` response (and remote connection failure prevents startup); the server will not silently switch a configured remote database to memory storage. Internal provider errors are not returned to clients.
