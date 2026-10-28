import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CaseModel } from '../src/model.js';

dotenv.config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')] });
const uri = process.env.MONGODB_URI?.trim() ?? '';
const dbName = process.env.MONGODB_DB_NAME?.trim() || 'ai_mystery_room';
let publicId = '';
let connected = false;

const runMongoIntegration = process.env.RUN_MONGO_INTEGRATION === '1' ? describe : describe.skip;

runMongoIntegration('MongoDB persistence integration (explicit opt-in)', () => {
  beforeAll(async () => {
    if (!uri) throw new Error('MONGODB_URI is required for the MongoDB integration test.');
    try {
      await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
      connected = true;
      await CaseModel.init();
    } catch (error) {
      const root = typeof error === 'object' && error !== null && 'cause' in error ? error.cause : error;
      const code = typeof root === 'object' && root !== null && 'code' in root ? root.code : 'unknown';
      const codeName = typeof root === 'object' && root !== null && 'codeName' in root ? root.codeName : 'unknown';
      throw new Error('MONGO_INTEGRATION_CONNECT_FAILED_' + String(code) + '_' + String(codeName));
    }
  }, 15000);

  afterAll(async () => {
    if (connected && publicId) await CaseModel.deleteOne({ publicId }).catch(() => {});
    if (connected) await mongoose.disconnect();
  });

  it('persists case progress across a fresh connection and removes expired cases', async () => {
    publicId = 'integration-' + randomUUID();
    const now = new Date();
    await CaseModel.create({
      publicId,
      accessTokenHash: 'integration-test-hash',
      status: 'generating',
      premise: 'An integration-only case used to verify persistence.',
      settings: { setting: '', tone: 'classic', difficulty: 'easy', length: 'short' },
      generation: { stage: 'building_mystery', attemptCount: 1 },
      progress: { reviewedEvidenceIds: [], inspectedSuspectIds: [], hintsUsed: 0 },
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 4 * 60 * 1000),
    });
    await CaseModel.updateOne({ publicId }, { $set: { progress: { reviewedEvidenceIds: ['E-01'], inspectedSuspectIds: ['S-01'], hintsUsed: 1 } } });
    const progress = await CaseModel.findOne({ publicId }).lean();
    expect(progress?.progress).toMatchObject({ reviewedEvidenceIds: ['E-01'], inspectedSuspectIds: ['S-01'], hintsUsed: 1 });

    await mongoose.disconnect();
    connected = false;
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
    connected = true;
    const afterReconnect = await CaseModel.findOne({ publicId }).lean();
    expect(afterReconnect?.progress).toMatchObject({ reviewedEvidenceIds: ['E-01'], hintsUsed: 1 });

    await CaseModel.updateOne({ publicId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    let removed = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      if (!await CaseModel.exists({ publicId })) {
        removed = true;
        break;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
    }
    expect(removed).toBe(true);
  }, 110000);
});