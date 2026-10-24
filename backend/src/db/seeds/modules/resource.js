// ===============================================================
// RESOURCE EFFICIENCY module definition
// ===============================================================
//
//   Electricity intensity = annual kWh / annual output
//   Water intensity       = annual m3  / annual output
//   Material recovery (%) = recovered mass / total material input x 100
//   Renewable share   (%) = renewable kWh / total kWh x 100
//
// Four ratios, no constants. These are the clearest demonstration
// that a calculation does not need reference data: each is two
// numbers the user supplies and a division.
//
// It reuses grid_electricity and annual_production from the Carbon
// module rather than asking again. Parameter codes are globally
// unique for exactly this reason - one question, asked once,
// available to every module that needs it.
//
// Total electricity is grid + on-site renewable, which is also the
// denominator of the renewable share. Entering renewable
// generation separately is what makes both figures possible; a
// single "total electricity" question would make neither.
//
// No benchmark is seeded. The specification is unambiguous: "No
// universal cross-sector pass/fail benchmark is defined." The
// numbers are reported with no threshold attached.
// ===============================================================

module.exports = {
  module: {
    code: "RESOURCE",
    name: "Resource efficiency",
    purpose:
      "Calculate electricity and water intensity per unit of output, plus "
      + "material recovery and renewable electricity share.",
    description:
      "Project-specific indicators, not regulatory pass/fail measures. No "
      + "cross-sector benchmark exists, so none is applied.",
    display_order: 40,
    enabled: true,
  },

  parameters: [
    {
      code: "renewable_electricity",
      label: "Renewable electricity",
      unit: "kWh/year",
      value_type: "numeric",
      required: false,
      display_order: 10,
      help_text:
        "On-site generation or contracted renewable supply for the same year "
        + "as the grid figure. Record in the assumption field whether this is "
        + "on-site, purchased or certificate-based; the three are not "
        + "interchangeable.",
    },
    {
      code: "annual_water_use",
      label: "Annual water use",
      unit: "m3/year",
      value_type: "numeric",
      required: false,
      display_order: 20,
      help_text:
        "Total annual abstraction across all sources. This is an annual "
        + "figure and is a separate question from the daily demand in the "
        + "Water module, because an intensity built from two different "
        + "periods would be wrong.",
    },
    {
      code: "material_input",
      label: "Total material input",
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order: 30,
      help_text:
        "Raw material entering the process in a year, from the bill of "
        + "quantities or process design.",
    },
    {
      code: "material_recovered",
      label: "Material recovered or reused",
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order: 40,
      help_text:
        "Mass recovered or reused on the same basis as the input figure. It "
        + "cannot exceed the input unless the boundary definition explains "
        + "why.",
    },
  ],

  constants: [],

  limits: [],

  outputs: [
    {
      code: "electricity_intensity",
      label: "Electricity intensity",
      unit: "kWh/t",
      formula_text:
        "Electricity intensity = (grid + renewable electricity) / annual output",
      operation: "ratio",
      comparable: false,
      display_order: 10,
      limitation_note:
        "The output unit must be explicit. Intensities for different "
        + "products, sectors or output units are not comparable.",
    },
    {
      code: "water_intensity",
      label: "Water intensity",
      unit: "m3/t",
      formula_text: "Water intensity = annual water use / annual output",
      operation: "ratio",
      comparable: false,
      display_order: 20,
      limitation_note:
        "Compare only like-for-like sectors and output units.",
    },
    {
      code: "material_recovery_rate",
      label: "Material recovery rate",
      unit: "%",
      formula_text:
        "Material recovery (%) = recovered mass / total material input x 100",
      operation: "ratio",
      comparable: false,
      display_order: 30,
      limitation_note:
        "A value above 100% means the numerator and denominator are on "
        + "different boundaries and should be checked before use.",
    },
    {
      code: "renewable_share",
      label: "Renewable electricity share",
      unit: "%",
      formula_text:
        "Renewable share (%) = renewable kWh / (grid + renewable) kWh x 100",
      operation: "ratio",
      comparable: false,
      display_order: 40,
      limitation_note:
        "Document whether the renewable figure is on-site, purchased or "
        + "certificate-based. The three support different claims.",
    },
  ],
};
