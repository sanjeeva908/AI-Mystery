import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createCaseSchema, type CaseLifecycle, type PublicCase, type Evidence } from '@mystery/shared';
import './mystery.css';

const InvestigationScene = lazy(() => import('./InvestigationScene').then((scene) => ({ default: scene.InvestigationScene })));

const API = import.meta.env.VITE_API_URL || '/api/v1';
type Err = { error?: { message?: string } };
type Tab = 'Briefing' | 'Suspects' | 'Evidence' | 'Timeline' | 'Verdict';
const tabs: Tab[] = ['Briefing', 'Suspects', 'Evidence', 'Timeline'];
const tokenKey = (id: string) => 'mystery-access:' + id;
const createDraftKey = 'mystery-create-draft';
const premiseExamples = [
  { label: 'Museum heist', value: 'A priceless miniature disappears from a locked museum gallery during a private evening tour.' },
  { label: 'Restaurant', value: 'A celebrated chef’s handwritten recipe vanishes from a locked restaurant office before opening night.' },
  { label: 'Mountain lodge', value: 'A guest’s antique compass disappears from a snowbound mountain lodge during a power outage.' },
];
const generationMessages = ['Building the mystery and solution…', 'Drafting suspects and their stories…', 'Placing evidence in the room…', 'Checking the case for fairness…'];

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let body: Err = {};
    try { body = await response.json() as Err; } catch { /* A proxy may return a non-JSON error page. */ }
    throw new Error(body.error?.message || 'The request failed (' + response.status + '). Please try again.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function Brand() {
  return <a className="brand" href="/" aria-label="AI Mystery Room home"><span className="brand-seal" aria-hidden="true">M</span><span>AI MYSTERY ROOM</span></a>;
}

