// Main app: routing, state, and all view rendering.
// Depends on globals from db.js, exercises.js, volume-landmarks.js, plans.js, progression.js.

const STATE = {
  settings: null,
  meso: null,
  sessions: [],
  draft: null
};

const TIMER = { remaining: 120, running: false, intervalId: null, total: 120 };

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./service-worker.js'); } catch (e) { console.warn('SW registration failed', e); }
  }
  STATE.settings = await DB.getSettings();
  STATE.meso = await DB.getActiveMesocycle();
  STATE.sessions = await DB.getAllSessions();
  TIMER.remaining = STATE.settings.restTimerSeconds || 120;
  TIMER.total = TIMER.remaining;

  window.addEventListener('hashchange', () => renderRoute());
  renderRoute();
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
  const hash = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  switch (hash) {
    case 'dashboard': renderDashboard(container); break;
    case 'log': await renderLog(container); break;
    case 'library': renderLibrary(container); break;
    case 'progress': renderProgress(container); break;
    case 'settings': renderSettings(container); break;
    case 'setup': renderOnboarding(container, { isChange: true }); break;
    default: renderDashboard(container);
  }
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

function bottomNavHtml(active) {
  const items = [
    { route: 'dashboard', icon: '▦', label: 'Dashboard' },
    { route: 'log', icon: '✎', label: 'Log' },
    { route: 'library', icon: '≡', label: 'Library' },
    { route: 'progress', icon: '↗', label: 'Progress' },
    { route: 'settings', icon: '⚙', label: 'Settings' }
  ];
  return `<div class="bottomnav">${items.map((i) =>
    `<a href="#/${i.route}" class="${i.route === active ? 'active' : ''}"><span class="icon">${i.icon}</span>${i.label}</a>`
  ).join('')}</div>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function exerciseById(id) { return EXERCISES.find((e) => e.id === id); }

function volumeCellClass(status) {
  return { under: 'cell-under', mev: 'cell-mev', mav: 'cell-mav', high: 'cell-high', over: 'cell-over' }[status] || '';
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

function loggedSetCount(sets) {
  return (sets || []).filter((s) => s.reps !== '' && s.reps !== null && s.reps !== undefined && !isNaN(parseFloat(s.reps))).length;
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
      splitKey: STATE.meso ? STATE.meso.splitKey : 'upperLower',
      days: STATE.meso ? STATE.meso.daysPerWeek : 4,
      units: STATE.settings ? STATE.settings.units || 'lbs' : 'lbs',
      trainingWeeks: STATE.meso ? STATE.meso.trainingWeeks : 4
    };
  }
  drawOnboarding(container, opts || {});
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

  const body = `
    <div class="card">
      <h2>${opts.isChange ? 'Change Your Plan' : 'Welcome'}</h2>
      <p class="small muted">${opts.isChange ? 'This starts a fresh mesocycle. Your training history is kept.' : 'Pick a split style, how many days/week you can train, and we\'ll build your weekly volume targets automatically.'}</p>
    </div>
    <div class="card">
      <h2>1. Split Style</h2>
      <div class="choice-grid">${splitCards}</div>
    </div>
    <div class="card">
      <h2>2. Days Per Week</h2>
      <div class="row">${dayButtons}</div>
    </div>
    <div class="card">
      <h2>3. Units</h2>
      <div class="row">
        <button type="button" class="${onboardingDraft.units === 'lbs' ? '' : 'secondary'}" data-role="pick-units" data-units="lbs">lbs</button>
        <button type="button" class="${onboardingDraft.units === 'kg' ? '' : 'secondary'}" data-role="pick-units" data-units="kg">kg</button>
      </div>
    </div>
    <div class="card">
      <h2>4. Mesocycle Length</h2>
      <div class="field">
        <label>Training weeks before deload (a deload week is always added after)</label>
        <input type="number" min="3" max="8" id="trainingWeeksInput" value="${onboardingDraft.trainingWeeks}">
      </div>
    </div>
    <button class="block" data-role="confirm-onboarding">${opts.isChange ? 'Start New Mesocycle' : 'Create My Plan'}</button>
    ${opts.isChange ? `<button class="block secondary" style="margin-top:8px" data-role="cancel-onboarding">Cancel</button>` : ''}
  `;

  container.innerHTML = `<div class="appbar"><div><h1>${opts.isChange ? 'Change Plan' : 'Hypertrophy Tracker'}</h1></div></div><div class="view">${body}</div>${(STATE.settings && STATE.settings.onboarded) ? bottomNavHtml('') : ''}`;

  container.querySelectorAll('[data-role="pick-split"]').forEach((el) => {
    el.addEventListener('click', () => { onboardingDraft.splitKey = el.dataset.key; drawOnboarding(container, opts); });
  });
  container.querySelectorAll('[data-role="pick-days"]').forEach((el) => {
    el.addEventListener('click', () => { onboardingDraft.days = parseInt(el.dataset.days, 10); drawOnboarding(container, opts); });
  });
  container.querySelectorAll('[data-role="pick-units"]').forEach((el) => {
    el.addEventListener('click', () => { onboardingDraft.units = el.dataset.units; drawOnboarding(container, opts); });
  });
  const twInput = container.querySelector('#trainingWeeksInput');
  if (twInput) twInput.addEventListener('input', () => { onboardingDraft.trainingWeeks = parseInt(twInput.value, 10) || 4; });

  const confirmBtn = container.querySelector('[data-role="confirm-onboarding"]');
  if (confirmBtn) confirmBtn.addEventListener('click', () => completeOnboarding());

  const cancelBtn = container.querySelector('[data-role="cancel-onboarding"]');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { onboardingDraft = null; goTo('settings'); });
}

async function completeOnboarding() {
  const draft = onboardingDraft;
  const plan = buildPlan(draft.splitKey, draft.days);

  if (STATE.meso) {
    await DB.updateMesocycle(STATE.meso.id, { active: false });
  }

  const newMeso = {
    splitKey: draft.splitKey,
    daysPerWeek: draft.days,
    trainingWeeks: Math.max(1, draft.trainingWeeks || 4),
    startDate: new Date().toISOString(),
    plan,
    active: true,
    createdAt: new Date().toISOString()
  };
  const id = await DB.addMesocycle(newMeso);
  newMeso.id = id;
  STATE.meso = newMeso;

  await DB.saveSettings({
    onboarded: true,
    units: draft.units,
    targetRIR: (STATE.settings && STATE.settings.targetRIR) || DEFAULT_TARGET_RIR,
    repRangeMin: (STATE.settings && STATE.settings.repRangeMin) || DEFAULT_REP_RANGE.min,
    repRangeMax: (STATE.settings && STATE.settings.repRangeMax) || DEFAULT_REP_RANGE.max,
    restTimerSeconds: (STATE.settings && STATE.settings.restTimerSeconds) || 120
  });
  STATE.settings = await DB.getSettings();
  STATE.sessions = await DB.getAllSessions();
  STATE.draft = null;
  onboardingDraft = null;
  goTo('dashboard');
  renderRoute();
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
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
    const weekLabel = status.isDeload ? 'Deload Week' : `Week ${status.weekIndex + 1} of ${STATE.meso.trainingWeeks}`;
    const todayDay = plan.days[status.dayIndex];
    const volumeTotals = computeWeeklyVolume(STATE.meso, status.currentWeekSessions, STATE.draft);

    const rows = MUSCLE_GROUP_ORDER.filter((m) => plan.weeklyTargets[m] !== undefined).map((m) => {
      const lm = VOLUME_LANDMARKS[m];
      const logged = volumeTotals[m] || 0;
      const target = plan.weeklyTargets[m] || 0;
      const cls = volumeCellClass(classifyVolume(m, logged));
      return `<tr>
        <td>${escapeHtml(lm.label)}</td>
        <td class="num ${cls}">${logged}</td>
        <td class="num muted">${target}</td>
        <td class="num muted small">${lm.mev}/${lm.mavLow}-${lm.mavHigh}/${lm.mrv}</td>
      </tr>`;
    }).join('');

    const recent = STATE.sessions.filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
    const recentHtml = recent.length
      ? recent.map((s) => `<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--border)">
          <span>${escapeHtml(s.dayLabel)}${s.isDeload ? ' <span class="badge deload">deload</span>' : ''}</span>
          <span class="muted">${new Date(s.date).toLocaleDateString()}</span>
        </div>`).join('')
      : `<p class="muted small">No workouts logged yet.</p>`;

    body = `
      <div class="card">
        <div class="row between">
          <div>
            <h2 style="margin-bottom:2px">${escapeHtml(plan.splitName)}</h2>
            <div class="small muted">${STATE.meso.daysPerWeek} days/week</div>
          </div>
          <span class="badge ${status.isDeload ? 'deload' : ''}">${weekLabel}</span>
        </div>
      </div>

      <div class="card">
        <h2>Today</h2>
        <p style="margin:0 0 8px"><strong>${escapeHtml(todayDay.dayLabel)}</strong> &mdash; ${todayDay.muscles.map((m) => VOLUME_LANDMARKS[m].label).join(', ')}</p>
        <button class="block" data-role="go-log">${STATE.draft && !STATE.draft.completed ? 'Resume Workout' : 'Start Workout'}</button>
      </div>

      <div class="card">
        <h2>This Week's Volume</h2>
        <table class="grid">
          <thead><tr><th>Muscle</th><th class="num">Sets</th><th class="num">Target</th><th class="num">MEV/MAV/MRV</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="legend">
          <div><span class="swatch" style="background:var(--under-bg)"></span>Under MEV</div>
          <div><span class="swatch" style="background:var(--mev-bg)"></span>At MEV</div>
          <div><span class="swatch" style="background:var(--mav-bg)"></span>MAV range</div>
          <div><span class="swatch" style="background:var(--high-bg)"></span>Above MAV</div>
          <div><span class="swatch" style="background:var(--over-bg)"></span>Over MRV</div>
        </div>
        ${status.isDeload ? '<p class="small muted" style="margin-top:8px">Deload week: lower numbers here are expected &mdash; targets are intentionally reduced.</p>' : ''}
      </div>

      <div class="card">
        <h2>Recent Sessions</h2>
        ${recentHtml}
      </div>
    `;
  }

  container.innerHTML = appShell(body, 'dashboard', 'Hypertrophy Tracker', STATE.meso.plan.splitName);
  const goLogBtn = container.querySelector('[data-role="go-log"]');
  if (goLogBtn) goLogBtn.addEventListener('click', () => goTo('log'));
}

// ---------------------------------------------------------------------------
// Log workout (the Excel-style grid)
// ---------------------------------------------------------------------------
let saveTimeout = null;
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (STATE.draft) await DB.updateSession(STATE.draft.id, STATE.draft);
  }, 600);
}

async function ensureDraft() {
  if (STATE.draft && !STATE.draft.completed) return STATE.draft;

  const incomplete = STATE.sessions.find((s) => s.mesoId === STATE.meso.id && !s.completed);
  if (incomplete) { STATE.draft = incomplete; return incomplete; }

  const status = mesoStatus(STATE.meso, STATE.sessions);
  if (status.isComplete) return null;

  const day = STATE.meso.plan.days[status.dayIndex];
  const deloadMultiplier = status.isDeload ? 0.5 : 1;
  const entries = day.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    muscleGroup: ex.muscleGroup,
    targetSets: ex.targetSets,
    sets: Array.from({ length: Math.max(1, Math.round(ex.targetSets * deloadMultiplier)) }, () => ({ weight: '', reps: '', rir: '', tempo: '', notes: '' }))
  }));

  const session = {
    date: new Date().toISOString(),
    mesoId: STATE.meso.id,
    weekIndex: status.weekIndex,
    dayIndex: status.dayIndex,
    dayLabel: day.dayLabel,
    isDeload: status.isDeload,
    entries,
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
  return exercisesForMuscle(muscleGroup).map((ex) =>
    `<option value="${ex.id}" ${ex.id === selectedId ? 'selected' : ''}>${escapeHtml(ex.name)} (${ex.equipment})</option>`
  ).join('');
}

function drawLog(container, draft, status) {
  const priorSessions = STATE.sessions.filter((s) => s.completed && s.id !== draft.id);
  const opts = { targetRIR: STATE.settings.targetRIR, repRange: { min: STATE.settings.repRangeMin, max: STATE.settings.repRangeMax }, units: STATE.settings.units };

  const exerciseBlocks = draft.entries.map((entry, ei) => {
    const ex = exerciseById(entry.exerciseId);
    const suggestion = getProgressionSuggestion(entry.exerciseId, priorSessions, opts);
    const setsRows = entry.sets.map((set, si) => `
      <tr>
        <td class="num muted">${si + 1}</td>
        <td><input class="cell-input" inputmode="decimal" placeholder="${STATE.settings.units}" data-entry="${ei}" data-set="${si}" data-field="weight" value="${escapeHtml(set.weight)}"></td>
        <td><input class="cell-input" inputmode="numeric" placeholder="reps" data-entry="${ei}" data-set="${si}" data-field="reps" value="${escapeHtml(set.reps)}"></td>
        <td><input class="cell-input" inputmode="numeric" placeholder="RIR" data-entry="${ei}" data-set="${si}" data-field="rir" value="${escapeHtml(set.rir)}"></td>
        <td><input class="cell-input" placeholder="tempo" data-entry="${ei}" data-set="${si}" data-field="tempo" value="${escapeHtml(set.tempo)}"></td>
        <td><input class="cell-input" placeholder="notes" data-entry="${ei}" data-set="${si}" data-field="notes" value="${escapeHtml(set.notes)}"></td>
        <td class="set-row-actions"><button type="button" class="ghost small" data-role="remove-set" data-entry="${ei}" data-set="${si}">&times;</button></td>
      </tr>
    `).join('');

    return `
      <div class="exercise-block">
        <div class="ex-header">
          <div class="row between">
            <strong>${escapeHtml(ex ? ex.name : 'Unknown exercise')}</strong>
            <button type="button" class="ghost small" data-role="remove-exercise" data-entry="${ei}">Remove</button>
          </div>
          <select data-role="swap-exercise" data-entry="${ei}">${exerciseOptionsHtml(entry.muscleGroup, entry.exerciseId)}</select>
          <div class="ex-suggestion">${escapeHtml(suggestion.note || '')}</div>
        </div>
        <div class="ex-body">
          <table class="grid">
            <thead><tr><th>#</th><th>Wt</th><th>Reps</th><th>RIR</th><th>Tempo</th><th>Notes</th><th></th></tr></thead>
            <tbody>${setsRows}</tbody>
          </table>
          <button type="button" class="secondary small" style="margin-top:8px" data-role="add-set" data-entry="${ei}">+ Add Set</button>
        </div>
      </div>
    `;
  }).join('');

  const addExerciseOptions = MUSCLE_GROUP_ORDER.map((m) => `<option value="${m}">${VOLUME_LANDMARKS[m].label}</option>`).join('');
  const initialMuscle = MUSCLE_GROUP_ORDER[0];

  const body = `
    <div class="row between">
      <div>
        <strong>${escapeHtml(draft.dayLabel)}</strong>
        ${draft.isDeload ? '<span class="badge deload" style="margin-left:6px">deload</span>' : ''}
      </div>
      <span class="small muted">${new Date(draft.date).toLocaleDateString()}</span>
    </div>

    <div class="timer-widget">
      <span>Rest: <span class="time" id="timerDisplay">${formatTime(TIMER.remaining)}</span></span>
      <span class="row">
        <button type="button" class="secondary small" data-role="timer-toggle">${TIMER.running ? 'Pause' : 'Start'}</button>
        <button type="button" class="ghost small" data-role="timer-reset">Reset</button>
      </span>
    </div>

    ${exerciseBlocks}

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
  container.querySelectorAll('input.cell-input').forEach((input) => {
    input.addEventListener('input', () => {
      const ei = parseInt(input.dataset.entry, 10);
      const si = parseInt(input.dataset.set, 10);
      const field = input.dataset.field;
      draft.entries[ei].sets[si][field] = input.value;
      scheduleSave();
    });
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
      draft.entries[ei].sets.push({ weight: '', reps: '', rir: '', tempo: '', notes: '' });
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
        exerciseId, muscleGroup, targetSets: 3,
        sets: Array.from({ length: 3 }, () => ({ weight: '', reps: '', rir: '', tempo: '', notes: '' }))
      });
      scheduleSave();
      drawLog(container, draft, mesoStatus(STATE.meso, STATE.sessions));
    });
  }

  const finishBtn = container.querySelector('[data-role="finish-workout"]');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      if (!confirm('Finish and save this workout?')) return;
      draft.completed = true;
      await DB.updateSession(draft.id, draft);
      STATE.sessions = await DB.getAllSessions();
      STATE.draft = null;
      stopTimer();
      goTo('dashboard');
      renderRoute();
    });
  }

  const discardBtn = container.querySelector('[data-role="discard-workout"]');
  if (discardBtn) {
    discardBtn.addEventListener('click', async () => {
      if (!confirm('Discard this workout? This cannot be undone.')) return;
      await DB.deleteSession(draft.id);
      STATE.sessions = await DB.getAllSessions();
      STATE.draft = null;
      stopTimer();
      goTo('dashboard');
      renderRoute();
    });
  }

  const timerToggle = container.querySelector('[data-role="timer-toggle"]');
  if (timerToggle) timerToggle.addEventListener('click', () => { toggleTimer(); timerToggle.textContent = TIMER.running ? 'Pause' : 'Start'; });
  const timerReset = container.querySelector('[data-role="timer-reset"]');
  if (timerReset) timerReset.addEventListener('click', () => { resetTimer(); if (timerToggle) timerToggle.textContent = 'Start'; });
}

