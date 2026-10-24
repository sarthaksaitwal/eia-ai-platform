// ===============================================================
// WATER module definition
// ===============================================================
//
// Four outputs, no constants. Every formula here is arithmetic on
// values the user supplies:
//
//   Total demand   = sum of demand by use
//   Supply gap     = max(0, total demand - confirmed supply)
//   Wastewater (%) = wastewater generated / water supplied   x 100
//   Reuse (%)      = reused water      / total water demand  x 100
//
// Demand is collected per use and per DAY, which is how the
// specification asks for it. The annual water figure that Resource
// efficiency divides by output is a separate question with a
// separate basis (annual_water_use), because a ratio built from two
// different periods is meaningless.
//
// The CPCB designated-best-use criteria are deliberately NOT
// seeded as limits here. They apply to a measured laboratory result
// for a water sample, and there is no input path for lab results
// yet. Seeding them now would let the engine appear to compare
// something it has never been given. They arrive with the
// water-quality input form.
// ===============================================================

module.exports = {
  module: {
    code: "WATER",
    name: "Water",
    purpose:
      "Calculate water demand, the gap against confirmed supply, and the "
      + "wastewater and reuse ratios.",
    description:
      "Quantity indicators only. Comparing a water sample against the CPCB "
      + "designated-best-use criteria needs laboratory results, which are "
      + "collected separately.",
    display_order: 20,
    enabled: true,
  },

  parameters: [
    {
      code: "water_demand_domestic",
      label: "Domestic water demand",
      unit: "m3/day",
      value_type: "numeric",
      required: false,
      display_order: 10,
      help_text:
        "Drinking, sanitation and canteen use. CPHEEO plans domestic supply "
        + "at 135 litres per capita per day for a town with sewerage; that is "
        + "a planning reference, not a limit.",
    },
    {
      code: "water_demand_process",
      label: "Process water demand",
      unit: "m3/day",
      value_type: "numeric",
      required: false,
      display_order: 20,
    },
    {
      code: "water_demand_cooling",
      label: "Cooling water demand",
      unit: "m3/day",
      value_type: "numeric",
      required: false,
      display_order: 30,
      help_text: "Make-up water for cooling, not the circulating volume.",
    },
    {
      code: "water_demand_other",
      label: "Other water demand",
      unit: "m3/day",
      value_type: "numeric",
      required: false,
      display_order: 40,
      help_text: "Dust suppression, greenbelt irrigation, washing.",
    },
    {
      code: "water_confirmed_supply",
      label: "Confirmed available supply",
      unit: "m3/day",
      value_type: "numeric",
      required: true,
      display_order: 50,
      help_text:
        "Only quantity with a source and permission behind it: a municipal "
        + "sanction, a CGWA permit, a surface-water allocation. An uncertain "
        + "supply must be recorded as unavailable rather than entered as zero.",
    },
    {
      code: "water_supplied",
      label: "Water actually supplied",
      unit: "m3/day",
      value_type: "numeric",
      required: false,
      display_order: 60,
      help_text:
        "The denominator of the wastewater ratio. Metered intake where "
        + "available, on the same period as the wastewater figure.",
    },
    {
      code: "wastewater_generated",
      label: "Wastewater generated",
      unit: "m3/day",
      value_type: "numeric",
      required: false,
      display_order: 70,
      help_text: "Measured flow, or a design estimate labelled as such.",
    },
    {
      code: "water_reused",
      label: "Water reused or recycled",
      unit: "m3/day",
      value_type: "numeric",
      required: false,
      display_order: 80,
      help_text: "Treated water returned to use, from meter records or design.",
    },
  ],

  constants: [],

  limits: [],

  outputs: [
    {
      code: "water_total_demand",
      label: "Total water demand",
      unit: "m3/day",
      formula_text:
        "Total demand = domestic + process + cooling + other demand",
      operation: "sum",
      comparable: false,
      display_order: 10,
      limitation_note:
        "The sum of whichever uses were entered. Uses left blank are "
        + "reported as absent, not treated as zero.",
    },
    {
      code: "water_supply_gap",
      label: "Supply gap",
      unit: "m3/day",
      formula_text: "Supply gap = max(0, total demand - confirmed supply)",
      operation: "clamped",
      comparable: false,
      display_order: 20,
      limitation_note:
        "A gap of zero means confirmed supply meets calculated demand. It is "
        + "not a statement that the source is sustainable.",
    },
    {
      code: "wastewater_ratio",
      label: "Wastewater ratio",
      unit: "%",
      formula_text:
        "Wastewater ratio (%) = wastewater generated / water supplied x 100",
      operation: "ratio",
      comparable: false,
      display_order: 30,
      limitation_note:
        "A value above 100% is physically implausible on the same basis and "
        + "should be investigated rather than reported.",
    },
    {
      code: "water_reuse_ratio",
      label: "Reuse ratio",
      unit: "%",
      formula_text:
        "Reuse ratio (%) = reused water / total water demand x 100",
      operation: "ratio",
      comparable: false,
      display_order: 40,
    },
  ],
};
