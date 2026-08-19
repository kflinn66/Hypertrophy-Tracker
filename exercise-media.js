// Exercise demo images.
//
// Source: Free Exercise DB (https://github.com/yuhonas/free-exercise-db), a public-
// domain (Unlicense) dataset of ~873 exercises with photo demos. We host nothing --
// images are loaded directly from GitHub's raw CDN at raw.githubusercontent.com, so
// there is no build step and no bundled image assets in this repo.
//
// Coverage is intentionally partial: 164 of 247 exercises (~66.4%) as of
// this pass. Every entry below was matched by name/movement and spot-checked by hand
// against the Free Exercise DB's own instructions text -- we deliberately did NOT map
// an exercise where the closest available FEDB name described a materially different
// movement or technique (e.g. HT's plain 'Barbell Bench Press' was NOT mapped to FEDB's
// 'Barbell Guillotine Bench Press', a distinct and riskier bar-path variant; it's mapped
// to 'Barbell Bench Press - Medium Grip' instead, which is the correct standard version).
// A wrong demo image is worse than no image, so exercises without a confident match are
// simply left out of this object rather than guessing.
//
// To expand coverage further: pull the combined dataset from
// https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json,
// match by normalized token sets (not raw substring/fuzzy-ratio matching -- pluralization
// and compound words like 'push-up' vs 'pushups' need normalizing first), then manually
// verify every candidate against the FEDB instructions text before adding it here. Never
// add an entry on name-similarity alone.
const EXERCISE_MEDIA = {
  'abs-cable-crunch': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg', // Cable Crunch -> Cable Crunch
  'abs-dead-bug': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dead_Bug/0.jpg', // Dead Bug -> Dead Bug
  'abs-decline-situp': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Sit-Up/0.jpg', // Decline Sit-Up -> Sit-Up
  'abs-hanging-knee-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg', // Hanging Knee Raise -> Hanging Leg Raise
  'abs-hanging-leg-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg', // Hanging Leg Raise -> Hanging Leg Raise
  'abs-machine-crunch': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Ab_Crunch_Machine/0.jpg', // Machine Crunch -> Ab Crunch Machine
  'abs-pallof-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pallof_Press/0.jpg', // Cable Pallof Press -> Pallof Press
  'abs-plank': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg', // Plank -> Plank
  'abs-russian-twist': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Russian_Twist/0.jpg', // Russian Twist -> Russian Twist
  'abs-weighted-situp': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Sit-Up/0.jpg', // Weighted Sit-Up -> Sit-Up
  'biceps-barbell-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg', // Barbell Curl -> Barbell Curl
  'biceps-cable-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Biceps_Cable_Curl/0.jpg', // Cable Curl -> Standing Biceps Cable Curl
  'biceps-cable-rope-hammer-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Hammer_Curls_-_Rope_Attachment/0.jpg', // Cable Rope Hammer Curl -> Cable Hammer Curls - Rope Attachment
  'biceps-concentration-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Concentration_Curls/0.jpg', // Concentration Curl -> Concentration Curls
  'biceps-cross-body-hammer-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cross_Body_Hammer_Curl/0.jpg', // Cross-Body Hammer Curl -> Cross Body Hammer Curl
  'biceps-dumbbell-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bicep_Curl/0.jpg', // Dumbbell Curl -> Dumbbell Bicep Curl
  'biceps-ezbar-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/EZ-Bar_Curl/0.jpg', // EZ-Bar Curl -> EZ-Bar Curl
  'biceps-hammer-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg', // Hammer Curl -> Hammer Curls
  'biceps-incline-dumbbell-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/0.jpg', // Incline Dumbbell Curl -> Incline Dumbbell Curl
  'biceps-machine-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Bicep_Curl/0.jpg', // Machine Bicep Curl -> Machine Bicep Curl
  'biceps-preacher-curl-barbell': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Preacher_Curl/0.jpg', // Preacher Curl, Barbell -> Preacher Curl
  'biceps-preacher-curl-dumbbell': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Preacher_Curl/0.jpg', // Preacher Curl, Single-Arm Dumbbell -> Preacher Curl
  'biceps-preacher-curl-machine': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Preacher_Curls/0.jpg', // Preacher Curl Machine -> Machine Preacher Curls
  'biceps-smith-drag-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Drag_Curl/0.jpg', // Smith Machine Drag Curl -> Drag Curl
  'biceps-spider-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Spider_Curl/0.jpg', // Spider Curl -> Spider Curl
  'biceps-zottman-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Zottman_Curl/0.jpg', // Zottman Curl -> Zottman Curl
  'calves-donkey-calf-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Donkey_Calf_Raises/0.jpg', // Donkey Calf Raise Machine -> Donkey Calf Raises
  'calves-dumbbell-calf-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Dumbbell_Calf_Raise/0.jpg', // Dumbbell Standing Calf Raise -> Standing Dumbbell Calf Raise
  'calves-leg-press-calf-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Calf_Press/0.jpg', // Leg Press Calf Raise -> Calf Press
  'calves-seated-machine-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Calf_Raise/0.jpg', // Seated Calf Raise Machine -> Seated Calf Raise
  'calves-single-leg-dumbbell-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Seated_One-Leg_Calf_Raise/0.jpg', // Single-Leg Dumbbell Calf Raise -> Dumbbell Seated One-Leg Calf Raise
  'calves-smith-calf-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Calf_Raise/0.jpg', // Smith Machine Calf Raise -> Smith Machine Calf Raise
  'calves-standing-machine-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg', // Standing Calf Raise Machine -> Standing Calf Raises
  'chest-assisted-dip-machine': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dip_Machine/0.jpg', // Assisted Dip Machine (Chest-Leaning) -> Dip Machine
  'chest-band-pushup': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg', // Band-Resisted Push-Up -> Pushups
  'chest-barbell-bench-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg', // Barbell Bench Press -> Barbell Bench Press - Medium Grip
  'chest-barbell-decline-bench-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Decline_Barbell_Bench_Press/0.jpg', // Barbell Decline Bench Press -> Decline Barbell Bench Press
  'chest-barbell-floor-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Floor_Press/0.jpg', // Barbell Floor Press -> Floor Press
  'chest-barbell-incline-bench-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg', // Barbell Incline Bench Press -> Barbell Incline Bench Press - Medium Grip
  'chest-cable-crossover-high-low': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg', // Cable Crossover, High-to-Low -> Cable Crossover
  'chest-cable-crossover-low-high': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Low_Cable_Crossover/0.jpg', // Cable Crossover, Low-to-High -> Low Cable Crossover
  'chest-cable-iron-cross': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Iron_Cross/0.jpg', // Standing Cable Iron Cross -> Cable Iron Cross
  'chest-close-grip-bench-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Barbell_Bench_Press/0.jpg', // Close-Grip Barbell Bench Press (Chest-Focused) -> Close-Grip Barbell Bench Press
  'chest-decline-dumbbell-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Decline_Dumbbell_Flyes/0.jpg', // Decline Dumbbell Fly -> Decline Dumbbell Flyes
  'chest-decline-pushup': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Push-Up/0.jpg', // Decline Push-Up (hands elevated) -> Incline Push-Up
  'chest-dumbbell-bench-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg', // Dumbbell Bench Press -> Dumbbell Bench Press
  'chest-dumbbell-decline-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Decline_Dumbbell_Bench_Press/0.jpg', // Dumbbell Decline Press -> Decline Dumbbell Bench Press
  'chest-dumbbell-floor-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Floor_Press/0.jpg', // Dumbbell Floor Press -> Dumbbell Floor Press
  'chest-dumbbell-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Flyes/0.jpg', // Dumbbell Fly -> Dumbbell Flyes
  'chest-dumbbell-incline-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg', // Dumbbell Incline Press -> Incline Dumbbell Press
  'chest-incline-dumbbell-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Flyes/0.jpg', // Incline Dumbbell Fly -> Incline Dumbbell Flyes
  'chest-incline-pushup': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Push-Ups_With_Feet_Elevated/0.jpg', // Incline Push-Up (feet elevated) -> Push-Ups With Feet Elevated
  'chest-machine-decline-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_Decline_Chest_Press/0.jpg', // Machine Decline Chest Press -> Leverage Decline Chest Press
  'chest-neutral-grip-dumbbell-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press_with_Neutral_Grip/0.jpg', // Neutral-Grip Dumbbell Press -> Dumbbell Bench Press with Neutral Grip
  'chest-pushup': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg', // Push-Up -> Pushups
  'chest-single-arm-cable-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Chest_Press/0.jpg', // Single-Arm Cable Chest Press -> Cable Chest Press
  'chest-smith-bench-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Bench_Press/0.jpg', // Smith Machine Bench Press -> Smith Machine Bench Press
  'chest-smith-decline-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Decline_Press/0.jpg', // Smith Machine Decline Press -> Smith Machine Decline Press
  'chest-smith-incline-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Incline_Bench_Press/0.jpg', // Smith Machine Incline Press -> Smith Machine Incline Bench Press
  'chest-svend-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Svend_Press/0.jpg', // Svend Press (Plate Squeeze Press) -> Svend Press
  'forearms-barbell-wrist-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Palm-Up_Barbell_Wrist_Curl/0.jpg', // Barbell Wrist Curl -> Seated Palm-Up Barbell Wrist Curl
  'forearms-behind-back-wrist-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl/0.jpg', // Behind-the-Back Barbell Wrist Curl -> Standing Palms-Up Barbell Behind The Back Wrist Curl
  'forearms-cable-reverse-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Reverse_Cable_Curl/0.jpg', // Cable Reverse-Grip Curl -> Reverse Cable Curl
  'forearms-cable-wrist-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Wrist_Curl/0.jpg', // Cable Wrist Curl -> Cable Wrist Curl
  'forearms-dumbbell-wrist-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Palms-Up_Wrist_Curl/0.jpg', // Dumbbell Wrist Curl -> Seated Dumbbell Palms-Up Wrist Curl
  'forearms-farmers-carry': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Farmers_Walk/0.jpg', // Farmer's Carry -> Farmer's Walk
  'forearms-plate-pinch': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plate_Pinch/0.jpg', // Plate Pinch Hold -> Plate Pinch
  'forearms-reverse-barbell-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Reverse_Barbell_Curl/0.jpg', // Reverse-Grip Barbell Curl -> Reverse Barbell Curl
  'forearms-wrist-roller': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wrist_Roller/0.jpg', // Wrist Roller -> Wrist Roller
  'frontdelts-arnold-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Arnold_Dumbbell_Press/0.jpg', // Arnold Press -> Arnold Dumbbell Press
  'frontdelts-barbell-ohp': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg', // Barbell Overhead Press -> Barbell Shoulder Press
  'frontdelts-cable-front-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Cable_Raise/0.jpg', // Cable Front Raise -> Front Cable Raise
  'frontdelts-dumbbell-front-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Dumbbell_Raise/0.jpg', // Dumbbell Front Raise -> Front Dumbbell Raise
  'frontdelts-dumbbell-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg', // Dumbbell Shoulder Press -> Dumbbell Shoulder Press
  'frontdelts-machine-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Shoulder_Military_Press/0.jpg', // Machine Shoulder Press -> Machine Shoulder (Military) Press
  'frontdelts-plate-front-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Plate_Raise/0.jpg', // Plate Front Raise -> Front Plate Raise
  'frontdelts-push-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Push_Press/0.jpg', // Barbell Push Press -> Push Press
  'frontdelts-seated-dumbbell-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg', // Seated Dumbbell Shoulder Press -> Dumbbell Shoulder Press
  'frontdelts-single-arm-dumbbell-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_One-Arm_Shoulder_Press/0.jpg', // Single-Arm Dumbbell Press -> Dumbbell One-Arm Shoulder Press
  'frontdelts-smith-ohp': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Overhead_Shoulder_Press/0.jpg', // Smith Machine Overhead Press -> Smith Machine Overhead Shoulder Press
  'glutes-band-abduction': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Monster_Walk/0.jpg', // Band Hip Abduction (Monster Walk) -> Monster Walk
  'glutes-barbell-hip-thrust': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg', // Barbell Hip Thrust -> Barbell Hip Thrust
  'glutes-cable-kickback': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Glute_Kickback/0.jpg', // Cable Glute Kickback -> Glute Kickback
  'glutes-dumbbell-step-up': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Step_Ups/0.jpg', // Dumbbell Step-Up -> Dumbbell Step Ups
  'hamstrings-barbell-deadlift': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg', // Barbell Deadlift (Conventional) -> Barbell Deadlift
  'hamstrings-barbell-rdl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg', // Barbell Romanian Deadlift -> Romanian Deadlift
  'hamstrings-cable-pullthrough': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pull_Through/0.jpg', // Cable Pull-Through -> Pull Through
  'hamstrings-dumbbell-rdl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg', // Dumbbell Romanian Deadlift -> Romanian Deadlift
  'hamstrings-glute-ham-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Glute_Ham_Raise/0.jpg', // Glute-Ham Raise -> Glute Ham Raise
  'hamstrings-good-morning': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Stiff_Leg_Barbell_Good_Morning/0.jpg', // Barbell Good Morning -> Stiff Leg Barbell Good Morning
  'hamstrings-lying-leg-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg', // Lying Leg Curl Machine -> Lying Leg Curls
  'hamstrings-seated-leg-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/0.jpg', // Seated Leg Curl Machine -> Seated Leg Curl
  'hamstrings-stability-ball-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Ball_Leg_Curl/0.jpg', // Stability Ball Leg Curl -> Ball Leg Curl
  'hamstrings-standing-leg-curl': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Leg_Curl/0.jpg', // Standing Single-Leg Curl Machine -> Standing Leg Curl
  'hamstrings-sumo-deadlift': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Sumo_Deadlift/0.jpg', // Sumo Deadlift -> Sumo Deadlift
  'lats-barbell-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg', // Barbell Bent-Over Row -> Bent Over Barbell Row
  'lats-behind-neck-pulldown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Pulldown_Behind_The_Neck/0.jpg', // Behind-the-Neck Lat Pulldown -> Wide-Grip Pulldown Behind The Neck
  'lats-chinup': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Chin-Up/0.jpg', // Chin-Up -> Chin-Up
  'lats-close-grip-pulldown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg', // Close-Grip Lat Pulldown -> Close-Grip Front Lat Pulldown
  'lats-dumbbell-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/One-Arm_Dumbbell_Row/0.jpg', // One-Arm Dumbbell Row -> One-Arm Dumbbell Row
  'lats-inverted-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Inverted_Row/0.jpg', // Inverted Row (Bodyweight) -> Inverted Row
  'lats-lat-pulldown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg', // Lat Pulldown, Wide Grip -> Wide-Grip Lat Pulldown
  'lats-machine-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_Iso_Row/0.jpg', // Machine Row -> Leverage Iso Row
  'lats-pullup': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg', // Pull-Up -> Pullups
  'lats-single-arm-pulldown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/One_Arm_Lat_Pulldown/0.jpg', // Single-Arm Lat Pulldown -> One Arm Lat Pulldown
  'lats-smith-bent-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Bent_Over_Row/0.jpg', // Smith Machine Bent-Over Row -> Smith Machine Bent Over Row
  'lats-straight-arm-pulldown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Straight-Arm_Pulldown/0.jpg', // Straight-Arm Pulldown -> Straight-Arm Pulldown
  'lats-tbar-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/T-Bar_Row_with_Handle/0.jpg', // T-Bar Row -> T-Bar Row with Handle
  'lats-vbar-pulldown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/V-Bar_Pulldown/0.jpg', // V-Bar Lat Pulldown -> V-Bar Pulldown
  'quads-barbell-back-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg', // Barbell Back Squat -> Barbell Squat
  'quads-barbell-front-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Barbell_Squat/0.jpg', // Barbell Front Squat -> Front Barbell Squat
  'quads-bodyweight-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Squat/0.jpg', // Bodyweight Squat -> Bodyweight Squat
  'quads-bulgarian-split-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Split_Squats/0.jpg', // Bulgarian Split Squat -> Split Squats
  'quads-goblet-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Goblet_Squat/0.jpg', // Dumbbell Goblet Squat -> Goblet Squat
  'quads-hack-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hack_Squat/0.jpg', // Hack Squat Machine -> Hack Squat
  'quads-kettlebell-goblet-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Goblet_Squat/0.jpg', // Kettlebell Goblet Squat -> Goblet Squat
  'quads-leg-extension': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg', // Leg Extension -> Leg Extensions
  'quads-leg-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg', // Leg Press -> Leg Press
  'quads-pistol-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Kettlebell_Pistol_Squat/0.jpg', // Pistol Squat -> Kettlebell Pistol Squat
  'quads-single-leg-extension': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Single-Leg_Leg_Extension/0.jpg', // Single-Leg Extension -> Single-Leg Leg Extension
  'quads-single-leg-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg', // Single-Leg Press -> Leg Press
  'quads-sissy-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Weighted_Sissy_Squat/0.jpg', // Sissy Squat -> Weighted Sissy Squat
  'quads-smith-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Squat/0.jpg', // Smith Machine Squat -> Smith Machine Squat
  'quads-walking-lunge': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Walking_Lunge/0.jpg', // Walking Lunge -> Bodyweight Walking Lunge
  'quads-walking-lunge-bw': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Walking_Lunge/0.jpg', // Bodyweight Walking Lunge -> Bodyweight Walking Lunge
  'quads-zercher-squat': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Zercher_Squats/0.jpg', // Zercher Squat -> Zercher Squats
  'reardelts-band-pull-apart': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Band_Pull_Apart/0.jpg', // Band Pull-Apart -> Band Pull Apart
  'reardelts-bentover-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench/0.jpg', // Bent-Over Dumbbell Rear Raise -> Bent Over Dumbbell Rear Delt Raise With Head On Bench
  'reardelts-cable-rear-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rear_Delt_Fly/0.jpg', // Cable Rear Delt Fly -> Cable Rear Delt Fly
  'reardelts-chest-supported-rear-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Rear_Delt_Raise/0.jpg', // Chest-Supported Dumbbell Rear Fly -> Lying Rear Delt Raise
  'reardelts-dumbbell-rear-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Bent-Over_Rear_Delt_Raise/0.jpg', // Dumbbell Rear Delt Fly -> Seated Bent-Over Rear Delt Raise
  'reardelts-face-pull-rear': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg', // Face Pull (Rear-Delt Focus) -> Face Pull
  'reardelts-machine-reverse-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Reverse_Machine_Flyes/0.jpg', // Machine Reverse Fly -> Reverse Machine Flyes
  'reardelts-single-arm-cable-rear-fly': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rear_Delt_Fly/0.jpg', // Single-Arm Cable Rear Delt Fly -> Cable Rear Delt Fly
  'sidedelts-band-lateral-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lateral_Raise_-_With_Bands/0.jpg', // Band Lateral Raise -> Lateral Raise - With Bands
  'sidedelts-cable-lateral-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg', // Cable Lateral Raise -> Cable Seated Lateral Raise
  'sidedelts-dumbbell-lateral-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg', // Dumbbell Lateral Raise -> Side Lateral Raise
  'sidedelts-seated-lateral-raise': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Raise/0.jpg', // Seated Dumbbell Lateral Raise -> Dumbbell Raise
  'traps-barbell-shrug': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shrug/0.jpg', // Barbell Shrug -> Barbell Shrug
  'traps-barbell-upright-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Upright_Barbell_Row/0.jpg', // Barbell Upright Row -> Upright Barbell Row
  'traps-cable-shrug': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Shrugs/0.jpg', // Cable Shrug -> Cable Shrugs
  'traps-cable-upright-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Upright_Cable_Row/0.jpg', // Cable Upright Row -> Upright Cable Row
  'traps-dumbbell-shrug': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shrug/0.jpg', // Dumbbell Shrug -> Dumbbell Shrug
  'traps-dumbbell-upright-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Dumbbell_Upright_Row/0.jpg', // Dumbbell Upright Row -> Standing Dumbbell Upright Row
  'traps-face-pull': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg', // Face Pull -> Face Pull
  'traps-farmers-walk': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Farmers_Walk/0.jpg', // Farmer's Walk -> Farmer's Walk
  'traps-machine-high-row': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_High_Row/0.jpg', // Machine High Row -> Leverage High Row
  'traps-overhead-cable-shrug': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Shrugs/0.jpg', // Overhead Cable Shrug -> Cable Shrugs
  'traps-rack-pull': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Rack_Pulls/0.jpg', // Rack Pull -> Rack Pulls
  'traps-snatch-grip-shrug': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shrug/0.jpg', // Snatch-Grip Barbell Shrug -> Barbell Shrug
  'triceps-assisted-dip-machine': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dip_Machine/0.jpg', // Assisted Dip Machine (Triceps-Focused) -> Dip Machine
  'triceps-band-pushdown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg', // Band Triceps Pushdown -> Triceps Pushdown
  'triceps-bench-dip': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Weighted_Bench_Dip/0.jpg', // Bench Dip -> Weighted Bench Dip
  'triceps-cable-overhead-extension': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rope_Overhead_Triceps_Extension/0.jpg', // Cable Overhead Triceps Extension -> Cable Rope Overhead Triceps Extension
  'triceps-cable-pushdown': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg', // Cable Triceps Pushdown -> Triceps Pushdown
  'triceps-close-grip-bench': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Barbell_Bench_Press/0.jpg', // Barbell Close-Grip Bench Press -> Close-Grip Barbell Bench Press
  'triceps-diamond-pushup': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Push-Ups_-_Close_Triceps_Position/0.jpg', // Diamond Push-Up -> Push-Ups - Close Triceps Position
  'triceps-dumbbell-kickback': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Tricep_Dumbbell_Kickback/0.jpg', // Dumbbell Triceps Kickback -> Tricep Dumbbell Kickback
  'triceps-jm-press': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/JM_Press/0.jpg', // JM Press -> JM Press
  'triceps-machine-dip': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dip_Machine/0.jpg', // Machine Dip -> Dip Machine
  'triceps-machine-extension': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Triceps_Extension/0.jpg', // Machine Triceps Extension -> Machine Triceps Extension
  'triceps-overhead-extension-dumbbell': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Dumbbell_Triceps_Extension/0.jpg', // Dumbbell Overhead Triceps Extension -> Standing Dumbbell Triceps Extension
  'triceps-single-arm-overhead-extension': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_One-Arm_Triceps_Extension/0.jpg', // Single-Arm Dumbbell Overhead Extension -> Dumbbell One-Arm Triceps Extension
  'triceps-smith-close-grip-bench': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Smith_Machine_Close-Grip_Bench_Press/0.jpg', // Smith Machine Close-Grip Bench Press -> Smith Machine Close-Grip Bench Press
};

if (typeof module !== 'undefined') module.exports = { EXERCISE_MEDIA };