// ---------------------------------------------------------------------------
// Rest timer
// ---------------------------------------------------------------------------
function formatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function toggleTimer() {
  if (TIMER.running) { pauseTimer(); } else { startTimer(); }
}

function startTimer() {
  if (TIMER.running) return;
  TIMER.running = true;
  TIMER.intervalId = setInterval(() => {
    TIMER.remaining -= 1;
    const display = document.getElementById('timerDisplay');
    if (display) display.textContent = formatTime(TIMER.remaining);
    if (TIMER.remaining <= 0) {
      stopTimer();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      const toggleBtn = document.querySelector('[data-role="timer-toggle"]');
      if (toggleBtn) toggleBtn.textContent = 'Start';
    }
  }, 1000);
}

function pauseTimer() {
  TIMER.running = false;
  if (TIMER.intervalId) clearInterval(TIMER.intervalId);
}

function stopTimer() {
  pauseTimer();
  TIMER.remaining = TIMER.total;
}

function resetTimer() {
  pauseTimer();
  TIMER.remaining = STATE.settings.restTimerSeconds || 120;
  TIMER.total = TIMER.remaining;
  const display = document.getElementById('timerDisplay');
  if (display) display.textContent = formatTime(TIMER.remaining);
}

// ---------------------------------------------------------------------------
// Exercise Library
// ---------------------------------------------------------------------------
function renderLibrary(container) {
  drawLibrary(container, { muscle: 'all', equipment: 'all', search: '' });
}

