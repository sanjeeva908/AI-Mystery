import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { CaseModel } from './model.js';
import { config } from './config.js';
import type { CaseContent, Settings } from '@mystery/shared';

export type StoredCase = { publicId: string; accessTokenHash: string; status: 'generating'|'ready'|'failed'|'completed'|'expired'; premise: string; settings: Settings; content?: CaseContent; generation: { stage: string; attemptCount: number; errorCode?: string }; progress: { reviewedEvidenceIds: string[]; inspectedSuspectIds: string[]; hintsUsed: number }; accusation?: { suspectId: string; submittedAt: Date; isCorrect: boolean }; createdAt: Date; updatedAt: Date; expiresAt: Date };
const memory = new Map<string, StoredCase>();
const mongoConfigured = () => Boolean(config.MONGODB_URI?.trim());
function requireMongoConnection() { if (mongoConfigured() && CaseModel.db.readyState !== 1) throw new Error('DATABASE_UNAVAILABLE'); }
export function deleteMemoryCase(id: string) { memory.delete(id); }
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function createStoredCase(premise: string, settings: Settings) {
  const publicId = randomBytes(24).toString('base64url'); const token = randomBytes(32).toString('base64url');
  const now = new Date(); const doc: StoredCase = { publicId, accessTokenHash: hash(token), status: 'generating', premise, settings, generation: { stage: 'building_mystery', attemptCount: 1 }, progress: { reviewedEvidenceIds: [], inspectedSuspectIds: [], hintsUsed: 0 }, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + config.CASE_TTL_DAYS * 86400000) };
  requireMongoConnection();
  if (mongoConfigured()) await CaseModel.create(doc); else memory.set(publicId, doc);
  return { doc, token };
}
export async function getCase(id: string): Promise<StoredCase | undefined> { requireMongoConnection(); if (mongoConfigured()) { const found = await CaseModel.findOne({ publicId: id }).lean(); return found ? found as unknown as StoredCase : undefined; } return memory.get(id); }
export async function touchCase(doc: StoredCase) { const now = new Date(); doc.updatedAt = now; doc.expiresAt = new Date(now.getTime() + config.CASE_TTL_DAYS * 86400000); if (mongoConfigured()) { requireMongoConnection(); await CaseModel.updateOne({ publicId: doc.publicId }, { $set: { updatedAt: now, expiresAt: doc.expiresAt } }); } else memory.set(doc.publicId, doc); }
export async function setGenerationStage(doc: StoredCase, stage: string) { doc.generation.stage = stage; doc.updatedAt = new Date(); if (mongoConfigured()) { requireMongoConnection(); await CaseModel.updateOne({ publicId: doc.publicId, status: 'generating' }, { $set: { generation: doc.generation, updatedAt: doc.updatedAt } }); } else memory.set(doc.publicId, doc); }
export async function completeGeneration(doc: StoredCase, content: CaseContent) { doc.content = content; doc.status = 'ready'; doc.updatedAt = new Date(); doc.generation = { ...doc.generation, stage: 'ready' }; if (mongoConfigured()) { requireMongoConnection(); await CaseModel.updateOne({ publicId: doc.publicId, status: 'generating' }, { $set: { content, status: 'ready', generation: doc.generation, updatedAt: doc.updatedAt } }); } else memory.set(doc.publicId, doc); }
export async function failGeneration(doc: StoredCase, errorCode: string) { doc.status = 'failed'; doc.updatedAt = new Date(); doc.generation = { ...doc.generation, stage: 'failed', errorCode }; if (mongoConfigured()) { requireMongoConnection(); await CaseModel.updateOne({ publicId: doc.publicId, status: 'generating' }, { $set: { status: 'failed', generation: doc.generation, updatedAt: doc.updatedAt } }); } else memory.set(doc.publicId, doc); }
export async function retryGeneration(doc: StoredCase) {
  if (doc.status !== 'failed' || doc.generation.attemptCount >= 2) return false;
  const generation = { attemptCount: doc.generation.attemptCount + 1, stage: 'building_mystery' };
  if (mongoConfigured()) {
    requireMongoConnection();
    const result = await CaseModel.updateOne({ publicId: doc.publicId, status: 'failed', 'generation.attemptCount': { $lt: 2 } }, { $set: { status: 'generating', generation, updatedAt: new Date() } });
    if (result.modifiedCount !== 1) return false;
  }
  doc.status = 'generating'; doc.generation = generation; doc.updatedAt = new Date();
  if (!mongoConfigured()) memory.set(doc.publicId, doc);
  return true;
}
export async function failInterruptedGenerations() {
  if (!mongoConfigured()) return;
  requireMongoConnection();
  const cutoff = new Date(Date.now() - 120_000);
  await CaseModel.updateMany({ status: 'generating', updatedAt: { $lt: cutoff } }, { $set: { status: 'failed', 'generation.stage': 'failed', 'generation.errorCode': 'GENERATION_INTERRUPTED', updatedAt: new Date() } });
}
export async function saveCase(doc: StoredCase) { const now = new Date(); doc.updatedAt = now; doc.expiresAt = new Date(now.getTime() + config.CASE_TTL_DAYS * 86400000); requireMongoConnection(); if (mongoConfigured()) await CaseModel.updateOne({ publicId: doc.publicId }, { $set: { progress: doc.progress, accusation: doc.accusation, status: doc.status, updatedAt: now, expiresAt: doc.expiresAt } }); else memory.set(doc.publicId, doc); }
export async function commitAccusation(doc: StoredCase, accusation: NonNullable<StoredCase['accusation']>) {
  requireMongoConnection();
  if (mongoConfigured()) {
    const now = new Date(); doc.updatedAt = now; doc.expiresAt = new Date(now.getTime() + config.CASE_TTL_DAYS * 86400000);
    const result = await CaseModel.updateOne({ publicId: doc.publicId, accusation: { $exists: false } }, { $set: { accusation, status: 'completed', updatedAt: now, expiresAt: doc.expiresAt } });
    if (result.modifiedCount !== 1) return false;
  }
  doc.accusation = accusation; doc.status = 'completed'; doc.updatedAt = new Date();
  if (!mongoConfigured()) memory.set(doc.publicId, doc);
  return true;
}
export function tokenMatches(doc: StoredCase, token: string) { const expected = Buffer.from(doc.accessTokenHash); const actual = Buffer.from(hash(token)); return expected.length === actual.length && timingSafeEqual(actual, expected); }
