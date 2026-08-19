// Weekly set volume landmarks per muscle group, in the style of RP's
// published hypertrophy guidelines: MEV (Minimum Effective Volume),
// MAV (Maximum Adaptive Volume, given as a range), MRV (Maximum Recoverable Volume).
// These are reasonable starting points, not gospel -- individual recovery varies.
// You can retune any of these numbers later in Settings.

const VOLUME_LANDMARKS = {
  chest:        { label: 'Chest',            mev: 8,  mavLow: 12, mavHigh: 20, mrv: 22 },
  lats:         { label: 'Back (Lats)',      mev: 10, mavLow: 14, mavHigh: 22, mrv: 25 },
  traps:        { label: 'Upper Back/Traps', mev: 6,  mavLow: 12, mavHigh: 20, mrv: 26 },
  frontDelts:   { label: 'Front Delts',      mev: 4,  mavLow: 6,  mavHigh: 12, mrv: 18 },
  sideDelts:    { label: 'Side Delts',       mev: 8,  mavLow: 16, mavHigh: 22, mrv: 26 },
  rearDelts:    { label: 'Rear Delts',       mev: 6,  mavLow: 12, mavHigh: 20, mrv: 22 },
  biceps:       { label: 'Biceps',           mev: 8,  mavLow: 14, mavHigh: 20, mrv: 26 },
  triceps:      { label: 'Triceps',          mev: 6,  mavLow: 10, mavHigh: 18, mrv: 22 },
  forearms:     { label: 'Forearms',         mev: 6,  mavLow: 10, mavHigh: 16, mrv: 20 },
  quads:        { label: 'Quads',            mev: 8,  mavLow: 12, mavHigh: 18, mrv: 20 },
  hamstrings:   { label: 'Hamstrings',       mev: 6,  mavLow: 10, mavHigh: 16, mrv: 20 },
  glutes:       { label: 'Glutes',           mev: 4,  mavLow: 8,  mavHigh: 12, mrv: 16 },
  calves:       { label: 'Calves',           mev: 8,  mavLow: 12, mavHigh: 16, mrv: 20 },
  abs:          { label: 'Abs',              mev: 4,  mavLow: 16, mavHigh: 20, mrv: 25 }
};

// Returns 'under' | 'mev' | 'mav' | 'mrv' | 'over' for color-coding a weekly total.
// `landmarksOverride`, if given, is a per-user retuned {mev, mavLow, mavHigh, mrv}
// for this muscle group (see Settings > Volume Landmarks) -- falls back to the
// stock VOLUME_LANDMARKS entry when absent.
function classifyVolume(muscleGroup, weeklySets, landmarksOverride) {
  const lm = landmarksOverride || VOLUME_LANDMARKS[muscleGroup];
  if (!lm) return 'under';
  if (weeklySets < lm.mev) return 'under';        // red-ish: below minimum effective
  if (weeklySets < lm.mavLow) return 'mev';        // yellow: at/above MEV, building toward MAV
  if (weeklySets <= lm.mavHigh) return 'mav';      // green: in the productive MAV range
  if (weeklySets <= lm.mrv) return 'high';         // orange: above MAV, approaching MRV
  return 'over';                                    // red: over MRV, junk volume/overreaching
}

if (typeof module !== 'undefined') module.exports = { VOLUME_LANDMARKS, classifyVolume };