function drawLibrary(container, filters) {
  let list = EXERCISES.slice();
  if (filters.muscle !== 'all') list = list.filter((e) => e.muscleGroup === filters.muscle);
  if (filters.equipment !== 'all') list = list.filter((e) => e.equipment === filters.equipment);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((e) => e.name.toLowerCase().includes(q));
  }
  list.sort((a, b) => a.name.localeCompare(b.name));

  const muscleOptions = ['<option value="all">All Muscles</option>'].concat(
    MUSCLE_GROUP_ORDER.map((m) => `<option value="${m}" ${filters.muscle === m ? 'selected' : ''}>${VOLUME_LANDMARKS[m].label}</option>`)
  ).join('');
  const equipmentOptions = ['<option value="all">All Equipment</option>'].concat(
    EQUIPMENT_TYPES.map((eq) => `<option value="${eq}" ${filters.equipment === eq ? 'selected' : ''}>${eq[0].toUpperCase() + eq.slice(1)}</option>`)
  ).join('');

  const rows = list.map((e) => `<tr>
    <td>${escapeHtml(e.name)}</td>
    <td>${escapeHtml(VOLUME_LANDMARKS[e.muscleGroup].label)}</td>
    <td>${escapeHtml(e.equipment)}</td>
    <td>${e.compound ? 'Compound' : 'Isolation'}</td>
  </tr>`).join('');

  const body = `
    <div class="card">
      <div class="field"><input type="text" id="librarySearch" placeholder="Search exercises…" value="${escapeHtml(filters.search)}"></div>
      <div class="row">
        <select id="libraryMuscle" style="flex:1">${muscleOptions}</select>
        <select id="libraryEquipment" style="flex:1">${equipmentOptions}</select>
      </div>
    </div>
    <div class="card">
      <table class="grid">
        <thead><tr><th>Exercise</th><th>Muscle</th><th>Equipment</th><th>Type</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty-state">No exercises match.</td></tr>'}</tbody>
      </table>
      <p class="small muted" style="margin-top:8px">${list.length} exercises</p>
    </div>
  `;

  container.innerHTML = appShell(body, 'library', 'Exercise Library', `${EXERCISES.length} exercises total`);

  const searchInput = container.querySelector('#librarySearch');
  const muscleSelect = container.querySelector('#libraryMuscle');
  const equipmentSelect = container.querySelector('#libraryEquipment');
  const update = () => drawLibrary(container, { muscle: muscleSelect.value, equipment: equipmentSelect.value, search: searchInput.value });
  searchInput.addEventListener('input', update);
  muscleSelect.addEventListener('change', update);
  equipmentSelect.addEventListener('change', update);
  searchInput.focus();
  searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
