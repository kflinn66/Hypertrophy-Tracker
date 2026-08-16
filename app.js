// Main app: routing, state, and all view rendering.
// Depends on globals from db.js, exercises.js, volume-landmarks.js, plans.js, progression.js.

const STATE = {
  settings: null,
  meso: null,
  sessions: [],
  draft: null,
  customExercises: []
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
  STATE.customExercises = await DB.getAllCustomExercises();
  TIMER.remaining = STATE.settings.restTimerSeconds || 120;
  TIMER.total = TIMER.remaining;
  applyTheme(STATE.settings.theme || 'dark');

  window.addEventListener('hashchange', () => renderRoute());
  renderRoute();
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
  const hash = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  switch (hash) {
    case 'dashboard': renderDashboard(container); break;
    case 'log': await renderLog(container); break;
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
      mode: STATE.meso && STATE.meso.splitKey === 'custom' ? 'custom' : 'preset',
      splitKey: STATE.meso && STATE.meso.splitKey !== 'custom' ? STATE.meso.splitKey : 'upperLower',
      days: STATE.meso && STATE.meso.splitKey !== 'custom' ? STATE.meso.daysPerWeek : 4,
      units: STATE.settings ? STATE.settings.units || 'lbs' : 'lbs',
      goal: STATE.settings ? STATE.settings.goal || 'hypertrophy' : 'hypertrophy',
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
    if (!draft.customDays || draft.customDays.length === 0) { alert('Add at least one training day.'); return; }
    for (const d of draft.customDays) {
      if (!d.exercises || d.exercises.length === 0) { alert(`Add at least one exercise to "${d.dayLabel}".`); return; }
    }
    try {
      plan = buildCustomPlan(draft.customDays.map((d) => ({ dayLabel: d.dayLabel || 'Day', exercises: d.exercises })));
    } catch (err) {
      alert(err.message);
      return;
    }
  } else {
    plan = buildPlan(draft.splitKey, draft.days);
  }

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
    targetRIR: goalPreset.targetRIR,
    repRangeMin: goalPreset.repRangeMin,
    repRangeMax: goalPreset.repRangeMax,
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
    const totalCompleted = STATE.sessions.filter((s) => s.completed).length;

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
      return `<div class="meter-row">
        <span class="name">${escapeHtml(lm.label)}</span>
        <div class="meter-track"><div class="meter-fill ${meta.fillClass}" style="width:${pct}%"></div></div>
        <span class="meter-status ${meta.textClass}">${meta.label}</span>
      </div>`;
    }).join('');

    const recent = STATE.sessions.filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
    const recentHtml = recent.length
      ? recent.map((s) => `<div class="list-row">
          <span class="primary">${escapeHtml(s.dayLabel)}${s.isDeload ? ' <span class="badge deload">deload</span>' : ''}</span>
          <span class="trailing">${new Date(s.date).toLocaleDateString()}</span>
        </div>`).join('')
      : `<p class="empty-state">No workouts logged yet.</p>`;

    body = `
      <div class="stat-row">
        <div class="stat-tile"><div class="val">${totalCompleted}</div><div class="lbl">Workouts</div></div>
        <div class="stat-tile"><div class="val">${weekLabel}</div><div class="lbl">${escapeHtml(plan.splitName)}</div></div>
        <div class="stat-tile"><div class="val ${overallOk ? 'status-mav' : 'status-high'}">${overallOk ? '✓' : '!'}</div><div class="lbl">${overallOk ? 'On Track' : 'Check Volume'}</div></div>
      </div>

      <div class="card">
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
  const entries = day.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    muscleGroup: ex.muscleGroup,
    targetSets: ex.targetSets,
    sets: Array.from({ length: 2 }, () => ({ weight: '', reps: '', rir: '', tempo: '', notes: '' }))
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
  return combinedExercisesForMuscle(muscleGroup).map((ex) =>
    `<option value="${ex.id}" ${ex.id === selectedId ? 'selected' : ''}>${escapeHtml(ex.name)} (${ex.equipment})</option>`
  ).join('');
}

function drawLog(container, draft, status) {
  const priorSessions = STATE.sessions.filter((s) => s.completed && s.id !== draft.id);
  const opts = { targetRIR: STATE.settings.targetRIR, repRange: { min: STATE.settings.repRangeMin, max: STATE.settings.repRangeMax }, units: STATE.settings.units };

  const exerciseBlocks = draft.entries.map((entry, ei) => {
    const ex = exerciseById(entry.exerciseId);
    const suggestion = getProgressionSuggestion(entry.exerciseId, priorSessions, opts);
    const setsRows = entry.sets.map((set, si) => {
      const done = set.reps !== '' && set.reps !== null && set.reps !== undefined;
      return `
      <div class="set-row">
        <div class="set-num">${si + 1}</div>
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
        <div class="set-check ${done ? 'done' : ''}">&#10003;</div>
        <div class="set-row-actions"><button type="button" class="ghost small" data-role="remove-set" data-entry="${ei}" data-set="${si}">&times;</button></div>
      </div>
      <div class="set-extra-row">
        <input class="cell-input secondary-input" placeholder="tempo" data-entry="${ei}" data-set="${si}" data-field="tempo" value="${escapeHtml(set.tempo)}">
        <input class="cell-input secondary-input" placeholder="notes" data-entry="${ei}" data-set="${si}" data-field="notes" value="${escapeHtml(set.notes)}">
      </div>`;
    }).join('');

    return `
      <div class="ex-card">
        <div class="ex-head">
          <div class="row between">
            <span class="name">${escapeHtml(ex ? ex.name : 'Unknown exercise')}</span>
            <button type="button" class="ghost small" data-role="remove-exercise" data-entry="${ei}">Remove</button>
          </div>
          <select data-role="swap-exercise" data-entry="${ei}">${exerciseOptionsHtml(entry.muscleGroup, entry.exerciseId)}</select>
          <div class="ex-suggestion">${escapeHtml(suggestion.note || '')}</div>
        </div>
        ${setsRows}
        <div style="padding:10px 14px 14px">
          <button type="button" class="secondary small" data-role="add-set" data-entry="${ei}">+ Add Set</button>
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

    <div class="rest-pill">
      <span>⏱ Rest &nbsp;<span class="time" id="timerDisplay">${formatTime(TIMER.remaining)}</span></span>
      <span class="row">
        <button type="button" data-role="timer-toggle">${TIMER.running ? 'Pause' : 'Start'}</button>
        <button type="button" data-role="timer-reset">Reset</button>
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
  const AUTOFILL_FIELDS = ['weight', 'reps', 'rir'];
  container.querySelectorAll('input.cell-input').forEach((input) => {
    input.addEventListener('input', () => {
      const ei = parseInt(input.dataset.entry, 10);
      const si = parseInt(input.dataset.set, 10);
      const field = input.dataset.field;
      draft.entries[ei].sets[si][field] = input.value;
      scheduleSave();
      if (field === 'reps') {
        const row = input.closest('.set-row');
        const check = row && row.querySelector('.set-check');
        if (check) check.classList.toggle('done', input.value !== '');
      }
      // Carry this value forward to the next set's same field, but only if that
      // next field is still untouched -- so editing set 2 after it was auto-filled
      // from set 1 will in turn carry forward into set 3, and so on.
      if (AUTOFILL_FIELDS.includes(field) && input.value !== '') {
        const nextSet = draft.entries[ei].sets[si + 1];
        if (nextSet && (nextSet[field] === '' || nextSet[field] === null || nextSet[field] === undefined)) {
          nextSet[field] = input.value;
          const nextInput = container.querySelector(`input.cell-input[data-entry="${ei}"][data-set="${si + 1}"][data-field="${field}"]`);
          if (nextInput) {
            nextInput.value = input.value;
            if (field === 'reps') {
              const nextRow = nextInput.closest('.set-row');
              const nextCheck = nextRow && nextRow.querySelector('.set-check');
              if (nextCheck) nextCheck.classList.toggle('done', input.value !== '');
            }
          }
          scheduleSave();
        }
      }
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
        exerciseId, muscleGroup, targetSets: 2,
        sets: Array.from({ length: 2 }, () => ({ weight: '', reps: '', rir: '', tempo: '', notes: '' }))
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
// Progress
// ---------------------------------------------------------------------------
function renderProgress(container) {
  drawProgress(container, null);
}

function drawProgress(container, selectedExerciseId) {
  const completed = STATE.sessions.filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1));

  const historyRows = completed.slice(0, 25).map((s) => {
    const setCount = (s.entries || []).reduce((sum, e) => sum + loggedSetCount(e.sets), 0);
    return `<div class="list-row">
      <div>
        <div class="primary">${escapeHtml(s.dayLabel)}${s.isDeload ? ' <span class="badge deload">deload</span>' : ''}</div>
        <div class="secondary">${new Date(s.date).toLocaleDateString()} &middot; ${(s.entries || []).length} exercises</div>
      </div>
      <span class="trailing num">${setCount} sets</span>
    </div>`;
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
    const rows = points.slice(0, 12).map((p) => `<div class="list-row">
      <span class="secondary">${new Date(p.date).toLocaleDateString()}</span>
      <span class="trailing num">${escapeHtml(p.weight)}${escapeHtml(STATE.settings.units)} &times; ${escapeHtml(p.reps)} @ RIR ${escapeHtml(p.rir)}</span>
    </div>`).join('');
    trendHtml = points.length
      ? rows
      : '<p class="empty-state">No logged sets yet for this exercise.</p>';
  }

  const body = `
    <div class="card">
      <h2>Session History</h2>
      ${historyRows || '<p class="empty-state">No completed workouts yet.</p>'}
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
  const currentTheme = s.theme || 'dark';
  const body = `
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
      </div>`).join('') : '<p class="empty-state">No custom exercises yet.</p>'}
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
      await DB.saveSettings({ theme: value });
      STATE.settings = await DB.getSettings();
    });
  });

  container.querySelectorAll('#goalToggle .goal-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const goal = btn.dataset.goalValue;
      const preset = GOAL_PRESETS[goal] || GOAL_PRESETS.hypertrophy;
      await DB.saveSettings({ goal, targetRIR: preset.targetRIR, repRangeMin: preset.repRangeMin, repRangeMax: preset.repRangeMax });
      STATE.settings = await DB.getSettings();
      renderSettings(container);
    });
  });

  const addCustomExerciseBtn = container.querySelector('#addCustomExerciseBtn');
  if (addCustomExerciseBtn) {
    addCustomExerciseBtn.addEventListener('click', async () => {
      const nameInput = container.querySelector('#newExName');
      const name = nameInput.value.trim();
      if (!name) { alert('Give the exercise a name.'); return; }
      const muscleGroup = container.querySelector('#newExMuscle').value;
      const equipment = container.querySelector('#newExEquipment').value;
      const compound = container.querySelector('#newExCompound').checked;
      const id = 'custom-' + muscleGroup + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const exercise = { id, name, muscleGroup, equipment, compound };
      await DB.addCustomExercise(exercise);
      STATE.customExercises = await DB.getAllCustomExercises();
      renderSettings(container);
    });
  }

  container.querySelectorAll('[data-role="delete-custom-exercise"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this custom exercise? Past logged sets that used it are kept, but you will not be able to pick it again.')) return;
      await DB.deleteCustomExercise(btn.dataset.id);
      STATE.customExercises = await DB.getAllCustomExercises();
      renderSettings(container);
    });
  });

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
      STATE.customExercises = await DB.getAllCustomExercises();
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
