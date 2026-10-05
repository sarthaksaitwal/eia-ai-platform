"""
Builds the collected reference-data CSVs in this folder from source values that
were transcribed, in this script, from the documents cited in SOURCES below.

Run:  python build_collected.py

Every number in this file was read out of the cited document. Nothing is
estimated, interpolated or recalled. Where a value could not be read from a
source, the row is absent and COLLECTION_REPORT.md says so.

`verified` is FALSE on every row. Transcription is not verification: a named
person still has to check each value against the cited document and then set
verified / verified_by / verified_on. See COLUMN_GUIDE.md.
"""
import csv
import os

HERE = os.path.dirname(os.path.abspath(__file__))

SOURCES = {
    "naaqs": dict(
        standard_name="NAAQS 2009",
        authority="CPCB",
        reference="CPCB Notification No. B-29016/20/90/PCI-L, New Delhi, 18 November 2009, "
                  "National Ambient Air Quality Standards (in supersession of S.O. 384(E) "
                  "dated 11.04.1994 and S.O. 935(E) dated 14.10.1998)",
        effective_from="2009-11-18",
    ),
    "dbu": dict(
        standard_name="CPCB Designated Best Use",
        authority="CPCB",
        reference="CPCB, Designated Best Use Water Quality Criteria "
                  "(cpcb.gov.in/wqm/Designated_Best_Use_Water_Quality_Criteria.pdf)",
        effective_from="",
    ),
    "schedule6": dict(
        standard_name="EP Rules 1986 Schedule VI",
        authority="MoEFCC",
        reference="Environment (Protection) Rules, 1986, Schedule VI, Part-A: Effluents "
                  "(inserted by G.S.R. 422(E) dated 19.05.1993; BOD basis substituted by "
                  "G.S.R. 176 dated 02.04.1996)",
        effective_from="1993-05-19",
    ),
    "is10500": dict(
        standard_name="IS 10500:2012",
        authority="BIS",
        reference="IS 10500:2012 Drinking Water - Specification, as reproduced in the "
                  "Arghyam presentation hosted by India Water Portal and cross-checked "
                  "against infralens.in/code/IS-10500-2012. NOT read from the BIS standard "
                  "itself.",
        effective_from="",
    ),
}

IPCC_REF = ("2006 IPCC Guidelines for National Greenhouse Gas Inventories, Volume 2 "
            "(Energy), Chapter 1: Table 1.2 default net calorific values and Table 1.4 "
            "default CO2 emission factors for combustion")

NAAQS_ZONES = (
    ("Industrial, Residential, Rural and Other Area", "ind"),
    ("Ecologically Sensitive Area", "eco"),
)

# (parameter_name, display_name, unit, {averaging_period: (industrial, ecologically_sensitive)})
NAAQS = [
    ("so2", "Sulphur Dioxide (SO2)", "ug/m3", {"Annual": (50, 20), "24 hours": (80, 80)}),
    ("no2", "Nitrogen Dioxide (NO2)", "ug/m3", {"Annual": (40, 30), "24 hours": (80, 80)}),
    ("pm10", "PM10", "ug/m3", {"Annual": (60, 60), "24 hours": (100, 100)}),
    ("pm25", "PM2.5", "ug/m3", {"Annual": (40, 40), "24 hours": (60, 60)}),
    ("o3", "Ozone (O3)", "ug/m3", {"8 hours": (100, 100), "1 hour": (180, 180)}),
    ("lead", "Lead (Pb)", "ug/m3", {"Annual": (0.5, 0.5), "24 hours": (1.0, 1.0)}),
    ("co", "Carbon Monoxide (CO)", "mg/m3", {"8 hours": (2, 2), "1 hour": (4, 4)}),
    ("nh3", "Ammonia (NH3)", "ug/m3", {"Annual": (100, 100), "24 hours": (400, 400)}),
    ("benzene", "Benzene (C6H6)", "ug/m3", {"Annual": (5, 5)}),
    ("benzo_a_pyrene", "Benzo(a)Pyrene", "ng/m3", {"Annual": (1, 1)}),
    ("arsenic", "Arsenic (As)", "ng/m3", {"Annual": (6, 6)}),
    ("nickel", "Nickel (Ni)", "ng/m3", {"Annual": (20, 20)}),
]

NAAQS_NOTE_ANNUAL = ("Annual arithmetic mean of a minimum of 104 measurements in a year at a "
                     "particular site, taken twice a week 24-hourly at uniform intervals.")
