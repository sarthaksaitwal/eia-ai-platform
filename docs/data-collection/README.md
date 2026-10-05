# Data collection templates

Two spreadsheets to fill in before the calculation engine is built. Open them in
Excel. **Every column name is a database column**, so a filled sheet loads straight
into its table.

| File | Loads into | Used for |
|---|---|---|
| `engineering_coefficients_template.csv` | `engineering_coefficients` | Calculating quantities: input × coefficient |
| `regulatory_standards_template.csv` | `regulatory_standards` | Comparing measured values against legal limits |

> **Every example row is an example.** Its `notes` start with `EXAMPLE VALUE` and
> `verified` is `FALSE`. The numbers show the expected format and rough magnitude
> only. They were not read from the source documents and must not be used.
> Replace each value with the one printed in the cited source, then fill in
> `verified`, `verified_by` and `verified_on`.

## General rules for both sheets

- Leave a cell **empty** when there is nothing to record. Empty cells load as NULL.
- `active`, `verified`: `TRUE` or `FALSE`.
- Dates (`effective_from`, `effective_to`, `verified_on`): `YYYY-MM-DD`.
- `verified = TRUE` is rejected unless `verified_by` and `verified_on` are filled.
- Put the page, table or clause number inside `reference`, so the value can be found again.

### Text length limits

| Sheet | Column | Max characters |
|---|---|---|
| Coefficients | `industry` | 150 |
| Coefficients | `factor`, `methodology_version` | 50 |
| Coefficients | `coefficient_code`, `input_parameter`, `input_unit`, `unit`, `result_unit` | 100 |
| Coefficients | `coefficient_name`, `source` | 200 |
| Standards | `category` | 50 |
| Standards | `parameter_name`, `averaging_period` | 100 |
| Standards | `zone`, `authority` | 150 |
| Standards | `display_name`, `standard_name` | 200 |
| Standards | `unit` | 50 |
| Both | `verified_by` | 150 |

`reference`, `notes` and `conditions` have no limit.

## Coefficients: one row per factor

| Column | Required | What to write | Example |
|---|---|---|---|
| `industry` | yes | Industry it applies to, or `All` for fuels and grid electricity | `Cement` |
| `factor` | yes | `Air`, `Water`, `Carbon`, `Resource`, `Waste`, `Noise` or `Ecology` | `Carbon` |
| `coefficient_code` | yes, unique | Name in capitals | `COAL_COMBUSTION_CO2` |
| `coefficient_name` | yes | Readable name | Coal combustion CO2 factor |
| `input_parameter` | for calculation | The assessment input it multiplies | `coal_consumption` |
| `input_unit` | for calculation | Unit that input must be in | `t/year` |
| `value` | yes, ≥ 0 | The number from the source | |
| `unit` | yes | Unit of the coefficient | `t CO2/t coal` |
| `result_unit` | for calculation | Unit of input × coefficient | `t CO2/year` |
| `source` | | Publication | IPCC 2006 Guidelines |
| `reference` | | Volume, chapter, table, page | Vol. 2, Ch. 2, Table 2.2 |
| `methodology_version` | | Edition or version | IPCC 2006, CEA version used |
| `conditions` | | What the value depends on, as JSON | `{"coal_grade": "G10"}` |
| `effective_from`, `effective_to` | | Validity period, if the source has one | |
| `active` | yes | `TRUE` | |
| `verified`, `verified_by`, `verified_on` | | Who checked it against the source, and when | |
| `notes` | | Working, conversions, caveats | |

Rules:
- **Fill `input_parameter`, `input_unit` and `result_unit` together, or leave all three empty.** A row with only some of them is rejected.
- **Units must chain.** `input_unit` × `unit` must give `result_unit`
  (t/year × t CO2/t = t CO2/year). If the source uses a different basis, convert it
  and show the working in `notes`.
- **Fuel factors come per energy unit** (t CO2 per TJ). Convert them to per physical
  unit (per tonne, kL or Sm³) using the fuel's net calorific value and density,
  and record both numbers in `notes`.
- **`conditions` must be valid JSON** — `{"key": "value"}` — or empty.
- **Prefer plant data over benchmarks** for water, waste and dust.

## Standards: one row per limit

One parameter usually needs several rows: one per zone and averaging period. A
range such as pH 6.5–8.5 takes two rows, a `minimum` and a `maximum`.

| Column | Required | What to write | Example |
|---|---|---|---|
| `category` | yes | `Air`, `Noise`, `Water`, `Soil`, … | `Air` |
| `parameter_name` | yes | Our parameter key | `pm25`, `leq_day`, `bod` |
| `display_name` | | Readable name | PM2.5 |
| `standard_name` | yes | Short name of the standard | `NAAQS 2009` |
| `zone` | yes | Where it applies; `All` if everywhere | `Industrial`, `Silence Zone`, `Inland surface water` |
| `averaging_period` | yes | Time basis, or `Not applicable` | `Annual`, `24 hours`, `Day (06:00-22:00)` |
| `limit_type` | yes | `maximum`, or `minimum` (e.g. dissolved oxygen) | `maximum` |
| `limit_value` | yes, ≥ 0 | The limit exactly as notified | `40` |
| `unit` | yes | Unit exactly as notified | `µg/m³` |
| `authority` | yes | Who notified it | CPCB / MoEFCC |
| `reference` | | Notification number, date, schedule or table | G.S.R. 826(E), 16 Nov 2009, Schedule |
| `effective_from`, `effective_to` | | Validity period | |
| `active` | yes | `TRUE` | |
| `verified`, `verified_by`, `verified_on` | | Who checked it against the notification, and when | |
| `notes` | | Caveats | |

The combination `parameter_name` + `standard_name` + `zone` + `averaging_period` +
`limit_type` must be unique.

For noise, use the site classification values as the zone: `Industrial`,
`Commercial`, `Residential`, `Silence Zone`.

## Open decisions (not in the sheets)

1. **Cement process CO2 is per tonne of clinker, not cement.** Needs a new
   assessment input, `clinker_production`, or a clinker-to-cement ratio. It is
   usually the largest carbon source for a cement plant.
2. **Biomass.** Biogenic CO2 is normally reported separately from the total.
   Decide whether to include biomass CH4 and N2O, then add those coefficient rows.
3. **Soil has no notified Indian standard.** Choose a published reference and add
   rows for it, or report soil values without a limit.
4. **Grid factor version.** CEA revises its database regularly. Record the version
   in `methodology_version` and use one version per assessment.
5. **Drinking water has two limits.** IS 10500 lists an acceptable and a permissible
   limit. Collect both, distinguished by `zone`.
6. **Discharge vs ambient water.** Effluent discharge limits apply to what the plant
   releases; water quality criteria apply to the river. Keep them as separate standards.
