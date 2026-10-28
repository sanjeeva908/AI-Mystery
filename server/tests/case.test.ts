import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { fixture } from '../src/fixture.js';
import { validateCase } from '../src/fairness.js';
import { createStoredCase, failGeneration, getCase, retryGeneration } from '../src/store.js';

async function waitForReady(caseId: string, token: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await request(app).get(`/api/v1/cases/${caseId}`).set('Authorization', `Bearer ${token}`).expect(200);
    if (response.body.status === 'ready') return response;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Fixture case did not become ready');
}

describe('case contract and deterministic gameplay', () => {
  it('accepts a coherent fixture and rejects unresolved evidence references', () => {
    const valid = fixture('A rare moonstone vanishes from the locked gallery after the evening tour.');
    expect(validateCase(valid).answerKey.culpritSuspectId).toBe('S-02');
    const broken = structuredClone(valid); broken.timeline[0]!.evidenceIds = ['E-404'];
    expect(() => validateCase(broken)).toThrow(/Unresolved reference/);
  });

  it('keeps fixture content within each difficulty target', () => {
    for (const [difficulty, suspects, evidence, hints] of [['easy', 3, 5, 2], ['medium', 5, 8, 3], ['hard', 6, 14, 3]] as const) {
      const settings = { setting: '', tone: 'classic' as const, difficulty, length: 'short' as const };
      const value = validateCase(fixture('A rare moonstone vanishes from the locked gallery after the evening tour.', '', difficulty), settings);
      expect(value.suspects).toHaveLength(suspects);
      expect(value.evidence).toHaveLength(evidence);
      expect(value.answerKey.hints).toHaveLength(hints);
    }
  });

  it('allows one explicit retry after a generation failure and no more', async () => {
    const { doc } = await createStoredCase('A rare moonstone vanishes from the locked gallery after the evening tour.', { setting: '', tone: 'classic', difficulty: 'easy', length: 'short' });
    await failGeneration(doc, 'GENERATION_INVALID');
    expect(doc.status).toBe('failed');
    expect(await retryGeneration(doc)).toBe(true);
    expect(doc.status).toBe('generating');
    await failGeneration(doc, 'GENERATION_INVALID');
    expect(await retryGeneration(doc)).toBe(false);
  });

  it('keeps the solution private, enforces access, guides hints and grades once', async () => {
    const created = await request(app).post('/api/v1/cases').send({ premise: 'A rare moonstone vanishes from the locked gallery after the evening tour.', settings: { difficulty: 'easy' } }).expect(202);
    const { caseId, accessToken } = created.body as { caseId: string; accessToken: string };
    expect(created.body.status).toBe('generating');
    await request(app).get(`/api/v1/cases/${caseId}`).expect(403);
    const before = await waitForReady(caseId, accessToken);
    expect(JSON.stringify(before.body)).not.toContain('culpritSuspectId');
    expect(JSON.stringify(before.body)).not.toContain('Jonas planned to sell');
    expect(before.body).not.toHaveProperty('answerKey');
    await request(app).post(`/api/v1/cases/${caseId}/hints`).set('Authorization', `Bearer ${accessToken}`).send({ hintIndex: 1 }).expect(400);
    const hint = await request(app).post(`/api/v1/cases/${caseId}/hints`).set('Authorization', `Bearer ${accessToken}`).send({ hintIndex: 0 }).expect(200);
    expect(hint.body).toHaveProperty('hint');
    expect(hint.body.hint).not.toContain('Jonas');
    const result = await request(app).post(`/api/v1/cases/${caseId}/accusation`).set('Authorization', `Bearer ${accessToken}`).send({ suspectId: 'S-02' }).expect(200);
    expect(result.body.accusation.isCorrect).toBe(true);
    expect(result.body.reveal.culpritName).toBe('Jonas Reed');
    await request(app).post(`/api/v1/cases/${caseId}/accusation`).set('Authorization', `Bearer ${accessToken}`).send({ suspectId: 'S-01' }).expect(409);
  });

  it('validates premise length and supports progress tracking', async () => {
    await request(app).post('/api/v1/cases').send({ premise: 'Too short' }).expect(400);
    const created = await request(app).post('/api/v1/cases').send({ premise: 'A rare moonstone vanishes from the locked gallery after the evening tour.' }).expect(202);
    await waitForReady(created.body.caseId, created.body.accessToken);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const result = await request(app).patch(`/api/v1/cases/${created.body.caseId}/progress`).set(auth).send({ reviewedEvidenceIds: ['E-01'], inspectedSuspectIds: ['S-01'] }).expect(200);
    expect(result.body.progress.reviewedEvidenceIds).toContain('E-01');
    await request(app).patch(`/api/v1/cases/${created.body.caseId}/progress`).set(auth).send({ reviewedEvidenceIds: ['E-404'], inspectedSuspectIds: [] }).expect(400);
  });

  it('rejects expired cases and deletes a case with valid access', async () => {
    const created = await request(app).post('/api/v1/cases').send({ premise: 'A rare moonstone vanishes from the locked gallery after the evening tour.' }).expect(202);
    await waitForReady(created.body.caseId, created.body.accessToken);
    const token = `Bearer ${created.body.accessToken}`;
    const stored = await getCase(created.body.caseId);
    if (!stored) throw new Error('Expected a stored fixture case');
    stored.expiresAt = new Date(0);
    await request(app).get(`/api/v1/cases/${created.body.caseId}`).set('Authorization', token).expect(410);

    const next = await request(app).post('/api/v1/cases').send({ premise: 'A brass sundial disappears from the conservatory before closing.' }).expect(202);
    await waitForReady(next.body.caseId, next.body.accessToken);
    await request(app).delete(`/api/v1/cases/${next.body.caseId}`).set('Authorization', `Bearer ${next.body.accessToken}`).expect(204);
    await request(app).get(`/api/v1/cases/${next.body.caseId}`).set('Authorization', `Bearer ${next.body.accessToken}`).expect(404);
  });
});
