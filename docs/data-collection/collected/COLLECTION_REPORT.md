# Collected reference data — what was found, from where, and what is still missing

Scope: Solapur district, Maharashtra. Collected 5 October 2026.

Everything in this folder was transcribed from the document cited on each row.
No value was estimated, interpolated or filled in from memory. Where a value
could not be read from a source, there is no row for it — it appears in
[Still missing](#still-missing) instead.

`verified` is **FALSE** on every row. Transcription is not verification. A named
person still has to check each value against the cited document and then set
`verified`, `verified_by` and `verified_on`. See `../COLUMN_GUIDE.md`.

## Files

| File | Rows | Loads into |
|---|---|---|
| `regulatory_standards_collected.csv` | 186 | `regulatory_standards` |
| `engineering_coefficients_collected.csv` | 12 | `engineering_coefficients` |
| `sector_water_standards.csv` | 20 | nowhere yet — needs a decision |
| `solapur_baseline.csv` | 79 | nowhere yet — needs a decision |
| `build_collected.py` | — | regenerates the first two files; holds the transcribed source values |

---

## 1. Regulatory standards (186 rows)

### NAAQS — 40 rows

All 12 pollutants, both averaging periods, both zone categories, read from the
notification text: **CPCB Notification No. B-29016/20/90/PCI-L, 18 November
2009**, which supersedes S.O. 384(E) of 1994 and S.O. 935(E) of 1998.

The two zones are exactly as the notification names them: `Industrial,
Residential, Rural and Other Area` and `Ecologically Sensitive Area`. Only SO₂
and NO₂ differ between them.

Both compliance footnotes are carried in `notes`: the annual value is the mean of
at least 104 measurements taken twice a week, and the short-period values must be
met 98% of the time, with exceedances not allowed on two consecutive days. **The
engine must apply the 98th-percentile rule, not a simple single-value
comparison** — a one-off 24-hour exceedance is not a breach of this standard.

> Note on the workbook: `COLUMN_GUIDE.md` and the uploaded knowledge base give
> the NAAQS reference as "G.S.R. 826(E), 16 Nov 2009". That is wrong. The
> standard is a CPCB notification under section 16(2)(h) of the Air Act, numbered
> B-29016/20/90/PCI-L and dated 18 November 2009.

### CPCB Designated Best Use — 24 rows

Classes A to E with their primary water quality criteria, from CPCB's
*Designated Best Use Water Quality Criteria*. pH ranges became two rows each (a
`minimum` and a `maximum`); DO is a `minimum`.

These are criteria for the **receiving water body**, not discharge limits. The
`zone` carries the full class description so the two can never be confused.

### EP Rules 1986 Schedule VI Part-A — 85 rows

General effluent discharge standards, read from the official CPCB copy of the
schedule. 28 parameters across four discharge routes, each route a `zone`:
inland surface water, public sewers, land for irrigation, marine coastal areas.
Where the schedule prints `--` for a route, there is no row.

Two things reproduced exactly as printed rather than corrected:
- Cadmium for inland surface water is **2.0 mg/l**, higher than for public
  sewers. This looks wrong but it is what the schedule says.
- BOD is **3 days at 27 °C**, substituted by G.S.R. 176 of 2 April 1996. It is
  not the 5-day 20 °C basis used in the Designated Best Use criteria. Measured
  BOD values must state which basis they use.

Three Schedule VI rows are not a single number and are not in the CSV:
- colour and odour (refers to item 6 of Annexure-I)
- particulate size of suspended solids (inland: shall pass an 850 micron IS
  sieve; marine: floatable solids max 3 mm, settleable solids max 850 microns)
- bio-assay test (90% survival of fish after 96 hours in 100% effluent)

### IS 10500:2012 — 37 rows

25 parameters, as acceptable and permissible limits. Where the standard prints
"No relaxation" there is only an acceptable row, and the note says so.

**This is the weakest set in the collection.** IS 10500 is a BIS standard that
is not published free of charge. The values were taken from a reproduction
hosted by India Water Portal and cross-checked against a second reproduction.
Every row says so. These must be checked against the purchased standard before
anyone sets `verified = TRUE`.

Parameters I could not read from either reproduction, so they are absent:
calcium, magnesium, total alkalinity, selenium, cadmium, nickel, boron,
anionic detergents, phenolic compounds, mineral oil, polynuclear aromatic
hydrocarbons, the pesticide residues and the radioactive parameters.

### Noise — not collected again

The eight CPCB noise limits (Noise Pollution (Regulation and Control) Rules,
2000) are already in the uploaded knowledge base, correctly, with zones and
day/night periods. Nothing to add.

---

## 2. Engineering coefficients (12 rows)

The uploaded workbook carries four IPCC fuel factors in **kg CO₂ per TJ** with
an explicit instruction not to convert them without a documented calorific
value. That instruction is why they were unusable.

The calorific values now exist. From the 2006 IPCC Guidelines, Volume 2, Chapter
1, both tables were read from the IPCC's own PDF:
- **Table 1.4** — default CO₂ emission factors (kg CO₂/TJ)
- **Table 1.2** — default net calorific values (TJ/Gg)

Multiplying them gives a factor per tonne of fuel:

```
EF (kg CO2/TJ)  ×  NCV (TJ/Gg)  ÷  10^6  =  t CO2 per tonne of fuel
diesel:  74 100 × 43.0 ÷ 10^6 = 3.186300 t CO2/t
```

Each row carries the two source numbers in `conditions` and the full working in
`notes`, so the arithmetic can be checked without re-reading the IPCC tables.

| Fuel | t CO₂ per tonne |
|---|---|
| Other bituminous coal | 2.440680 |
| Sub-bituminous coal | 1.816290 |
| Lignite | 1.201900 |
| Gas/diesel oil | 3.186300 |
| Motor gasoline | 3.069990 |
| LPG | 2.984630 |
| Natural gas | 2.692800 |
| Residual fuel oil | 3.126960 |
| Other kerosene | 3.149220 |
| Petroleum coke | 3.168750 |
| Wood / wood waste | 1.747200 |
| Other primary solid biomass | 1.160000 |

The two biomass rows are flagged biogenic in `notes`: the IPCC Guidelines record
biomass CO₂ as an information item outside the national total, so it has to be
reported separately from fossil CO₂. That settles one of the open questions in
`../README.md`.

Both coals are `industry = All` with the same factor and result unit, so they
were given **different `input_parameter` values** (`coal_consumption` and
`sub_bituminous_coal_consumption`). Two coefficients matching one input would be
ambiguous and the engine would refuse to choose.

### The unit problem you have to decide

These factors are per **tonne** of fuel. Three catalogue inputs are volumetric:

| Catalogue input | Current unit | Needed |
|---|---|---|
| `diesel_consumption` | kL/year | tonnes, or a density |
| `petrol_consumption` | kL/year | tonnes, or a density |
| `natural_gas_consumption` | Sm³/year | tonnes, or a density |

The IPCC tables give no densities and I did not invent any. Two ways out:

1. **Change the catalogue units to t/year.** Works immediately, and plants
   usually know fuel purchases by weight. Cheapest option.
2. **Collect densities** from IS 1460 (diesel), IS 2796 (petrol) and the project's
   own gas analysis, and add a conversion step. More work, and natural gas
   density depends on composition, which is exactly what the IPCC note warns
   about.

Until this is decided, a kL or Sm³ input will be rejected as a unit mismatch —
which is the correct behaviour, not a bug.

---

## 3. Sector water standards (20 rows) — needs a home

Schedule VI **Part-B** turned out to carry notified maximum wastewater
generation quantums per unit of production. These are real, notified numbers,
and four of them matter for Solapur: **sugar 0.4 m³ per tonne of cane crushed**,
distillery 12 m³/kL of alcohol, dairy 3 m³/kL of milk, and textile
nylon/polyester 120 m³ per tonne of fibre.

They do not fit `regulatory_standards` cleanly: the limit is per unit of
production, so there is no zone and no averaging period, and `averaging_period`
would have to hold "per tonne of cane crushed". The uploaded workbook's own
architecture rule says not to force data into a table it does not fit. So they
are parked in their own file with a `basis` column.

**Decision needed:** add a `basis` column to `regulatory_standards`, or give
these a table of their own. I did not change the schema.

---

## 4. Solapur baseline (79 rows)

### Groundwater — collected, and good

All **11 talukas** of Solapur district, from the **Report on the Dynamic
Groundwater Resources of Maharashtra 2023** (GSDA Pune with CGWB Central Region
Nagpur, March 2024). Annual extractable resource, total extraction, stage of
extraction and category for each.

| Taluka | Stage of extraction | Category |
|---|---|---|
| Malshiras | 101.2% | **Over-exploited** |
| Mohol | 88.2% | Semi-critical |
| Madha | 81.5% | Semi-critical |
| Barshi | 79.3% | Semi-critical |
| Mangalwedha | 74.6% | Semi-critical |
| Pandharpur | 74.4% | Semi-critical |
| Sangola | 73.4% | Semi-critical |
| Karmala | 72.3% | Semi-critical |
| North Solapur | 67.1% | Safe |
| South Solapur | 63.7% | Safe |
| Akkalkot | 56.3% | Safe |

This matters for the CGWA regulatory triggers already in the workbook: in
Malshiras, Mohol, Madha, Barshi, Mangalwedha, Pandharpur, Sangola and Karmala
the **100 m³/day** threshold applies, not the 500 or 2000 m³/day one. Eight of
eleven talukas sit in the strictest bracket.

### Air — partly collected

Solapur's 2024 annual averages, from CREA's *Tracing the Hazy Air 2025* analysis
of CPCB data: **PM10 93 µg/m³** (366 days monitored, 161 days above the NAAQS)
and **PM2.5 39 µg/m³** (366 days, 50 days above). PM10 is well over the annual
NAAQS of 60; PM2.5 sits just under 40.

The 366-day record settles an open question: **there is a continuous monitoring
station reporting from Solapur.** But this is a third-party analysis, not CPCB's
own publication, and it gives no station name or coordinates — see below.

### Surface and groundwater quality — index only

Six surface water and three groundwater monitoring stations in the district,
from MPCB's *Water Quality Status of Maharashtra 2022-2023*, with Water Quality
Index values and the 2011-12 to 2022-23 trend:

| Station | River / type | Avg WQI | Trend |
|---|---|---|---|
| 1911 Gursale, Pandharpur | Chandrabhaga, U/s Pandharpur | 69 | deteriorating |
| 1912 Gopalpur, Pandharpur | Chandrabhaga, D/s Pandharpur | 66 | improving |
| 1188 Narsingpur, Malshiras | Bhima after Nira confluence | 69 | improving |
| 2705 Laboti, Mohol | Sina | 68 | improving |
| 28 Takali, South Solapur | Bhima | 69 | improving |
| 2789 Aklai, Malshiras | nalla D/s Alkai Mandir | 63 | deteriorating |
| 2821 Dahegaon, North Solapur | bore well | 279 | — |
| 2822 Chincholi, Mohol | bore well | 272 | — |
| 2823 Shete Vasti, Solapur | bore well | 295 | — |

**These are index values, not concentrations.** They cannot be compared with the
Designated Best Use criteria or IS 10500 — the same trap as the CPCB AQI
sub-indices. On the groundwater scale, above 100 means not suitable for
drinking, and all three bore wells are far above it.

### Sewage — collected

Solapur Municipal Corporation generates 115.2 MLD against 102.5 MLD of installed
STP capacity, treating 90.0 MLD. Barshi has capacity to match its load. The
other **fourteen** municipal councils and nagar panchayats in the district have
**no STP at all** — Akluj 6.456 MLD, Vairag 6.16 MLD and Natepute 4.18 MLD being
the largest untreated loads.

---

## Still missing

| Missing | Why it resisted collection | Where to go |
|---|---|---|
| IS 10500 parameters: calcium, magnesium, alkalinity, selenium, cadmium, nickel, boron, detergents, phenolics, mineral oil, PAH, pesticides, radioactivity | Not in either free reproduction | The purchased BIS standard |
| Station-level air data for Solapur: station name, coordinates, station-wise annual averages | CREA's table gives city aggregates only; CPCB's own station list and NAMP summaries were not retrieved | CPCB CAAQMS station list; CPCB NAMP annual summaries; MPCB's Solapur Emission Inventory and Source Apportionment report, July 2024 |
| Raw surface and groundwater concentrations per Solapur station (pH, DO, BOD, COD, coliform) | The MPCB report publishes only the index per station | CPCB NWMP river data files; MPCB station data |
| Great Indian Bustard Sanctuary notified boundary | Secondary sources give an original 8,469 km² across Solapur and Ahmednagar with a later reduction proposed. The current notification was not located, and the geometry matters too much to take from a secondary source | Maharashtra Forest Department / MoEFCC notification; Protected Planet shapefile download |
| Eco-Sensitive Zone notifications for the district | None located | moef.gov.in, PARIVESH |
| Seismic zone under IS 1893 | Secondary sources say Zone III, factor 0.16. Not read from IS 1893 or an official map | BIS IS 1893 (Part 1) zoning map |
| Flood hazard zonation, landslide susceptibility | No coordinate API and no district document located | Bhuvan; state disaster management authority |
| Authoritative land use / land cover | Bhuvan needs registration; `bhuvan_client.py` in the repo is an empty file | bhuvan.nrsc.gov.in LULC 50k |
| Ambient noise baseline | No monitoring station exists in Solapur | Site measurement by a consultant |
| Sector benchmarks for carbon intensity and specific energy consumption | BEE PAT targets are sector- and plant-specific; there is no universal number, and the workbook forbids inventing one | BEE PAT notifications for the specific sector |
| Fuel densities for the volumetric inputs | IPCC gives none; natural gas density depends on composition | IS 1460, IS 2796, project gas analysis — or switch the inputs to tonnes |
| Soil standards | India has no notified soil quality standard | Open question: pick a published reference or report soil without a limit |

---

## What this changes in the plan

1. **Air compliance now works.** NAAQS limits exist, with zones and averaging
   periods matching the design. But the 98th-percentile rule has to be
   implemented — a single 24-hour value cannot be compared to a 24-hour limit
   and called a breach.
2. **Water compliance now works three ways** — receiving water body (Designated
   Best Use), effluent discharge (Schedule VI) and drinking water (IS 10500) —
   and they must not be mixed up. The `zone` column keeps them apart.
3. **Fuel carbon now works**, once the kL/Sm³ versus tonne question is settled.
4. **The index trap appears twice more.** CPCB AQI sub-indices were already
   known; the Solapur water data is also index-only. Index values must be stored
   as context and never compared against a limit.
5. **The BOD basis differs between two standards** we are loading at once —
   3 days at 27 °C in Schedule VI, 5 days at 20 °C in the Designated Best Use
   criteria. An input needs to say which it is.
6. **Groundwater has a real regulatory consequence** for eight of eleven Solapur
   talukas, which makes the CGWA 100 m³/day trigger the common case rather than
   the edge case.
