// Main app: routing, state, and all view rendering.
// Depends on globals from db.js, exercises.js, volume-landmarks.js, plans.js, progression.js.

const STATE = {
  settings: null,
  meso: null,
  sessions: [],
  draft: null,
  customExercises: []
};

const TIMER = { remaining: 105, running: false, intervalId: null, total: 105, activeEntryIndex: null };

// ---------------------------------------------------------------------------
// Toasts, confirm/message modals, save indicator, update banner
// ---------------------------------------------------------------------------
// Small transient notice in the corner -- used for background failures
// (a save that didn't go through, etc.) that shouldn't block the UI the way
// a modal does.
function showToast(message, opts) {
  opts = opts || {};
  const type = opts.type || 'info';
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, opts.duration || 3200);
}

// Generic replacements for the native confirm()/alert() -- same modal
// look-and-feel as the exercise/muscle check-in popups so a destructive
// action doesn't suddenly pop an unstyled browser dialog.
function openConfirmModal(message, opts) {
  opts = opts || {};
  closeAnyModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <p style="margin:0 0 18px;font-size:15px;line-height:1.4">${escapeHtml(message)}</p>
      <div class="row">
        <button type="button" class="secondary block" data-role="modal-cancel">${escapeHtml(opts.cancelLabel || 'Cancel')}</button>
        <button type="button" class="block ${opts.danger ? 'danger' : ''}" data-role="modal-confirm">${escapeHtml(opts.confirmLabel || 'Confirm')}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const cancel = () => { modal.remove(); if (opts.onCancel) opts.onCancel(); };
  const confirmIt = () => { modal.remove(); if (opts.onConfirm) opts.onConfirm(); };
  modal.querySelector('[data-role="modal-cancel"]').addEventListener('click', cancel);
  modal.querySelector('[data-role="modal-confirm"]').addEventListener('click', confirmIt);
  modal.addEventListener('click', (e) => { if (e.target === modal) cancel(); });
}

function openMessageModal(message, opts) {
  opts = opts || {};
  closeAnyModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <p style="margin:0 0 18px;font-size:15px;line-height:1.4">${escapeHtml(message)}</p>
      <button type="button" class="block" data-role="modal-ok">${escapeHtml(opts.okLabel || 'OK')}</button>
    </div>`;
  document.body.appendChild(modal);
  const cleanup = () => { modal.remove(); if (opts.onClose) opts.onClose(); };
  modal.querySelector('[data-role="modal-ok"]').addEventListener('click', cleanup);
  modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(); });
}

// Tiny "Saving…/Saved/Save failed" label rendered next to the workout date
// in the Log view -- the only sign you had before that anything was being
// persisted was... nothing, so a failed write behind a debounce could be
// silently lost. Safe to call when the element isn't on screen.
function setSaveIndicator(state) {
  const el = document.getElementById('saveIndicatorEl');
  if (!el) return;
  el.dataset.state = state;
  el.textContent = state === 'pending' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Save failed' : '';
  if (state === 'saved') {
    setTimeout(() => { if (el.dataset.state === 'saved') el.textContent = ''; }, 2000);
  }
}

// Persistent bar (not a toast -- shouldn't auto-dismiss) telling you a new
// version of the app has been fetched in the background and is ready.
function showUpdateBanner(reg) {
  if (document.getElementById('updateBanner')) return;
  const el = document.createElement('div');
  el.id = 'updateBanner';
  el.className = 'update-banner';
  el.innerHTML = `<span>A new version is ready.</span><button type="button" data-role="update-reload">Reload</button>`;
  document.body.appendChild(el);
  el.querySelector('[data-role="update-reload"]').addEventListener('click', () => {
    if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Cloud sync auth gate -- shown before the app loads if Supabase is wired up
// (see js/sync.js) and no session is active yet. "Skip for now" always
// stays available so a Supabase hiccup, or simply not wanting an account,
// never blocks using the app the way it always worked.
// ---------------------------------------------------------------------------
function renderAuthGate() {
  let mode = 'signin';
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="appbar"><div><h1>HyperTrack</h1></div></div>
    <div class="view" style="max-width:400px">
      <div class="card">
        <h2 id="authTitle" style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--text)">Sign In</h2>
        <p class="small muted" style="margin-top:-4px">Sync your workouts across devices so they never live only in this browser.</p>
        <div class="field"><label>Email</label><input type="email" id="authEmail" placeholder="you@example.com"></div>
        <div class="field"><label>Password</label><input type="password" id="authPassword" placeholder="At least 6 characters"></div>
        <p id="authError" class="small" style="color:var(--critical);display:none;margin-bottom:10px"></p>
        <p id="authNotice" class="small" style="color:var(--good);display:none;margin-bottom:10px"></p>
        <button class="block" id="authSubmitBtn">Sign In</button>
        <p class="small muted" style="text-align:center;margin-top:14px"><a href="#" id="authToggleMode">Need an account? Create one</a></p>
        <p class="small muted" style="text-align:center;margin-top:6px"><a href="#" id="authSkip">Skip for now &mdash; use offline only</a></p>
      </div>
    </div>`;

  const emailEl = document.getElementById('authEmail');
  const passEl = document.getElementById('authPassword');
  const errEl = document.getElementById('authError');
  const noticeEl = document.getElementById('authNotice');
  const submitBtn = document.getElementById('authSubmitBtn');
  const titleEl = document.getElementById('authTitle');
  const toggleLink = document.getElementById('authToggleMode');

  const setError = (msg) => { errEl.textContent = msg; errEl.style.display = msg ? 'block' : 'none'; };
  const setNotice = (msg) => { noticeEl.textContent = msg; noticeEl.style.display = msg ? 'block' : 'none'; };
  const applyMode = () => {
    titleEl.textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
    submitBtn.textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
    toggleLink.textContent = mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in';
  };

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    mode = mode === 'signin' ? 'signup' : 'signin';
    applyMode();
    setError(''); setNotice('');
  });
  document.getElementById('authSkip').addEventListener('click', (e) => {
    e.preventDefault();
    startApp();
  });
  submitBtn.addEventListener('click', async () => {
    setError(''); setNotice('');
    const email = emailEl.value.trim();
    const password = passEl.value;
    if (!email || !password) { setError('Enter an email and password.'); return; }
    submitBtn.disabled = true;
    try {
      if (mode === 'signin') {
        await Sync.signIn(email, password);
        STATE.authEmail = email;
        await Sync.syncOnLogin();
        startApp();
      } else {
        await Sync.signUp(email, password);
        setNotice('Check your email to confirm your account, then sign in below.');
        mode = 'signin';
        applyMode();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function startApp() {
  try {
    STATE.settings = await DB.getSettings();
    STATE.meso = await DB.getActiveMesocycle();
    STATE.sessions = await DB.getAllSessions();
    STATE.customExercises = await DB.getAllCustomExercises();
  } catch (e) {
    console.error('Failed to load app data', e);
    document.getElementById('app').innerHTML = `<div class="view"><div class="card">
      <h2>Couldn't load your data</h2>
      <p>Something went wrong reading your workout data from this browser. Try reloading the page. If this keeps happening, your device's storage may be full.</p>
      <button class="block" onclick="location.reload()">Reload</button>
    </div></div>`;
    return;
  }
  TIMER.remaining = STATE.settings.restTimerSeconds || 105;
  TIMER.total = TIMER.remaining;
  applyTheme(STATE.settings.theme || 'dark');

  window.addEventListener('hashchange', () => renderRoute());
  renderRoute();
}

async function boot() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          // Only worth announcing if there's an OLD worker already controlling
          // the page -- on first install there's nothing to "update" from.
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(reg);
          }
        });
      });
      let reloadedForUpdate = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadedForUpdate) return;
        reloadedForUpdate = true;
        location.reload();
      });
    } catch (e) { console.warn('SW registration failed', e); }
  }
  // Ask the browser not to evict this origin's storage under pressure --
  // best-effort and silently ignored where unsupported (e.g. iOS Safari).
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch (e) { /* best effort */ }
  }

  // If cloud sync is wired up (js/sync.js) and nobody's signed in on this
  // device yet, show the sign-in gate first -- but "Skip for now" inside it
  // always falls through to startApp() so a Supabase outage, or just not
  // wanting an account, never blocks using the app like it always has.
  if (window.Sync && Sync.enabled) {
    try {
      const session = await Sync.getSession();
      if (session) {
        STATE.authEmail = session.user.email;
        await Sync.syncOnLogin();
        Sync.onAuthStateChange((s) => { if (!s) location.reload(); });
        await startApp();
        return;
      }
    } catch (e) { console.warn('Cloud sync check failed, continuing offline', e); }
    renderAuthGate();
    return;
  }

  await startApp();
}

function applyTheme(theme) {
  const value = theme || 'dark';
  document.documentElement.setAttribute('data-theme', value);
}

document.addEventListener('DOMContentLoaded', boot);

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function renderRoute() {
  const container = document.getElementById('app');
  if (!STATE.settings.onboarded || !STATE.meso) {
    renderOnboarding(container, { isChange: false });
    return;
  }
  const hashPath = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const segments = hashPath.split('/');
  switch (segments[0]) {
    case 'dashboard': renderDashboard(container); break;
    case 'log': await renderLog(container); break;
    case 'progress': renderProgress(container); break;
    case 'settings': renderSettings(container); break;
    case 'setup': renderOnboarding(container, { isChange: true }); break;
    case 'session': await renderSessionDetail(container, segments[1]); break;
    default: renderDashboard(container);
  }
  // Hash-based navigation swaps the whole view but a real page nav would
  // start at the top -- match that so landing on a new screen never leaves
  // you scrolled to wherever the previous screen happened to be.
  window.scrollTo(0, 0);
}

function goTo(route) { location.hash = '#/' + route; }

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------
function appShell(bodyHtml, activeRoute, title, subtitle) {
  return `
    <div class="appbar">
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
      </div>
    </div>
    <div class="view">${bodyHtml}</div>
    ${STATE.settings.onboarded ? bottomNavHtml(activeRoute) : ''}
  `;
}

// Inline outline-style SVGs (stroke uses currentColor so they inherit the
// nav's muted/accent text color for free) -- kept as plain strings so the
// nav never depends on an icon font or CDN fetch, matching the rest of this
// no-build-step, offline-first app.
const NAV_ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
  log: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  progress: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

function bottomNavHtml(active) {
  const items = [
    { route: 'dashboard', label: 'Dashboard' },
    { route: 'log', label: 'Log' },
    { route: 'progress', label: 'Progress' },
    { route: 'settings', label: 'Settings' }
  ];
  return `<div class="bottomnav">${items.map((i) =>
    `<a href="#/${i.route}" class="${i.route === active ? 'active' : ''}"><span class="icon">${NAV_ICONS[i.route]}</span>${i.label}</a>`
  ).join('')}</div>`;
}