function renderProgress(container) {
  drawProgress(container, null);
}

function drawProgress(container, selectedExerciseId) {
  const completed = STATE.sessions.filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1));

  const historyRows = completed.slice(0, 25).map((s) => {
    const setCount = (s.entries || []).reduce((sum, e) => sum + loggedSetCount(e.sets), 0);
    return `<tr>
      <td>${new Date(s.date).toLocaleDateString()}</td>
      <td>${escapeHtml(s.dayLabel)}${s.isDeload ? ' <span class="badge deload">deload</span>' : ''}</td>
      <td class="num">${(s.entries || []).length}</td>
      <td class="num">${setCount}</td>
    </tr>`;
  }).join('');

  const loggedExerciseIds = Array.from(new Set(
    completed.flatMap((s) => (s.entries || []).map((e) => e.exerciseId))
  ));
  const exerciseSelectOptions = ['<option value="">Select an exercise…</option>'].concat(
    loggedExerciseIds.map((id) => {
      const ex = exerciseById(id);
      return `<option value="${id}" ${id === selectedExerciseId ? 'selected' : ''}>${escapeHtml(ex ? ex.name : id)}</option>`;
    })
  ).join('');

  let trendHtml = '<p class="muted small">Pick an exercise to see your recent weight/reps/RIR history.</p>';
  if (selectedExerciseId) {
    const points = [];
    completed.forEach((s) => {
      const entry = (s.entries || []).find((e) => e.exerciseId === selectedExerciseId);
      if (!entry) return;
      const workingSets = (entry.sets || []).filter((set) => set.reps !== '' && set.reps !== null);
      if (workingSets.length === 0) return;
      const topSet = workingSets.reduce((best, cur) => (parseFloat(cur.weight) || 0) > (parseFloat(best.weight) || 0) ? cur : best, workingSets[0]);
      points.push({ date: s.date, weight: topSet.weight, reps: topSet.reps, rir: topSet.rir });
    });
    const rows = points.slice(0, 12).map((p) => `<tr>
      <td>${new Date(p.date).toLocaleDateString()}</td>
      <td class="num">${escapeHtml(p.weight)}</td>
      <td class="num">${escapeHtml(p.reps)}</td>
      <td class="num">${escapeHtml(p.rir)}</td>
    </tr>`).join('');
    trendHtml = points.length
      ? `<table class="grid"><thead><tr><th>Date</th><th class="num">Top Wt</th><th class="num">Reps</th><th class="num">RIR</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="muted small">No logged sets yet for this exercise.</p>';
  }

  const body = `
    <div class="card">
      <h2>Session History</h2>
      ${historyRows ? `<table class="grid"><thead><tr><th>Date</th><th>Day</th><th class="num">Exercises</th><th class="num">Sets</th></tr></thead><tbody>${historyRows}</tbody></table>` : '<p class="empty-state">No completed workouts yet.</p>'}
    </div>
    <div class="card">
      <h2>Exercise Trend</h2>
      <select id="progressExerciseSelect">${exerciseSelectOptions}</select>
      <div style="margin-top:8px">${trendHtml}</div>
    </div>
  `;

  container.innerHTML = appShell(body, 'progress', 'Progress', `${completed.length} workouts logged`);
  const sel = container.querySelector('#progressExerciseSelect');
  sel.addEventListener('change', () => drawProgress(container, sel.value || null));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function renderSettings(container) {
  const s = STATE.settings;
  const body = `
    <div class="card">
      <h2>Plan</h2>
      <p class="small">${escapeHtml(STATE.meso.plan.splitName)} &middot; ${STATE.meso.daysPerWeek} days/week &middot; ${STATE.meso.trainingWeeks}+1 week meso</p>
      <a class="btn secondary block" href="#/setup">Change Plan / Start New Mesocycle</a>
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

  container.querySelector('#saveSettingsBtn').addEventListener('click', async () => {
    const units = container.querySelector('#setUnits').value;
    const targetRIR = parseFloat(container.querySelector('#setTargetRIR').value) || DEFAULT_TARGET_RIR;
    const repRangeMin = parseInt(container.querySelector('#setRepMin').value, 10) || 8;
    const repRangeMax = parseInt(container.querySelector('#setRepMax').value, 10) || 12;
    const restTimerSeconds = parseInt(container.querySelector('#setRestTimer').value, 10) || 120;
    await DB.saveSettings({ units, targetRIR, repRangeMin, repRangeMax, restTimerSeconds });
    STATE.settings = await DB.getSettings();
    TIMER.remaining = STATE.settings.restTimerSeconds;
    TIMER.total = TIMER.remaining;
    alert('Preferences saved.');
    renderSettings(container);
  });

  container.querySelector('#exportBtn').addEventListener('click', async () => {
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
  });

  container.querySelector('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('This will replace all current data with the backup file. Continue?')) return;
      await DB.importAll(data);
      STATE.settings = await DB.getSettings();
      STATE.meso = await DB.getActiveMesocycle();
      STATE.sessions = await DB.getAllSessions();
      STATE.draft = null;
      alert('Backup imported.');
      goTo('dashboard');
      renderRoute();
    } catch (err) {
      alert('Could not import that file: ' + err.message);
    }
  });

  container.querySelector('#resetBtn').addEventListener('click', async () => {
    if (!confirm('This deletes ALL workouts, mesocycles, and settings on this device. This cannot be undone. Continue?')) return;
    if (!confirm('Really sure? Consider exporting a backup first.')) return;
    indexedDB.deleteDatabase(DB_NAME);
    location.reload();
  });
}
