import { caseContentSchema, type CaseContent, type Settings } from '@mystery/shared';

export function validateCase(input: unknown, settings?: Settings): CaseContent {
  const data = caseContentSchema.parse(input);
  if (settings) {
    const ranges = settings.difficulty === 'easy' ? { suspects: [3,3], evidence: [5,7], hints: [1,2] } : settings.difficulty === 'medium' ? { suspects: [4,5], evidence: [8,10], hints: [1,3] } : { suspects: [5,6], evidence: [10,14], hints: [1,3] };
    if (data.suspects.length < ranges.suspects[0] || data.suspects.length > ranges.suspects[1] || data.evidence.length < ranges.evidence[0] || data.evidence.length > ranges.evidence[1] || data.answerKey.hints.length < ranges.hints[0] || data.answerKey.hints.length > ranges.hints[1]) throw new Error('Case does not match the requested difficulty bounds');
  }
  const suspectIds = new Set(data.suspects.map((s) => s.id));
  const evidenceIds = new Set(data.evidence.map((e) => e.id));
  const eventIds = new Set(data.timeline.map((e) => e.id));
  const unique = <T,>(ids: T[]) => new Set(ids).size === ids.length;
  if (!unique(data.suspects.map((s) => s.id)) || !unique(data.evidence.map((e) => e.id)) || !unique(data.timeline.map((e) => e.id))) throw new Error('Duplicate case identifiers');
  if (!suspectIds.has(data.answerKey.culpritSuspectId)) throw new Error('Culprit must be a listed suspect');
  for (const event of data.timeline) if (event.suspectIds.some((id) => !suspectIds.has(id)) || event.evidenceIds.some((id) => !evidenceIds.has(id))) throw new Error(`Unresolved reference in ${event.id}`);
  for (const item of data.evidence) if (item.personIds.some((id) => !suspectIds.has(id)) || item.relatedEventIds.some((id) => !eventIds.has(id))) throw new Error(`Unresolved reference in ${item.id}`);
  for (const clue of data.answerKey.evidenceReasoning) if (!evidenceIds.has(clue.evidenceId)) throw new Error('Solution cites missing evidence');
  for (const clue of data.answerKey.redHerrings) if (!evidenceIds.has(clue.evidenceId)) throw new Error('Red herring cites missing evidence');
  for (const step of data.answerKey.reconstruction) if (step.evidenceIds.some((id) => !evidenceIds.has(id))) throw new Error('Reconstruction cites missing evidence');
  const supporting = new Set(data.answerKey.evidenceReasoning.filter((c) => c.relationship === 'supports').map((c) => c.evidenceId));
  if (supporting.size < 2) throw new Error('At least two independent supporting evidence items are required');
  if (new Set(data.suspects.map((s) => s.name.toLocaleLowerCase())).size !== data.suspects.length) throw new Error('Suspects must be distinct');
  for (const item of data.evidence) if (item.timestamp && Number.isNaN(Date.parse(item.timestamp))) throw new Error(`Invalid evidence time ${item.id}`);
  return data;
}
