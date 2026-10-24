// ===============================================================
// NOISE module definition
// ===============================================================
//
// The only module whose reference data is complete in the
// specification: all eight ambient limits are published there, and
// the formula is a subtraction.
//
//   Exceedance (dB) = measured ambient Leq - applicable limit
//
// The zone is NOT a parameter here. It is already recorded on
// project_locations.area_classification (migration 004), whose
// CHECK carries the same four categories, and the engine receives
// it as assessment context. Asking for it twice would let the two
// answers disagree.
//
// What this module must never do, in the specification's words:
// "do not predict sound level from distance alone without a
// validated model". There is therefore no source-combination or
// attenuation output, and the 33 equipment sound-power levels in
// the old knowledge base are not seeded.
// ===============================================================

const SOURCE = "Central Pollution Control Board";
const CITATION =
  "Noise Pollution (Regulation and Control) Rules, 2000, Schedule - "
  + "ambient air quality standards in respect of noise, as published by CPCB";
const URL = "https://cpcb.nic.in/noise-pollution/";

// Day is 06:00-22:00 and night 22:00-06:00, per the same Schedule.
const ZONE_LIMITS = [
  ["INDUSTRIAL", "Industrial", 75, 70],
  ["COMMERCIAL", "Commercial", 65, 55],
  ["RESIDENTIAL", "Residential", 55, 45],
  ["SILENCE", "Silence Zone", 50, 40],
];

function limits() {
  const rows = [];
  for (const [key, zone, day, night] of ZONE_LIMITS) {
    for (const [period, subject, value] of [
      ["day", "leq_day", day],
      ["night", "leq_night", night],
    ]) {
      rows.push({
        code: `NOISE_LIMIT_${key}_${period.toUpperCase()}`,
        label: `${zone} ambient noise limit, ${period}`,
        subject,
        selector: { zone, period },
        comparison: "max",
        value,
        value_max: null,
        unit: "dB(A)",
        is_index: false,
        source: SOURCE,
        citation: CITATION,
        source_url: URL,
        version: "Noise Rules 2000",
        effective_from: "2000-02-14",
        notes:
          "A measured ambient limit, not a permitted project contribution. "
          + "Verify the actual notified zone designation for the site.",
      });
    }
  }
  return rows;
}

module.exports = {
  module: {
    code: "NOISE",
    name: "Noise",
    purpose:
      "Compare a measured ambient Leq against the notified limit for the "
      + "site's area category and time period.",
    description:
      "Reports the applicable ambient limit, the measured level and the "
      + "exceedance in dB. It does not predict project-generated noise.",
    display_order: 10,
    enabled: true,
  },

  parameters: [
    {
      code: "leq_day",
      label: "Measured ambient Leq, day",
      unit: "dB(A)",
      value_type: "numeric",
      required: true,
      display_order: 10,
      help_text:
        "Day period is 06:00-22:00. Use a traceable sound-level meter "
        + "reading or a monitoring report, not an estimate.",
    },
    {
      code: "leq_night",
      label: "Measured ambient Leq, night",
      unit: "dB(A)",
      value_type: "numeric",
      required: true,
      display_order: 20,
      help_text: "Night period is 22:00-06:00.",
    },
    {
      code: "noise_measurement_location",
      label: "Measurement location",
      unit: null,
      value_type: "text",
      required: false,
      display_order: 30,
      help_text:
        "Where the meter stood, and its position relative to the site "
        + "boundary and the nearest receptor.",
    },
    {
      code: "noise_measurement_datetime",
      label: "Measurement date and time",
      unit: null,
      value_type: "text",
      required: false,
      display_order: 40,
      help_text: "Including the duration over which Leq was integrated.",
    },
  ],

  // Nothing is multiplied in this module, so it has no constants.
  constants: [],

  limits: limits(),

  outputs: [
    {
      code: "noise_exceedance_day",
      label: "Daytime exceedance",
      unit: "dB",
      formula_text: "Exceedance (dB) = measured day Leq - applicable day limit",
      operation: "difference",
      comparable: true,
      display_order: 10,
      limitation_note:
        "A positive value means the measured ambient level is above the "
        + "notified limit. This is a measured condition, not a prediction "
        + "of future project noise.",
    },
    {
      code: "noise_exceedance_night",
      label: "Night-time exceedance",
      unit: "dB",
      formula_text:
        "Exceedance (dB) = measured night Leq - applicable night limit",
      operation: "difference",
      comparable: true,
      display_order: 20,
      limitation_note:
        "A positive value means the measured ambient level is above the "
        + "notified limit. Night operation and nearby receptors should be "
        + "flagged separately.",
    },
  ],
};