NAAQS_NOTE_SHORT = ("24-hourly / 8-hourly / 1-hourly values shall be complied with 98% of the "
                    "time in a year; 2% of the time they may exceed the limit but not on two "
                    "consecutive days of monitoring.")

# CPCB designated-best-use classes.
# (zone, [(parameter_name, display_name, limit_type, value, unit)])
DBU = [
    ("Class A - Drinking water source without conventional treatment but after disinfection", [
        ("total_coliform", "Total coliform organisms", "maximum", 50, "MPN/100ml"),
        ("ph", "pH", "minimum", 6.5, "pH"),
        ("ph", "pH", "maximum", 8.5, "pH"),
        ("do", "Dissolved oxygen", "minimum", 6, "mg/l"),
        ("bod", "BOD (5 days, 20 C)", "maximum", 2, "mg/l"),
    ]),
    ("Class B - Outdoor bathing (organised)", [
        ("total_coliform", "Total coliform organisms", "maximum", 500, "MPN/100ml"),
        ("ph", "pH", "minimum", 6.5, "pH"),
        ("ph", "pH", "maximum", 8.5, "pH"),
        ("do", "Dissolved oxygen", "minimum", 5, "mg/l"),
        ("bod", "BOD (5 days, 20 C)", "maximum", 3, "mg/l"),
    ]),
    ("Class C - Drinking water source after conventional treatment and disinfection", [
        ("total_coliform", "Total coliform organisms", "maximum", 5000, "MPN/100ml"),
        ("ph", "pH", "minimum", 6, "pH"),
        ("ph", "pH", "maximum", 9, "pH"),
        ("do", "Dissolved oxygen", "minimum", 4, "mg/l"),
        ("bod", "BOD (5 days, 20 C)", "maximum", 3, "mg/l"),
    ]),
    ("Class D - Propagation of wildlife and fisheries", [
        ("ph", "pH", "minimum", 6.5, "pH"),
        ("ph", "pH", "maximum", 8.5, "pH"),
        ("do", "Dissolved oxygen", "minimum", 4, "mg/l"),
        ("free_ammonia", "Free ammonia (as N)", "maximum", 1.2, "mg/l"),
    ]),
    ("Class E - Irrigation, industrial cooling, controlled waste disposal", [
        ("ph", "pH", "minimum", 6.0, "pH"),
        ("ph", "pH", "maximum", 8.5, "pH"),
        ("electrical_conductivity", "Electrical conductivity at 25 C", "maximum", 2250,
         "micromhos/cm"),
        ("sodium_absorption_ratio", "Sodium absorption ratio", "maximum", 26, "ratio"),
        ("boron", "Boron", "maximum", 2, "mg/l"),
    ]),
]

# Schedule VI Part A. None means the schedule prints "--" for that route.
SCHEDULE6_ZONES = ("Effluent discharge - Inland surface water",
                   "Effluent discharge - Public sewers",
                   "Effluent discharge - Land for irrigation",
                   "Effluent discharge - Marine coastal areas")
