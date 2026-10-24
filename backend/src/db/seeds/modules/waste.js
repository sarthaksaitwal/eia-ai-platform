// ===============================================================
// WASTE module definition
// ===============================================================
//
//   Total waste        = sum of quantities across streams
//   Recovery (%)       = (reused + recycled) / total waste x 100
//   Disposal share (%) = sent to disposal    / total waste x 100
//
// Three outputs, no constants.
//
// THE STREAMS ARE KEPT SEPARATE in the questions even though the
// total adds them, because the legal obligation follows the
// category and not the tonnage. Hazardous, construction and
// demolition, municipal solid, plastic, e-waste and biomedical
// waste each fall under their own rules.
//
// NO LEGAL TRIGGER IS ENCODED. The specification lists the CPCB
// portal's bulk-generator criteria - floor area 20,000 m2 OR water
// use 40,000 L/day OR solid waste 100 kg/day under the Solid Waste
// Management Rules, 2026 - and then says to "verify the exact
// current rule text, definitions and applicability before encoding
// as a legal trigger". It also warns against applying a municipal
// trigger to every stream. So those numbers are not seeded as
// limits, and this module computes quantities only:
// "Do not infer compliance from quantity alone."
// ===============================================================

// [code, label, display order, help text]
const STREAMS = [
  [
    "waste_hazardous",
    "Hazardous waste",
    10,
    "Under the Hazardous and Other Wastes (Management and Transboundary "
      + "Movement) Rules. Record the category and the authorised facility.",
  ],
  [
    "waste_non_hazardous",
    "Non-hazardous industrial waste",
    20,
    "Process waste that falls outside the hazardous categories.",
  ],
  [
    "waste_municipal",
    "Municipal solid waste",
    30,
    "Canteen, office and general site waste.",
  ],
  [
    "waste_construction_demolition",
    "Construction and demolition waste",
    40,
    "Under the Construction and Demolition Waste Management Rules, which are "
      + "separate from the municipal rules.",
  ],
  [
    "waste_plastic",
    "Plastic waste",
    50,
    "Including packaging, which may carry extended producer responsibility.",
  ],
  ["waste_ewaste", "E-waste", 60, "Under the E-Waste (Management) Rules."],
  [
    "waste_biomedical",
    "Biomedical waste",
    70,
    "Only where an on-site medical facility generates it.",
  ],
];

module.exports = {
  module: {
    code: "WASTE",
    name: "Waste",
    purpose:
      "Quantify waste by stream and calculate the recovery rate and disposal "
      + "share.",
    description:
      "Quantities and ratios only. Legal obligations depend on the waste "
      + "category and the current rules, and are not derived from tonnage.",
    display_order: 50,
    enabled: true,
  },

  parameters: [
    ...STREAMS.map(([code, label, display_order, help_text]) => ({
      code,
      label,
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order,
      help_text: `${help_text} Tonnes per year, same basis as every other stream.`,
    })),
    {
      code: "waste_reused",
      label: "Quantity reused",
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order: 100,
      help_text:
        "Returned to use without reprocessing. Keep separate from recycled "
        + "quantity so neither is double counted.",
    },
    {
      code: "waste_recycled",
      label: "Quantity recycled",
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order: 110,
      help_text:
        "Sent for reprocessing into new material, supported by contractor or "
        + "facility records where available.",
    },
    {
      code: "waste_disposed",
      label: "Quantity sent to disposal",
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order: 120,
      help_text:
        "Landfilled, incinerated without recovery, or otherwise disposed of. "
        + "Name the authorised destination in the source reference.",
    },
    {
      code: "waste_disposal_destination",
      label: "Disposal destination",
      unit: null,
      value_type: "text",
      required: false,
      display_order: 130,
      help_text:
        "The authorised facility or route, with its authorisation reference "
        + "if known.",
    },
  ],

  constants: [],

  limits: [],

  outputs: [
    {
      code: "waste_total",
      label: "Total waste generated",
      unit: "t/year",
      formula_text: "Total waste = sum of quantities across all streams",
      operation: "sum",
      comparable: false,
      display_order: 10,
      limitation_note:
        "The sum of whichever streams were entered, on a common tonnes-per-"
        + "year basis. Streams left blank are reported as absent, not zero.",
    },
    {
      code: "waste_recovery_rate",
      label: "Recovery rate",
      unit: "%",
      formula_text:
        "Recovery (%) = (reused + recycled quantity) / total waste x 100",
      operation: "ratio",
      comparable: false,
      display_order: 20,
      limitation_note:
        "No universal recovery percentage applies to every project. A "
        + "recovery rate does not establish legal compliance, which depends "
        + "on the category and the authorised handling route.",
    },
    {
      code: "waste_disposal_share",
      label: "Disposal share",
      unit: "%",
      formula_text:
        "Disposal share (%) = quantity sent to disposal / total waste x 100",
      operation: "ratio",
      comparable: false,
      display_order: 30,
      limitation_note:
        "Check that reuse, recycling and disposal quantities do not overlap; "
        + "together they should not exceed the total.",
    },
  ],
};
