// Premade plan templates. Volume per muscle group scales automatically based on
// how many days/week you train and which split you pick, staying inside the
// MEV-MRV window defined in volume-landmarks.js.
//
// Depends on globals from exercises.js and volume-landmarks.js (loaded first).

const SPLIT_DEFINITIONS = {
  fullBody: {
    name: 'Full Body',
    dayOptions: [2, 3],
    schedule(days) {
      const allMuscles = MUSCLE_GROUP_ORDER;
      return Array.from({ length: days }, (_, i) => ({
        dayLabel: 'Full Body ' + String.fromCharCode(65 + i),
        muscles: allMuscles
      }));
    }
  },
  upperLower: {
    name: 'Upper / Lower',
    dayOptions: [4],
    schedule() {
      const upper = ['chest', 'lats', 'traps', 'frontDelts', 'sideDelts', 'rearDelts', 'biceps', 'triceps', 'forearms'];
      const lower = ['quads', 'hamstrings', 'glutes', 'calves', 'abs'];
      return [
        { dayLabel: 'Upper A', muscles: upper },
        { dayLabel: 'Lower A', muscles: lower },
        { dayLabel: 'Upper B', muscles: upper },
        { dayLabel: 'Lower B', muscles: lower }
      ];
    }
  },
  ppl: {
    name: 'Push / Pull / Legs',
    dayOptions: [5, 6],
    schedule(days) {
      const push = ['chest', 'frontDelts', 'sideDelts', 'triceps'];
      const pull = ['lats', 'traps', 'rearDelts', 'biceps', 'forearms'];
      const legs = ['quads', 'hamstrings', 'glutes', 'calves', 'abs'];
      if (days === 6) {
        return [
          { dayLabel: 'Push A', muscles: push },
          { dayLabel: 'Pull A', muscles: pull },
          { dayLabel: 'Legs A', muscles: legs },
          { dayLabel: 'Push B', muscles: push },
          { dayLabel: 'Pull B', muscles: pull },
          { dayLabel: 'Legs B', muscles: legs }
        ];
      }
      // 5-day hybrid: straight PPL then an Upper/Lower pair so nothing gets skipped
      const upper = ['chest', 'lats', 'traps', 'frontDelts', 'sideDelts', 'rearDelts', 'biceps', 'triceps'];
      const lower = ['quads', 'hamstrings', 'glutes', 'calves', 'abs'];
      return [
        { dayLabel: 'Push', muscles: push },
        { dayLabel: 'Pull', muscles: pull },
        { dayLabel: 'Legs', muscles: legs },
        { dayLabel: 'Upper', muscles: upper },
        { dayLabel: 'Lower', muscles: lower }
      ];
    }
  },
  broSplit: {
    name: 'Bro Split (Body-Part)',
    dayOptions: [5, 6],
    schedule(days) {
      const base = [
        { dayLabel: 'Chest', muscles: ['chest'] },
        { dayLabel: 'Back', muscles: ['lats', 'traps'] },
        { dayLabel: 'Shoulders', muscles: ['frontDelts', 'sideDelts', 'rearDelts'] },
        { dayLabel: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
        { dayLabel: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] }
      ];
      if (days === 6) {
        base.push({ dayLabel: 'Abs & Weak Points', muscles: ['abs', 'calves', 'rearDelts'] });
      } else {
        base[3] = Object.assign({}, base[3], { muscles: base[3].muscles.concat('abs') });
      }
      return base;
    }
  }
};

function listAvailablePlans() {
  return Object.keys(SPLIT_DEFINITIONS).map((key) => ({
    key,
    name: SPLIT_DEFINITIONS[key].name,
    dayOptions: SPLIT_DEFINITIONS[key].dayOptions
  }));
}

// Where in the MEV-MRV window to land the weekly target, based on days/week.
// More training days = more recoverable volume, so we push closer to MRV.
function targetWeeklySets(muscleGroup, daysPerWeek) {
  const lm = VOLUME_LANDMARKS[muscleGroup];
  if (!lm) return 0;
  let target;
  if (daysPerWeek <= 3) {
    target = lm.mev + 0.25 * (lm.mavHigh - lm.mev);
  } else if (daysPerWeek === 4) {
    target = lm.mavLow + 0.5 * (lm.mavHigh - lm.mavLow);
  } else {
    target = lm.mavHigh + 0.4 * (lm.mrv - lm.mavHigh);
  }
  return Math.max(0, Math.round(target));
}

function pickExercisesForMuscle(muscleGroup, count) {
  const pool = exercisesForMuscle(muscleGroup).slice();
  pool.sort((a, b) => (b.compound === true) - (a.compound === true));
  return pool.slice(0, count);
}

// Builds a full plan: which exercises on which day, with a target set count each,
// such that the week's total per muscle group lands on targetWeeklySets().
function buildPlan(splitKey, daysPerWeek) {
  const def = SPLIT_DEFINITIONS[splitKey];
  if (!def) throw new Error('Unknown split: ' + splitKey);
  if (!def.dayOptions.includes(daysPerWeek)) {
    throw new Error(def.name + ' does not support ' + daysPerWeek + ' days/week');
  }

  const schedule = def.schedule(daysPerWeek);

  // how many days/week each muscle group is trained in this schedule
  const frequency = {};
  schedule.forEach((day) => {
    day.muscles.forEach((m) => {
      frequency[m] = (frequency[m] || 0) + 1;
    });
  });

  const weeklyTargets = {};
  Object.keys(frequency).forEach((m) => {
    weeklyTargets[m] = targetWeeklySets(m, daysPerWeek);
  });

  const days = schedule.map((day) => {
    const dayExercises = [];
    day.muscles.forEach((muscleGroup) => {
      const weeklyTotal = weeklyTargets[muscleGroup] || 0;
      const freq = frequency[muscleGroup] || 1;
      const perOccurrence = Math.max(2, Math.round(weeklyTotal / freq));
      const useTwoExercises = perOccurrence >= 6;
      const picks = pickExercisesForMuscle(muscleGroup, useTwoExercises ? 2 : 1);

      if (picks.length === 0) return;

      if (picks.length === 1) {
        dayExercises.push({ exerciseId: picks[0].id, muscleGroup, targetSets: perOccurrence });
      } else {
        const half = Math.round(perOccurrence / 2);
        dayExercises.push({ exerciseId: picks[0].id, muscleGroup, targetSets: half });
        dayExercises.push({ exerciseId: picks[1].id, muscleGroup, targetSets: perOccurrence - half });
      }
    });
    return { dayLabel: day.dayLabel, muscles: day.muscles, exercises: dayExercises };
  });

  return {
    splitKey,
    splitName: def.name,
    daysPerWeek,
    weeklyTargets,
    days
  };
}

if (typeof module !== 'undefined') {
  module.exports = { SPLIT_DEFINITIONS, listAvailablePlans, targetWeeklySets, buildPlan, pickExercisesForMuscle };
}
