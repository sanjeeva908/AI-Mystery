import { z } from 'zod';

export const settingsSchema = z.object({
  setting: z.string().trim().max(100).default(''),
  tone: z.enum(['cozy', 'classic', 'thriller']).default('classic'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),
  length: z.enum(['short', 'standard', 'long']).default('short'),
});
export const createCaseSchema = z.object({
  premise: z.string().trim().min(20, 'Tell us a little more (at least 20 characters).').max(1500),
  settings: settingsSchema.default({ setting: '', tone: 'classic', difficulty: 'easy', length: 'short' }),
});
export const caseContentSchema = z.object({
  caseFile: z.object({ title: z.string(), summary: z.string(), incident: z.object({ dateTime: z.string().datetime(), location: z.string() }) }),
  suspects: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), profile: z.string(), knownMotive: z.string(), alibi: z.string().optional() })).min(3),
  timeline: z.array(z.object({ id: z.string(), timestamp: z.string().datetime(), description: z.string(), suspectIds: z.array(z.string()), evidenceIds: z.array(z.string()), kind: z.enum(['observed', 'inferred']) })),
  evidence: z.array(z.object({ id: z.string(), type: z.enum(['chat_transcript','document','image','cctv_log','audio_transcript','forensic_report','witness_statement','digital_log']), title: z.string(), summary: z.string(), timestamp: z.string().datetime().optional(), source: z.string(), body: z.string(), personIds: z.array(z.string()), location: z.string().optional(), reliabilityNote: z.string().optional(), relatedEventIds: z.array(z.string()) })).min(5),
  answerKey: z.object({ culpritSuspectId: z.string(), motive: z.string(), opportunity: z.string(), reconstruction: z.array(z.object({ timestamp: z.string(), description: z.string(), evidenceIds: z.array(z.string()) })), evidenceReasoning: z.array(z.object({ evidenceId: z.string(), interpretation: z.string(), relationship: z.enum(['supports','contradicts']) })), redHerrings: z.array(z.object({ evidenceId: z.string(), explanation: z.string() })), hints: z.array(z.string()).min(1).max(3), fairnessNotes: z.array(z.string()) }),
});
export type Settings = z.infer<typeof settingsSchema>;
export type CaseContent = z.infer<typeof caseContentSchema>;
export type Evidence = CaseContent['evidence'][number];
export type CaseLifecycle = { caseId: string; status: 'generating'; generation: { stage: string } } | { caseId: string; status: 'failed'; generation: { errorCode?: string }; retryAvailable: boolean };
export type PublicCase = Omit<CaseContent, 'answerKey'> & { caseId: string; status: 'ready'|'completed'; hintLimit: number; progress: { reviewedEvidenceIds: string[]; inspectedSuspectIds: string[]; hintsUsed: number }; accusation?: { suspectId: string; isCorrect: boolean }; reveal?: CaseContent['answerKey'] & { culpritName: string } };