type Theme = 'light' | 'dark';

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const nextMode = theme === 'dark' ? 'light' : 'dark';
  return <button className="theme-toggle" type="button" aria-label={'Switch to ' + nextMode + ' mode'} onClick={onToggle}><span aria-hidden="true">{theme === 'dark' ? '☼' : '☾'}</span><span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>;
}
function App() {
  const [themeChoice, setThemeChoice] = useState<Theme | null>(() => {
    const saved = window.localStorage.getItem('mystery-theme');
    return saved === 'light' || saved === 'dark' ? saved : null;
  });
  const [systemTheme, setSystemTheme] = useState<Theme>(() => window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const theme = themeChoice ?? systemTheme;
  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: light)');
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'light' : 'dark');
    preference.addEventListener('change', updateSystemTheme);
    return () => preference.removeEventListener('change', updateSystemTheme);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (themeChoice) window.localStorage.setItem('mystery-theme', themeChoice);
  }, [theme, themeChoice]);
  const toggleTheme = () => setThemeChoice(theme === 'dark' ? 'light' : 'dark');
  const match = window.location.pathname.match(/^\/case\/([^/]+)/);
  const caseId = match?.[1];
  const [activeSection, setActiveSection] = useState('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    if (caseId) return;
    const ids = ['home', 'evidence', 'suspects', 'connections', 'revelation', 'method', 'new-case', 'about'];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-28% 0px -55% 0px', threshold: [0.05, 0.2, 0.45] });
    ids.forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [caseId]);
  const [premise, setPremise] = useState('A priceless moonstone vanishes from a locked gallery during the evening closing tour.');
  const [fictionAccepted, setFictionAccepted] = useState(false);
  const [formErrors, setFormErrors] = useState<{ premise?: string; consent?: string }>({});
  const [setting, setSetting] = useState('');
  const [tone, setTone] = useState('classic');
  const [difficulty, setDifficulty] = useState('easy');
  const [length, setLength] = useState('short');
  const [data, setData] = useState<PublicCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [caseRetryAvailable, setCaseRetryAvailable] = useState(false);
  const [tab, setTab] = useState<Tab>('Briefing');
  const [selected, setSelected] = useState<Evidence | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [suspect, setSuspect] = useState('');
  const [pendingAccusation, setPendingAccusation] = useState(false);
  const [hint, setHint] = useState('');
  const [hintBusy, setHintBusy] = useState(false);
  const [scenePreview, setScenePreview] = useState('');
  const [reviewingCompletedCase, setReviewingCompletedCase] = useState(false);
  const [generationSlow, setGenerationSlow] = useState(false);
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0);
  const [expandedSuspect, setExpandedSuspect] = useState('');
  const premiseRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const pollingControllerRef = useRef<AbortController | null>(null);
  const generationStartedRef = useRef<number | null>(null);
  const generationPollTimerRef = useRef<number | null>(null);
  const startInvestigating = useCallback(() => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.getElementById('new-case')?.scrollIntoView({ behavior });
  }, []);
  const selectSceneEvidence = useCallback((label: string) => setScenePreview(label), []);
  const token = caseId ? localStorage.getItem(tokenKey(caseId)) || '' : '';

  async function loadCase(id: string, auth: string) {
    try {
      pollingControllerRef.current?.abort();
      const controller = new AbortController();
      pollingControllerRef.current = controller;
      const result = await request<PublicCase | CaseLifecycle>('/cases/' + id, auth, { signal: controller.signal });
      if (result.status === 'generating') {
        generationStartedRef.current ??= Date.now();
        if (Date.now() - generationStartedRef.current >= 25_000) setGenerationSlow(true);
        generationPollTimerRef.current = window.setTimeout(() => void loadCase(id, auth), 1000);
        return;
      }
      generationStartedRef.current = null;
      setGenerationSlow(false);
      if (result.status === 'failed') {
        setCaseRetryAvailable(result.retryAvailable);
        setError('The mystery could not be prepared. You can retry once or start a new case.');
        return;
      }
      setError('');
      setData(result);
      if (result.status === 'completed') setTab('Verdict');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Could not load this case. Check your connection and try again.');
    }
  }

  const loadCaseRef = useRef(loadCase);
  useEffect(() => { loadCaseRef.current = loadCase; });
  useEffect(() => {
    if (!caseId) return;
    generationStartedRef.current = Date.now();
    const pollTimer = window.setTimeout(() => void loadCaseRef.current(caseId, token), 0);
    const slowTimer = window.setTimeout(() => setGenerationSlow(true), 25_000);
    const messageTimer = window.setInterval(() => setGenerationMessageIndex((index) => (index + 1) % generationMessages.length), 4200);
    return () => {
      window.clearTimeout(pollTimer);
      window.clearTimeout(slowTimer);
      window.clearInterval(messageTimer);
      if (generationPollTimerRef.current !== null) window.clearTimeout(generationPollTimerRef.current);
      pollingControllerRef.current?.abort();
    };
  }, [caseId, token]);

  async function retryGeneration() {
    if (!caseId) return;
    setError('');
    setBusy(true);
    try {
      await request('/cases/' + caseId + '/retry', token, { method: 'POST' });
      setCaseRetryAvailable(false);
      void loadCase(caseId, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation could not be retried.');
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLButtonElement>('.evidence-drawer .close')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelected(null); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...document.querySelectorAll<HTMLElement>('.evidence-drawer button:not(:disabled), .evidence-drawer a[href], .evidence-drawer input:not(:disabled), .evidence-drawer select:not(:disabled), .evidence-drawer textarea:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [selected]);

  useEffect(() => {
    if (!pendingAccusation) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPendingAccusation(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...document.querySelectorAll<HTMLElement>('.confirm-dialog button:not(:disabled), .confirm-dialog a[href], .confirm-dialog input:not(:disabled), .confirm-dialog select:not(:disabled), .confirm-dialog textarea:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    document.querySelector<HTMLButtonElement>('.confirm-dialog .button-secondary')?.focus();
    return () => { window.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [pendingAccusation]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setFormErrors({});
    if (premise.trim().length < 20) {
      setFormErrors({ premise: 'Add a little more detail (at least 20 characters).' });
      premiseRef.current?.focus();
      return;
    }
    if (!fictionAccepted) {
      setFormErrors({ consent: 'Please confirm that this case is fictional.' });
      consentRef.current?.focus();
      return;
    }
    const parsed = createCaseSchema.safeParse({ premise, settings: { setting, tone, difficulty, length } });
    if (!parsed.success) {
      setFormErrors({ premise: parsed.error.issues[0]?.message || 'Check your case details.' });
      premiseRef.current?.focus();
      return;
    }
    try { sessionStorage.setItem(createDraftKey, JSON.stringify(parsed.data)); } catch { /* The form remains usable when session storage is unavailable. */ }
    setBusy(true);
    try {
      const result = await request<{ caseId: string; accessToken: string }>('/cases', undefined, {
        method: 'POST', body: JSON.stringify(parsed.data),
      });
      localStorage.setItem(tokenKey(result.caseId), result.accessToken);
      window.location.assign('/case/' + result.caseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mystery generation failed. Check your connection.');
      setBusy(false);
    }
  }

  async function cancelAndRetryGeneration() {
    let payload: ReturnType<typeof createCaseSchema.parse> | null = null;
    try {
      const saved = sessionStorage.getItem(createDraftKey);
      if (saved) payload = createCaseSchema.parse(JSON.parse(saved));
    } catch { payload = null; }
    if (!payload) { window.location.assign('/#new-case'); return; }
    if (generationPollTimerRef.current !== null) window.clearTimeout(generationPollTimerRef.current);
    pollingControllerRef.current?.abort();
    setBusy(true);
    setError('');
    try {
      const result = await request<{ caseId: string; accessToken: string }>('/cases', undefined, {
        method: 'POST', body: JSON.stringify(payload),
      });
      localStorage.setItem(tokenKey(result.caseId), result.accessToken);
      window.location.assign('/case/' + result.caseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A new attempt could not be started. Please try again.');
      setBusy(false);
    }
  }

  function handleToneKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const toneValues = ['cozy', 'classic', 'thriller'];
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? toneValues.length - 1 : (currentIndex + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + toneValues.length) % toneValues.length;
    setTone(toneValues[next]);
    document.querySelector<HTMLButtonElement>(`[data-tone="${toneValues[next]}"]`)?.focus();
  }

  async function markEvidence(item: Evidence) {
    if (!caseId || !data) return;
    setSelected(item);
    if (data.status === 'completed') return;
    try {
      const result = await request<{ progress: PublicCase['progress'] }>('/cases/' + caseId + '/progress', token, {
        method: 'PATCH', body: JSON.stringify({ reviewedEvidenceIds: [item.id], inspectedSuspectIds: data.progress.inspectedSuspectIds }),
      });
      setData({ ...data, progress: result.progress });
    } catch (e) { setError(e instanceof Error ? e.message : 'Progress could not be saved. Try again.'); }
  }

  async function inspectSuspect(id: string) {
    if (!caseId || !data) return;
    setSuspect(id);
    if (data.status === 'completed') return;
    try {
      const result = await request<{ progress: PublicCase['progress'] }>('/cases/' + caseId + '/progress', token, {
        method: 'PATCH', body: JSON.stringify({ reviewedEvidenceIds: data.progress.reviewedEvidenceIds, inspectedSuspectIds: [id] }),
      });
      setData({ ...data, progress: result.progress });
    } catch (e) { setError(e instanceof Error ? e.message : 'Progress could not be saved. Try again.'); }
  }

  async function requestHint() {
    if (!caseId || !data) return;
    setHintBusy(true);
    setError('');
    try {
      const result = await request<{ hint: string; hintsUsed: number }>('/cases/' + caseId + '/hints', token, {
        method: 'POST', body: JSON.stringify({ hintIndex: data.progress.hintsUsed }),
      });
      setHint(result.hint);
      setData({ ...data, progress: { ...data.progress, hintsUsed: result.hintsUsed } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Hint unavailable. Please try again.'); }
    finally { setHintBusy(false); }
  }

  async function accuse() {
    if (!caseId || !suspect) return;
    setBusy(true);
    setError('');
    try {
      const result = await request<PublicCase>('/cases/' + caseId + '/accusation', token, {
        method: 'POST', body: JSON.stringify({ suspectId: suspect }),
      });
      setData(result);
      setTab('Verdict');
      setReviewingCompletedCase(false);
      setPendingAccusation(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Accusation could not be submitted.'); }
    finally { setBusy(false); }
  }

  const filteredEvidence = useMemo(() => (data?.evidence || []).filter((item) =>
    (kindFilter === 'all' || item.type === kindFilter)
    && (reviewFilter === 'all' || (reviewFilter === 'reviewed') === data?.progress.reviewedEvidenceIds.includes(item.id))
    && (item.title + ' ' + item.body + ' ' + item.source + ' ' + item.personIds.join(' ')).toLowerCase().includes(query.toLowerCase()),
  ), [data, kindFilter, reviewFilter, query]);

  if (!caseId) {
    const tones = [
      { value: 'cozy', title: 'Cozy', copy: 'Warm intrigue, human stakes' },
      { value: 'classic', title: 'Classic', copy: 'Clues, motive, deduction' },
      { value: 'thriller', title: 'Thriller', copy: 'Tension with a clear trail' },
    ];
    return (
      <main className="landing">
        <header className="site-header floating-nav"><Brand /><nav className={'header-links' + (mobileNavOpen ? ' open' : '')} aria-label="Main navigation"><a className={activeSection === 'home' ? 'active' : ''} href="#home" onClick={() => setMobileNavOpen(false)}>Home</a><a className={activeSection === 'new-case' ? 'active' : ''} href="#new-case" onClick={() => setMobileNavOpen(false)}>Investigate</a><a className={activeSection === 'method' ? 'active' : ''} href="#method" onClick={() => setMobileNavOpen(false)}>How it works</a><a className={activeSection === 'about' ? 'active' : ''} href="#about" onClick={() => setMobileNavOpen(false)}>About</a></nav><button className="nav-menu" type="button" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}>{mobileNavOpen ? '×' : '☰'}</button><ThemeToggle theme={theme} onToggle={toggleTheme} /></header>
        <Suspense fallback={<div className="investigation-scene scene-loading" aria-hidden="true" />}><InvestigationScene theme={theme} onStart={startInvestigating} onSelect={selectSceneEvidence} /></Suspense>
        <div className="interactive-cursor" aria-hidden="true"><span /><i /></div>
        <section className="landing-hero" id="home" aria-labelledby="hero-title">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-mark" /> SCENE 01 <span className="hero-edition">/ THE UNKNOWN</span></p><h1 id="hero-title">Every Mystery<br /><em>Has a Truth.</em></h1><p className="hero-intro">A living investigation shaped around you. Move through the evidence, question every story, and follow the signal that doesn't belong.</p><a className="button button-primary hero-cta" href="#new-case">Start Investigating <span>↗</span></a><a className="experience-link" href="#evidence">Enter the experience <span>↓</span></a><div className="hero-assurance"><i /> No account required <span /> Your case stays yours</div></div>
          <div className="hero-index"><span>THE NIGHT ARCHIVE</span><span>VOL. 01 — THE ART OF NOTICING</span></div>
          <div className="scene-hint" aria-hidden="true"><i /> MOVE TO EXPLORE <span>·</span> CLICK A SIGNAL</div>
        </section>
        <section className="story-chapter chapter-evidence" id="evidence" aria-labelledby="evidence-title"><p className="eyebrow">02 / THE EVIDENCE</p><h2 id="evidence-title">Every detail<br /><em>matters.</em></h2><p>Somewhere in the noise, one small thing changes everything.</p><a href="#new-case" className="chapter-link">Read the evidence <span>↗</span></a><span className="chapter-coordinate">SIGNAL 02 · TRACE FOUND</span></section>
        <section className="story-chapter chapter-suspects" id="suspects" aria-labelledby="suspects-title"><p className="eyebrow">03 / THE SUSPECTS</p><h2 id="suspects-title">Everyone<br /><em>has a story.</em></h2><p>Listen closely. The truth has a way of changing shape.</p><button type="button" className="chapter-link" onClick={() => setScenePreview('Person of interest')}>Examine a profile <span>↗</span></button><span className="chapter-coordinate">SIGNAL 03 · VOICES DETECTED</span></section>
        <section className="story-chapter chapter-connections" id="connections" aria-labelledby="connections-title"><p className="eyebrow">04 / THE CONNECTION</p><h2 id="connections-title">Connect what<br /><em>others miss.</em></h2><p>Follow the threads between what happened and what was said.</p><a href="#method" className="chapter-link">Trace the sequence <span>↗</span></a><span className="chapter-coordinate">SIGNAL 04 · PATTERN EMERGING</span></section>
        <section className="story-chapter chapter-revelation" id="revelation" aria-labelledby="revelation-title"><p className="eyebrow">05 / THE REVELATION</p><h2 id="revelation-title">The truth<br /><em>is waiting.</em></h2><p>Every clue is a door. Decide which one deserves to open.</p><a href="#new-case" className="chapter-link">Enter the investigation <span>↗</span></a><span className="chapter-coordinate">SIGNAL 05 · FILE UNSEALED</span></section>
        <section className="story-chapter chapter-invitation" aria-labelledby="invitation-title"><p className="eyebrow">06 / START INVESTIGATING</p><h2 id="invitation-title">The room<br /><em>is yours.</em></h2><p>Set the scene. The case begins with a single detail.</p><a href="#new-case" className="button button-primary chapter-cta">Start Investigating <span>↗</span></a><span className="chapter-coordinate">OPEN A NEW CASE · ANONYMOUS BY DESIGN</span></section>
        <section className="method-section" id="method"><div className="section-heading"><div><p className="eyebrow">HOW IT WORKS / A FIELD GUIDE</p><h2>Look closer.<br /><em>Think deeper.</em></h2></div><p>A story built for your premise. One sealed answer. A fair trail of evidence to get you there.</p></div><div className="method-grid story-grid"><article><span>01</span><i /><h3>Read the room</h3><p>Meet the people. Take in the scene.</p></article><article><span>02</span><i /><h3>Follow the record</h3><p>Examine evidence and reconstruct the timeline.</p></article><article><span>03</span><i /><h3>Make your call</h3><p>Use your clues. Make one final accusation.</p></article></div></section>
        <section className="intake-section" id="new-case"><div className="intake-intro"><p className="eyebrow">THE NEXT FILE IS YOURS</p><h2>Set the scene.<br /><em>We’ll build the case.</em></h2><p>Give us the spark of a story. Choose an atmosphere. We’ll prepare a fair case with suspects, evidence, and a trail to follow.</p><div className="intake-note"><span>✳</span> Fiction for entertainment. No real people or events are investigated.</div></div>
          <form className="create-card" noValidate onSubmit={create}><div className="form-heading"><div><span className="eyebrow">NEW INVESTIGATION</span><h3>Write your opening line</h3></div><span className="step">01 <i /> 01</span></div>
            <div className="premise-examples" aria-label="Premise examples"><span>Need a spark?</span>{premiseExamples.map((example) => <button key={example.label} type="button" onClick={() => { setPremise(example.value); setFormErrors((errors) => ({ ...errors, premise: undefined })); }}>{example.label}</button>)}</div>
            <label className="field-label" htmlFor="premise">Your premise</label><textarea ref={premiseRef} id="premise" value={premise} onChange={(event) => { setPremise(event.target.value); if (formErrors.premise) setFormErrors((errors) => ({ ...errors, premise: undefined })); }} maxLength={1500} minLength={20} rows={4} required aria-invalid={Boolean(formErrors.premise)} aria-describedby={formErrors.premise ? 'premise-error premise-note' : 'premise-note'} placeholder="A locked room, a missing heirloom, a witness who remembers too much…" />{formErrors.premise && <p className="field-error" id="premise-error" role="alert">{formErrors.premise}</p>}<div className="field-meta" id="premise-note"><span>At least 20 characters. Keep it fictional.</span><span>{premise.length} / 1,500</span></div>
            <label className="field-label" htmlFor="setting">Setting <small>OPTIONAL</small></label><input id="setting" className="text-input" value={setting} onChange={(event) => setSetting(event.target.value)} maxLength={100} placeholder="e.g. A coastal hotel in winter" />
            <fieldset className="tone-fieldset"><legend>Tone</legend><div className="tone-options" role="radiogroup" aria-label="Tone">{tones.map((option, index) => <button key={option.value} data-tone={option.value} type="button" role="radio" tabIndex={tone === option.value ? 0 : -1} aria-checked={tone === option.value} className={'tone-option' + (tone === option.value ? ' selected' : '')} onKeyDown={(event) => handleToneKeyDown(event, index)} onClick={() => setTone(option.value)}><i /><strong>{option.title}</strong><small>{option.copy}</small></button>)}</div></fieldset>
            <div className="select-grid"><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="easy">Easy · more guidance</option><option value="medium">Medium · balanced</option><option value="hard">Hard · more threads</option></select></label><label>Case length<select value={length} onChange={(event) => setLength(event.target.value)}><option value="short">Short · quick read</option><option value="standard">Standard · full file</option><option value="long">Long · deeper case</option></select></label></div>
            <label className={'fiction-consent' + (formErrors.consent ? ' has-error' : '')}><input ref={consentRef} type="checkbox" required checked={fictionAccepted} aria-invalid={Boolean(formErrors.consent)} aria-describedby={formErrors.consent ? 'fiction-error' : undefined} onChange={(event) => { setFictionAccepted(event.target.checked); if (formErrors.consent) setFormErrors((errors) => ({ ...errors, consent: undefined })); }} /><span>I understand this is a fictional story and generated details are invented.</span></label>{formErrors.consent && <p className="field-error" id="fiction-error" role="alert">{formErrors.consent}</p>}{error && <p className="error-message" role="alert">{error}</p>}<button className="button button-primary generate-button" disabled={busy}>{busy ? <><i className="spinner" /> Building your case…</> : <>Generate Mystery <span>→</span></>}</button><p className="form-footnote">◇ &nbsp; Anonymous case · Expires after 30 days · No account needed</p>
          </form>
        </section>
        {scenePreview && <div className="scene-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScenePreview(''); }}><section className="scene-preview" role="dialog" aria-modal="true" aria-labelledby="scene-preview-title"><button type="button" className="close" aria-label="Close clue preview" onClick={() => setScenePreview('')}>×</button><p className="eyebrow">FICTIONAL FIELD NOTE · PROP FILE</p><h2 id="scene-preview-title">{scenePreview}</h2><p>This exhibit represents the kind of fictional material you can examine in an investigation. Create a case to inspect its actual suspect profiles, source records, and timeline.</p><button className="button button-primary" onClick={() => { setScenePreview(''); startInvestigating(); }}>Start a new investigation ↗</button></section></div>}
        <footer className="site-footer" id="about"><Brand /><span>FICTION FOR THE CURIOUS.</span><a href="https://github.com/sanjeeva908/AI-Mystery" target="_blank" rel="noreferrer">Built around the details ↗</a></footer>
      </main>
    );
  }

  if (caseId && !data && !error) {
    return <main className="state-screen is-generating"><header className="state-topbar"><Brand /><ThemeToggle theme={theme} onToggle={toggleTheme} /></header><div className="state-content"><span className="generation-seal" aria-hidden="true"><i /><b /></span><p className="eyebrow">CASE IN PROGRESS</p><h1>Putting the pieces in place.</h1><p className="generation-message" aria-live="polite" aria-atomic="true">{generationMessages[generationMessageIndex]}</p><div className="loading-track" role="progressbar" aria-label="Mystery generation progress" aria-valuetext="In progress"><i /></div><span className="state-footnote">Your answer key stays sealed until your final accusation.</span>{generationSlow && <section className="generation-slow" aria-live="polite"><p>This is taking longer than usual.</p><p className="generation-cancel-note">Canceling here stops this browser’s polling and starts a fresh case with the same inputs. The server may continue preparing the earlier case in the background.</p><div><button className="button button-secondary" onClick={() => setGenerationSlow(false)}>Keep waiting</button><button className="button button-primary" disabled={busy} onClick={() => void cancelAndRetryGeneration()}>{busy ? 'Starting a fresh attempt…' : 'Cancel & retry'}</button></div></section>}{error && <p className="error-message" role="alert">{error}</p>}</div></main>;
  }

  if (error && !data) return <main className="state-screen generation-error"><header className="state-topbar"><Brand /><ThemeToggle theme={theme} onToggle={toggleTheme} /></header><div className="state-content"><span className="state-emblem error-emblem">!</span><p className="eyebrow">FILE ACCESS INTERRUPTED</p><h1>This case file is unavailable.</h1><p role="alert">{error}</p><div className="state-actions"><button className="button button-secondary" disabled={busy} onClick={() => caseRetryAvailable ? void retryGeneration() : caseId && void loadCase(caseId, token)}>{busy ? 'Retrying…' : caseRetryAvailable ? 'Retry case generation' : 'Try again'}</button><a className="button button-primary" href="/#new-case">Cancel & start again →</a></div><span className="state-footnote">If this file has expired, start a new investigation.</span></div></main>;  if (!data) return null;
  const completed = data.status === 'completed';
  const currentSuspect = data.suspects.find((person) => person.id === suspect);
  const reviewedPercent = data.evidence.length ? Math.round(data.progress.reviewedEvidenceIds.length / data.evidence.length * 100) : 0;
  const caseTabs = completed ? [...tabs, 'Verdict' as const] : tabs;

  return (
    <main className="case-app">
      <header className="case-topbar"><Brand /><div className="case-reference"><i /><small>FICTIONAL CASE</small><span />{data.caseId.slice(0, 8).toUpperCase()}</div><div className="case-header-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /><a className="new-case-link" href="/">Close file <b>×</b></a></div></header>
      <div className="case-layout">
        <aside className="rail">
          <div className="rail-label"><span className="eyebrow">INVESTIGATION ROOM</span><span className="rail-seal">N</span></div>
          <div className="case-name">{data.caseFile.title}<small>⌖ &nbsp;{data.caseFile.incident.location}</small></div>
          <nav className="section-nav" role="tablist" aria-label="Case sections">{caseTabs.map((item, index) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={'nav-item' + (tab === item ? ' active' : '')} onClick={() => { setTab(item); if (completed) setReviewingCompletedCase(item !== 'Verdict'); }}><span>{'0' + (index + 1)}</span>{item}{item === 'Evidence' && <b>{data.evidence.length}</b>}</button>)}</nav>
          <section className="progress-box" aria-label="Investigation progress"><span className="eyebrow">YOUR INVESTIGATION</span><strong>{data.progress.reviewedEvidenceIds.length}<small> / {data.evidence.length}</small></strong><span>pieces of evidence reviewed</span><div className="progress-track" role="progressbar" aria-label="Evidence reviewed" aria-valuenow={reviewedPercent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: reviewedPercent + '%' }} /></div><div className="progress-meta"><span>{data.progress.inspectedSuspectIds.length} suspects examined</span><span>{data.progress.hintsUsed}/{data.hintLimit} hints</span></div></section>
          <div className="rail-bottom"><span>◇</span><p>All people, records and events in this room are fictional.</p><small>THE NIGHT ARCHIVE · VOL. 01</small></div>
        </aside>

        <section className="case-main">
          <div className="case-banner"><div><p className="eyebrow">CASE BRIEF <span>/</span> {new Date(data.caseFile.incident.dateTime).toLocaleDateString()}</p><h1>{data.caseFile.title}</h1><p>{data.caseFile.incident.location}</p></div><span className={'status-pill' + (completed ? ' closed' : '')}><i />{completed ? 'CASE CLOSED' : 'OPEN INVESTIGATION'}</span></div>
          {error && <p className="error-message inline-error" role="alert">{error}</p>}

          {completed && data.reveal && !reviewingCompletedCase ? <section className="reveal-card" aria-live="polite">
            <div className="verdict-seal" aria-hidden="true"><i /><b>{data.accusation?.isCorrect ? '✓' : '!'}</b></div>
            <div className="reveal-top"><div><p className="eyebrow">CASE CLOSED · {data.caseId.slice(0, 8).toUpperCase()}</p><h2>{data.accusation?.isCorrect ? 'You found the truth.' : 'The trail led elsewhere.'}</h2></div><span className={data.accusation?.isCorrect ? 'result-good' : 'result-bad'}>{data.accusation?.isCorrect ? 'CASE SOLVED' : 'CASE MISSED'}</span></div>
            <div className="completion-stats" aria-label="Your investigation summary"><div><strong>{data.progress.reviewedEvidenceIds.length}<small> / {data.evidence.length}</small></strong><span>evidence reviewed</span></div><div><strong>{data.progress.inspectedSuspectIds.length}<small> / {data.suspects.length}</small></strong><span>profiles examined</span></div><div><strong>{data.progress.hintsUsed}<small> / {data.hintLimit}</small></strong><span>hints used</span></div></div>
            <div className="culprit-panel"><span className="eyebrow">RESPONSIBLE PARTY</span><h3>{data.reveal.culpritName}</h3><p>{data.reveal.motive}</p></div>
            <div className="reveal-columns"><div><h3>Opportunity</h3><p>{data.reveal.opportunity}</p></div><div><h3>Reconstruction</h3>{data.reveal.reconstruction.map((event, index) => <p className="reconstruction-item" key={index}><code>{event.timestamp}</code> {event.description} {event.evidenceIds.map((id) => <button className="citation" key={id} onClick={() => { setTab('Evidence'); setReviewingCompletedCase(true); const item = data.evidence.find((record) => record.id === id); if (item) void markEvidence(item); }}>{id}</button>)}</p>)}</div></div>
            <h3 className="reveal-section-title">Evidence recap · why the clues mattered</h3><div className="reasoning-list">{data.reveal.evidenceReasoning.map((item) => <p key={item.evidenceId}><b>{item.relationship === 'supports' ? '+' : '−'}</b><strong>{item.evidenceId}</strong><span>{item.interpretation}</span></p>)}</div>
            {data.reveal.redHerrings.length > 0 && <><h3 className="reveal-section-title">The false leads</h3><div className="reasoning-list">{data.reveal.redHerrings.map((item) => <p key={item.evidenceId}><b>↗</b><strong>{item.evidenceId}</strong><span>{item.explanation}</span></p>)}</div></>}
            <p className="verdict-disclaimer">This investigation is fictional and created for entertainment.</p><div className="result-actions"><button className="button button-secondary" onClick={() => { setTab('Evidence'); setReviewingCompletedCase(true); }}>Review the evidence</button><a className="button button-primary" href="/#new-case">Play again →</a><a className="button button-home" href="/">Back home</a></div>
          </section> : <>
            {!completed && <div className="mobile-progress"><span>CASE PROGRESS</span><strong>{data.progress.reviewedEvidenceIds.length} / {data.evidence.length} clues</strong><div className="progress-track"><i style={{ width: reviewedPercent + '%' }} /></div></div>}
            <section className="case-content" role="tabpanel" aria-label={tab}>
              {tab === 'Briefing' && <div className="brief-layout">
                <article className="brief-card"><div className="card-topline"><span className="eyebrow">INCIDENT SUMMARY</span><span>FILED · {new Date(data.caseFile.incident.dateTime).toLocaleDateString()}</span></div><p className="summary">{data.caseFile.summary}</p><div className="incident-meta"><div><span>LOCATION</span><strong>{data.caseFile.incident.location}</strong></div><div><span>PERSONS OF INTEREST</span><strong>{data.suspects.length} persons</strong></div><div><span>AVAILABLE MATERIAL</span><strong>{data.evidence.length} records</strong></div><div><span>CASE REFERENCE</span><strong>{data.caseId.slice(0, 8).toUpperCase()}</strong></div></div></article>
                <article className="objective-card"><span className="eyebrow">INVESTIGATOR’S OBJECTIVE</span><b aria-hidden="true">§</b><h2>Find the thread<br />that holds.</h2><p>Compare each account with the record. Separate what was seen from what was assumed.</p><footer><span>FOCUS</span><strong>Access · timing · motive</strong></footer></article>
                <section className="hint-card"><div className="hint-heading"><i>?</i><div><span className="eyebrow">FIELD NOTE</span><h2>A nudge, if you need one.</h2></div></div><p>{hint || 'The fairest answer is usually supported by more than one independent clue. Take your time with the details.'}</p><div className="hint-action"><div className="hint-meter">{Array.from({ length: data.hintLimit }, (_, index) => <i key={index} className={index < data.progress.hintsUsed ? 'used' : ''} />)}<span>{data.progress.hintsUsed} / {data.hintLimit} used</span></div><button className="button button-secondary" disabled={completed || hintBusy || data.progress.hintsUsed >= data.hintLimit} onClick={() => void requestHint()}>{completed ? 'Case closed' : hintBusy ? 'Looking for a clue…' : data.progress.hintsUsed >= data.hintLimit ? 'No hints remaining' : 'Request a hint ↗'}</button></div></section>
                <div className="brief-next"><span className="eyebrow">BEGIN WITH THE PEOPLE</span><button className="text-link" onClick={() => setTab('Suspects')}>Review persons of interest ↗</button></div>
              </div>}

              {tab === 'Suspects' && <div className="section-panel"><div className="panel-heading"><div><p className="eyebrow">PERSONS OF INTEREST · {data.suspects.length} FILES</p><h2>Who had a reason to be there?</h2></div><p>Compare each account with the timeline. Motive is context, not proof.</p></div><div className="suspect-grid">{data.suspects.length ? data.suspects.map((person, index) => { const isExpanded = expandedSuspect === person.id; const isReviewed = data.progress.inspectedSuspectIds.includes(person.id); return <article className={'suspect-card' + (suspect === person.id ? ' chosen' : '')} key={person.id}><div className="suspect-card-top"><span className="eyebrow">PERSON / 0{index + 1}</span><span className={isReviewed ? 'reviewed-label' : ''}>{isReviewed ? '✓ REVIEWED' : 'UNREVIEWED'}</span></div><button className="suspect-expand" type="button" aria-expanded={isExpanded} aria-controls={'suspect-details-' + person.id} onClick={() => { setExpandedSuspect(isExpanded ? '' : person.id); if (!isExpanded) void inspectSuspect(person.id); }}><span className="suspect-heading"><i>{person.name.split(' ').map((name) => name[0]).join('')}</i><span><strong>{person.name}</strong><small>{person.role}</small></span></span><span className="suspect-profile">{person.profile}</span><span className="suspect-expand-label">{isExpanded ? 'Close profile' : 'Examine profile'} <b aria-hidden="true">{isExpanded ? '−' : '+'}</b></span></button><div className={'suspect-detail-wrap' + (isExpanded ? ' expanded' : '')} id={'suspect-details-' + person.id} aria-hidden={!isExpanded}><div className="suspect-detail"><span>KNOWN MOTIVE</span><p>{person.knownMotive}</p><span>STATED ALIBI</span><p>{person.alibi || 'No statement recorded.'}</p></div></div></article>; }) : <p className="empty-state">No suspect profiles are available for this case.</p>}</div></div>}

              {tab === 'Evidence' && <div className="section-panel"><div className="panel-heading"><div><p className="eyebrow">THE CASE RECORD · {data.evidence.length} ITEMS</p><h2>Read what the room left behind.</h2></div><p>Open a record to review its full contents and source.</p></div><div className="filters"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search evidence" placeholder="Search records, people, details…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter by type" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">All record types</option>{[...new Set(data.evidence.map((item) => item.type))].map((kind) => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}</select><select aria-label="Filter review status" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option value="all">All records</option><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option></select></div><div className="evidence-list">{filteredEvidence.map((item) => <button className="evidence-card" key={item.id} onClick={() => void markEvidence(item)}><span className="evidence-code">{item.id}</span><span className="evidence-icon">{item.type === 'digital_log' ? '⌁' : item.type === 'document' ? '▤' : item.type === 'cctv_log' ? '◉' : '◷'}</span><span className="evidence-content"><small>{item.type.replaceAll('_', ' ').toUpperCase()} · {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'UNDATED'}</small><strong>{item.title}</strong><span>{item.summary}</span><em>FICTIONAL RECORD · {item.source}</em></span><span className="review-mark">{data.progress.reviewedEvidenceIds.includes(item.id) ? '✓' : '↗'}</span></button>)}{filteredEvidence.length === 0 && <p className="empty-state">No records match these filters. Try a different search.</p>}</div></div>}

              {tab === 'Timeline' && <div className="section-panel"><div className="panel-heading"><div><p className="eyebrow">SEQUENCE OF EVENTS · {data.timeline.length} ENTRIES</p><h2>Put the evening in order.</h2></div><p>Observed events come from the record. Inferred events represent conclusions drawn from available details.</p></div>{data.timeline.length ? <div className="timeline">{[...data.timeline].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((event, index) => <article className={'timeline-item' + (event.kind === 'observed' && event.evidenceIds.length > 1 ? ' key-event' : '')} style={{ '--timeline-index': index } as CSSProperties} key={event.id}><time>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><i /><div><span className="eyebrow">{event.kind === 'observed' ? 'OBSERVED' : 'INFERRED'} EVENT · {event.id}</span><p>{event.description}</p><div className="refs">{event.evidenceIds.map((id) => { const item = data.evidence.find((record) => record.id === id); return item ? <button className="citation" key={id} onClick={() => { setTab('Evidence'); void markEvidence(item); }}>{id} · {item.title}</button> : null; })}</div></div></article>)}</div> : <p className="empty-state">There are no timeline entries in this case.</p>}</div>}
            </section>
            {!completed && <section className="accusation-box"><div><span className="eyebrow">WHEN YOU’RE READY</span><h2>Make your accusation.</h2><p>This is your one final answer. The solution stays sealed until you submit.</p></div><div className="accusation-controls"><label className="sr-only" htmlFor="accused-suspect">Select a suspect</label><select id="accused-suspect" aria-label="Select a suspect" value={suspect} onChange={(event) => { setSuspect(event.target.value); if (event.target.value) void inspectSuspect(event.target.value); }}><option value="">Select a suspect…</option>{data.suspects.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.role}</option>)}</select><button className="button button-primary" disabled={!suspect || busy} onClick={() => setPendingAccusation(true)}>Submit accusation ↗</button></div></section>}
            {completed && <div className="completed-review-actions"><span className="eyebrow">CASE CLOSED · REVIEW MODE</span><button className="button button-secondary" onClick={() => { setTab('Verdict'); setReviewingCompletedCase(false); }}>Return to the verdict ↗</button></div>}
          </>}
        </section>
      </div>
      {selected && <div className="scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><button className="close" aria-label="Close evidence" onClick={() => setSelected(null)}>×</button><p className="eyebrow">FICTIONAL EVIDENCE · {selected.id}</p><h2 id="evidence-title">{selected.title}</h2><p className="role">{selected.type.replaceAll('_', ' ')} · {selected.source}</p><p className="drawer-summary">{selected.summary}</p><p className="evidence-body">{selected.body}</p><div className="drawer-meta"><span>TIME</span><p>{selected.timestamp ? new Date(selected.timestamp).toLocaleString() : 'Not recorded'}</p><span>PEOPLE REFERENCED</span><p>{selected.personIds.map((id) => data.suspects.find((person) => person.id === id)?.name).filter(Boolean).join(', ') || 'None'}</p>{selected.location && <><span>LOCATION</span><p>{selected.location}</p></>}{selected.reliabilityNote && <><span>RELIABILITY NOTE</span><p>{selected.reliabilityNote}</p></>}</div><button className="button button-secondary drawer-close-action" onClick={() => setSelected(null)}>Close evidence</button></aside></div>}
      {pendingAccusation && <div className="scrim dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingAccusation(false); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><span className="eyebrow">FINAL DECISION · ONE ANSWER</span><i>?</i><h2 id="confirm-title">Submit your final accusation?</h2><p id="confirm-description">You selected <b>{currentSuspect?.name}</b>. This decision cannot be changed. The solution will be revealed after submission.</p><div className="actions"><button className="button button-secondary" onClick={() => setPendingAccusation(false)}>Keep investigating</button><button className="button button-primary" disabled={busy} onClick={() => void accuse()}>{busy ? 'Submitting…' : 'Confirm accusation'}</button></div></section></div>}
    </main>
  );
}

export default App;