// Shared empty-state markup (small muted icon + message) so "nothing here
// yet" screens read as designed rather than as a bare line of gray text.
function emptyState(text) {
  return `<div class="empty-state"><svg class="empty-state-icon" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" stroke-dasharray="2.5 3.5"/></svg><p>${text}</p></div>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function exerciseById(id) {
  return EXERCISES.find((e) => e.id === id) || (STATE.customExercises || []).find((e) => e.id === id);
}

// Built-in + user-created exercises for a given muscle group, built-ins first.
function combinedExercisesForMuscle(muscleGroup) {
  const custom = (STATE.customExercises || []).filter((e) => e.muscleGroup === muscleGroup);
  return exercisesForMuscle(muscleGroup).concat(custom);
}

// ---------------------------------------------------------------------------
// Mesocycle status / volume math
// ---------------------------------------------------------------------------
function mesoStatus(meso, sessions) {
  const mesoSessions = sessions
    .filter((s) => s.mesoId === meso.id && s.completed)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const count = mesoSessions.length;
  const weekIndex = Math.floor(count / meso.daysPerWeek);
  const totalWeeks = meso.trainingWeeks + 1;
  const isDeload = weekIndex === meso.trainingWeeks;
  const isComplete = weekIndex > meso.trainingWeeks;
  const dayIndex = count % meso.daysPerWeek;
  const weekStartIdx = weekIndex * meso.daysPerWeek;
  const currentWeekSessions = mesoSessions.slice(weekStartIdx, weekStartIdx + meso.daysPerWeek);
  return { count, weekIndex, totalWeeks, isDeload, isComplete, dayIndex, currentWeekSessions };
}

// Warm-up sets don't count toward the volume/set totals shown here -- they're
// a ramp, not working volume the muscle needs to recover from.
function loggedSetCount(sets) {
  return (sets || []).filter((s) => !s.warmup && s.reps !== '' && s.reps !== null && s.reps !== undefined && !isNaN(parseFloat(s.reps))).length;
}

// Shared shortcut for the "finished workouts only" filter used all over
// (dashboard stats, streak, progress history, PR lookups) so it isn't
// hand-rolled slightly differently in five different places.
function completedSessions(sessions) {
  return (sessions || []).filter((s) => s.completed);
}

// Compact summary of a completed session used anywhere it's listed as a row:
// dashboard "Recent Sessions", Progress "Session History", and the detail view header.
function sessionSummary(session) {
  const entries = session.entries || [];
  const totalSets = entries.reduce((sum, e) => sum + loggedSetCount(e.sets), 0);
  const totalVolume = entries.reduce((sum, e) => sum + (e.sets || []).reduce((s, set) => {
    if (set.warmup) return s;
    const w = parseFloat(set.weight), r = parseFloat(set.reps);
    return s + (isFinite(w) && isFinite(r) ? w * r : 0);
  }, 0), 0);
  const muscleLabels = Array.from(new Set(entries.map((e) => e.muscleGroup)))
    .map((m) => (VOLUME_LANDMARKS[m] ? VOLUME_LANDMARKS[m].label : m));
  let durationMin = null;
  if (session.startedAt && session.completedAt) {
    durationMin = Math.max(1, Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 60000));
  }
  return { totalSets, totalVolume: Math.round(totalVolume), muscleLabels, exerciseCount: entries.length, durationMin };
}

// True when it's been a while (or never) since the last export -- drives the
// dismissible "back up your data" nudge on the dashboard. Doesn't nag brand
// new accounts with nothing worth losing yet.
function shouldShowBackupNudge(settings, sessions) {
  const completedCount = completedSessions(sessions).length;
  if (completedCount < 3) return false;
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  if (settings.lastExportAt && new Date(settings.lastExportAt).getTime() > cutoff) return false;
  if (settings.backupNudgeDismissedAt && new Date(settings.backupNudgeDismissedAt).getTime() > cutoff) return false;
  return true;
}

// Current consecutive-week training streak: counts backward from this week
// as long as each week hit at least one completed session, for the little
// momentum badge on the dashboard.
function computeTrainingStreak(sessions) {
  const completed = completedSessions(sessions).map((s) => new Date(s.date));
  if (completed.length === 0) return 0;
  const weekKey = (d) => {
    const t = new Date(d);
    const day = (t.getDay() + 6) % 7; // Monday-start week
    t.setDate(t.getDate() - day);
    return t.toISOString().slice(0, 10);
  };
  const weeksWithWorkouts = new Set(completed.map(weekKey));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    if (weeksWithWorkouts.has(weekKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 7); }
    else break;
  }
  return streak;
}

// True if this set's estimated one-rep max (Epley) is the highest ever
// logged for this exercise as of (and including) the given session -- a
// personal-best flag that credits a heavier-lower-rep or lighter-higher-rep
// set fairly instead of only ever recognizing raw weight going up. Warm-up
// sets never count as -- or against -- a PR.
function isPRSet(allSessions, session, exerciseId, weight, reps) {
  const e1rm = estimated1RM(weight, reps);
  if (e1rm === null) return false;
  const priorBest = allSessions
    .filter((s) => s.completed && new Date(s.date) < new Date(session.date))
    .flatMap((s) => (s.entries || []).filter((e) => e.exerciseId === exerciseId))
    .flatMap((e) => (e.sets || []).filter((set) => !set.warmup))
    .reduce((best, set) => {
      const rm = estimated1RM(set.weight, set.reps);
      return rm !== null && rm > best ? rm : best;
    }, 0);
  return e1rm > priorBest;
}

function deleteSessionFlow(id, afterRoute) {
  openConfirmModal('Delete this workout? This cannot be undone.', {
    danger: true,
    confirmLabel: 'Delete',
    onConfirm: async () => {
      try {
        await DB.deleteSession(id);
        STATE.sessions = await DB.getAllSessions();
        if (STATE.draft && STATE.draft.id === id) STATE.draft = null;
        goTo(afterRoute || 'progress');
        renderRoute();
      } catch (err) {
        console.error('Failed to delete workout', err);
        showToast('Could not delete that workout.', { type: 'error' });
      }
    }
  });
}

// Shared clickable row used on the Dashboard's Recent Sessions and the
// Progress tab's Session History -- tap the row to open the full workout,
// tap the trash icon to delete it without leaving the list.
function sessionRowHtml(s) {
  const sum = sessionSummary(s);
  const muscleText = sum.muscleLabels.length
    ? sum.muscleLabels.slice(0, 3).join(' · ') + (sum.muscleLabels.length > 3 ? ' +' + (sum.muscleLabels.length - 3) : '')
    : `${sum.exerciseCount} exercises`;
  return `<div class="list-row clickable" data-role="session-row" data-id="${s.id}" role="button" tabindex="0">
      <div>
        <div class="primary">${escapeHtml(s.dayLabel)}${s.isDeload ? ' <span class="badge deload">deload</span>' : ''}</div>
        <div class="secondary">${escapeHtml(muscleText)} &middot; ${sum.totalSets} sets${sum.durationMin ? ' &middot; ' + sum.durationMin + ' min' : ''}</div>
      </div>
      <div class="row" style="gap:2px">
        <div style="text-align:right">
          <div class="trailing num">${sum.totalVolume ? sum.totalVolume.toLocaleString() + ' ' + escapeHtml(STATE.settings.units) : sum.totalSets + ' sets'}</div>
          <div class="trailing" style="margin-top:2px">${new Date(s.date).toLocaleDateString()}</div>
        </div>
        <button type="button" class="icon-btn" data-role="delete-session" data-id="${s.id}" aria-label="Delete workout">&#128465;</button>
      </div>
    </div>`;
}

function wireSessionRows(container, afterRouteForDelete) {
  container.querySelectorAll('[data-role="session-row"]').forEach((row) => {
    const go = () => goTo('session/' + row.dataset.id);
    row.addEventListener('click', (e) => { if (e.target.closest('[data-role="delete-session"]')) return; go(); });
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  container.querySelectorAll('[data-role="delete-session"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSessionFlow(parseInt(btn.dataset.id, 10), afterRouteForDelete);
    });
  });
}

function computeWeeklyVolume(meso, currentWeekSessions, draft) {
  const totals = {};
  MUSCLE_GROUP_ORDER.forEach((m) => (totals[m] = 0));
  const sessionsToCount = currentWeekSessions.slice();
  if (draft && draft.mesoId === meso.id && !draft.completed) sessionsToCount.push(draft);
  sessionsToCount.forEach((sess) => {
    (sess.entries || []).forEach((entry) => {
      totals[entry.muscleGroup] = (totals[entry.muscleGroup] || 0) + loggedSetCount(entry.sets);
    });
  });
  return totals;
}

// ---------------------------------------------------------------------------
// Onboarding / plan setup
// ---------------------------------------------------------------------------
let onboardingDraft = null;

function renderOnboarding(container, opts) {
  if (!onboardingDraft) {
    onboardingDraft = {
      mode: STATE.meso && STATE.meso.splitKey === 'custom' ? 'custom' : 'preset',
      splitKey: STATE.meso && STATE.meso.splitKey !== 'custom' ? STATE.meso.splitKey : 'upperLower',
      days: STATE.meso && STATE.meso.splitKey !== 'custom' ? STATE.meso.daysPerWeek : 4,
      units: STATE.settings ? STATE.settings.units || 'lbs' : 'lbs',
      goal: STATE.settings ? STATE.settings.goal || 'hypertrophy' : 'hypertrophy',
      priorityMuscles: STATE.settings && Array.isArray(STATE.settings.priorityMuscles) ? STATE.settings.priorityMuscles.slice() : [],
      trainingWeeks: STATE.meso ? STATE.meso.trainingWeeks : 4,
      customDays: [{ dayLabel: 'Day 1', exercises: [], addMuscle: MUSCLE_GROUP_ORDER[0] }]
    };
  }
  drawOnboarding(container, opts || {});
}

function customDaysBuilderHtml(customDays) {
  const dayCards = customDays.map((day, di) => {
    const musclesSoFar = Array.from(new Set(day.exercises.map((e) => e.muscleGroup)));
    const muscleLabel = musclesSoFar.length ? musclesSoFar.map((m) => VOLUME_LANDMARKS[m].label).join(' · ') : 'No exercises yet';
    const exerciseRows = day.exercises.map((ex, exi) => {
      const exObj = exerciseById(ex.exerciseId);
      return `<div class="list-row">
        <div>
          <div class="primary">${escapeHtml(exObj ? exObj.name : ex.exerciseId)}</div>
          <div class="secondary">${escapeHtml(VOLUME_LANDMARKS[ex.muscleGroup].label)}</div>
        </div>
        <button type="button" class="ghost small" data-role="remove-custom-exercise" data-day="${di}" data-ex="${exi}">&times;</button>
      </div>`;
    }).join('');
    const addMuscle = day.addMuscle || MUSCLE_GROUP_ORDER[0];
    const muscleOptions = MUSCLE_GROUP_ORDER.map((m) => `<option value="${m}" ${m === addMuscle ? 'selected' : ''}>${VOLUME_LANDMARKS[m].label}</option>`).join('');

    return `<div class="card">
      <div class="row between">
        <input type="text" class="day-label-input" data-role="custom-day-label" data-day="${di}" value="${escapeHtml(day.dayLabel)}" placeholder="Day label (e.g. Glutes A)" style="flex:1;background:transparent;border:none;font-size:15px;font-weight:700;padding:0">
        <button type="button" class="ghost small" data-role="remove-custom-day" data-day="${di}">Remove Day</button>
      </div>
      <p class="small muted" style="margin:4px 0 8px">${muscleLabel}</p>
      ${exerciseRows}
      <div class="row" style="margin-top:8px">
        <select data-role="custom-add-muscle" data-day="${di}" style="flex:1">${muscleOptions}</select>
        <select data-role="custom-add-exercise" data-day="${di}" style="flex:1">${exerciseOptionsHtml(addMuscle, null)}</select>
      </div>
      <button type="button" class="secondary block" style="margin-top:8px" data-role="custom-add-exercise-btn" data-day="${di}">+ Add Exercise</button>
    </div>`;
  }).join('');

  return dayCards + `<button type="button" class="block secondary" data-role="add-custom-day">+ Add Training Day</button>`;
}

function drawOnboarding(container, opts) {
  const plans = listAvailablePlans();
  const splitCards = plans.map((p) => {
    const selected = p.key === onboardingDraft.splitKey;
    return `<div class="choice-card ${selected ? 'selected' : ''}" data-role="pick-split" data-key="${p.key}">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${p.dayOptions.join(' or ')} days/week</p>
    </div>`;
  }).join('');

  const currentPlanDef = SPLIT_DEFINITIONS[onboardingDraft.splitKey];
  if (!currentPlanDef.dayOptions.includes(onboardingDraft.days)) {
    onboardingDraft.days = currentPlanDef.dayOptions[0];
  }
  const dayButtons = currentPlanDef.dayOptions.map((d) =>
    `<button type="button" class="${d === onboardingDraft.days ? '' : 'secondary'}" data-role="pick-days" data-days="${d}">${d} days/week</button>`
  ).join(' ');

  const isCustom = onboardingDraft.mode === 'custom';
  let n = 0;
  const num = () => ++n;

  const trainingStyleSection = `
    <div class="card">
      <h2>${num()}. Training Style</h2>
      <div class="row">
        <button type="button" class="${!isCustom ? '' : 'secondary'}" data-role="pick-mode" data-mode="preset">Use a Preset Split</button>
        <button type="button" class="${isCustom ? '' : 'secondary'}" data-role="pick-mode" data-mode="custom">Build Your Own</button>
      </div>
    </div>`;

  const splitSection = isCustom
    ? `
    <div class="card">
      <h2>${num()}. Your Training Days</h2>
      <p class="small muted">Add as many days as you want, each with its own label and exercises &mdash; nothing here is locked to a fixed split.</p>
    </div>
    ${customDaysBuilderHtml(onboardingDraft.customDays)}`
    : `
    <div class="card">
      <h2>${num()}. Split Style</h2>
      <div class="choice-grid">${splitCards}</div>
    </div>
    <div class="card">
      <h2>${num()}. Days Per Week</h2>
      <div class="row">${dayButtons}</div>
    </div>`;

  const goalSection = `
    <div class="card">
      <h2>${num()}. Training Goal</h2>
      <div class="row">
        <button type="button" class="${onboardingDraft.goal === 'hypertrophy' ? '' : 'secondary'}" data-role="pick-goal" data-goal="hypertrophy">Growth</button>
        <button type="button" class="${onboardingDraft.goal === 'strength' ? '' : 'secondary'}" data-role="pick-goal" data-goal="strength">Strength</button>
      </div>
      <p class="small muted" style="margin-top:8px">Sets the default rep range and target RIR used for progression suggestions. You can fine-tune these later in Settings.</p>
    </div>`;

  const priorityMuscles = onboardingDraft.priorityMuscles || [];
  const priorityCells = MUSCLE_GROUP_ORDER.map((m) => {
    const active = priorityMuscles.includes(m);
    return `<button type="button" class="priority-chip ${active ? 'active' : ''}" data-role="pick-priority" data-muscle="${m}">${escapeHtml(VOLUME_LANDMARKS[m].label)}</button>`;
  }).join('');

  const prioritySection = `
    <div class="card">
      <h2>${num()}. Your Priorities <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></h2>
      <p class="small muted" style="margin-top:-6px">Pick up to 3 muscle groups you most want to grow or strengthen. We'll give them extra weekly volume and train them first each session, while it's still fresh.</p>
      <div class="priority-grid">${priorityCells}</div>
    </div>`;

  const unitsSection = `
    <div class="card">
      <h2>${num()}. Units</h2>
      <div class="row">
        <button type="button" class="${onboardingDraft.units === 'lbs' ? '' : 'secondary'}" data-role="pick-units" data-units="lbs">lbs</button>
        <button type="button" class="${onboardingDraft.units === 'kg' ? '' : 'secondary'}" data-role="pick-units" data-units="kg">kg</button>
      </div>
    </div>`;

  const mesoSection = `
    <div class="card">
      <h2>${num()}. Mesocycle Length</h2>
      <div class="field">
        <label>Training weeks before deload (a deload week is always added after)</label>
        <input type="number" min="3" max="8" id="trainingWeeksInput" value="${onboardingDraft.trainingWeeks}">
      </div>
    </div>`;

  const body = `
    <div class="card">
      <h2>${opts.isChange ? 'Change Your Plan' : 'Welcome'}</h2>
      <p class="small muted">${opts.isChange ? 'This starts a fresh mesocycle. Your training history is kept.' : 'Pick a preset split or build your own training days, and we\'ll build your weekly volume targets automatically.'}</p>
    </div>
    ${trainingStyleSection}
    ${splitSection}
    ${goalSection}
    ${prioritySection}
    ${unitsSection}
    ${mesoSection}
    <button class="block" data-role="confirm-onboarding">${opts.isChange ? 'Start New Mesocycle' : 'Create My Plan'}</button>
    ${opts.isChange ? `<button class="block secondary" style="margin-top:8px" data-role="cancel-onboarding">Cancel</button>` : ''}
  `;

  container.innerHTML = `<div class="appbar"><div><h1>${opts.isChange ? 'Change Plan' : 'Hypertrophy Tracker'}</h1></div></div><div class="view">${body}</div>${(STATE.settings && STATE.settings.onboarded) ? bottomNavHtml('') : ''}`;

  container.querySelectorAll('[data-role="pick-mode"]').forEach((el) => {
    el.addEventListener('click', () => {
      onboardingDraft.mode = el.dataset.mode;
      if (onboardingDraft.mode === 'custom' && (!onboardingDraft.customDays || onboardingDraft.customDays.length === 0)) {
        onboardingDraft.customDays = [{ dayLabel: 'Day 1', exercises: [], addMuscle: MUSCLE_GROUP_ORDER[0] }];
      }
      drawOnboarding(container, opts);
    });
  });
  container.querySelectorAll('[data-role="pick-split"]').forEach((el) => {
    el.addEventListener('click', () => { onboardingDraft.splitKey = el.dataset.key; drawOnboarding(container, opts); });
  });
  container.querySelectorAll('[data-role="pick-days"]').forEach((el) => {
    el.addEventListener('click', () => { onboardingDraft.days = parseInt(el.dataset.days, 10); drawOnboarding(container, opts); });
  });
  container.querySelectorAll('[data-role="pick-goal"]').forEach((el) => {
    el.addEventListener('click', () => { onboardingDraft.goal = el.dataset.goal; drawOnboarding(container, opts); });
  });
  container.querySelectorAll('[data-role="pick-priority"]').forEach((el) => {
    el.addEventListener('click', () => {
      const m = el.dataset.muscle;
      const list = onboardingDraft.priorityMuscles || (onboardingDraft.priorityMuscles = []);
      const idx = list.indexOf(m);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        if (list.length >= 3) { openMessageModal('Pick up to 3 priority muscle groups for the biggest effect.'); return; }
        list.push(m);
      }
      drawOnboarding(container, opts);
    });
  });
  container.querySelectorAll('[data-role="pick-units"]').forEach((el) => {
    el.addEventListener('click', () => { onboardingDraft.units = el.dataset.units; drawOnboarding(container, opts); });
  });
  const twInput = container.querySelector('#trainingWeeksInput');
  if (twInput) twInput.addEventListener('input', () => { onboardingDraft.trainingWeeks = parseInt(twInput.value, 10) || 4; });

  // ---- custom day builder wiring ----
  container.querySelectorAll('[data-role="custom-day-label"]').forEach((el) => {
    el.addEventListener('input', () => {
      const di = parseInt(el.dataset.day, 10);
      onboardingDraft.customDays[di].dayLabel = el.value;
    });
  });
  container.querySelectorAll('[data-role="remove-custom-day"]').forEach((el) => {
    el.addEventListener('click', () => {
      const di = parseInt(el.dataset.day, 10);
      onboardingDraft.customDays.splice(di, 1);
      if (onboardingDraft.customDays.length === 0) {
        onboardingDraft.customDays.push({ dayLabel: 'Day 1', exercises: [], addMuscle: MUSCLE_GROUP_ORDER[0] });
      }
      drawOnboarding(container, opts);
    });
  });
  container.querySelectorAll('[data-role="add-custom-day"]').forEach((el) => {
    el.addEventListener('click', () => {
      onboardingDraft.customDays.push({ dayLabel: `Day ${onboardingDraft.customDays.length + 1}`, exercises: [], addMuscle: MUSCLE_GROUP_ORDER[0] });
      drawOnboarding(container, opts);
    });
  });
  container.querySelectorAll('[data-role="custom-add-muscle"]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const di = parseInt(sel.dataset.day, 10);
      onboardingDraft.customDays[di].addMuscle = sel.value;
      const exSel = container.querySelector(`[data-role="custom-add-exercise"][data-day="${di}"]`);
      if (exSel) exSel.innerHTML = exerciseOptionsHtml(sel.value, null);
    });
  });
  container.querySelectorAll('[data-role="custom-add-exercise-btn"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const di = parseInt(btn.dataset.day, 10);
      const muscleSel = container.querySelector(`[data-role="custom-add-muscle"][data-day="${di}"]`);
      const exSel = container.querySelector(`[data-role="custom-add-exercise"][data-day="${di}"]`);
      if (!exSel || !exSel.value) return;
      onboardingDraft.customDays[di].exercises.push({ exerciseId: exSel.value, muscleGroup: muscleSel.value });
      drawOnboarding(container, opts);
    });
  });
  container.querySelectorAll('[data-role="remove-custom-exercise"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const di = parseInt(btn.dataset.day, 10);
      const exi = parseInt(btn.dataset.ex, 10);
      onboardingDraft.customDays[di].exercises.splice(exi, 1);
      drawOnboarding(container, opts);
    });
  });

  const confirmBtn = container.querySelector('[data-role="confirm-onboarding"]');
  if (confirmBtn) confirmBtn.addEventListener('click', () => completeOnboarding());

  const cancelBtn = container.querySelector('[data-role="cancel-onboarding"]');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { onboardingDraft = null; goTo('settings'); });
}

async function completeOnboarding() {
  const draft = onboardingDraft;
  let plan;
  if (draft.mode === 'custom') {
    if (!draft.customDays || draft.customDays.length === 0) { openMessageModal('Add at least one training day.'); return; }
    for (const d of draft.customDays) {
      if (!d.exercises || d.exercises.length === 0) { openMessageModal(`Add at least one exercise to "${d.dayLabel}".`); return; }
    }
    try {
      plan = buildCustomPlan(draft.customDays.map((d) => ({ dayLabel: d.dayLabel || 'Day', exercises: d.exercises })), draft.priorityMuscles || []);
    } catch (err) {
      openMessageModal(err.message);
      return;
    }
  } else {
    plan = buildPlan(draft.splitKey, draft.days, draft.priorityMuscles || []);
  }

  try {
    if (STATE.meso) {
      await DB.updateMesocycle(STATE.meso.id, { active: false });
    }

    const newMeso = {
      splitKey: draft.mode === 'custom' ? 'custom' : draft.splitKey,
      daysPerWeek: draft.mode === 'custom' ? draft.customDays.length : draft.days,
      trainingWeeks: Math.max(1, draft.trainingWeeks || 4),
      startDate: new Date().toISOString(),
      plan,
      active: true,
      createdAt: new Date().toISOString()
    };
    const id = await DB.addMesocycle(newMeso);
    newMeso.id = id;
    STATE.meso = newMeso;

    const goalPreset = GOAL_PRESETS[draft.goal] || GOAL_PRESETS.hypertrophy;
    await DB.saveSettings({
      onboarded: true,
      units: draft.units,
      goal: draft.goal,
      priorityMuscles: draft.priorityMuscles || [],
      targetRIR: goalPreset.targetRIR,
      repRangeMin: goalPreset.repRangeMin,
      repRangeMax: goalPreset.repRangeMax,
      restTimerSeconds: (STATE.settings && STATE.settings.restTimerSeconds) || 105
    });
    STATE.settings = await DB.getSettings();
    STATE.sessions = await DB.getAllSessions();
    STATE.draft = null;
    onboardingDraft = null;
    goTo('dashboard');
    renderRoute();
  } catch (err) {
    console.error('Failed to save your plan', err);
    showToast('Could not save your plan — please try again.', { type: 'error', duration: 5000 });
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function statusMeta(status) {
  return {
    under:   { label: 'Under MEV', fillClass: 'fill-under',  textClass: 'status-under' },
    mev:     { label: 'Building',  fillClass: 'fill-mev',    textClass: 'status-mev' },
    mav:     { label: 'On Track',  fillClass: 'fill-mav',    textClass: 'status-mav' },
    high:    { label: 'High',      fillClass: 'fill-high',   textClass: 'status-high' },
    over:    { label: 'Over MRV',  fillClass: 'fill-over',   textClass: 'status-over' }
  }[status] || { label: '', fillClass: '', textClass: '' };
}

function renderDashboard(container) {
  const status = mesoStatus(STATE.meso, STATE.sessions);
  const plan = STATE.meso.plan;
  let body;

  if (status.isComplete) {
    body = `
      <div class="card">
        <h2>Mesocycle Complete</h2>
        <p>You finished all ${status.totalWeeks} weeks of your ${escapeHtml(plan.splitName)} block, including the deload. Nice work.</p>
        <a class="btn block" href="#/setup">Start Your Next Mesocycle</a>
      </div>`;
  } else {
    const weekLabel = status.isDeload ? 'Deload' : `Wk ${status.weekIndex + 1}/${STATE.meso.trainingWeeks}`;
    const todayDay = plan.days[status.dayIndex];
    const volumeTotals = computeWeeklyVolume(STATE.meso, status.currentWeekSessions, STATE.draft);
    const totalCompleted = completedSessions(STATE.sessions).length;

    const muscleKeys = MUSCLE_GROUP_ORDER.filter((m) => plan.weeklyTargets[m] !== undefined);
    const statuses = muscleKeys.map((m) => classifyVolume(m, volumeTotals[m] || 0));
    const onTrackCount = statuses.filter((s) => s === 'mav').length;
    const overCount = statuses.filter((s) => s === 'over').length;
    const overallOk = overCount === 0 && onTrackCount >= Math.ceil(muscleKeys.length / 2);

    const meterRows = muscleKeys.map((m) => {
      const lm = VOLUME_LANDMARKS[m];
      const logged = volumeTotals[m] || 0;
      const cls = classifyVolume(m, logged);
      const meta = statusMeta(cls);
      const pct = Math.min(100, Math.round((logged / lm.mrv) * 100));
      // Reference ticks at MEV and the start of MAV, shown even at 0% fill,
      // so an early-week glance at an empty bar still tells you where you're
      // headed instead of reading as blank/broken.
      const mevPct = Math.min(100, Math.round((lm.mev / lm.mrv) * 100));
      const mavPct = Math.min(100, Math.round((lm.mavLow / lm.mrv) * 100));
      return `<div class="meter-row">
        <span class="name">${escapeHtml(lm.label)}</span>
        <div class="meter-track">
          <div class="meter-fill ${meta.fillClass}" style="width:${pct}%"></div>
          <span class="meter-tick" style="left:${mevPct}%"></span>
          <span class="meter-tick" style="left:${mavPct}%"></span>
        </div>
        <span class="meter-status ${meta.textClass}">${meta.label}</span>
      </div>`;
    }).join('');

    const recent = completedSessions(STATE.sessions).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
    const recentHtml = recent.length
      ? recent.map(sessionRowHtml).join('')
      : emptyState('No workouts logged yet.');
    const streak = computeTrainingStreak(STATE.sessions);
    const showBackupNudge = shouldShowBackupNudge(STATE.settings, STATE.sessions);

    body = `
      ${streak >= 2 ? `<div class="streak-strip">&#128293; ${streak}-week training streak &mdash; keep it going</div>` : ''}
      ${showBackupNudge ? `
      <div class="card backup-nudge">
        <button type="button" class="modal-close" data-role="dismiss-backup-nudge" aria-label="Dismiss">&times;</button>
        <h2>Back up your data</h2>
        <p class="small muted" style="margin-top:-4px">Your workouts live only in this browser. It only takes a second to export a copy.</p>
        <a class="btn secondary block" href="#/settings">Export Backup</a>
      </div>` : ''}
      <div class="stat-row">
        <div class="stat-tile clickable" data-role="stat-workouts" role="button" tabindex="0" aria-label="View session history"><div class="val">${totalCompleted}</div><div class="lbl">Workouts</div></div>
        <div class="stat-tile clickable" data-role="stat-week" role="button" tabindex="0" aria-label="View plan details"><div class="val">${weekLabel}</div><div class="lbl">${escapeHtml(plan.splitName)}</div></div>
        <div class="stat-tile clickable ${overallOk ? '' : 'stat-tile-warning'}" data-role="stat-volume" role="button" tabindex="0" aria-label="Jump to this week's volume"><div class="val ${overallOk ? 'status-mav' : 'status-high'}">${overallOk ? '✓' : '!'}</div><div class="lbl">${overallOk ? 'On Track' : 'Check Volume'}</div></div>
      </div>

      <div class="card hero">
        <h2>Today</h2>
        <div class="today-title">${escapeHtml(todayDay.dayLabel)}</div>
        <div class="today-sub">${todayDay.muscles.map((m) => VOLUME_LANDMARKS[m].label).join(' · ')}</div>
        <button class="block" data-role="go-log">${STATE.draft && !STATE.draft.completed ? 'Resume Workout' : 'Start Workout'}</button>
      </div>

      <div class="card">
        <h2>This Week's Volume</h2>
        ${meterRows}
        <div class="legend">
          <div><span class="swatch" style="background:var(--muted)"></span>Under MEV</div>
          <div><span class="swatch" style="background:var(--warning)"></span>Building</div>
          <div><span class="swatch" style="background:var(--good)"></span>On Track</div>
          <div><span class="swatch" style="background:var(--serious)"></span>High</div>
          <div><span class="swatch" style="background:var(--critical)"></span>Over MRV</div>
        </div>
        ${status.isDeload ? '<p class="small muted" style="margin-top:10px">Deload week: lower numbers here are expected &mdash; targets are intentionally reduced.</p>' : ''}
      </div>

      <div class="card">
        <h2>Recent Sessions</h2>
        ${recentHtml}
      </div>
    `;
  }

  container.innerHTML = appShell(body, 'dashboard', 'HyperTrack', STATE.meso.plan.splitName);
  const goLogBtn = container.querySelector('[data-role="go-log"]');
  if (goLogBtn) goLogBtn.addEventListener('click', () => goTo('log'));
  const bindActivatable = (el, handler) => { if (!el) return; el.addEventListener('click', handler); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } }); };
  bindActivatable(container.querySelector('[data-role="stat-workouts"]'), () => goTo('progress'));
  bindActivatable(container.querySelector('[data-role="stat-week"]'), () => goTo('settings'));
  bindActivatable(container.querySelector('[data-role="stat-volume"]'), () => {
    const heading = Array.from(container.querySelectorAll('.card h2')).find((h) => h.textContent.trim() === "This Week's Volume");
    if (heading) heading.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const dismissBackupBtn = container.querySelector('[data-role="dismiss-backup-nudge"]');
  if (dismissBackupBtn) {
    dismissBackupBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await DB.saveSettings({ backupNudgeDismissedAt: new Date().toISOString() });
        STATE.settings = await DB.getSettings();
      } catch (err) {
        console.error('Failed to dismiss backup nudge', err);
      }
      const card = dismissBackupBtn.closest('.backup-nudge');
      if (card) card.remove();
    });
  }
  wireSessionRows(container, 'dashboard');
}

// ---------------------------------------------------------------------------
// Log workout (the Excel-style grid)
// ---------------------------------------------------------------------------
let saveTimeout = null;
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  setSaveIndicator('pending');
  saveTimeout = setTimeout(async () => {
    if (!STATE.draft) return;
    try {
      await DB.updateSession(STATE.draft.id, STATE.draft);
      setSaveIndicator('saved');
    } catch (err) {
      console.error('Failed to save workout', err);
      setSaveIndicator('error');
      showToast('Could not save your workout — check your device storage.', { type: 'error', duration: 5000 });
    }
  }, 600);
}

async function ensureDraft() {
  if (STATE.draft && !STATE.draft.completed) return STATE.draft;

  const incomplete = STATE.sessions.find((s) => s.mesoId === STATE.meso.id && !s.completed);
  if (incomplete) { STATE.draft = incomplete; return incomplete; }

  const status = mesoStatus(STATE.meso, STATE.sessions);
  if (status.isComplete) return null;

  const day = STATE.meso.plan.days[status.dayIndex];
  const entries = day.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    muscleGroup: ex.muscleGroup,
    targetSets: ex.targetSets,
    sets: Array.from({ length: 2 }, () => ({ weight: '', reps: '', rir: '', tempo: '', notes: '', done: false, warmup: false })),
    feedback: null
  }));

  const session = {
    date: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    mesoId: STATE.meso.id,
    weekIndex: status.weekIndex,
    dayIndex: status.dayIndex,
    dayLabel: day.dayLabel,
    isDeload: status.isDeload,
    entries,
    muscleFeedback: {},
    completed: false
  };
  const id = await DB.addSession(session);
  session.id = id;
  STATE.sessions.push(session);
  STATE.draft = session;
  return session;
}

async function renderLog(container) {
  const status = mesoStatus(STATE.meso, STATE.sessions);
  if (status.isComplete) {
    container.innerHTML = appShell(
      `<div class="card"><h2>Mesocycle Complete</h2><p>Start a new mesocycle from the dashboard to keep logging.</p><a class="btn block" href="#/setup">Start New Mesocycle</a></div>`,
      'log', 'Log Workout', ''
    );
    return;
  }

  const draft = await ensureDraft();
  drawLog(container, draft, status);
}

function exerciseOptionsHtml(muscleGroup, selectedId) {
  return combinedExercisesForMuscle(muscleGroup).map((ex) =>
    `<option value="${ex.id}" ${ex.id === selectedId ? 'selected' : ''}>${escapeHtml(ex.name)} (${ex.equipment})</option>`
  ).join('');
}

// Which sets currently have their tempo/notes row expanded. Keyed by
// "entryIndex:setIndex". Reset per log session by wireLogEvents when a
// different draft id is drawn, so it doesn't leak across workouts.
let expandedNotes = new Set();
let expandedNotesDraftId = null;

// An exercise counts as "done" only once every set has been explicitly
// marked complete by the lifter (the checkmark button) -- never just because
// a field has a value in it. Autofill can prefill weight/reps for the next
// set, but it must never flip this on by itself.
function isEntryDone(entry) {
  return entry.sets.length > 0 && entry.sets.every((s) => !!s.done);
}

const PAIN_CHIPS = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'sharp', label: 'Sharp' }
];
const DIFFICULTY_CHIPS = [
  { value: 'light', label: 'Too Light' },
  { value: 'right', label: 'Just Right' },
  { value: 'hard', label: 'Too Hard' }
];
const VOLUME_CHIPS = [
  { value: 'little', label: 'Too Little' },
  { value: 'right', label: 'Just Right' },
  { value: 'much', label: 'Too Much' }
];

function chipRowHtml(role, entryIndex, groupName, chips, current, disabled) {
  return `<div class="chip-row" data-role="${role}-row" ${entryIndex !== null ? `data-entry="${entryIndex}"` : ''} data-group="${escapeHtml(groupName)}">` +
    chips.map((c) => `<button type="button" class="chip chip-${c.value} ${current === c.value ? 'active' : ''}" ${disabled ? 'disabled' : ''}
      data-role="${role}" data-value="${c.value}" ${entryIndex !== null ? `data-entry="${entryIndex}"` : ''} data-group="${escapeHtml(groupName)}">${c.label}</button>`).join('') +
    `</div>`;
}

const PAIN_CHIP_LABELS = Object.fromEntries(PAIN_CHIPS.map((c) => [c.value, c.label]));
const DIFFICULTY_CHIP_LABELS = Object.fromEntries(DIFFICULTY_CHIPS.map((c) => [c.value, c.label]));
const VOLUME_CHIP_LABELS = Object.fromEntries(VOLUME_CHIPS.map((c) => [c.value, c.label]));

// Compact, tappable summary of a completed check-in shown on the exercise
// card afterward -- empty until the popup has been answered at least once.
function feedbackSummaryHtml(entry, ei) {
  if (!entry.feedback || (!entry.feedback.pain && !entry.feedback.difficulty)) return '';
  const parts = [];
  if (entry.feedback.pain) parts.push(`Pain: ${PAIN_CHIP_LABELS[entry.feedback.pain]}`);
  if (entry.feedback.difficulty) parts.push(`Felt: ${DIFFICULTY_CHIP_LABELS[entry.feedback.difficulty]}`);
  return `<button type="button" class="feedback-summary" data-role="edit-checkin" data-entry="${ei}">${escapeHtml(parts.join(' · '))} <span class="edit-hint">Edit</span></button>`;
}

function closeAnyModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
}

// Wires a single chip-row's buttons for use INSIDE a modal: toggles the
// active class in place (the modal itself never re-renders while open) and
// hands the chosen value back to the caller to persist.
function wireModalChipRow(rowEl, onSelect) {
  if (!rowEl) return;
  rowEl.querySelectorAll('button.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      rowEl.querySelectorAll('button.chip').forEach((b) => b.classList.toggle('active', b === btn));
      onSelect(btn.dataset.value);
    });
  });
}

// Popup shown the instant the FINAL set of an exercise is marked complete
// (never before). Answers save live as chips are tapped; closing via Done,
// the X, or the backdrop is the only way out. onClose can chain straight
// into the muscle-group popup when this was also that muscle's last exercise.
function openExerciseCheckinModal(draft, ei, container, onClose) {
  closeAnyModal();
  const entry = draft.entries[ei];
  const ex = exerciseById(entry.exerciseId);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close" data-role="modal-close" aria-label="Close">&times;</button>
      <h2>${escapeHtml(ex ? ex.name : 'Exercise')} done</h2>
      <p class="muted small">How did that feel?</p>
      <div class="checkin-row">
        <span class="checkin-label">Pain?</span>
        ${chipRowHtml('pain-chip', ei, 'pain', PAIN_CHIPS, entry.feedback ? entry.feedback.pain : null, false)}
      </div>
      <div class="checkin-row">
        <span class="checkin-label">Felt?</span>
        ${chipRowHtml('diff-chip', ei, 'diff', DIFFICULTY_CHIPS, entry.feedback ? entry.feedback.difficulty : null, false)}
      </div>
      <button type="button" class="block" data-role="modal-done" style="margin-top:6px">Done</button>
    </div>`;
  document.body.appendChild(modal);

  wireModalChipRow(modal.querySelector('[data-role="pain-chip-row"]'), (value) => {
    entry.feedback = entry.feedback || { pain: null, difficulty: null };
    entry.feedback.pain = value;
    scheduleSave();
  });
  wireModalChipRow(modal.querySelector('[data-role="diff-chip-row"]'), (value) => {
    entry.feedback = entry.feedback || { pain: null, difficulty: null };
    entry.feedback.difficulty = value;
    scheduleSave();
  });

  const finish = () => {
    modal.remove();
    drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    if (onClose) onClose();
  };
  modal.querySelector('[data-role="modal-close"]').addEventListener('click', finish);
  modal.querySelector('[data-role="modal-done"]').addEventListener('click', finish);
  modal.addEventListener('click', (e) => { if (e.target === modal) finish(); });
}