# (parameter_name, display_name, unit, limit_type, (inland, sewers, land, marine), note)
SCHEDULE6 = [
    ("suspended_solids", "Suspended solids", "mg/l", "maximum", (100, 600, 200, 100),
     "Marine column: 100 for process waste water; for cooling water effluent, 10 percent "
     "above the total suspended matter of the influent."),
    ("ph", "pH", "pH", "minimum", (5.5, 5.5, 5.5, 5.5), ""),
    ("ph", "pH", "pH", "maximum", (9.0, 9.0, 9.0, 9.0), ""),
    ("temperature_rise", "Temperature rise above receiving water", "deg C", "maximum",
     (5, None, None, 5), "Schedule wording: shall not exceed 5 C above the receiving water "
                         "temperature."),
    ("oil_and_grease", "Oil and grease", "mg/l", "maximum", (10, 20, 10, 20), ""),
    ("total_residual_chlorine", "Total residual chlorine", "mg/l", "maximum",
     (1.0, None, None, 1.0), ""),
    ("ammoniacal_nitrogen", "Ammoniacal nitrogen (as N)", "mg/l", "maximum",
     (50, 50, None, 50), ""),
    ("total_kjeldahl_nitrogen", "Total Kjeldahl nitrogen (as NH3)", "mg/l", "maximum",
     (100, None, None, 100), ""),
    ("free_ammonia", "Free ammonia (as NH3)", "mg/l", "maximum", (5.0, None, None, 5.0), ""),
    ("bod", "BOD (3 days at 27 C)", "mg/l", "maximum", (30, 350, 100, 100),
     "BOD basis substituted to 3 days at 27 C by G.S.R. 176 dated 02.04.1996."),
    ("cod", "COD", "mg/l", "maximum", (250, None, None, 250), ""),
    ("arsenic", "Arsenic (as As)", "mg/l", "maximum", (0.2, 0.2, 0.2, 0.2), ""),
    ("mercury", "Mercury (as Hg)", "mg/l", "maximum", (0.01, 0.01, None, 0.01), ""),
    ("lead", "Lead (as Pb)", "mg/l", "maximum", (0.1, 1.0, None, 2.0), ""),
    ("cadmium", "Cadmium (as Cd)", "mg/l", "maximum", (2.0, 1.0, None, 2.0),
     "Reproduced exactly as printed in Schedule VI."),
    ("hexavalent_chromium", "Hexavalent chromium (as Cr+6)", "mg/l", "maximum",
     (0.1, 2.0, None, 1.0), ""),
    ("total_chromium", "Total chromium (as Cr)", "mg/l", "maximum", (2.0, 2.0, None, 2.0), ""),
    ("copper", "Copper (as Cu)", "mg/l", "maximum", (3.0, 3.0, None, 3.0), ""),
    ("zinc", "Zinc (as Zn)", "mg/l", "maximum", (5.0, 15, None, 15), ""),
    ("selenium", "Selenium (as Se)", "mg/l", "maximum", (0.05, 0.05, None, 0.05), ""),
    ("nickel", "Nickel (as Ni)", "mg/l", "maximum", (3.0, 3.0, None, 5.0), ""),
    ("cyanide", "Cyanide (as CN)", "mg/l", "maximum", (0.2, 2.0, 0.2, 0.2), ""),
    ("fluoride", "Fluoride (as F)", "mg/l", "maximum", (2.0, 15, None, 15), ""),
    ("dissolved_phosphates", "Dissolved phosphates (as P)", "mg/l", "maximum",
     (5.0, None, None, None), ""),
    ("sulphide", "Sulphide (as S)", "mg/l", "maximum", (2.0, None, None, 5.0), ""),
    ("phenolic_compounds", "Phenolic compounds (as C6H5OH)", "mg/l", "maximum",
     (1.0, 5.0, None, 5.0), ""),
    ("alpha_emitter", "Radioactive material - alpha emitter", "microcurie/ml", "maximum",
     (1e-7, 1e-7, 1e-8, 1e-7), ""),
    ("beta_emitter", "Radioactive material - beta emitter", "microcurie/ml", "maximum",
     (1e-6, 1e-6, 1e-7, 1e-6), ""),
]
SCHEDULE6_NOT_NUMERIC = [
    "Colour and odour (see item 6 of Annexure-I)",
    "Particulate size of suspended solids (inland: shall pass 850 micron IS sieve; "
    "marine: floatable solids max 3 mm, settleable solids max 850 microns)",
    "Bio-assay test (90 percent survival of fish after 96 hours in 100 percent effluent)",
]

# IS 10500:2012. permissible = None means the standard prints "No relaxation".
# (parameter_name, display_name, unit, limit_type, acceptable, permissible)
IS10500 = [
    ("colour", "Colour", "Hazen units", "maximum", 5, 15),
    ("ph", "pH", "pH", "minimum", 6.5, None),
    ("ph", "pH", "pH", "maximum", 8.5, None),
    ("tds", "Total dissolved solids", "mg/l", "maximum", 500, 2000),
    ("turbidity", "Turbidity", "NTU", "maximum", 1, 5),
    ("total_hardness", "Total hardness (as CaCO3)", "mg/l", "maximum", 200, 600),
    ("aluminium", "Aluminium (as Al)", "mg/l", "maximum", 0.03, 0.2),
    ("ammonia", "Ammonia (as total ammonia-N)", "mg/l", "maximum", 0.5, None),
    ("barium", "Barium (as Ba)", "mg/l", "maximum", 0.7, None),
    ("iron", "Iron (as Fe)", "mg/l", "maximum", 0.3, None),
    ("manganese", "Manganese (as Mn)", "mg/l", "maximum", 0.1, 0.3),
    ("sulphate", "Sulphate (as SO4)", "mg/l", "maximum", 200, 400),
    ("nitrate", "Nitrate (as NO3)", "mg/l", "maximum", 45, None),
    ("chloride", "Chloride (as Cl)", "mg/l", "maximum", 250, 1000),
    ("fluoride", "Fluoride (as F)", "mg/l", "maximum", 1.0, 1.5),
    ("arsenic", "Total arsenic (as As)", "mg/l", "maximum", 0.01, 0.05),
    ("total_chromium", "Total chromium (as Cr)", "mg/l", "maximum", 0.05, None),
    ("copper", "Copper (as Cu)", "mg/l", "maximum", 0.05, 1.5),
    ("cyanide", "Cyanide (as CN)", "mg/l", "maximum", 0.05, None),
    ("lead", "Lead (as Pb)", "mg/l", "maximum", 0.01, None),
    ("mercury", "Mercury (as Hg)", "mg/l", "maximum", 0.001, None),
    ("zinc", "Zinc (as Zn)", "mg/l", "maximum", 5, 15),
    ("total_coliform", "Total coliform bacteria", "MPN/100ml", "maximum", 0, None),
    ("e_coli", "E. coli", "MPN/100ml", "maximum", 0, None),
    ("residual_free_chlorine", "Residual free chlorine", "mg/l", "minimum", 0.2, None),
]
IS10500_ACCEPTABLE = "Drinking water - acceptable limit"
IS10500_PERMISSIBLE = "Drinking water - permissible limit in absence of alternate source"

