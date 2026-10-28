import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { createCaseSchema, type CaseContent } from '@mystery/shared';
import { config } from './config.js';
import { generateCase } from './generation.js';
import { commitAccusation, completeGeneration, createStoredCase, failGeneration, getCase, retryGeneration, saveCase, setGenerationStage, tokenMatches, touchCase, type StoredCase } from './store.js';

export const app = express();
app.disable('x-powered-by'); app.set('trust proxy', 1); app.use(helmet()); app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: false })); app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => { if (config.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') { res.status(426).json({ error: { code: 'HTTPS_REQUIRED', message: 'Secure HTTPS access is required.' } }); return; } next(); });
app.use((req, res, next) => { const id = randomUUID(); res.setHeader('X-Request-Id', id); (req as Request & { requestId?: string }).requestId = id; next(); });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/cases', rateLimit({ windowMs: config.RATE_LIMIT_WINDOW_MS, limit: config.NODE_ENV === 'test' ? 100 : config.RATE_LIMIT_MAX_CASES, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Please wait a little before creating another case.' } }, skip: (req) => req.method !== 'POST' || req.path !== '/' }));
const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message, requestId: res.getHeader('X-Request-Id') } });
function publicDto(doc: StoredCase & { content: CaseContent }, reveal = false) {
  const { answerKey, ...publicContent } = doc.content;
  const dto: Record<string, unknown> = { ...publicContent, caseId: doc.publicId, status: doc.status, hintLimit: answerKey.hints.length, progress: doc.progress, ...(doc.accusation ? { accusation: { suspectId: doc.accusation.suspectId, isCorrect: doc.accusation.isCorrect } } : {}) };
  if (reveal && doc.accusation) dto.reveal = { ...answerKey, culpritName: doc.content.suspects.find((s) => s.id === answerKey.culpritSuspectId)?.name ?? 'Unknown' };
  return dto;
}
function readyCase(doc: StoredCase): doc is StoredCase & { content: CaseContent } { return (doc.status === 'ready' || doc.status === 'completed') && Boolean(doc.content); }
async function runGeneration(doc: StoredCase) {
  try {
    const content = await generateCase(doc.premise, doc.settings, (stage) => setGenerationStage(doc, stage));
    await completeGeneration(doc, content);
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith('GENERATION_') ? error.message : 'GENERATION_INVALID';
    try { await failGeneration(doc, code); } catch { /* Database outage is surfaced on the next authenticated poll. */ }
  }
}
async function authorized(req: Request, res: Response) {
  const doc = await getCase(String(req.params.caseId ?? ''));
  if (!doc) { fail(res, 404, 'CASE_NOT_FOUND', 'This case is unavailable.'); return undefined; }
  if (doc.expiresAt.getTime() <= Date.now()) { fail(res, 410, 'CASE_EXPIRED', 'This case has expired.'); return undefined; }
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token || !tokenMatches(doc, token)) { fail(res, 403, 'ACCESS_DENIED', 'You do not have access to this case.'); return undefined; }
  await touchCase(doc);
  return doc;
}
app.post('/api/v1/cases', async (req, res, next) => {
  try {
    const parsed = createCaseSchema.safeParse(req.body); if (!parsed.success) { fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Check the case details and try again.'); return; }
    const { doc, token } = await createStoredCase(parsed.data.premise.slice(0, config.MAX_PREMISE_LENGTH), parsed.data.settings);
    res.status(202).json({ caseId: doc.publicId, accessToken: token, status: doc.status, generation: doc.generation, pollUrl: `/api/v1/cases/${doc.publicId}` });
    void runGeneration(doc);
  } catch (err) { next(err); }
});
app.get('/api/v1/cases/:caseId', async (req, res, next) => { try { const doc = await authorized(req, res); if (!doc) return; if (doc.status === 'generating') { res.json({ caseId: doc.publicId, status: doc.status, generation: { stage: doc.generation.stage } }); return; } if (doc.status === 'failed') { res.json({ caseId: doc.publicId, status: doc.status, generation: { errorCode: doc.generation.errorCode }, retryAvailable: doc.generation.attemptCount < 2 }); return; } if (!doc.content) { fail(res, 409, 'CASE_NOT_READY', 'This case is not ready yet.'); return; } res.json(publicDto(doc as StoredCase & { content: CaseContent }, doc.status === 'completed')); } catch (err) { next(err); } });
app.post('/api/v1/cases/:caseId/retry', async (req, res, next) => { try { const doc = await authorized(req, res); if (!doc) return; if (!await retryGeneration(doc)) { fail(res, 409, 'GENERATION_INVALID', 'This case cannot be retried. Start a new case instead.'); return; } res.status(202).json({ caseId: doc.publicId, status: 'generating', generation: doc.generation }); void runGeneration(doc); } catch (err) { next(err); } });
app.get('/api/v1/cases/:caseId/evidence/:evidenceId', async (req, res, next) => {
  try {
    const doc = await authorized(req, res); if (!doc) return;
    if (!readyCase(doc)) { fail(res, 409, 'CASE_NOT_READY', 'This case is not ready yet.'); return; }
    const item = doc.content.evidence.find((e) => e.id === req.params.evidenceId);
    if (!item) { fail(res, 404, 'EVIDENCE_NOT_FOUND', 'This evidence is unavailable.'); return; }
    res.json(item);
  } catch (err) { next(err); }
});
app.patch('/api/v1/cases/:caseId/progress', async (req, res, next) => {
  try {
    const doc = await authorized(req, res); if (!doc) return;
    if (!readyCase(doc) || doc.accusation) { fail(res, 409, 'CASE_NOT_READY', 'This case is not open for progress updates.'); return; }
    if (!Array.isArray(req.body.reviewedEvidenceIds) || !Array.isArray(req.body.inspectedSuspectIds) || req.body.reviewedEvidenceIds.some((id: string) => !doc.content.evidence.some((e) => e.id === id)) || req.body.inspectedSuspectIds.some((id: string) => !doc.content.suspects.some((s) => s.id === id))) { fail(res, 400, 'VALIDATION_ERROR', 'Progress contains an unknown case item.'); return; }
    doc.progress.reviewedEvidenceIds = [...new Set([...doc.progress.reviewedEvidenceIds, ...req.body.reviewedEvidenceIds])];
    doc.progress.inspectedSuspectIds = [...new Set([...doc.progress.inspectedSuspectIds, ...req.body.inspectedSuspectIds])];
    await saveCase(doc); res.json({ progress: doc.progress });
  } catch (err) { next(err); }
});
app.post('/api/v1/cases/:caseId/hints', async (req, res, next) => {
  try {
    const doc = await authorized(req, res); if (!doc) return;
    if (!readyCase(doc) || doc.accusation) { fail(res, 409, 'CASE_NOT_READY', 'This case is not open for hints.'); return; }
    const index = req.body.hintIndex;
    if (!Number.isInteger(index) || index !== doc.progress.hintsUsed) { fail(res, 400, 'VALIDATION_ERROR', 'Hints must be requested in order.'); return; }
    const hint = doc.content.answerKey.hints[index];
    if (!hint) { fail(res, 429, 'HINT_LIMIT_REACHED', 'You have used all available hints.'); return; }
    doc.progress.hintsUsed++; await saveCase(doc);
    res.json({ hint, hintIndex: index, hintsUsed: doc.progress.hintsUsed, totalHints: doc.content.answerKey.hints.length });
  } catch (err) { next(err); }
});
app.post('/api/v1/cases/:caseId/accusation', async (req, res, next) => {
  try {
    const doc = await authorized(req, res); if (!doc) return;
    if (!readyCase(doc)) { fail(res, 409, 'CASE_NOT_READY', 'This case is not ready for an accusation.'); return; }
    if (doc.accusation) { fail(res, 409, 'ALREADY_SUBMITTED', 'Your final accusation has already been submitted.'); return; }
    if (!doc.content.suspects.some((s) => s.id === req.body.suspectId)) { fail(res, 400, 'INVALID_SUSPECT', 'Choose a suspect from this case.'); return; }
    const accusation = { suspectId: req.body.suspectId, submittedAt: new Date(), isCorrect: req.body.suspectId === doc.content.answerKey.culpritSuspectId };
    if (!await commitAccusation(doc, accusation)) { fail(res, 409, 'ALREADY_SUBMITTED', 'Your final accusation has already been submitted.'); return; }
    res.json(publicDto(doc as StoredCase & { content: CaseContent }, true));
  } catch (err) { next(err); }
});
app.delete('/api/v1/cases/:caseId', async (req, res, next) => { try { const doc = await authorized(req, res); if (!doc) return; const { CaseModel } = await import('./model.js'); if (CaseModel.db.readyState === 1) await CaseModel.deleteOne({ publicId: doc.publicId }); else { const { deleteMemoryCase } = await import('./store.js'); deleteMemoryCase(doc.publicId); } res.status(204).end(); } catch (err) { next(err); } });
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => { void _next; const id = (req as Request & { requestId?: string }).requestId; const code = err instanceof Error && err.message === 'DATABASE_UNAVAILABLE' ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR'; console.error(JSON.stringify({ requestId: id, error: code })); res.status(code === 'DATABASE_UNAVAILABLE' ? 503 : 500).json({ error: { code, message: code === 'DATABASE_UNAVAILABLE' ? 'Case storage is temporarily unavailable. Please retry.' : 'Something went wrong. Please try again.', requestId: id } }); });
