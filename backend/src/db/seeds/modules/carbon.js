// ===============================================================
// CARBON module definition
// ===============================================================
//
//   Grid CO2 (t)   = electricity (MWh) x CEA grid factor
//                    where MWh = kWh / 1,000
//   Fuel CO2 (t)   = fuel quantity x matching fuel factor
//   Total          = grid + fuel + other quantified sources
//   Intensity      = total / annual output
//
// The thirteen constants below are the only ones in the project
// that were ever usable by an engine: they are the rows that carry
// an input parameter, an expected input unit and a result unit.
// The other 42 rows of the old knowledge base had none of the
// three and are not carried over.
//
// FOSSIL AND BIOGENIC ARE KEPT APART. The 2006 IPCC Guidelines
// record CO2 from biomass combustion as an information item and
// not in the national total, so wood and agro-residue carry
// {"carbon_pool":"biogenic"} and are summed into their own output.
// Adding them to the fossil total would overstate it.
//
// EVERY FUEL IS ON A MASS BASIS. The IPCC defaults are per tonne,
// derived from a calorific value per tonne, so each fuel question
// asks for tonnes per year. Asking for diesel in kilolitres would
// need a density, which the specification does not supply and
// which we will not invent.
//
// LABELLED tCO2, NOT tCO2e. These factors quantify CO2 only. The
// specification: "If the factor reports CO2 only, label the result
// tCO2, not tCO2e."
// ===============================================================

const IPCC_SOURCE = "Intergovernmental Panel on Climate Change";
const IPCC_CITATION =
  "2006 IPCC Guidelines for National Greenhouse Gas Inventories, Volume 2 "
  + "(Energy), Chapter 1: Table 1.2 default net calorific values and "
  + "Table 1.4 default CO2 emission factors for combustion";
const IPCC_URL = "https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html";

// [code suffix, label, parameter, kg CO2/TJ (Table 1.4),
//  TJ/Gg (Table 1.2), biogenic]
//
// value = ef_kg_per_tj x ncv_tj_per_gg / 1e6, in t CO2 per tonne of fuel.
// Both terms are IPCC defaults, not India-specific measurements, so every
// row below is a documented proxy rather than a national factor.
const FUELS = [
  ["COAL_BITUMINOUS", "Other bituminous coal", "coal_consumption", 94600, 25.8, false],
  ["COAL_SUBBITUMINOUS", "Sub-bituminous coal", "sub_bituminous_coal_consumption", 96100, 18.9, false],
  ["LIGNITE", "Lignite", "lignite_consumption", 101000, 11.9, false],
  ["DIESEL", "Gas/diesel oil", "diesel_consumption", 74100, 43.0, false],
  ["PETROL", "Motor gasoline", "petrol_consumption", 69300, 44.3, false],
  ["LPG", "Liquefied petroleum gases", "lpg_consumption", 63100, 47.3, false],
  ["NATURAL_GAS", "Natural gas", "natural_gas_consumption", 56100, 48.0, false],
  ["FUEL_OIL", "Residual fuel oil", "fuel_oil_consumption", 77400, 40.4, false],
  ["KEROSENE", "Other kerosene", "kerosene_consumption", 71900, 43.8, false],
  ["PETROLEUM_COKE", "Petroleum coke", "petroleum_coke_consumption", 97500, 32.5, false],
  ["WOOD_BIOMASS", "Wood and wood waste", "biomass_consumption", 112000, 15.6, true],
  ["SOLID_BIOMASS_OTHER", "Other primary solid biomass", "agro_residue_consumption", 100000, 11.6, true],
];

function round10(n) {
  // The derived factor is exact to six decimals; this trims float noise
  // without changing the published arithmetic.
  return Number(n.toFixed(10));
}

function fuelConstants() {
  return FUELS.map(([suffix, name, parameter, ef, ncv, biogenic]) => ({
    code: `CARBON_${suffix}_IPCC_2006`,
    label: `${name} CO2 emission factor`,
    value: round10((ef * ncv) / 1e6),
    unit: "t CO2/t",
    applies_to: parameter,
    expects_unit: "t/year",
    result_unit: "t CO2/year",
    tags: {
      // The engine selects fuels by source_category and then splits them by
      // carbon_pool, which is how biogenic CO2 stays out of the total.
      source_category: "fuel_combustion",
      carbon_pool: biogenic ? "biogenic" : "fossil",
      status: "PROXY",
      ipcc_fuel: name,
      ef_kg_co2_per_tj: ef,
      ncv_tj_per_gg: ncv,
    },
    source: IPCC_SOURCE,
    citation: IPCC_CITATION,
    source_url: IPCC_URL,
    version: "IPCC 2006",
    verified: false,
    notes:
      `Derived: ${ef} kg CO2/TJ (Table 1.4) x ${ncv} TJ/Gg (Table 1.2) / 1e6 `
      + `= ${round10((ef * ncv) / 1e6)} t CO2 per tonne of fuel. Both terms are `
      + "IPCC defaults, not India-specific values."
      + (biogenic
        ? " Biogenic CO2: the 2006 Guidelines record biomass combustion CO2 "
          + "as an information item, not in the national total. Reported "
          + "separately from fossil CO2."
        : ""),
  }));
}