# IPCC fuel CO2 factors, derived as EF(kg CO2/TJ) x NCV(TJ/Gg) / 1e6 = t CO2 / t fuel.
# (coefficient_code, name, input_parameter, ipcc_fuel, ef_kg_per_tj, ncv_tj_per_gg, biogenic)
FUELS = [
    ("CARBON_COAL_BITUMINOUS_IPCC_2006", "Other bituminous coal CO2 emission factor",
     "coal_consumption", "Other Bituminous Coal", 94600, 25.8, False),
    # A separate input_parameter on purpose: two coefficients sharing coal_consumption
    # with the same factor and result_unit would be ambiguous and the engine would
    # refuse to pick one. The user says which coal they are entering.
    ("CARBON_COAL_SUBBITUMINOUS_IPCC_2006", "Sub-bituminous coal CO2 emission factor",
     "sub_bituminous_coal_consumption", "Sub-Bituminous Coal", 96100, 18.9, False),
    ("CARBON_LIGNITE_IPCC_2006", "Lignite CO2 emission factor",
     "lignite_consumption", "Lignite", 101000, 11.9, False),
    ("CARBON_DIESEL_MASS_IPCC_2006", "Gas/diesel oil CO2 emission factor, mass basis",
     "diesel_consumption", "Gas/Diesel Oil", 74100, 43.0, False),
    ("CARBON_PETROL_MASS_IPCC_2006", "Motor gasoline CO2 emission factor, mass basis",
     "petrol_consumption", "Motor Gasoline", 69300, 44.3, False),
    ("CARBON_LPG_MASS_IPCC_2006", "LPG CO2 emission factor, mass basis",
     "lpg_consumption", "Liquefied Petroleum Gases", 63100, 47.3, False),
    ("CARBON_NATURAL_GAS_MASS_IPCC_2006", "Natural gas CO2 emission factor, mass basis",
     "natural_gas_consumption", "Natural Gas", 56100, 48.0, False),
    ("CARBON_FUEL_OIL_MASS_IPCC_2006", "Residual fuel oil CO2 emission factor, mass basis",
     "fuel_oil_consumption", "Residual Fuel Oil", 77400, 40.4, False),
    ("CARBON_KEROSENE_MASS_IPCC_2006", "Other kerosene CO2 emission factor, mass basis",
     "kerosene_consumption", "Other Kerosene", 71900, 43.8, False),
    ("CARBON_PETROLEUM_COKE_IPCC_2006", "Petroleum coke CO2 emission factor",
     "petroleum_coke_consumption", "Petroleum Coke", 97500, 32.5, False),
    ("CARBON_WOOD_BIOMASS_IPCC_2006", "Wood / wood waste CO2 emission factor",
     "biomass_consumption", "Wood/Wood Waste", 112000, 15.6, True),
    ("CARBON_SOLID_BIOMASS_OTHER_IPCC_2006",
     "Other primary solid biomass CO2 emission factor",
     "agro_residue_consumption", "Other Primary Solid Biomass", 100000, 11.6, True),
]
BIOGENIC_NOTE = ("Biogenic CO2. The 2006 IPCC Guidelines record CO2 from biomass combustion "
                 "as an information item, not in the national total; report it separately "
                 "from fossil CO2.")

