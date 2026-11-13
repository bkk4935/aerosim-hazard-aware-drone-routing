# AEROSIM LIVE
### Hazard-aware adaptive drone routing for low-disturbance inspection

**Research prototype developed for Team Bath Autonomy Designathon (November 2026).** AEROSIM explores the trade-offs between mission duration, energy consumption and the potential disturbance of settled hazardous dust when routing a quadrotor through a simulated indoor inspection environment.

> **Status: simulation / hackathon prototype, not a validated radiation-monitoring or flight-safety system.** The dust-release, inhalation exposure and indoor-transfer calculations are explicitly assumed scenarios, not an experimentally calibrated rotor–dust model. The 3D view is an illustration, not CFD or full rigid-body flight dynamics.

## Try the demo

1. Download or clone the repository.
2. Open **[`AEROSIM_LIVE_3D.html`](AEROSIM_LIVE_3D.html)** locally in a browser (Chrome/Safari). **No installation or internet connection is needed.**
3. Select **Play mission** to compare the reference and adaptive routes. During playback, choose **Inject contamination spike** to trigger event-driven replanning from the simulated current aircraft position.
4. Explore dust loading, zone activity, wind, ventilation, airframe conditions, energy versus dose priorities, and exported outputs.

The portable trained models are embedded in the single-file demo. You do **not** need Python to run it.

## What it does

- Illustrates an adaptive 3D inspection route with obstacles, speed choices, and altitude layers.
- Replans when a hypothetical contamination event changes the simulated environment.
- Shows a **modelled** energy/disturbance/risk trade-off against a reference route.
- Exposes adjustable environmental parameters and supports CSV/PNG export.
- Connects three separately trained ML components to an engineering demonstration without misrepresenting them as a validated end-to-end dust simulator.

### Fitted ML components (historical reported results)

| Component | Model | Evidence and reported hold-out / CV result |
|---|---|---|
| Electrical power | Histogram Gradient Boosting | AMOVFLY flight data: grouped whole-flight test R² **0.741**, MAE **12.26 W** |
| Wind-tunnel dust | Histogram Gradient Boosting | Jia soil wind-tunnel data: unseen-soil R² **0.491**, MAE **8.85 g/m³** |
| Particle detachment | Standardised Logistic Regression | Bristol morphology data: five-fold within-sample balanced accuracy **0.733** |

These are **different tasks with different targets**. They do not establish predictive accuracy for rotor-induced radioactive dust suspension, occupational exposure, or the proposed airframe.

## Scientific boundaries

- **Measured source data:** electrical power observations; wind-tunnel dust concentrations; particle morphology/detachment labels; isotope metadata.
- **Fitted outputs:** the three separately trained ML targets above.
- **Scenario parameters:** illustrative zone activity, room conditions, ventilation, gamma field and assumed dust-to-air / inhalation calculations.
- **Not validated:** rotor wake–surface entrainment, indoor aerosol transport, radioactive isotope composition at a field site, human exposure, live UAV controls, real-time sensing, CFD and flight certification.

Details and explicit caveats: [`docs/ORIGINAL_README.md`](docs/ORIGINAL_README.md), [`docs/AEROSIM_LIVE_Engineering_Report_Final.pdf`](docs/AEROSIM_LIVE_Engineering_Report_Final.pdf), and [`docs/DATA_AND_LIMITATIONS.md`](docs/DATA_AND_LIMITATIONS.md).

## Repository contents

```text
AEROSIM_LIVE_3D.html         Standalone offline interactive 3D demo
engine.js / ui.js            Modular simulation / UI reference source
train_models.py              Train three independently supported ML tasks
export_models.py             Export models into browser-readable JSON
add_ml_probes.py             Supporting diagnostics / demo tooling
patch_refine.py              Development/refinement helper
requirements.txt             Python dependencies
models/                     Learned models, portable JSON, validation results
data/                       Prepared experimental and isotope reference tables
validation/                 Screenshots from the original demonstration
presentation/               Original final deck (.pptx and .pdf)
docs/                       Report, original notes, provenance/limitations
BOM_estimates.csv            Illustrative airframe component estimates
CODEX_IMPLEMENTATION_PROMPT.md  Suggested next development steps
```

## Reproduce model training (optional)

Requires Python 3.10+ and suitable compatible versions of dependencies. Pretrained artifacts are already included; the demo does not need retraining.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python train_models.py
python export_models.py
```

Outputs are written by the scripts to `models/` and `outputs/`. Retraining can change results if dependency versions change. **Only load `.joblib` models from a trusted source:** they use Python's pickle-based serialization.

## Presentation

- [Editable PowerPoint deck](presentation/AEROSIM_Designathon_Final_Presentation.pptx) — 8 slides
- [PDF version](presentation/AEROSIM_Designathon_Final_Presentation.pdf)
- [Engineering report](docs/AEROSIM_LIVE_Engineering_Report_Final.pdf)

## Provenance, reuse and limitations

See [`docs/DATA_AND_LIMITATIONS.md`](docs/DATA_AND_LIMITATIONS.md) for the sources linked in the original project and data/model publication caveats. Upstream dataset rights and attribution should be reviewed before distributing their contents publicly. **No open-source licence is asserted for the combined work in this package.**

**Safety:** do not use this prototype for radiological safety, exposure assessment, operational UAV flight decisions, or deployment near hazardous material.
