// Auto-progression suggestions: RIR-based double progression, RP-style.
// Looks at your most recent logged sets for an exercise and suggests what
// to do next session. This is a heuristic, not a physiologist -- treat
// suggestions as a starting point and adjust to how you actually feel.

const DEFAULT_TARGET_RIR = 2;       // aim to leave ~2 reps in the tank on working sets
const DEFAULT_REP_RANGE = { min: 8, max: 12 };
const WEIGHT_STEP_LBS = 5;
const WEIGHT_STEP_KG = 2.5;

function average(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// sessions: array of session records from DB (most recent first not required, we sort here)
function lastLoggedSetsForExercise(sessions, exerciseId) {
  const withExercise = sessions
    .filter((s) => s.entries && s.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  if (withExercise.length === 0) return null;
  const entry = withExercise[0].entries.find((e) => e.exerciseId === exerciseId);
  return { date: withExercise[0].date, sets: entry.sets || [], isDeload: !!withExercise[0].isDeload };
}

function roundToStep(weight, step) {
  return Math.round(weight / step) * step;
}

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
      note: 'No history yet for this exercise. Start with a weight you can control for the target rep range, leaving 1-3 reps in reserve.'
    };
  }
  if (last.isDeload) {
    return {
      hasHistory: true,
      lastWeight: last.sets[last.sets.length - 1].weight,
      note: 'Last session was a deload, so it is not a reliable signal. Resume normal progression from your last non-deload working weight.'
    };
  }

  const weights = last.sets.map((s) => s.weight).filter((w) => typeof w === 'number');
  const reps = last.sets.map((s) => s.reps);
  const rirs = last.sets.map((s) => s.rir);

  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const avgReps = average(reps);
  const avgRIR = average(rirs);

  if (lastWeight === null) {
    return { hasHistory: true, note: 'Last session has no weight logged -- log weight/reps/RIR next time to get a suggestion.' };
  }

  let suggestedWeight = lastWeight;
  let suggestedRepsNote = '';
  let note;

  if (avgRIR === null) {
    note = 'Log RIR on your sets to unlock weight/rep suggestions -- for now, aim to beat last session\'s reps at the same weight.';
  } else if (avgRIR > opts.targetRIR + 1.5) {
    // way too easy
    suggestedWeight = roundToStep(lastWeight + step, step);
    note = `Last session felt easy (avg RIR ${avgRIR.toFixed(1)}, target ${opts.targetRIR}). Try ${suggestedWeight}${opts.units} for the same rep range.`;
  } else if (avgRIR < opts.targetRIR - 1.5) {
    // too hard
    note = `Last session was tougher than planned (avg RIR ${avgRIR.toFixed(1)}, target ${opts.targetRIR}). Repeat ${lastWeight}${opts.units} and focus on hitting your rep target before adding weight.`;
  } else if (avgReps !== null && avgReps >= opts.repRange.max) {
    suggestedWeight = roundToStep(lastWeight + step, step);
    note = `You topped out the rep range (avg ${avgReps.toFixed(1)} reps) at the right RIR. Bump to ${suggestedWeight}${opts.units} and reset near the bottom of your rep range.`;
  } else {
    note = `On track. Repeat ${lastWeight}${opts.units} and aim for +1 rep per set versus last time, keeping RIR around ${opts.targetRIR}.`;
  }

  return {
    hasHistory: true,
    lastDate: last.date,
    lastWeight,
    avgReps,
    avgRIR,
    suggestedWeight,
    note
  };
}

if (typeof module !== 'undefined') {
  module.exports = { getProgressionSuggestion, lastLoggedSetsForExercise, DEFAULT_TARGET_RIR, DEFAULT_REP_RANGE };
}
