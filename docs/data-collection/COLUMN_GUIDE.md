# Reference data collection: column guide

We need two sets of reference data before the EIA platform can produce real results:

| Sheet | Used for |
|---|---|
| `engineering_coefficients_template.csv` | Calculating quantities: project input × coefficient (e.g. coal used → CO2 emitted) |
| `regulatory_standards_template.csv` | Checking measured values against legal limits (e.g. PM2.5 against NAAQS) |

Both templates are in this folder. Every column name matches a database column, so a
filled sheet loads straight into the database. The sheets contain every column the
database needs, but **not every column needs research**: some you copy from the
source, some you fill in yourself, and some are optional.

---

## 1. Engineering coefficients (20 columns)

One row per coefficient.

| Group | Columns | Where it comes from |
|---|---|---|
| **Collect from the source** | `value`, `unit`, `source`, `reference`, `methodology_version` | The source document: IPCC Guidelines, CEA CO2 Baseline Database, USEPA AP-42, plant data |
| **Collect if the source has it** | `conditions`, `effective_from`, `effective_to` | What the value depends on (coal grade, dust controls) and its validity period |
| **You fill in (naming)** | `industry`, `factor`, `coefficient_code`, `coefficient_name`, `active` | Your choice, no research needed |
| **You fill in (calculation link)** | `input_parameter`, `input_unit`, `result_unit` | Which project input the coefficient multiplies, and the unit of the result |
| **After checking** | `verified`, `verified_by`, `verified_on`, `notes` | Who checked the value against the source, when, and any working |

**Minimum for a calculation to work:** `industry`, `input_parameter`, `input_unit`,
`value`, `unit`, `result_unit`.

### How a row is used

```
input_parameter (in input_unit)  ×  value (in unit)  =  result (in result_unit)
coal_consumption [t/year]        ×  [t CO2/t coal]   =  [t CO2/year]
```

The units must chain: `input_unit` × `unit` must give `result_unit`.

### Column details

| Column | Required | What to write | Example |
|---|---|---|---|
| `industry` | yes | Industry it applies to, or `All` for fuels and grid electricity | `Cement`, `All` |
| `factor` | yes | `Air`, `Water`, `Carbon`, `Resource`, `Waste`, `Noise` or `Ecology` | `Carbon` |
| `coefficient_code` | yes, unique | Short name in capitals | `COAL_COMBUSTION_CO2` |
| `coefficient_name` | yes | Readable name | Coal combustion CO2 factor |
| `input_parameter` | for calculation | The project input it multiplies | `coal_consumption` |
| `input_unit` | for calculation | Unit that input is in | `t/year` |
| `value` | yes, ≥ 0 | The number from the source | *(from source)* |
| `unit` | yes | Unit of the coefficient | `t CO2/t coal` |
| `result_unit` | for calculation | Unit of input × coefficient | `t CO2/year` |
| `source` | | Publication | IPCC 2006 Guidelines |
| `reference` | | Volume, chapter, table, page | Vol. 2, Ch. 2, Table 2.2 |
| `methodology_version` | | Edition or version | IPCC 2006 |
| `conditions` | | What the value depends on, as JSON | `{"coal_grade": "G10"}` |
| `effective_from`, `effective_to` | | Validity period, if the source gives one | `2024-04-01` |
| `active` | yes | `TRUE` | |
| `verified`, `verified_by`, `verified_on` | | Who checked it against the source, and when | `TRUE`, name, `2026-09-11` |
| `notes` | | Working, conversions, caveats | |

### Not covered by a column: fuel conversions

IPCC gives fuel emission factors per unit of energy (t CO2 per TJ). Converting them to
per tonne, kL or Sm³ needs each fuel's **net calorific value** and **density**. These
have no columns of their own. Record them in `notes` as working. The calculation only
uses the converted `value`.

---

## 2. Regulatory standards (18 columns)

One row per limit. A parameter usually needs several rows: one per zone and averaging
period. A range such as pH 6.5–8.5 takes two rows, a `minimum` and a `maximum`.

| Group | Columns | Where it comes from |
|---|---|---|
| **Collect from the notification** | `limit_value`, `unit`, `limit_type`, `zone`, `averaging_period`, `standard_name`, `authority`, `reference` | The Gazette notification or BIS standard |
| **Collect if it has one** | `effective_from`, `effective_to` | Notification date or revision |
| **You fill in** | `category`, `parameter_name`, `display_name`, `active` | Our parameter keys, e.g. `pm25`, `leq_day` |
| **After checking** | `verified`, `verified_by`, `verified_on`, `notes` | Who checked it against the notification, and when |

**Minimum for a compliance check to work:** `parameter_name`, `zone`,
`averaging_period`, `limit_type`, `limit_value`, `unit`.

### Column details

| Column | Required | What to write | Example |
|---|---|---|---|
| `category` | yes | `Air`, `Noise`, `Water`, `Soil`, … | `Air` |
| `parameter_name` | yes | Our parameter key | `pm25`, `leq_day`, `bod` |
| `display_name` | | Readable name | PM2.5 |
| `standard_name` | yes | Short name of the standard | `NAAQS 2009` |
| `zone` | yes | Where it applies; `All` if everywhere | `Industrial`, `Silence Zone` |
| `averaging_period` | yes | Time basis, or `Not applicable` | `Annual`, `24 hours`, `Day (06:00-22:00)` |
| `limit_type` | yes | `maximum`, or `minimum` (e.g. dissolved oxygen) | `maximum` |
| `limit_value` | yes, ≥ 0 | The limit exactly as notified | *(from notification)* |
| `unit` | yes | Unit exactly as notified | `µg/m³` |
| `authority` | yes | Who notified it | CPCB / MoEFCC |
| `reference` | | Notification number, date, schedule or table | G.S.R. 826(E), 16 Nov 2009, Schedule |
| `effective_from`, `effective_to` | | Validity period | |
| `active` | yes | `TRUE` | |
| `verified`, `verified_by`, `verified_on` | | Who checked it, and when | |
| `notes` | | Caveats | |

The combination `parameter_name` + `standard_name` + `zone` + `averaging_period` +
`limit_type` must be unique.

For noise, use these zone values: `Industrial`, `Commercial`, `Residential`,
`Silence Zone`.

---

## 3. Formatting rules (both sheets)

- Leave a cell **empty** when there is nothing to record.
- `active`, `verified`: `TRUE` or `FALSE`.
- Dates: `YYYY-MM-DD`.
- `verified = TRUE` is rejected unless `verified_by` and `verified_on` are filled.
- `conditions` must be valid JSON (`{"key": "value"}`) or empty.
- Put the page, table or clause number in `reference`, so anyone can find the value again.
- The example rows in the templates are **format examples only**. Their numbers were
  not taken from the sources. Replace every value with the one printed in the source.

### Text length limits

| Sheet | Column | Max characters |
|---|---|---|
| Coefficients | `industry` | 150 |
| Coefficients | `factor`, `methodology_version` | 50 |
| Coefficients | `coefficient_code`, `input_parameter`, `input_unit`, `unit`, `result_unit` | 100 |
| Coefficients | `coefficient_name`, `source` | 200 |
| Standards | `category`, `unit` | 50 |
| Standards | `parameter_name`, `averaging_period` | 100 |
| Standards | `zone`, `authority` | 150 |
| Standards | `display_name`, `standard_name` | 200 |
| Both | `verified_by` | 150 |

`reference`, `notes` and `conditions` have no limit.
