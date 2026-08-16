// Comprehensive exercise database.
// Fields: id, name, muscleGroup (matches VOLUME_LANDMARKS keys), secondary (optional list),
// equipment: bodyweight | cable | dumbbell | machine | barbell | smith, compound: bool

const EXERCISES = [
  // ---------------- CHEST ----------------
  { id: 'chest-barbell-bench-press', name: 'Barbell Bench Press', muscleGroup: 'chest', secondary: ['triceps','frontDelts'], equipment: 'barbell', compound: true },
  { id: 'chest-barbell-incline-bench-press', name: 'Barbell Incline Bench Press', muscleGroup: 'chest', secondary: ['frontDelts','triceps'], equipment: 'barbell', compound: true },
  { id: 'chest-barbell-decline-bench-press', name: 'Barbell Decline Bench Press', muscleGroup: 'chest', secondary: ['triceps'], equipment: 'barbell', compound: true },
  { id: 'chest-dumbbell-bench-press', name: 'Dumbbell Bench Press', muscleGroup: 'chest', secondary: ['triceps','frontDelts'], equipment: 'dumbbell', compound: true },
  { id: 'chest-dumbbell-incline-press', name: 'Dumbbell Incline Press', muscleGroup: 'chest', secondary: ['frontDelts','triceps'], equipment: 'dumbbell', compound: true },
  { id: 'chest-dumbbell-decline-press', name: 'Dumbbell Decline Press', muscleGroup: 'chest', secondary: ['triceps'], equipment: 'dumbbell', compound: true },
  { id: 'chest-dumbbell-fly', name: 'Dumbbell Fly', muscleGroup: 'chest', equipment: 'dumbbell', compound: false },
  { id: 'chest-incline-dumbbell-fly', name: 'Incline Dumbbell Fly', muscleGroup: 'chest', equipment: 'dumbbell', compound: false },
  { id: 'chest-cable-fly', name: 'Cable Fly (Mid)', muscleGroup: 'chest', equipment: 'cable', compound: false },
  { id: 'chest-cable-crossover-high-low', name: 'Cable Crossover, High-to-Low', muscleGroup: 'chest', equipment: 'cable', compound: false },
  { id: 'chest-cable-crossover-low-high', name: 'Cable Crossover, Low-to-High', muscleGroup: 'chest', equipment: 'cable', compound: false },
  { id: 'chest-machine-chest-press', name: 'Machine Chest Press', muscleGroup: 'chest', secondary: ['triceps'], equipment: 'machine', compound: true },
  { id: 'chest-pec-deck', name: 'Pec Deck / Machine Fly', muscleGroup: 'chest', equipment: 'machine', compound: false },
  { id: 'chest-smith-bench-press', name: 'Smith Machine Bench Press', muscleGroup: 'chest', secondary: ['triceps'], equipment: 'smith', compound: true },
  { id: 'chest-smith-incline-press', name: 'Smith Machine Incline Press', muscleGroup: 'chest', secondary: ['frontDelts'], equipment: 'smith', compound: true },
  { id: 'chest-pushup', name: 'Push-Up', muscleGroup: 'chest', secondary: ['triceps'], equipment: 'bodyweight', compound: true },
  { id: 'chest-incline-pushup', name: 'Incline Push-Up (feet elevated)', muscleGroup: 'chest', secondary: ['frontDelts'], equipment: 'bodyweight', compound: true },
  { id: 'chest-dip', name: 'Dip (Chest-Leaning)', muscleGroup: 'chest', secondary: ['triceps'], equipment: 'bodyweight', compound: true },

  // ---------------- LATS (Back Width) ----------------
  { id: 'lats-pullup', name: 'Pull-Up', muscleGroup: 'lats', secondary: ['biceps'], equipment: 'bodyweight', compound: true },
  { id: 'lats-chinup', name: 'Chin-Up', muscleGroup: 'lats', secondary: ['biceps'], equipment: 'bodyweight', compound: true },
  { id: 'lats-lat-pulldown', name: 'Lat Pulldown, Wide Grip', muscleGroup: 'lats', secondary: ['biceps'], equipment: 'cable', compound: true },
  { id: 'lats-close-grip-pulldown', name: 'Close-Grip Lat Pulldown', muscleGroup: 'lats', secondary: ['biceps'], equipment: 'cable', compound: true },
  { id: 'lats-straight-arm-pulldown', name: 'Straight-Arm Pulldown', muscleGroup: 'lats', equipment: 'cable', compound: false },
  { id: 'lats-barbell-row', name: 'Barbell Bent-Over Row', muscleGroup: 'lats', secondary: ['traps','biceps'], equipment: 'barbell', compound: true },
  { id: 'lats-pendlay-row', name: 'Pendlay Row', muscleGroup: 'lats', secondary: ['traps','biceps'], equipment: 'barbell', compound: true },
  { id: 'lats-dumbbell-row', name: 'One-Arm Dumbbell Row', muscleGroup: 'lats', secondary: ['traps','biceps'], equipment: 'dumbbell', compound: true },
  { id: 'lats-chest-supported-row', name: 'Chest-Supported Dumbbell Row', muscleGroup: 'lats', secondary: ['traps','biceps'], equipment: 'dumbbell', compound: true },
  { id: 'lats-seated-cable-row', name: 'Seated Cable Row', muscleGroup: 'lats', secondary: ['traps','biceps'], equipment: 'cable', compound: true },
  { id: 'lats-machine-row', name: 'Machine Row', muscleGroup: 'lats', secondary: ['traps','biceps'], equipment: 'machine', compound: true },
  { id: 'lats-tbar-row', name: 'T-Bar Row', muscleGroup: 'lats', secondary: ['traps','biceps'], equipment: 'machine', compound: true },
  { id: 'lats-smith-bent-row', name: 'Smith Machine Bent-Over Row', muscleGroup: 'lats', secondary: ['traps'], equipment: 'smith', compound: true },

  // ---------------- UPPER BACK / TRAPS ----------------
  { id: 'traps-barbell-shrug', name: 'Barbell Shrug', muscleGroup: 'traps', equipment: 'barbell', compound: false },
  { id: 'traps-dumbbell-shrug', name: 'Dumbbell Shrug', muscleGroup: 'traps', equipment: 'dumbbell', compound: false },
  { id: 'traps-cable-shrug', name: 'Cable Shrug', muscleGroup: 'traps', equipment: 'cable', compound: false },
  { id: 'traps-smith-shrug', name: 'Smith Machine Shrug', muscleGroup: 'traps', equipment: 'smith', compound: false },
  { id: 'traps-face-pull', name: 'Face Pull', muscleGroup: 'traps', secondary: ['rearDelts'], equipment: 'cable', compound: false },
  { id: 'traps-barbell-upright-row', name: 'Barbell Upright Row', muscleGroup: 'traps', secondary: ['sideDelts'], equipment: 'barbell', compound: true },
  { id: 'traps-dumbbell-upright-row', name: 'Dumbbell Upright Row', muscleGroup: 'traps', secondary: ['sideDelts'], equipment: 'dumbbell', compound: true },
  { id: 'traps-machine-high-row', name: 'Machine High Row', muscleGroup: 'traps', secondary: ['rearDelts'], equipment: 'machine', compound: true },
  { id: 'traps-rack-pull', name: 'Rack Pull', muscleGroup: 'traps', secondary: ['lats','hamstrings'], equipment: 'barbell', compound: true },

  // ---------------- FRONT DELTS ----------------
  { id: 'frontdelts-barbell-ohp', name: 'Barbell Overhead Press', muscleGroup: 'frontDelts', secondary: ['triceps','sideDelts'], equipment: 'barbell', compound: true },
  { id: 'frontdelts-dumbbell-press', name: 'Dumbbell Shoulder Press', muscleGroup: 'frontDelts', secondary: ['triceps','sideDelts'], equipment: 'dumbbell', compound: true },
  { id: 'frontdelts-arnold-press', name: 'Arnold Press', muscleGroup: 'frontDelts', secondary: ['sideDelts','triceps'], equipment: 'dumbbell', compound: true },
  { id: 'frontdelts-machine-press', name: 'Machine Shoulder Press', muscleGroup: 'frontDelts', secondary: ['triceps'], equipment: 'machine', compound: true },
  { id: 'frontdelts-smith-ohp', name: 'Smith Machine Overhead Press', muscleGroup: 'frontDelts', secondary: ['triceps'], equipment: 'smith', compound: true },
  { id: 'frontdelts-cable-front-raise', name: 'Cable Front Raise', muscleGroup: 'frontDelts', equipment: 'cable', compound: false },
  { id: 'frontdelts-dumbbell-front-raise', name: 'Dumbbell Front Raise', muscleGroup: 'frontDelts', equipment: 'dumbbell', compound: false },
  { id: 'frontdelts-plate-front-raise', name: 'Plate Front Raise', muscleGroup: 'frontDelts', equipment: 'barbell', compound: false },

  // ---------------- SIDE DELTS ----------------
  { id: 'sidedelts-dumbbell-lateral-raise', name: 'Dumbbell Lateral Raise', muscleGroup: 'sideDelts', equipment: 'dumbbell', compound: false },
  { id: 'sidedelts-cable-lateral-raise', name: 'Cable Lateral Raise', muscleGroup: 'sideDelts', equipment: 'cable', compound: false },
  { id: 'sidedelts-lean-away-cable-raise', name: 'Lean-Away Cable Lateral Raise', muscleGroup: 'sideDelts', equipment: 'cable', compound: false },
  { id: 'sidedelts-machine-lateral-raise', name: 'Machine Lateral Raise', muscleGroup: 'sideDelts', equipment: 'machine', compound: false },
  { id: 'sidedelts-egyptian-lateral-raise', name: 'Egyptian Lateral Raise', muscleGroup: 'sideDelts', equipment: 'cable', compound: false },
  { id: 'sidedelts-wide-upright-row', name: 'Wide-Grip Upright Row', muscleGroup: 'sideDelts', secondary: ['traps'], equipment: 'barbell', compound: true },

  // ---------------- REAR DELTS ----------------
  { id: 'reardelts-dumbbell-rear-fly', name: 'Dumbbell Rear Delt Fly', muscleGroup: 'rearDelts', equipment: 'dumbbell', compound: false },
  { id: 'reardelts-cable-rear-fly', name: 'Cable Rear Delt Fly', muscleGroup: 'rearDelts', equipment: 'cable', compound: false },
  { id: 'reardelts-machine-reverse-fly', name: 'Machine Reverse Fly', muscleGroup: 'rearDelts', equipment: 'machine', compound: false },
  { id: 'reardelts-face-pull-rear', name: 'Face Pull (Rear-Delt Focus)', muscleGroup: 'rearDelts', secondary: ['traps'], equipment: 'cable', compound: false },
  { id: 'reardelts-bentover-raise', name: 'Bent-Over Dumbbell Rear Raise', muscleGroup: 'rearDelts', equipment: 'dumbbell', compound: false },

  // ---------------- BICEPS ----------------
  { id: 'biceps-barbell-curl', name: 'Barbell Curl', muscleGroup: 'biceps', equipment: 'barbell', compound: false },
  { id: 'biceps-ezbar-curl', name: 'EZ-Bar Curl', muscleGroup: 'biceps', equipment: 'barbell', compound: false },
  { id: 'biceps-dumbbell-curl', name: 'Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell', compound: false },
  { id: 'biceps-incline-dumbbell-curl', name: 'Incline Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell', compound: false },
  { id: 'biceps-hammer-curl', name: 'Hammer Curl', muscleGroup: 'biceps', secondary: ['forearms'], equipment: 'dumbbell', compound: false },
  { id: 'biceps-concentration-curl', name: 'Concentration Curl', muscleGroup: 'biceps', equipment: 'dumbbell', compound: false },
  { id: 'biceps-cable-curl', name: 'Cable Curl', muscleGroup: 'biceps', equipment: 'cable', compound: false },
  { id: 'biceps-cable-rope-hammer-curl', name: 'Cable Rope Hammer Curl', muscleGroup: 'biceps', secondary: ['forearms'], equipment: 'cable', compound: false },
  { id: 'biceps-preacher-curl-machine', name: 'Preacher Curl Machine', muscleGroup: 'biceps', equipment: 'machine', compound: false },
  { id: 'biceps-preacher-curl-barbell', name: 'Preacher Curl, Barbell', muscleGroup: 'biceps', equipment: 'barbell', compound: false },
  { id: 'biceps-smith-drag-curl', name: 'Smith Machine Drag Curl', muscleGroup: 'biceps', equipment: 'smith', compound: false },

  // ---------------- TRICEPS ----------------
  { id: 'triceps-close-grip-bench', name: 'Barbell Close-Grip Bench Press', muscleGroup: 'triceps', secondary: ['chest'], equipment: 'barbell', compound: true },
  { id: 'triceps-skull-crusher-barbell', name: 'Skull Crusher, Barbell/EZ-Bar', muscleGroup: 'triceps', equipment: 'barbell', compound: false },
  { id: 'triceps-skull-crusher-dumbbell', name: 'Skull Crusher, Dumbbell', muscleGroup: 'triceps', equipment: 'dumbbell', compound: false },
  { id: 'triceps-overhead-extension-dumbbell', name: 'Dumbbell Overhead Triceps Extension', muscleGroup: 'triceps', equipment: 'dumbbell', compound: false },
  { id: 'triceps-cable-pushdown', name: 'Cable Triceps Pushdown', muscleGroup: 'triceps', equipment: 'cable', compound: false },
  { id: 'triceps-cable-rope-pushdown', name: 'Cable Rope Pushdown', muscleGroup: 'triceps', equipment: 'cable', compound: false },
  { id: 'triceps-cable-overhead-extension', name: 'Cable Overhead Triceps Extension', muscleGroup: 'triceps', equipment: 'cable', compound: false },
  { id: 'triceps-machine-extension', name: 'Machine Triceps Extension', muscleGroup: 'triceps', equipment: 'machine', compound: false },
  { id: 'triceps-machine-dip', name: 'Machine Dip', muscleGroup: 'triceps', secondary: ['chest'], equipment: 'machine', compound: true },
  { id: 'triceps-dip', name: 'Dip (Triceps-Focused, Upright)', muscleGroup: 'triceps', secondary: ['chest'], equipment: 'bodyweight', compound: true },
  { id: 'triceps-bench-dip', name: 'Bench Dip', muscleGroup: 'triceps', equipment: 'bodyweight', compound: false },
  { id: 'triceps-smith-close-grip-bench', name: 'Smith Machine Close-Grip Bench Press', muscleGroup: 'triceps', equipment: 'smith', compound: true },

  // ---------------- FOREARMS ----------------
  { id: 'forearms-barbell-wrist-curl', name: 'Barbell Wrist Curl', muscleGroup: 'forearms', equipment: 'barbell', compound: false },
  { id: 'forearms-dumbbell-wrist-curl', name: 'Dumbbell Wrist Curl', muscleGroup: 'forearms', equipment: 'dumbbell', compound: false },
  { id: 'forearms-reverse-barbell-curl', name: 'Reverse-Grip Barbell Curl', muscleGroup: 'forearms', secondary: ['biceps'], equipment: 'barbell', compound: false },
  { id: 'forearms-cable-wrist-curl', name: 'Cable Wrist Curl', muscleGroup: 'forearms', equipment: 'cable', compound: false },
  { id: 'forearms-farmers-carry', name: "Farmer's Carry", muscleGroup: 'forearms', secondary: ['traps'], equipment: 'dumbbell', compound: true },
  { id: 'forearms-plate-pinch', name: 'Plate Pinch Hold', muscleGroup: 'forearms', equipment: 'bodyweight', compound: false },

  // ---------------- QUADS ----------------
  { id: 'quads-barbell-back-squat', name: 'Barbell Back Squat', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'barbell', compound: true },
  { id: 'quads-barbell-front-squat', name: 'Barbell Front Squat', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'barbell', compound: true },
  { id: 'quads-smith-squat', name: 'Smith Machine Squat', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'smith', compound: true },
  { id: 'quads-leg-press', name: 'Leg Press', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'machine', compound: true },
  { id: 'quads-hack-squat', name: 'Hack Squat Machine', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'machine', compound: true },
  { id: 'quads-leg-extension', name: 'Leg Extension', muscleGroup: 'quads', equipment: 'machine', compound: false },
  { id: 'quads-goblet-squat', name: 'Dumbbell Goblet Squat', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'dumbbell', compound: true },
  { id: 'quads-bulgarian-split-squat', name: 'Bulgarian Split Squat', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'dumbbell', compound: true },
  { id: 'quads-walking-lunge', name: 'Walking Lunge', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'dumbbell', compound: true },
  { id: 'quads-bodyweight-squat', name: 'Bodyweight Squat', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'bodyweight', compound: true },
  { id: 'quads-walking-lunge-bw', name: 'Bodyweight Walking Lunge', muscleGroup: 'quads', secondary: ['glutes'], equipment: 'bodyweight', compound: true },

  // ---------------- HAMSTRINGS ----------------
  { id: 'hamstrings-barbell-rdl', name: 'Barbell Romanian Deadlift', muscleGroup: 'hamstrings', secondary: ['glutes'], equipment: 'barbell', compound: true },
  { id: 'hamstrings-dumbbell-rdl', name: 'Dumbbell Romanian Deadlift', muscleGroup: 'hamstrings', secondary: ['glutes'], equipment: 'dumbbell', compound: true },
  { id: 'hamstrings-lying-leg-curl', name: 'Lying Leg Curl Machine', muscleGroup: 'hamstrings', equipment: 'machine', compound: false },
  { id: 'hamstrings-seated-leg-curl', name: 'Seated Leg Curl Machine', muscleGroup: 'hamstrings', equipment: 'machine', compound: false },
  { id: 'hamstrings-cable-pullthrough', name: 'Cable Pull-Through', muscleGroup: 'hamstrings', secondary: ['glutes'], equipment: 'cable', compound: true },
  { id: 'hamstrings-good-morning', name: 'Barbell Good Morning', muscleGroup: 'hamstrings', secondary: ['glutes'], equipment: 'barbell', compound: true },
  { id: 'hamstrings-nordic-curl', name: 'Nordic Hamstring Curl', muscleGroup: 'hamstrings', equipment: 'bodyweight', compound: false },
  { id: 'hamstrings-smith-rdl', name: 'Smith Machine RDL', muscleGroup: 'hamstrings', secondary: ['glutes'], equipment: 'smith', compound: true },

  // ---------------- GLUTES ----------------
  { id: 'glutes-barbell-hip-thrust', name: 'Barbell Hip Thrust', muscleGroup: 'glutes', secondary: ['hamstrings'], equipment: 'barbell', compound: true },
  { id: 'glutes-dumbbell-hip-thrust', name: 'Dumbbell Hip Thrust', muscleGroup: 'glutes', secondary: ['hamstrings'], equipment: 'dumbbell', compound: true },
  { id: 'glutes-machine-hip-thrust', name: 'Machine Hip Thrust', muscleGroup: 'glutes', equipment: 'machine', compound: true },
  { id: 'glutes-cable-kickback', name: 'Cable Glute Kickback', muscleGroup: 'glutes', equipment: 'cable', compound: false },
  { id: 'glutes-glute-bridge', name: 'Glute Bridge', muscleGroup: 'glutes', equipment: 'bodyweight', compound: false },
  { id: 'glutes-smith-hip-thrust', name: 'Smith Machine Hip Thrust', muscleGroup: 'glutes', equipment: 'smith', compound: true },
  { id: 'glutes-dumbbell-step-up', name: 'Dumbbell Step-Up', muscleGroup: 'glutes', secondary: ['quads'], equipment: 'dumbbell', compound: true },
  { id: 'glutes-machine-abduction', name: 'Machine Hip Abduction', muscleGroup: 'glutes', equipment: 'machine', compound: false },

  // ---------------- CALVES ----------------
  { id: 'calves-standing-machine-raise', name: 'Standing Calf Raise Machine', muscleGroup: 'calves', equipment: 'machine', compound: false },
  { id: 'calves-seated-machine-raise', name: 'Seated Calf Raise Machine', muscleGroup: 'calves', equipment: 'machine', compound: false },
  { id: 'calves-smith-calf-raise', name: 'Smith Machine Calf Raise', muscleGroup: 'calves', equipment: 'smith', compound: false },
  { id: 'calves-dumbbell-calf-raise', name: 'Dumbbell Standing Calf Raise', muscleGroup: 'calves', equipment: 'dumbbell', compound: false },
  { id: 'calves-leg-press-calf-raise', name: 'Leg Press Calf Raise', muscleGroup: 'calves', equipment: 'machine', compound: false },
  { id: 'calves-bodyweight-raise', name: 'Bodyweight Calf Raise', muscleGroup: 'calves', equipment: 'bodyweight', compound: false },

  // ---------------- ABS ----------------
  { id: 'abs-cable-crunch', name: 'Cable Crunch', muscleGroup: 'abs', equipment: 'cable', compound: false },
  { id: 'abs-hanging-leg-raise', name: 'Hanging Leg Raise', muscleGroup: 'abs', equipment: 'bodyweight', compound: false },
  { id: 'abs-machine-crunch', name: 'Machine Crunch', muscleGroup: 'abs', equipment: 'machine', compound: false },
  { id: 'abs-weighted-situp', name: 'Weighted Sit-Up', muscleGroup: 'abs', equipment: 'dumbbell', compound: false },
  { id: 'abs-plank', name: 'Plank', muscleGroup: 'abs', equipment: 'bodyweight', compound: false },
  { id: 'abs-ab-wheel', name: 'Ab Wheel Rollout', muscleGroup: 'abs', equipment: 'bodyweight', compound: false },
  { id: 'abs-cable-woodchopper', name: 'Cable Woodchopper', muscleGroup: 'abs', equipment: 'cable', compound: false },
  { id: 'abs-bodyweight-crunch', name: 'Bodyweight Crunch', muscleGroup: 'abs', equipment: 'bodyweight', compound: false }
];

const MUSCLE_GROUP_ORDER = ['chest','lats','traps','frontDelts','sideDelts','rearDelts','biceps','triceps','forearms','quads','hamstrings','glutes','calves','abs'];
const EQUIPMENT_TYPES = ['bodyweight','cable','dumbbell','machine','barbell','smith'];

function exercisesForMuscle(muscleGroup) {
  return EXERCISES.filter(e => e.muscleGroup === muscleGroup);
}

if (typeof module !== 'undefined') module.exports = { EXERCISES, MUSCLE_GROUP_ORDER, EQUIPMENT_TYPES, exercisesForMuscle };
