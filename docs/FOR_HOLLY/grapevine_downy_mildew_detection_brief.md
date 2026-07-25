# Grapevine Downy Mildew Detection Brief

## Selected Disease

**Grapevine downy mildew** (*Plasmopara viticola*) is the recommended target because it is visually detectable and strongly associated with rainfall, humidity, temperature, and leaf wetness. This makes it well suited for a multimodal demo combining close-range imagery, weather data, and satellite signals.

## Visual Indicators

| Indicator | Importance |
|---|---|
| White, downy growth on the underside of leaves | Essential |
| Matching upper-surface oil spot and underside growth | Essential |
| Yellow or translucent “oil spots” on the upper leaf surface | Supporting |
| Angular, vein-bounded brown or necrotic lesions | Supporting |
| Browning or sporulation on flowers, stems, or young berries | Supporting |

## Environmental Indicators

| Indicator | Importance |
|---|---|
| Consecutive hours of leaf wetness | Essential |
| Recent rainfall or overhead irrigation | Essential |
| Nighttime relative humidity near 90% or higher | Essential |
| Temperatures around 13–30°C while foliage is wet | Supporting |
| Rapid drying from sunlight, wind, or low humidity | Exclusionary |

## Common Lookalikes

- **Powdery mildew:** Flour-like coating without the characteristic upper oil spot and matching underside growth.
- **Nutrient deficiency:** Repeated yellowing patterns across many leaves, without white sporulation.
- **Water stress:** Wilting, curling, dry margins, and low canopy moisture across a wider block.
- **Dust or spray residue:** Often wipes or rinses off and does not correspond to damaged tissue.
- **Other leaf spots:** Usually produce discrete necrotic lesions without active white underside growth.

## Decision Rules

### Require Closer Imagery

Request upper- and lower-leaf images when:

- Only yellowing or white residue is visible.
- The underside of the leaf has not been photographed.
- Model confidence is moderate.
- Symptoms appear on flowers or young clusters.
- Dust, residue, or powdery mildew cannot be excluded.

### Monitoring Is Enough

Continue monitoring when:

- No underside sporulation is visible.
- Lesions are old, dry, and not expanding.
- Weather has remained dry.
- Symptoms resemble nutrient or irrigation stress.
- Satellite stress appears without supporting visual or weather evidence.

### Treatment May Be Justified

Escalate for treatment review when:

- Underside sporulation is confirmed.
- Matching oil spots and underside growth appear on multiple leaves.
- Symptoms are spreading.
- Flowers, stems, or young berries are affected.
- A major wetting event occurs during a sensitive growth stage.

Weather or satellite data alone should trigger inspection, not an automatic pesticide recommendation.

## Low-Pesticide and Biological Options

- Improve airflow through shoot thinning and canopy management.
- Use drip irrigation instead of overhead irrigation.
- Irrigate early enough for foliage to dry quickly.
- Remove infected debris and manage leaf litter.
- Avoid excessive nitrogen.
- Consider registered microbial biopesticides or plant-defense elicitors for preventive use.
- Use phosphite or copper products only according to local labels and integrated pest-management guidance.

Avoid spraying during strong wind, immediately before heavy rain, when temperatures create phytotoxicity risk, or when disease evidence is weak.

## NASA POWER Fields

Use **hourly data** whenever possible.

| Field | Purpose |
|---|---|
| `RH2M` | Count high-humidity nighttime hours |
| `PRECTOT` | Detect hourly rainfall and wetting events |
| `PRECTOTCORR` | Daily corrected rainfall fallback |
| `T2M` | Apply a temperature suitability gate |
| `T2MDEW` | Estimate dew formation using dew-point depression |
| `WS2M` | Estimate wind-driven drying |
| `ALLSKY_SFC_SW_DWN` | Estimate solar drying |

Do not treat `T2MWET` as leaf wetness; it represents wet-bulb air temperature.

### Leaf-Wetness Proxy

```text
dew_point_depression = T2M - T2MDEW

probable_wet_hour =
    PRECTOT > 0.1 mm/hour
    OR (
        RH2M >= 90%
        AND dew_point_depression <= 2°C
    )

disease_eligible_hour =
    probable_wet_hour
    AND 13°C <= T2M <= 30°C
```

Suggested demo thresholds:

- **0–1 eligible hours:** Low risk
- **2–5 eligible hours:** Moderate risk; request imagery
- **6+ eligible hours:** High risk; prioritize inspection

These thresholds should be calibrated using local vineyard observations.

## SMAP and Crop-CASMA

Useful fields:

- Surface soil moisture, 1 km daily
- Surface soil moisture, 1 km 3-day composite
- Surface soil moisture anomaly

Use soil moisture only as a weak supporting signal for wet areas, poor drainage, or splash risk. Root-zone moisture should receive little or no weight for immediate infection prediction because it does not measure leaf wetness.

## Sentinel Hub Signals

### NDVI

```text
NDVI = (B08 - B04) / (B08 + B04)
```

Use changes from the vineyard’s recent baseline. A decline may indicate canopy damage, but it is not disease-specific.

### NDMI

```text
NDMI = (B08 - B11) / (B08 + B11)
```

Use NDMI mainly to distinguish disease from drought:

- Low NDMI across a dry block supports water stress.
- Wet-weather risk plus visual lesions and later NDMI decline supports disease-related damage.
- High or low NDMI alone does not diagnose downy mildew.

## Recommended Multimodal Weighting

```text
45% close-range visual evidence
45% hourly weather and leaf-wetness proxy
10% satellite and soil-moisture context
```

## Demo Narrative

> Weather estimates when infection may have occurred. Vision checks for the characteristic lesion pattern. Satellite data identifies where canopy stress is developing and helps distinguish disease from drought.

## Sources

- Cornell Integrated Pest Management: Grapevine Downy Mildew Fact Sheet  
  https://cals.cornell.edu/integrated-pest-management/grapevine-downy-mildew-plasmopara-viticola-fruit-fact-sheet
- NASA POWER Hourly API Documentation  
  https://power.larc.nasa.gov/docs/services/api/temporal/hourly/
- Sentinel Hub NDMI Documentation  
  https://custom-scripts.sentinel-hub.com/custom-scripts/sentinel-2/ndmi/