// Popup shown the instant the LAST exercise for a muscle group is marked
// complete. Also reachable afterward from the Muscle Group Check-In summary
// row to review or change the answer.
function openMuscleCheckinModal(draft, muscleGroup, container, onClose) {
  closeAnyModal();
  const current = draft.muscleFeedback ? draft.muscleFeedback[muscleGroup] : null;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close" data-role="modal-close" aria-label="Close">&times;</button>
      <h2>${escapeHtml(VOLUME_LANDMARKS[muscleGroup].label)} volume</h2>
      <p class="muted small">How did overall volume feel today?</p>
      ${chipRowHtml('muscle-chip', null, muscleGroup, VOLUME_CHIPS, current, false)}
      <button type="button" class="block" data-role="modal-done" style="margin-top:14px">Done</button>
    </div>`;
  document.body.appendChild(modal);

  wireModalChipRow(modal.querySelector('[data-role="muscle-chip-row"]'), (value) => {
    draft.muscleFeedback = draft.muscleFeedback || {};
    draft.muscleFeedback[muscleGroup] = value;
    scheduleSave();
  });

  const finish = () => {
    modal.remove();
    drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    if (onClose) onClose();
  };
  modal.querySelector('[data-role="modal-close"]').addEventListener('click', finish);
  modal.querySelector('[data-role="modal-done"]').addEventListener('click', finish);
  modal.addEventListener('click', (e) => { if (e.target === modal) finish(); });
}

function drawLog(container, draft, status) {
  if (expandedNotesDraftId !== draft.id) { expandedNotes = new Set(); expandedNotesDraftId = draft.id; }
  const priorSessions = STATE.sessions.filter((s) => s.completed && s.id !== draft.id);
  const opts = { targetRIR: STATE.settings.targetRIR, repRange: { min: STATE.settings.repRangeMin, max: STATE.settings.repRangeMax }, units: STATE.settings.units };

  const doneCount = draft.entries.filter(isEntryDone).length;

  const exerciseBlocks = draft.entries.map((entry, ei) => {
    const ex = exerciseById(entry.exerciseId);
    const suggestion = getProgressionSuggestion(entry.exerciseId, priorSessions, opts);
    const entryDone = isEntryDone(entry);
    const signalClass = suggestion.signal === 'up' ? 'status-mav' : suggestion.signal === 'down' ? 'status-serious' : 'status-warning';
    const signalIcon = suggestion.signal === 'up' ? '&#9650;' : suggestion.signal === 'down' ? '&#9660;' : '&#9679;';

    const setsRows = entry.sets.map((set, si) => {
      const hasReps = set.reps !== '' && set.reps !== null && set.reps !== undefined;
      const key = `${ei}:${si}`;
      const expanded = expandedNotes.has(key);
      const hasExtra = (set.tempo && set.tempo !== '') || (set.notes && set.notes !== '') || set.warmup;
      return `
      <div class="set-row ${set.warmup ? 'is-warmup' : ''}">
        <div class="set-num">${set.warmup ? 'W' : si + 1}</div>
        <div class="set-field">
          <span class="field-label">${escapeHtml(STATE.settings.units)}</span>
          <input class="cell-input" inputmode="decimal" placeholder="&mdash;" data-entry="${ei}" data-set="${si}" data-field="weight" value="${escapeHtml(set.weight)}">
        </div>
        <div class="set-field">
          <span class="field-label">Reps</span>
          <input class="cell-input" inputmode="numeric" placeholder="&mdash;" data-entry="${ei}" data-set="${si}" data-field="reps" value="${escapeHtml(set.reps)}">
        </div>
        <div class="set-field">
          <span class="field-label">RIR</span>
          <input class="cell-input" inputmode="numeric" placeholder="&mdash;" data-entry="${ei}" data-set="${si}" data-field="rir" value="${escapeHtml(set.rir)}">
        </div>
        <button type="button" class="set-check ${set.done ? 'done' : ''}" data-role="toggle-set-done" data-entry="${ei}" data-set="${si}" ${!hasReps ? 'disabled' : ''} aria-label="${set.done ? 'Mark set incomplete' : 'Mark set complete'}">&#10003;</button>
        <button type="button" class="set-more-btn ${hasExtra ? 'has-content' : ''}" data-role="toggle-notes" data-entry="${ei}" data-set="${si}" aria-label="Tempo, notes, and warm-up">&#8942;</button>
        <div class="set-row-actions"><button type="button" class="ghost small" data-role="remove-set" data-entry="${ei}" data-set="${si}">&times;</button></div>
      </div>
      ${expanded ? `<div class="set-extra-row">
        <input class="cell-input secondary-input" placeholder="tempo" data-entry="${ei}" data-set="${si}" data-field="tempo" value="${escapeHtml(set.tempo)}">
        <input class="cell-input secondary-input" placeholder="notes" data-entry="${ei}" data-set="${si}" data-field="notes" value="${escapeHtml(set.notes)}">
      </div>
      <label class="warmup-toggle">
        <input type="checkbox" data-role="set-warmup" data-entry="${ei}" data-set="${si}" ${set.warmup ? 'checked' : ''}>
        Warm-up set (excluded from volume &amp; progression)
      </label>` : ''}`;
    }).join('');

    const feedbackHtml = feedbackSummaryHtml(entry, ei);

    return `
      <div class="ex-card ${entryDone ? 'ex-done' : ''}">
        <div class="ex-head">
          <div class="row between">
            <span class="name">${entryDone ? '<span class="ex-done-check">&#10003;</span> ' : ''}${escapeHtml(ex ? ex.name : 'Unknown exercise')}</span>
            <div class="reorder-btns">
              <button type="button" class="ghost small" data-role="move-exercise" data-entry="${ei}" data-dir="-1" ${ei === 0 ? 'disabled' : ''} aria-label="Move up">&#9650;</button>
              <button type="button" class="ghost small" data-role="move-exercise" data-entry="${ei}" data-dir="1" ${ei === draft.entries.length - 1 ? 'disabled' : ''} aria-label="Move down">&#9660;</button>
              <button type="button" class="ghost small" data-role="remove-exercise" data-entry="${ei}">Remove</button>
            </div>
          </div>
          <select data-role="swap-exercise" data-entry="${ei}">${exerciseOptionsHtml(entry.muscleGroup, entry.exerciseId)}</select>
          <div class="ex-suggestion"><span class="signal-dot ${signalClass}">${signalIcon}</span> ${escapeHtml(suggestion.note || '')}</div>
        </div>
        ${setsRows}
        <div class="ex-footer">
          <button type="button" class="secondary small" data-role="add-set" data-entry="${ei}">+ Add Set</button>
          <button type="button" class="ex-timer-badge" data-role="ex-timer-badge" data-entry="${ei}" style="display:${(TIMER.running && TIMER.activeEntryIndex === ei) ? 'inline-flex' : 'none'}" aria-label="Rest timer, tap to cancel">
            <span class="ex-timer-icon">&#9201;</span><span class="ex-timer-time" data-role="ex-timer-time">${formatTime(TIMER.remaining)}</span>
          </button>
        </div>
        ${feedbackHtml}
      </div>
    `;
  }).join('');

  // Muscle-group check-in: one row per distinct muscle in this session, in
  // first-seen order. Locked until every exercise for that muscle is done;
  // once unlocked it's a button that opens the volume popup (it also opens
  // automatically the instant the last exercise for that muscle is marked
  // complete -- see the toggle-set-done handler in wireLogEvents).
  const muscleOrder = [];
  draft.entries.forEach((e) => { if (!muscleOrder.includes(e.muscleGroup)) muscleOrder.push(e.muscleGroup); });
  const muscleRows = muscleOrder.map((m) => {
    const entriesForMuscle = draft.entries.filter((e) => e.muscleGroup === m);
    const allDone = entriesForMuscle.every(isEntryDone);
    const current = draft.muscleFeedback ? draft.muscleFeedback[m] : null;
    const statusHtml = current
      ? `<span class="chip chip-${current} active small-tag">${VOLUME_CHIP_LABELS[current]}</span>`
      : `<span class="muted small">${allDone ? 'Tap to answer' : 'Finish all exercises first'}</span>`;
    return `<button type="button" class="muscle-checkin-row ${allDone ? 'clickable' : ''}" data-role="muscle-checkin-row" data-group="${m}" ${!allDone ? 'disabled' : ''}>
      <span class="muscle-checkin-label-text">${escapeHtml(VOLUME_LANDMARKS[m].label)}</span>
      ${statusHtml}
    </button>`;
  }).join('');

  const addExerciseOptions = MUSCLE_GROUP_ORDER.map((m) => `<option value="${m}">${VOLUME_LANDMARKS[m].label}</option>`).join('');
  const initialMuscle = MUSCLE_GROUP_ORDER[0];

  const body = `
    <div class="row between">
      <div>
        <strong>${escapeHtml(draft.dayLabel)}</strong>
        ${draft.isDeload ? '<span class="badge deload" style="margin-left:6px">deload</span>' : ''}
      </div>
      <span class="small muted">${new Date(draft.date).toLocaleDateString()} <span class="save-indicator" id="saveIndicatorEl" data-state="idle"></span></span>
    </div>

    <div class="log-progress">
      <div class="log-progress-track"><div class="log-progress-fill" style="width:${draft.entries.length ? Math.round((doneCount / draft.entries.length) * 100) : 0}%"></div></div>
      <span class="log-progress-label">${doneCount}/${draft.entries.length} exercises logged</span>
    </div>

    ${exerciseBlocks}

    <div class="card">
      <h2>Muscle Group Check-In</h2>
      <p class="small muted" style="margin-top:-6px">How did overall volume feel for each muscle today?</p>
      ${muscleRows}
    </div>

    <div class="card">
      <h2>Add Exercise</h2>
      <div class="field">
        <label>Muscle Group</label>
        <select id="addMuscleSelect">${addExerciseOptions}</select>
      </div>
      <div class="field">
        <label>Exercise</label>
        <select id="addExerciseSelect">${exerciseOptionsHtml(initialMuscle, null)}</select>
      </div>
      <button type="button" class="secondary block" data-role="add-exercise">+ Add to Workout</button>
    </div>

    <button class="block" data-role="finish-workout">Finish Workout</button>
    <button class="block secondary" style="margin-top:8px" data-role="discard-workout">Discard Workout</button>
  `;

  container.innerHTML = appShell(body, 'log', 'Log Workout', STATE.meso.plan.splitName);
  wireLogEvents(container, draft);
}

function wireLogEvents(container, draft) {
  // Autofill is a convenience prefill only -- weight and reps carry forward
  // into the next set so you're not retyping the same numbers, but it never
  // marks that next set complete. Completion is always a deliberate tap on
  // the checkmark button, gated on reps being logged first.
  const AUTOFILL_FIELDS = ['weight', 'reps'];
  container.querySelectorAll('input.cell-input').forEach((input) => {
    input.addEventListener('input', () => {
      const ei = parseInt(input.dataset.entry, 10);
      const si = parseInt(input.dataset.set, 10);
      const field = input.dataset.field;
      draft.entries[ei].sets[si][field] = input.value;
      scheduleSave();
      if (field === 'reps') {
        const row = input.closest('.set-row');
        const toggleBtn = row && row.querySelector('[data-role="toggle-set-done"]');
        if (toggleBtn) toggleBtn.disabled = (input.value === '' || input.value === null || input.value === undefined);
      }
    });

    // Carry the *final* value forward to the next set's same field once the
    // user is actually done editing this one (blur, tab-away, etc.) -- not on
    // every keystroke. Firing on every keystroke used to carry forward only
    // the first character typed (e.g. typing "50" left the next set with
    // "5", because after that first "5" copied over, the next-set field was
    // no longer empty, so later keystrokes stopped overwriting it). Only if
    // that next field is still untouched -- so editing set 2 after it was
    // auto-filled from set 1 will in turn carry forward into set 3, and so on.
    if (AUTOFILL_FIELDS.includes(input.dataset.field)) {
      input.addEventListener('change', () => {
        const ei = parseInt(input.dataset.entry, 10);
        const si = parseInt(input.dataset.set, 10);
        const field = input.dataset.field;
        if (input.value === '') return;
        const nextSet = draft.entries[ei].sets[si + 1];
        if (nextSet && (nextSet[field] === '' || nextSet[field] === null || nextSet[field] === undefined)) {
          nextSet[field] = input.value;
          const nextInput = container.querySelector(`input.cell-input[data-entry="${ei}"][data-set="${si + 1}"][data-field="${field}"]`);
          if (nextInput) {
            nextInput.value = input.value;
            if (field === 'reps') {
              const nextRow = nextInput.closest('.set-row');
              const nextToggleBtn = nextRow && nextRow.querySelector('[data-role="toggle-set-done"]');
              if (nextToggleBtn) nextToggleBtn.disabled = false;
            }
          }
          scheduleSave();
        }
      });
    }
  });

  container.querySelectorAll('[data-role="swap-exercise"]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const ei = parseInt(sel.dataset.entry, 10);
      draft.entries[ei].exerciseId = sel.value;
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  });

  container.querySelectorAll('[data-role="add-set"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.entry, 10);
      draft.entries[ei].sets.push({ weight: '', reps: '', rir: '', tempo: '', notes: '', done: false, warmup: false });
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  });

  container.querySelectorAll('[data-role="remove-set"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.entry, 10);
      const si = parseInt(btn.dataset.set, 10);
      if (draft.entries[ei].sets.length <= 1) return;
      draft.entries[ei].sets.splice(si, 1);
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  });

  container.querySelectorAll('[data-role="remove-exercise"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.entry, 10);
      draft.entries.splice(ei, 1);
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  });

  container.querySelectorAll('[data-role="move-exercise"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.entry, 10);
      const dir = parseInt(btn.dataset.dir, 10);
      const target = ei + dir;
      if (target < 0 || target >= draft.entries.length) return;
      const [moved] = draft.entries.splice(ei, 1);
      draft.entries.splice(target, 0, moved);
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  });

  container.querySelectorAll('[data-role="toggle-notes"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = `${btn.dataset.entry}:${btn.dataset.set}`;
      if (expandedNotes.has(key)) expandedNotes.delete(key); else expandedNotes.add(key);
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  });

  container.querySelectorAll('[data-role="set-warmup"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const ei = parseInt(cb.dataset.entry, 10);
      const si = parseInt(cb.dataset.set, 10);
      draft.entries[ei].sets[si].warmup = cb.checked;
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  });

  // Marking a set complete is the only thing that can trigger the check-in
  // popups -- never typing/autofill. If this was the exercise's last
  // remaining set, the pain/felt-like popup opens; if it was also the last
  // exercise for that muscle group, the volume popup follows right after.
  container.querySelectorAll('[data-role="toggle-set-done"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const ei = parseInt(btn.dataset.entry, 10);
      const si = parseInt(btn.dataset.set, 10);
      const entry = draft.entries[ei];
      const muscleGroup = entry.muscleGroup;
      const entriesForMuscle = draft.entries.filter((e) => e.muscleGroup === muscleGroup);
      const wasEntryDone = isEntryDone(entry);
      const wasMuscleDone = entriesForMuscle.every(isEntryDone);

      const justCompleted = !entry.sets[si].done;
      entry.sets[si].done = justCompleted;
      scheduleSave();

      // Celebrate a PR the instant it happens, not buried in a session-detail
      // screen the lifter may not open until days later -- the payoff should
      // land in the same moment as the effort. Warm-ups never qualify.
      if (justCompleted && !entry.sets[si].warmup) {
        const set = entry.sets[si];
        if (isPRSet(STATE.sessions, draft, entry.exerciseId, set.weight, set.reps)) {
          const ex = exerciseById(entry.exerciseId);
          showToast(`New PR on ${ex ? ex.name : 'that exercise'} \u{1F3C6}`, { type: 'success', duration: 3600 });
        }
      }

      const nowEntryDone = isEntryDone(entry);
      const nowMuscleDone = entriesForMuscle.every(isEntryDone);

      // Completing a set (not un-completing) always kicks off a fresh rest
      // timer -- no button to press. If one was already counting down from
      // the previous set, this restarts it at the full rest duration. It only
      // shows on the exercise you're actively working -- unless that set was
      // the exercise's last one, in which case you're moving on, so the timer
      // follows to the next exercise block instead (falling back to the same
      // card if this was the last exercise in the workout).
      if (justCompleted) {
        TIMER.activeEntryIndex = nowEntryDone
          ? (ei + 1 < draft.entries.length ? ei + 1 : ei)
          : ei;
        restartRestTimer();
      }

      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));

      if (!wasEntryDone && nowEntryDone) {
        openExerciseCheckinModal(draft, ei, container, () => {
          if (!wasMuscleDone && nowMuscleDone) {
            openMuscleCheckinModal(draft, muscleGroup, container);
          }
        });
      } else if (!wasMuscleDone && nowMuscleDone) {
        openMuscleCheckinModal(draft, muscleGroup, container);
      }
    });
  });

  container.querySelectorAll('[data-role="ex-timer-badge"]').forEach((btn) => {
    btn.addEventListener('click', () => cancelRestTimer());
  });

  container.querySelectorAll('[data-role="edit-checkin"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.entry, 10);
      openExerciseCheckinModal(draft, ei, container);
    });
  });

  container.querySelectorAll('[data-role="muscle-checkin-row"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      openMuscleCheckinModal(draft, btn.dataset.group, container);
    });
  });

  const addMuscleSelect = container.querySelector('#addMuscleSelect');
  const addExerciseSelect = container.querySelector('#addExerciseSelect');
  if (addMuscleSelect) {
    addMuscleSelect.addEventListener('change', () => {
      addExerciseSelect.innerHTML = exerciseOptionsHtml(addMuscleSelect.value, null);
    });
  }
  const addExerciseBtn = container.querySelector('[data-role="add-exercise"]');
  if (addExerciseBtn) {
    addExerciseBtn.addEventListener('click', () => {
      const muscleGroup = addMuscleSelect.value;
      const exerciseId = addExerciseSelect.value;
      if (!exerciseId) return;
      draft.entries.push({
        exerciseId, muscleGroup, targetSets: 2,
        sets: Array.from({ length: 2 }, () => ({ weight: '', reps: '', rir: '', tempo: '', notes: '', done: false, warmup: false })),
        feedback: null
      });
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  }

  const finishBtn = container.querySelector('[data-role="finish-workout"]');
  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      openConfirmModal('Finish and save this workout?', {
        confirmLabel: 'Finish',
        onConfirm: async () => {
          draft.completed = true;
          draft.completedAt = new Date().toISOString();
          try {
            await DB.updateSession(draft.id, draft);
            STATE.sessions = await DB.getAllSessions();
            STATE.draft = null;
            cancelRestTimer();
            goTo('dashboard');
            renderRoute();
          } catch (err) {
            draft.completed = false;
            draft.completedAt = null;
            console.error('Failed to finish workout', err);
            showToast('Could not save — your workout is still in progress. Try again.', { type: 'error', duration: 5000 });
          }
        }
      });
    });
  }

  const discardBtn = container.querySelector('[data-role="discard-workout"]');
  if (discardBtn) {
    discardBtn.addEventListener('click', () => {
      openConfirmModal('Discard this workout? This cannot be undone.', {
        danger: true,
        confirmLabel: 'Discard',
        onConfirm: async () => {
          try {
            await DB.deleteSession(draft.id);
            STATE.sessions = await DB.getAllSessions();
            STATE.draft = null;
            cancelRestTimer();
            goTo('dashboard');
            renderRoute();
          } catch (err) {
            console.error('Failed to discard workout', err);
            showToast('Could not discard that workout.', { type: 'error' });
          }
        }
      });
    });
  }

}

// ---------------------------------------------------------------------------
// Rest timer -- no buttons. Marking any set complete automatically (re)starts
// a countdown from restTimerSeconds (default 1:45); a badge showing the time
// left appears in the lower-right of every exercise card's footer, next to
// "+ Add Set", and a chime plays when it hits zero. Tapping the badge cancels it.
// ---------------------------------------------------------------------------
function formatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Only the badge on the active exercise card is ever shown -- every other
// card's badge (and there's one rendered in each, ready to go) stays hidden.
function updateTimerDisplays() {
  const time = formatTime(TIMER.remaining);
  document.querySelectorAll('[data-role="ex-timer-badge"]').forEach((el) => {
    const ei = parseInt(el.dataset.entry, 10);
    const show = TIMER.running && ei === TIMER.activeEntryIndex;
    el.style.display = show ? 'inline-flex' : 'none';
    if (show) {
      const timeEl = el.querySelector('[data-role="ex-timer-time"]');
      if (timeEl) timeEl.textContent = time;
    }
  });
}

// Lazily created, reused AudioContext for the completion chime. Created (or
// resumed) from restartRestTimer(), which only ever runs off a real tap on
// the set-complete checkmark -- that user gesture is what lets the browser's
// autoplay policy allow audio later when the interval callback fires on its own.
let audioCtx = null;
function ensureAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playChime() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [{ t: 0, f: 880 }, { t: 0.16, f: 1175 }].forEach(({ t, f }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, now + t);
    gain.gain.linearRampToValueAtTime(0.25, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.45);
  });
}

function restartRestTimer() {
  if (TIMER.intervalId) clearInterval(TIMER.intervalId);
  ensureAudioContext();
  TIMER.total = STATE.settings.restTimerSeconds || 105;
  TIMER.remaining = TIMER.total;
  TIMER.running = true;
  TIMER.intervalId = setInterval(() => {
    TIMER.remaining -= 1;
    if (TIMER.remaining <= 0) {
      clearInterval(TIMER.intervalId);
      TIMER.intervalId = null;
      TIMER.running = false;
      TIMER.remaining = TIMER.total;
      TIMER.activeEntryIndex = null;
      updateTimerDisplays();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      playChime();
      return;
    }
    updateTimerDisplays();
  }, 1000);
  updateTimerDisplays();
}

function cancelRestTimer() {
  if (TIMER.intervalId) clearInterval(TIMER.intervalId);
  TIMER.intervalId = null;
  TIMER.running = false;
  TIMER.remaining = TIMER.total;
  TIMER.activeEntryIndex = null;
  updateTimerDisplays();
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
function renderProgress(container) {
  drawProgress(container, null);
}

// One point per session that logged this exercise -- the day's best working
// set by estimated 1RM (Epley), so a heavier-lower-rep or lighter-higher-rep
// PR still reads as the day's true signal. Warm-up sets never count.
function buildExerciseTrendPoints(completedList, exerciseId) {
  const points = [];
  completedList.forEach((s) => {
    const entry = (s.entries || []).find((e) => e.exerciseId === exerciseId);
    if (!entry) return;
    let best = null;
    (entry.sets || []).forEach((set) => {
      if (set.warmup) return;
      const rm = estimated1RM(set.weight, set.reps);
      if (rm !== null && (!best || rm > best.e1rm)) {
        best = { e1rm: rm, weight: set.weight, reps: set.reps, rir: set.rir };
      }
    });
    if (best) points.push({ date: s.date, e1rm: best.e1rm, weight: best.weight, reps: best.reps, rir: best.rir });
  });
  return points.sort((a, b) => (a.date < b.date ? -1 : 1)); // oldest first, left-to-right
}

// Hand-rolled SVG line chart -- single series (one exercise at a time), so
// per the dataviz guidance a legend is skippable (the card title names the
// series) but a hover tooltip + a table-view fallback are not. Returns both
// the markup and the plotted pixel coordinates so the caller can wire hover.
function trendChartMarkup(points) {
  const W = 560, H = 200, padX = 16, padTop = 16, padBottom = 16;
  const values = points.map((p) => p.e1rm);
  const minV = Math.min(...values), maxV = Math.max(...values);
  const range = (maxV - minV) || Math.max(1, maxV * 0.1) || 1;
  const plotH = H - padTop - padBottom;
  const stepX = points.length > 1 ? (W - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: points.length > 1 ? padX + i * stepX : W / 2,
    y: padTop + plotH - ((p.e1rm - minV) / range) * plotH
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const dots = coords.map((c, i) =>
    `<circle class="trend-dot" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" data-index="${i}"></circle>`
  ).join('');
  const firstLabel = new Date(points[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const lastLabel = new Date(points[points.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const svg = `
    <div class="trend-chart-wrap">
      <div class="trend-chart-plot">
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="trend-chart-svg" data-role="trend-svg">
          <line x1="${padX}" y1="${padTop + plotH}" x2="${W - padX}" y2="${padTop + plotH}" class="trend-baseline"></line>
          <text x="${padX}" y="${padTop - 2}" class="trend-axis-label">${Math.round(maxV)}</text>
          <text x="${padX}" y="${padTop + plotH + 14}" class="trend-axis-label">${Math.round(minV)}</text>
          <path d="${path}" class="trend-line"></path>
          ${dots}
        </svg>
        <div class="trend-tooltip" data-role="trend-tooltip" style="display:none"></div>
      </div>
      <div class="trend-chart-xaxis"><span>${escapeHtml(firstLabel)}</span><span>${points.length > 1 ? escapeHtml(lastLabel) : ''}</span></div>
    </div>`;
  return { html: svg, coords, W, H };
}

function wireTrendChart(container, coords, points, W, H, units) {
  const svgEl = container.querySelector('[data-role="trend-svg"]');
  const tooltipEl = container.querySelector('[data-role="trend-tooltip"]');
  if (!svgEl || !tooltipEl) return;

  const showAt = (i) => {
    const c = coords[i], p = points[i];
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = ((c.x / W) * 100) + '%';
    tooltipEl.style.top = ((c.y / H) * 100) + '%';
    tooltipEl.innerHTML = `<strong>${escapeHtml(p.weight)}${escapeHtml(units)} &times; ${escapeHtml(p.reps)}${p.rir !== '' && p.rir !== null && p.rir !== undefined ? ` @ RIR ${escapeHtml(p.rir)}` : ''}</strong><br>${new Date(p.date).toLocaleDateString()} &middot; ~${Math.round(p.e1rm)}${escapeHtml(units)} e1RM`;
    svgEl.querySelectorAll('.trend-dot').forEach((d) => d.classList.toggle('active', parseInt(d.dataset.index, 10) === i));
  };
  const hide = () => {
    tooltipEl.style.display = 'none';
    svgEl.querySelectorAll('.trend-dot').forEach((d) => d.classList.remove('active'));
  };
  const nearestIndex = (clientX) => {
    const rect = svgEl.getBoundingClientRect();
    const relX = rect.width ? ((clientX - rect.left) / rect.width) * W : 0;
    let nearest = 0, best = Infinity;
    coords.forEach((c, i) => { const d = Math.abs(c.x - relX); if (d < best) { best = d; nearest = i; } });
    return nearest;
  };
  svgEl.addEventListener('pointermove', (e) => showAt(nearestIndex(e.clientX)));
  svgEl.addEventListener('pointerdown', (e) => showAt(nearestIndex(e.clientX)));
  svgEl.addEventListener('pointerleave', hide);
  svgEl.querySelectorAll('.trend-dot').forEach((dot) => {
    dot.addEventListener('pointerenter', () => showAt(parseInt(dot.dataset.index, 10)));
  });
  if (points.length) showAt(points.length - 1);
}

function drawProgress(container, selectedExerciseId) {
  const completed = completedSessions(STATE.sessions).sort((a, b) => (a.date < b.date ? 1 : -1));

  const historyRows = completed.slice(0, 25).map(sessionRowHtml).join('');

  const loggedExerciseIds = Array.from(new Set(
    completed.flatMap((s) => (s.entries || []).map((e) => e.exerciseId))
  ));
  const exerciseSelectOptions = ['<option value="">Select an exercise…</option>'].concat(
    loggedExerciseIds.map((id) => {
      const ex = exerciseById(id);
      return `<option value="${id}" ${id === selectedExerciseId ? 'selected' : ''}>${escapeHtml(ex ? ex.name : id)}</option>`;
    })
  ).join('');

  let chartHtml = '<p class="muted small">Pick an exercise to see your estimated 1RM trend over time.</p>';
  let chartData = null;
  let trendPoints = [];
  if (selectedExerciseId) {
    trendPoints = buildExerciseTrendPoints(completed, selectedExerciseId);
    if (trendPoints.length >= 2) {
      chartData = trendChartMarkup(trendPoints);
      chartHtml = `<p class="small muted" style="margin:0 0 8px">Estimated 1-rep max (Epley formula), most recent working set each session</p>${chartData.html}`;
    } else if (trendPoints.length === 1) {
      chartHtml = emptyState('Log this exercise once more to start seeing a trend.');
    } else {
      chartHtml = emptyState('No logged working sets yet for this exercise.');
    }
  }

  const tableRows = trendPoints.slice().reverse().slice(0, 12).map((p) => `<div class="list-row">
      <span class="secondary">${new Date(p.date).toLocaleDateString()}</span>
      <span class="trailing num">${escapeHtml(p.weight)}${escapeHtml(STATE.settings.units)} &times; ${escapeHtml(p.reps)}${p.rir !== '' && p.rir !== null && p.rir !== undefined ? ` @ RIR ${escapeHtml(p.rir)}` : ''}</span>
    </div>`).join('');

  const body = `
    <div class="card">
      <h2>Session History</h2>
      ${historyRows || emptyState('No completed workouts yet.')}
    </div>
    <div class="card">
      <h2>Exercise Trend</h2>
      <select id="progressExerciseSelect">${exerciseSelectOptions}</select>
      <div style="margin-top:10px">${chartHtml}</div>
      ${trendPoints.length ? `<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)"><p class="small muted" style="margin:0 0 4px">Logged sessions (table view)</p>${tableRows}</div>` : ''}
    </div>
  `;

  container.innerHTML = appShell(body, 'progress', 'Progress', `${completed.length} workouts logged`);
  const sel = container.querySelector('#progressExerciseSelect');
  sel.addEventListener('change', () => drawProgress(container, sel.value || null));
  if (chartData) wireTrendChart(container, chartData.coords, trendPoints, chartData.W, chartData.H, STATE.settings.units);
  wireSessionRows(container, 'progress');
}

// ---------------------------------------------------------------------------
// Session detail (drill into one logged or in-progress workout)
// ---------------------------------------------------------------------------
async function renderSessionDetail(container, idParam) {
  const id = parseInt(idParam, 10);
  let session = STATE.sessions.find((s) => s.id === id);
  if (!session) session = await DB.getSession(id);
  if (!session) {
    container.innerHTML = appShell(
      `<div class="card"><h2>Not Found</h2><p>That workout no longer exists.</p><a class="btn block" href="#/progress">Back to Progress</a></div>`,
      'progress', 'Workout', ''
    );
    return;
  }

  const sum = sessionSummary(session);
  const units = STATE.settings.units;

  const exerciseRows = (session.entries || []).map((entry) => {
    const ex = exerciseById(entry.exerciseId);
    const setRows = (entry.sets || []).map((set, si) => {
      const logged = set.reps !== '' && set.reps !== null && set.reps !== undefined;
      if (!logged) return '';
      const pr = !set.warmup && isPRSet(STATE.sessions, session, entry.exerciseId, set.weight, set.reps);
      return `<div class="detail-set-row">
        <span class="detail-set-num">${si + 1}</span>
        <span class="detail-set-vals">${escapeHtml(set.weight)}${escapeHtml(units)} &times; ${escapeHtml(set.reps)}${set.rir !== '' && set.rir !== null && set.rir !== undefined ? ` @ RIR ${escapeHtml(set.rir)}` : ''}</span>
        ${pr ? '<span class="pr-badge">PR</span>' : ''}
        ${set.warmup ? '<span class="tag">Warm-up</span>' : ''}
        ${set.tempo ? `<span class="tag">${escapeHtml(set.tempo)}</span>` : ''}
      </div>${set.notes ? `<div class="detail-set-note">${escapeHtml(set.notes)}</div>` : ''}`;
    }).join('');

    const fb = entry.feedback;
    const fbHtml = fb && (fb.pain || fb.difficulty) ? `<div class="detail-feedback">
      ${fb.pain ? `<span class="tag">Pain: ${escapeHtml(PAIN_LABELS[fb.pain] || fb.pain)}</span>` : ''}
      ${fb.difficulty ? `<span class="tag">Felt: ${escapeHtml(DIFFICULTY_LABELS[fb.difficulty] || fb.difficulty)}</span>` : ''}
    </div>` : '';

    return `<div class="detail-exercise">
      <div class="detail-exercise-name">${escapeHtml(ex ? ex.name : 'Unknown exercise')}</div>
      ${setRows || '<p class="small muted">No sets logged.</p>'}
      ${fbHtml}
    </div>`;
  }).join('');

  const muscleFeedbackHtml = session.muscleFeedback && Object.keys(session.muscleFeedback).length
    ? `<div class="card"><h2>Muscle Group Feedback</h2>${Object.keys(session.muscleFeedback).map((m) =>
        `<div class="list-row"><span class="primary">${escapeHtml(VOLUME_LANDMARKS[m] ? VOLUME_LANDMARKS[m].label : m)}</span><span class="tag">${escapeHtml(DIFFICULTY_LABELS[session.muscleFeedback[m]] || session.muscleFeedback[m])}</span></div>`
      ).join('')}</div>`
    : '';

  const body = `
    <a href="#/progress" class="small back-link">&larr; Back to Progress</a>
    <div class="card">
      <div class="row between">
        <h2 style="margin:0">${escapeHtml(session.dayLabel)}${session.isDeload ? ' <span class="badge deload">deload</span>' : ''}${!session.completed ? ' <span class="badge">in progress</span>' : ''}</h2>
      </div>
      <p class="small muted" style="margin:6px 0 0">${new Date(session.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      <div class="detail-stat-row">
        <div><div class="val">${sum.totalSets}</div><div class="lbl">Sets</div></div>
        <div><div class="val">${sum.totalVolume ? sum.totalVolume.toLocaleString() : 0}</div><div class="lbl">Volume (${escapeHtml(units)})</div></div>
        <div><div class="val">${sum.durationMin || '—'}</div><div class="lbl">Minutes</div></div>
      </div>
    </div>

    ${exerciseRows}
    ${muscleFeedbackHtml}

    <button type="button" class="block ghost" style="color:var(--critical);border-color:var(--critical)" data-role="delete-session-detail">Delete Workout</button>
  `;

  container.innerHTML = appShell(body, 'progress', 'Workout Detail', sum.muscleLabels.join(' · '));
  const delBtn = container.querySelector('[data-role="delete-session-detail"]');
  if (delBtn) delBtn.addEventListener('click', () => deleteSessionFlow(session.id, 'progress'));
}

// Minimal static sparkline (no hover interaction, unlike the exercise trend
// chart) -- body weight is a lighter-weight, glance-only metric.
function bodyweightSparklineHtml(points, units) {
  if (points.length < 2) return '<p class="bw-sparkline-empty">Log your weight at least twice to see a trend.</p>';
  const W = 560, H = 90, padX = 12, padY = 14;
  const values = points.map((p) => p.weight);
  const minV = Math.min(...values), maxV = Math.max(...values);
  const range = (maxV - minV) || Math.max(1, maxV * 0.05) || 1;
  const plotH = H - padY * 2;
  const stepX = (W - padX * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: padY + plotH - ((p.weight - minV) / range) * plotH
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const dots = coords.map((c) => `<circle class="trend-dot" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3"></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="trend-chart-svg bw-sparkline">
    <text x="${padX}" y="${padY - 3}" class="trend-axis-label">${maxV}${escapeHtml(units)}</text>
    <text x="${padX}" y="${padY + plotH + 12}" class="trend-axis-label">${minV}${escapeHtml(units)}</text>
    <path d="${path}" class="trend-line"></path>
    ${dots}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function renderSettings(container) {
  const s = STATE.settings;
  const currentTheme = s.theme || 'dark';
  const bwLog = (s.bodyweightLog || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const bwRecentRows = bwLog.slice().reverse().slice(0, 5).map((e) => `<div class="list-row">
      <span class="secondary">${new Date(e.date + 'T00:00:00').toLocaleDateString()}</span>
      <div class="row" style="gap:8px">
        <span class="trailing num">${e.weight}${escapeHtml(s.units)}</span>
        <button type="button" class="ghost small" data-role="delete-bw-entry" data-date="${escapeHtml(e.date)}">&times;</button>
      </div>
    </div>`).join('');
  const todayIso = new Date().toISOString().slice(0, 10);
  const syncEmail = (window.Sync && Sync.client && Sync._userId) ? (STATE.authEmail || 'Signed in') : null;
  const accountCard = (window.Sync && Sync.enabled) ? `
    <div class="card">
      <h2>Account</h2>
      ${syncEmail ? `
        <p class="small" style="margin-top:-4px">Signed in as <strong>${escapeHtml(syncEmail)}</strong>. Your workouts sync automatically.</p>
        <button type="button" class="secondary block" data-role="sign-out">Sign Out</button>
      ` : `
        <p class="small muted" style="margin-top:-4px">You're using this device offline-only. Sign in to sync your workouts across devices.</p>
        <button type="button" class="block" data-role="go-sign-in">Sign In / Create Account</button>
      `}
    </div>` : '';
  const body = `
    ${accountCard}
    <div class="card">
      <h2>Appearance</h2>
      <div class="theme-toggle" id="themeToggle" role="group" aria-label="Theme">
        <button type="button" class="theme-toggle-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme-value="dark">Dark</button>
        <button type="button" class="theme-toggle-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme-value="light">Light</button>
        <button type="button" class="theme-toggle-btn ${currentTheme === 'system' ? 'active' : ''}" data-theme-value="system">System</button>
      </div>
    </div>

    <div class="card">
      <h2>Plan</h2>
      <p class="small">${escapeHtml(STATE.meso.plan.splitName)} &middot; ${STATE.meso.daysPerWeek} days/week &middot; ${STATE.meso.trainingWeeks}+1 week meso</p>
      <a class="btn secondary block" href="#/setup">Change Plan / Start New Mesocycle</a>
    </div>

    <div class="card">
      <h2>Training Goal</h2>
      <div class="row" id="goalToggle">
        <button type="button" class="goal-btn ${(s.goal || 'hypertrophy') === 'hypertrophy' ? '' : 'secondary'}" data-goal-value="hypertrophy">Growth</button>
        <button type="button" class="goal-btn ${s.goal === 'strength' ? '' : 'secondary'}" data-goal-value="strength">Strength</button>
      </div>
      <p class="small muted" style="margin-top:8px">Changing this updates your target RIR and rep range below to that goal's defaults.</p>
    </div>

    <div class="card">
      <h2>Your Exercises</h2>
      <p class="small muted">Custom exercises show up alongside the built-in database anywhere you pick or swap an exercise.</p>
      ${(STATE.customExercises && STATE.customExercises.length) ? STATE.customExercises.map((e) => `<div class="list-row">
        <div>
          <div class="primary">${escapeHtml(e.name)}</div>
          <div class="secondary">
            <span class="tag">${escapeHtml(VOLUME_LANDMARKS[e.muscleGroup].label)}</span>
            <span class="tag">${escapeHtml(e.equipment)}</span>
            <span class="tag">${e.compound ? 'Compound' : 'Isolation'}</span>
          </div>
        </div>
        <button type="button" class="ghost small" data-role="delete-custom-exercise" data-id="${e.id}">Delete</button>
      </div>`).join('') : emptyState('No custom exercises yet.')}
      <div class="field" style="margin-top:12px">
        <label>Name</label>
        <input type="text" id="newExName" placeholder="e.g. Cable Chest Press">
      </div>
      <div class="row">
        <div class="field" style="flex:1">
          <label>Muscle Group</label>
          <select id="newExMuscle">${MUSCLE_GROUP_ORDER.map((m) => `<option value="${m}">${VOLUME_LANDMARKS[m].label}</option>`).join('')}</select>
        </div>
        <div class="field" style="flex:1">
          <label>Equipment</label>
          <select id="newExEquipment">${EQUIPMENT_TYPES.map((eq) => `<option value="${eq}">${eq[0].toUpperCase() + eq.slice(1)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field">
        <label><input type="checkbox" id="newExCompound" style="width:auto;margin-right:6px">Compound movement</label>
      </div>
      <button type="button" class="secondary block" id="addCustomExerciseBtn">+ Create Exercise</button>
    </div>

    <div class="card">
      <h2>Preferences</h2>
      <div class="field">
        <label>Units</label>
        <select id="setUnits">
          <option value="lbs" ${s.units === 'lbs' ? 'selected' : ''}>lbs</option>
          <option value="kg" ${s.units === 'kg' ? 'selected' : ''}>kg</option>
        </select>
      </div>
      <div class="field">
        <label>Target RIR (reps in reserve) for progression suggestions</label>
        <input type="number" id="setTargetRIR" min="0" max="5" value="${s.targetRIR}">
      </div>
      <div class="row">
        <div class="field" style="flex:1">
          <label>Rep range min</label>
          <input type="number" id="setRepMin" min="1" max="30" value="${s.repRangeMin}">
        </div>
        <div class="field" style="flex:1">
          <label>Rep range max</label>
          <input type="number" id="setRepMax" min="1" max="30" value="${s.repRangeMax}">
        </div>
      </div>
      <div class="field">
        <label>Default rest timer (seconds)</label>
        <input type="number" id="setRestTimer" min="15" max="600" step="15" value="${s.restTimerSeconds}">
      </div>
      <button class="block" id="saveSettingsBtn">Save Preferences</button>
    </div>

    <div class="card">
      <h2>Body Weight</h2>
      <div class="bodyweight-row">
        <div class="field"><label>Date</label><input type="date" id="bwDate" value="${todayIso}"></div>
        <div class="field"><label>Weight (${escapeHtml(s.units)})</label><input type="number" id="bwWeight" step="0.1" min="0" inputmode="decimal"></div>
      </div>
      <button type="button" class="secondary block" id="bwLogBtn">Log Weight</button>
      <div class="bw-sparkline">${bodyweightSparklineHtml(bwLog, s.units)}</div>
      ${bwRecentRows}
    </div>

    <div class="card">
      <h2>Backup</h2>
      <p class="small muted">Your data lives in this browser only. Export a backup occasionally in case Chrome ever clears its storage.</p>
      <button class="block secondary" id="exportBtn">Export Backup (.json)</button>
      <div style="margin-top:8px">
        <label>Import Backup</label>
        <input type="file" id="importFile" accept="application/json">
      </div>
    </div>

    <div class="card">
      <h2>Danger Zone</h2>
      <button class="block danger" id="resetBtn">Reset All Data</button>
    </div>
  `;

  container.innerHTML = appShell(body, 'settings', 'Settings', '');

  container.querySelectorAll('#themeToggle .theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.themeValue;
      container.querySelectorAll('#themeToggle .theme-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
      applyTheme(value);
      try {
        await DB.saveSettings({ theme: value });
        STATE.settings = await DB.getSettings();
      } catch (err) {
        console.error('Failed to save theme', err);
        showToast('Could not save theme preference.', { type: 'error' });
      }
    });
  });

  container.querySelectorAll('#goalToggle .goal-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const goal = btn.dataset.goalValue;
      const preset = GOAL_PRESETS[goal] || GOAL_PRESETS.hypertrophy;
      try {
        await DB.saveSettings({ goal, targetRIR: preset.targetRIR, repRangeMin: preset.repRangeMin, repRangeMax: preset.repRangeMax });
        STATE.settings = await DB.getSettings();
        renderSettings(container);
      } catch (err) {
        console.error('Failed to save goal', err);
        showToast('Could not save training goal.', { type: 'error' });
      }
    });
  });

  const addCustomExerciseBtn = container.querySelector('#addCustomExerciseBtn');
  if (addCustomExerciseBtn) {
    addCustomExerciseBtn.addEventListener('click', async () => {
      const nameInput = container.querySelector('#newExName');
      const name = nameInput.value.trim();
      if (!name) { openMessageModal('Give the exercise a name.'); return; }
      const muscleGroup = container.querySelector('#newExMuscle').value;
      const equipment = container.querySelector('#newExEquipment').value;
      const compound = container.querySelector('#newExCompound').checked;
      const id = 'custom-' + muscleGroup + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const exercise = { id, name, muscleGroup, equipment, compound };
      try {
        await DB.addCustomExercise(exercise);
        STATE.customExercises = await DB.getAllCustomExercises();
        renderSettings(container);
      } catch (err) {
        console.error('Failed to add exercise', err);
        showToast('Could not save that exercise.', { type: 'error' });
      }
    });
  }

  container.querySelectorAll('[data-role="delete-custom-exercise"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openConfirmModal('Delete this custom exercise? Past logged sets that used it are kept, but you will not be able to pick it again.', {
        danger: true,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          try {
            await DB.deleteCustomExercise(btn.dataset.id);
            STATE.customExercises = await DB.getAllCustomExercises();
            renderSettings(container);
          } catch (err) {
            console.error('Failed to delete exercise', err);
            showToast('Could not delete that exercise.', { type: 'error' });
          }
        }
      });
    });
  });

  container.querySelector('#saveSettingsBtn').addEventListener('click', async () => {
    const units = container.querySelector('#setUnits').value;
    const targetRIR = parseFloat(container.querySelector('#setTargetRIR').value) || DEFAULT_TARGET_RIR;
    const repRangeMin = parseInt(container.querySelector('#setRepMin').value, 10) || 8;
    const repRangeMax = parseInt(container.querySelector('#setRepMax').value, 10) || 12;
    const restTimerSeconds = parseInt(container.querySelector('#setRestTimer').value, 10) || 105;
    try {
      await DB.saveSettings({ units, targetRIR, repRangeMin, repRangeMax, restTimerSeconds });
      STATE.settings = await DB.getSettings();
      TIMER.remaining = STATE.settings.restTimerSeconds;
      TIMER.total = TIMER.remaining;
      showToast('Preferences saved.', { type: 'success' });
      renderSettings(container);
    } catch (err) {
      console.error('Failed to save preferences', err);
      showToast('Could not save preferences.', { type: 'error' });
    }
  });

  const signOutBtn = container.querySelector('[data-role="sign-out"]');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      openConfirmModal('Sign out of this device? Your workouts stay saved in the cloud and locally on this device.', {
        confirmLabel: 'Sign Out',
        onConfirm: async () => {
          try {
            await Sync.signOut();
            location.reload();
          } catch (err) {
            console.error('Sign out failed', err);
            showToast('Could not sign out — try again.', { type: 'error' });
          }
        }
      });
    });
  }
  const goSignInBtn = container.querySelector('[data-role="go-sign-in"]');
  if (goSignInBtn) {
    goSignInBtn.addEventListener('click', () => renderAuthGate());
  }

  const bwLogBtn = container.querySelector('#bwLogBtn');
  if (bwLogBtn) {
    bwLogBtn.addEventListener('click', async () => {
      const dateVal = container.querySelector('#bwDate').value;
      const weightVal = parseFloat(container.querySelector('#bwWeight').value);
      if (!dateVal || !isFinite(weightVal) || weightVal <= 0) { openMessageModal('Enter a valid date and weight.'); return; }
      const log = (STATE.settings.bodyweightLog || []).filter((e) => e.date !== dateVal);
      log.push({ date: dateVal, weight: weightVal });
      log.sort((a, b) => (a.date < b.date ? -1 : 1));
      try {
        await DB.saveSettings({ bodyweightLog: log });
        STATE.settings = await DB.getSettings();
        renderSettings(container);
      } catch (err) {
        console.error('Failed to log body weight', err);
        showToast('Could not save that entry.', { type: 'error' });
      }
    });
  }

  container.querySelectorAll('[data-role="delete-bw-entry"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openConfirmModal('Delete this weight entry?', {
        danger: true,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          const log = (STATE.settings.bodyweightLog || []).filter((e) => e.date !== btn.dataset.date);
          try {
            await DB.saveSettings({ bodyweightLog: log });
            STATE.settings = await DB.getSettings();
            renderSettings(container);
          } catch (err) {
            console.error('Failed to delete body weight entry', err);
            showToast('Could not delete that entry.', { type: 'error' });
          }
        }
      });
    });
  });

  container.querySelector('#exportBtn').addEventListener('click', async () => {
    try {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hypertrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await DB.saveSettings({ lastExportAt: new Date().toISOString() });
      STATE.settings = await DB.getSettings();
      showToast('Backup exported.', { type: 'success' });
    } catch (err) {
      console.error('Failed to export backup', err);
      showToast('Could not export a backup.', { type: 'error' });
    }
  });

  container.querySelector('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (err) {
      openMessageModal('Could not read that file: ' + err.message);
      return;
    }
    openConfirmModal('This will replace all current data with the backup file. Continue?', {
      danger: true,
      confirmLabel: 'Import',
      onConfirm: async () => {
        try {
          await DB.importAll(data);
          STATE.settings = await DB.getSettings();
          STATE.meso = await DB.getActiveMesocycle();
          STATE.sessions = await DB.getAllSessions();
          STATE.customExercises = await DB.getAllCustomExercises();
          STATE.draft = null;
          openMessageModal('Backup imported.', { onClose: () => { goTo('dashboard'); renderRoute(); } });
        } catch (err) {
          console.error('Failed to import backup', err);
          openMessageModal('Could not import that file: ' + err.message);
        }
      }
    });
  });

  container.querySelector('#resetBtn').addEventListener('click', () => {
    openConfirmModal('This deletes ALL workouts, mesocycles, and settings on this device. This cannot be undone. Continue?', {
      danger: true,
      confirmLabel: 'Continue',
      onConfirm: () => {
        openConfirmModal('Really sure? Consider exporting a backup first.', {
          danger: true,
          confirmLabel: 'Delete Everything',
          onConfirm: () => {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => location.reload();
            req.onblocked = () => location.reload();
            req.onerror = () => showToast('Could not reset data.', { type: 'error' });
          }
        });
      }
    });
  });
}
