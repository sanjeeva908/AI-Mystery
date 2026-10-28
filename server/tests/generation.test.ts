import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../src/fixture.js';
import { createCaseGenerator, type ModelCaller } from '../src/generation.js';

const premise = 'A rare moonstone vanishes from the locked gallery after the evening tour.';
const settings = { setting: 'A coastal museum', tone: 'classic' as const, difficulty: 'easy' as const, length: 'short' as const };
const validOutput = JSON.stringify(fixture(premise, settings.setting, settings.difficulty));

afterEach(() => vi.restoreAllMocks());

describe('Gemini case generation pipeline', () => {
  it('accepts a valid complete response using one model call', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const callModel = vi.fn<ModelCaller>(async () => ({ text: validOutput, responseId: 'provider-test-id' }));
    const result = await createCaseGenerator(callModel, 1000)(premise, settings);
    expect(result.answerKey.culpritSuspectId).toBe('S-02');
    expect(callModel).toHaveBeenCalledTimes(1);
  });
  it('repairs malformed JSON once', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const callModel = vi.fn<ModelCaller>()
      .mockResolvedValueOnce({ text: '{"caseFile":' })
      .mockResolvedValueOnce({ text: validOutput });
    const result = await createCaseGenerator(callModel, 1000)(premise, settings);
    expect(result.evidence).toHaveLength(5);
    expect(callModel).toHaveBeenCalledTimes(2);
  });
  it('repairs a partial case before accepting it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const partial = JSON.stringify({ ...fixture(premise, settings.setting, settings.difficulty), evidence: [] });
    const callModel = vi.fn<ModelCaller>()
      .mockResolvedValueOnce({ text: partial })
      .mockResolvedValueOnce({ text: validOutput });
    const result = await createCaseGenerator(callModel, 1000)(premise, settings);
    expect(result.evidence).toHaveLength(5);
    expect(callModel).toHaveBeenCalledTimes(2);
  });
  it('retries transient provider failures no more than three attempts', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const callModel = vi.fn<ModelCaller>()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({ text: validOutput });
    const result = await createCaseGenerator(callModel, 5000)(premise, settings);
    expect(result.evidence).toHaveLength(5);
    expect(callModel).toHaveBeenCalledTimes(3);
  });  it('fails within the configured budget when a model call stalls', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const callModel: ModelCaller = () => new Promise(() => {});
    await expect(createCaseGenerator(callModel, 20)(premise, settings)).rejects.toThrow('GENERATION_TIMEOUT');
  });
});