STD_HEADER = ["category", "parameter_name", "display_name", "standard_name", "zone",
              "averaging_period", "limit_type", "limit_value", "unit", "authority",
              "reference", "effective_from", "effective_to", "active", "verified",
              "verified_by", "verified_on", "notes"]

COEF_HEADER = ["industry", "factor", "coefficient_code", "coefficient_name",
               "input_parameter", "input_unit", "value", "unit", "result_unit", "source",
               "reference", "methodology_version", "conditions", "effective_from",
               "effective_to", "active", "verified", "verified_by", "verified_on", "notes"]


def num(value):
    """Print a number without inventing or losing precision."""
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return repr(value) if isinstance(value, float) else str(value)


def std_row(category, parameter_name, display_name, src, zone, period, limit_type,
            value, unit, notes=""):
    s = SOURCES[src]
    return [category, parameter_name, display_name, s["standard_name"], zone, period,
            limit_type, num(value), unit, s["authority"], s["reference"],
            s["effective_from"], "", "TRUE", "FALSE", "", "", notes]


def build_standards():
    rows = []

    for parameter_name, display_name, unit, periods in NAAQS:
        for period, values in periods.items():
            note = NAAQS_NOTE_ANNUAL if period == "Annual" else NAAQS_NOTE_SHORT
            for (zone, which), value in zip(NAAQS_ZONES, values):
                rows.append(std_row("Air", parameter_name, display_name, "naaqs", zone,
                                    period, "maximum", value, unit, note))

    for zone, criteria in DBU:
        for parameter_name, display_name, limit_type, value, unit in criteria:
            rows.append(std_row("Water", parameter_name, display_name, "dbu", zone,
                                "Not applicable", limit_type, value, unit,
                                "Primary water quality criterion for this designated best "
                                "use; it is a criterion for the receiving water body, not "
                                "an effluent discharge limit."))

    for parameter_name, display_name, unit, limit_type, values, note in SCHEDULE6:
        for zone, value in zip(SCHEDULE6_ZONES, values):
            if value is None:
                continue
            rows.append(std_row("Water", parameter_name, display_name, "schedule6", zone,
                                "Not applicable", limit_type, value, unit, note))

    for parameter_name, display_name, unit, limit_type, acceptable, permissible in IS10500:
        base = ("Transcribed from a secondary reproduction of IS 10500:2012, not from the "
                "BIS standard. Check against the purchased standard before verifying.")
        extra = "" if permissible is not None else " The standard prints 'No relaxation' "\
                                                  "for the permissible limit."
        rows.append(std_row("Water", parameter_name, display_name, "is10500",
                            IS10500_ACCEPTABLE, "Not applicable", limit_type, acceptable,
                            unit, base + extra))
        if permissible is not None:
            rows.append(std_row("Water", parameter_name, display_name, "is10500",
                                IS10500_PERMISSIBLE, "Not applicable", limit_type,
                                permissible, unit, base))
    return rows


def build_coefficients():
    rows = []
    for code, name, input_parameter, fuel, ef, ncv, biogenic in FUELS:
        value = ef * ncv / 1e6
        working = (f"Derived: {ef} kg CO2/TJ (Table 1.4, {fuel}) x {ncv} TJ/Gg "
                   f"(Table 1.2, {fuel}) / 1e6 = {value:.6g} t CO2 per tonne of fuel. "
                   "Both inputs are IPCC defaults, not India-specific values.")
        if biogenic:
            working += " " + BIOGENIC_NOTE
        conditions = ('{"status":"PROXY","basis":"IPCC 2006 default EF and default NCV",'
                      '"ipcc_fuel":"%s","ef_kg_co2_per_tj":%s,"ncv_tj_per_gg":%s,'
                      '"biogenic":%s}' % (fuel, ef, ncv, "true" if biogenic else "false"))
        rows.append(["All", "Carbon", code, name, input_parameter, "t/year",
                     f"{value:.6f}", "t CO2/t", "t CO2/year", "IPCC", IPCC_REF,
                     "IPCC 2006", conditions, "", "", "TRUE", "FALSE", "", "", working])
    return rows


def write(path, header, rows):
    with open(os.path.join(HERE, path), "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)
    print(f"{path}: {len(rows)} rows")


if __name__ == "__main__":
    write("regulatory_standards_collected.csv", STD_HEADER, build_standards())
    write("engineering_coefficients_collected.csv", COEF_HEADER, build_coefficients())
    print("\nSchedule VI rows that are not a single number, recorded in "
          "COLLECTION_REPORT.md instead of the CSV:")
    for item in SCHEDULE6_NOT_NUMERIC:
        print("  -", item)
