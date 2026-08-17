// Auto-progression suggestions: RIR-based double progression, RP-style.
// Looks at your most recent logged sets for an exercise and suggests what
// to do next session. This is a heuristic, not a physiologist -- treat
// suggestions as a starting point and adjust to how you actually feel.

const DEFAULT_TARGET_RIR = 2;       // aim to leave ~2 reps in the tank on working sets
const DEFAULT_REP_RANGE = { min: 8, max: 12 };
const WEIGHT_STEP_LBS = 5;
const WEIGHT_STEP_KG = 2.5;

// Training-goal presets. Picking a goal sets the default target RIR and rep
// range used across onboarding, Settings, and progression suggestions.
const GOAL_PRESETS = {
  hypertrophy: { label: 'Growth (Hypertrophy)', targetRIR: DEFAULT_TARGET_RIR, repRangeMin: DEFAULT_REP_RANGE.min, repRangeMax: DEFAULT_REP_RANGE.max },
  strength:    { label: 'Strength',             targetRIR: 2,                 repRangeMin: 3,                      repRangeMax: 6 }
};

function average(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// sessions: array of session records from DB (most recent first not required, we sort here)
// Warm-up sets are excluded here -- they're a ramp to the working weight, not
// a signal about whether the working weight itself should move.
function lastLoggedSetsForExercise(sessions, exerciseId) {
  const withExercise = sessions
    .filter((s) => s.entries && s.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  if (withExercise.length === 0) return null;
  const entry = withExercise[0].entries.find((e) => e.exerciseId === exerciseId);
  return {
    date: withExercise[0].date,
    sets: (entry.sets || []).filter((s) => !s.warmup),
    isDeload: !!withExercise[0].isDeload,
    feedback: entry.feedback || null
  };
}

// Epley formula: estimated one-rep max from a working set's weight x reps.
// Used for PR detection so a heavier-but-lower-rep or lighter-but-higher-rep
// set can still be correctly flagged as a new best, not just raw weight.
function estimated1RM(weight, reps) {
  const w = parseFloat(weight), r = parseFloat(reps);
  if (!isFinite(w) || !isFinite(r) || w <= 0 || r <= 0) return null;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

// Looks at the last time this muscle group appeared in a session and returns
// what the lifter said about overall volume that day ('little' | 'right' | 'much'),
// or null if there's no feedback logged yet.
function lastMuscleFeedback(sessions, muscleGroup) {
  const withMuscle = sessions
    .filter((s) => s.muscleFeedback && s.muscleFeedback[muscleGroup])
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (withMuscle.length === 0) return null;
  return { date: withMuscle[0].date, value: withMuscle[0].muscleFeedback[muscleGroup] };
}

// Turns recent muscle-group volume feedback into a plain-language note. Two
// sessions can flag the same direction before we bother the lifter about it --
// one off day isn't a trend.
function getVolumeFeedbackNote(muscleGroup, sessions) {
  const withMuscle = sessions
    .filter((s) => s.muscleFeedback && s.muscleFeedback[muscleGroup])
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 2);
  if (withMuscle.length < 2) return null;
  const values = withMuscle.map((s) => s.muscleFeedback[muscleGroup]);
  if (values.every((v) => v === 'much')) {
    return { direction: 'down', text: 'Volume has felt like too much here two sessions running -- consider dropping a set next time this muscle comes up.' };
  }
  if (values.every((v) => v === 'little')) {
    return { direction: 'up', text: 'Volume has felt light here two sessions running -- consider adding a set next time this muscle comes up.' };
  }
  return null;
}

function roundToStep(weight, step) {
  return Math.round(weight / step) * step;
}

const PAIN_LABELS = { none: 'no pain', mild: 'mild discomfort', sharp: 'sharp pain' };
const DIFFICULTY_LABELS = { light: 'too light', right: 'just right', hard: 'too hard' };

function getProgressionSuggestion(exerciseId, sessions, options) {
  const opts = Object.assign(
    { targetRIR: DEFAULT_TARGET_RIR, repRange: DEFAULT_REP_RANGE, units: 'lbs' },
    options || {}
  );
  const step = opts.units === 'kg' ? WEIGHT_STEP_KG : WEIGHT_STEP_LBS;

  const last = lastLoggedSetsForExercise(sessions, exerciseId);
  if (!last || last.sets.length === 0) {
    return {
      hasHistory: false,
      signal: 'hold',
      note: 'No history yet for this exercise. Start with a weight you can control for the target rep range, leaving 1-3 reps in reserve.'
    };
  }
  if (last.isDeload) {
    return {
      hasHistory: true,
      signal: 'hold',
      lastWeight: last.sets[last.sets.length - 1].weight,
      note: 'Last session was a deload, so it is not a reliable signal. Resume normal progression from your last non-deload working weight.'
    };
  }

  // Logged fields come in as strings straight from the input boxes -- parse
  // them to numbers here rather than relying on typeof checks downstream.
  const weights = last.sets.map((s) => parseFloat(s.weight)).filter((w) => isFinite(w));
  const reps = last.sets.map((s) => parseFloat(s.reps)).filter((n) => isFinite(n));
  const rirs = last.sets.map((s) => parseFloat(s.rir)).filter((n) => isFinite(n));

  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const avgReps = average(reps);
  const avgRIR = average(rirs);
  const feedback = last.feedback || null;
  const pain = feedback && feedback.pain && feedback.pain !== 'none' ? feedback.pain : null;
  const difficulty = feedback ? feedback.difficulty : null;

  if (lastWeight === null) {
    return { hasHistory: true, signal: 'hold', note: 'Last session has no weight logged -- log weight/reps/RIR next time to get a suggestion.' };
  }

  // Base signal from the numbers (RIR + rep range), same as before.
  let signal = 'hold';
  let suggestedWeight = lastWeight;
  let numericNote;

  if (avgRIR === null) {
    numericNote = 'Log RIR on your sets to unlock weight/rep suggestions -- for now, aim to beat last session\'s reps at the same weight.';
  } else if (avgRIR > opts.targetRIR + 1.5) {
    signal = 'up';
    suggestedWeight = roundToStep(lastWeight + step, step);
    numericNote = `felt easy (avg RIR ${avgRIR.toFixed(1)}, target ${opts.targetRIR})`;
  } else if (avgRIR < opts.targetRIR - 1.5) {
    signal = 'down';
    numericNote = `was tougher than planned (avg RIR ${avgRIR.toFixed(1)}, target ${opts.targetRIR})`;
  } else if (avgReps !== null && avgReps >= opts.repRange.max) {
    signal = 'up';
    suggestedWeight = roundToStep(lastWeight + step, step);
    numericNote = `topped out the rep range (avg ${avgReps.toFixed(1)} reps) at the right RIR`;
  } else {
    numericNote = 'was on track';
  }

  // Layer the subjective check-in on top of the numeric signal. Safety comes
  // first: pain caps progression at "hold" (or "down" if it was also hard),
  // and weight never increases when pain was flagged. Otherwise, "how it
  // felt" and "what the numbers say" are two independent readings of the
  // same set -- when they agree we say so; when they disagree we trust the
  // more conservative one and say why.
  const numericSignal = signal; // snapshot before feedback can move it
  let feelNote = null;

  if (pain) {
    signal = difficulty === 'hard' ? 'down' : 'hold';
    suggestedWeight = lastWeight;
    feelNote = `You flagged ${PAIN_LABELS[pain]} last time -- ${signal === 'down' ? `repeat ${lastWeight}${opts.units} at most, or swap the movement` : `hold at ${lastWeight}${opts.units}`} and stop immediately if it recurs.`;
  } else if (difficulty === 'light') {
    if (numericSignal === 'down') {
      // RIR said it was hard but it felt light -- trust the numbers and hold.
      feelNote = 'That said, your RIR told a harder story than "too light" did, so we\'re trusting the numbers here.';
    } else {
      signal = 'up';
      suggestedWeight = Math.max(suggestedWeight, roundToStep(lastWeight + step, step));
      feelNote = numericSignal === 'up' ? 'That matches how it felt too.' : 'You also called it too light, so we bumped the suggestion up.';
    }
  } else if (difficulty === 'hard') {
    if (numericSignal === 'down') {
      feelNote = 'That matches how it felt too.';
    } else {
      signal = 'hold';
      suggestedWeight = lastWeight;
      feelNote = numericSignal === 'up'
        ? 'The numbers looked ready to progress, but you called it too hard, so we\'re holding instead of adding weight.'
        : 'You also called it too hard, so hold here until RIR catches up.';
    }
  } else if (difficulty === 'right') {
    feelNote = 'You called it just right, matching the numbers.';
  }

  const weightPart = signal === 'up' || signal === 'down'
    ? `${signal === 'up' ? 'Try' : 'Repeat'} ${suggestedWeight}${opts.units}`
    : `Repeat ${lastWeight}${opts.units}`;
  const note = `Last session ${numericNote}. ${weightPart} for the same rep range.${feelNote ? ' ' + feelNote : ''}`;

  return {
    hasHistory: true,
    lastDate: last.date,
    lastWeight,
    avgReps,
    avgRIR,
    pain,
    difficulty,
    signal,
    suggestedWeight,
    note
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    getProgressionSuggestion, lastLoggedSetsForExercise, lastMuscleFeedback, getVolumeFeedbackNote, estimated1RM,
    DEFAULT_TARGET_RIR, DEFAULT_REP_RANGE, GOAL_PRESETS, PAIN_LABELS, DIFFICULTY_LABELS
  };
}