const GRID_CONSTANT = {
  code: "CARBON_GRID_CEA",
  label:
    "CEA all-India weighted-average grid emission factor "
    + "(including renewables and captive, excluding imports)",
  value: 0.7117,
  unit: "t CO2/MWh",
  applies_to: "grid_electricity",
  // The question asks for kWh because that is what an electricity bill
  // shows. The engine divides by 1,000 before applying this factor, which
  // is the one conversion the specification states explicitly.
  expects_unit: "MWh/year",
  result_unit: "t CO2/year",
  // source_category keeps this out of the fuel-combustion sum: it is tagged
  // fossil, but it is grid electricity and has its own output.
  tags: {
    source_category: "grid_electricity",
    carbon_pool: "fossil",
    status: "OFFICIAL_REFERENCE",
  },
  source: "Central Electricity Authority",
  citation:
    "CEA CDM CO2 Baseline Database for the Indian Power Sector, "
    + "weighted average emission rate (combined margin basis not applied)",
  source_url: "https://cea.nic.in/cdm-co2-baseline-database/?lang=en",
  version: "v21.0",
  verified: false,
  notes:
    "NEEDS UPDATING. This is Version 21.0. The specification records that "
    + "CEA's database page currently lists Version 22.0 and instructs: 'Use "
    + "the current downloadable spreadsheet and user guide, record the "
    + "version/date and choose the factor appropriate to the calculation "
    + "method. Do not hardcode an old factor.' The v22.0 value is not "
    + "published in the specification and has not been invented here. Until "
    + "someone downloads v22.0 and replaces this row, every grid result is "
    + "marked provisional.",
};

module.exports = {
  module: {
    code: "CARBON",
    name: "Carbon",
    purpose:
      "Quantify annual CO2 from grid electricity and fuel combustion using "
      + "published emission factors.",
    description:
      "Reports tCO2, separating fossil from biogenic. There is no universal "
      + "legal pass/fail tonnage, so no threshold is applied.",
    display_order: 30,
    enabled: true,
  },

  parameters: [
    {
      code: "grid_electricity",
      label: "Grid electricity consumption",
      unit: "kWh/year",
      value_type: "numeric",
      required: false,
      display_order: 10,
      help_text:
        "Purchased grid electricity for one reporting year, from bills or a "
        + "design estimate. Electricity generated on site from fuel belongs "
        + "under that fuel instead, or it is counted twice.",
    },
    ...FUELS.map(([, name, parameter], index) => ({
      code: parameter,
      label: `${name} consumption`,
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order: 20 + index * 10,
      help_text:
        "Tonnes per year. The IPCC default factor is per tonne of fuel, so a "
        + "volume cannot be used without a sourced density.",
    })),
    {
      code: "annual_production",
      label: "Annual output",
      unit: "t/year",
      value_type: "numeric",
      required: false,
      display_order: 200,
      help_text:
        "The denominator for every intensity figure, in tonnes of product "
        + "per year. Shared with the Resource efficiency module.",
    },
    {
      code: "production_description",
      label: "What the output is",
      unit: null,
      value_type: "text",
      required: false,
      display_order: 210,
      help_text:
        "For example 'tonnes of OPC cement' or 'tonnes of crude steel'. An "
        + "intensity figure is meaningless without naming its product, and "
        + "two sectors' intensities are not comparable.",
    },
  ],

  constants: [...fuelConstants(), GRID_CONSTANT],

  limits: [],

  outputs: [
    {
      code: "carbon_grid_electricity",
      label: "Grid electricity emissions",
      unit: "t CO2/year",
      formula_text:
        "Grid CO2 (t) = electricity (MWh) x CEA grid factor, "
        + "where MWh = kWh / 1,000",
      operation: "product",
      comparable: false,
      display_order: 10,
      limitation_note:
        "tCO2, not tCO2e: the CEA factor quantifies CO2 only. Provisional "
        + "while the seeded factor is Version 21.0 and CEA publishes 22.0.",
    },
    {
      code: "carbon_fuel_fossil",
      label: "Fossil fuel combustion emissions",
      unit: "t CO2/year",
      formula_text:
        "Fuel CO2 (t) = sum over fossil fuels of "
        + "(quantity x matching IPCC factor)",
      operation: "sum",
      comparable: false,
      display_order: 20,
      limitation_note:
        "IPCC 2006 default factors and default calorific values, not "
        + "India-specific measurements. Labelled an estimate.",
    },
    {
      code: "carbon_fuel_biogenic",
      label: "Biogenic CO2 from biomass",
      unit: "t CO2/year",
      formula_text:
        "Biogenic CO2 (t) = sum over biomass fuels of "
        + "(quantity x matching IPCC factor)",
      operation: "sum",
      comparable: false,
      display_order: 30,
      limitation_note:
        "Reported separately and deliberately excluded from the total. The "
        + "2006 IPCC Guidelines treat biomass combustion CO2 as an "
        + "information item, not part of the inventory total.",
    },
    {
      code: "carbon_total",
      label: "Total quantified fossil CO2",
      unit: "t CO2/year",
      formula_text:
        "Total = grid electricity emissions + fossil fuel emissions",
      operation: "sum",
      comparable: false,
      display_order: 40,
      limitation_note:
        "The sum of the sources that could be quantified, and not a complete "
        + "carbon footprint. Process emissions are absent because no process "
        + "emission factor is available. Operational only: construction "
        + "emissions are not included.",
    },
    {
      code: "carbon_intensity",
      label: "Carbon intensity",
      unit: "t CO2/t",
      formula_text: "Carbon intensity = total fossil CO2 / annual output",
      operation: "ratio",
      comparable: false,
      display_order: 50,
      limitation_note:
        "No universal intensity threshold exists across sectors. Compare "
        + "only against a sourced sector benchmark or a clearly labelled "
        + "project target, and only for the same product and output unit.",
    },
  ],
};
