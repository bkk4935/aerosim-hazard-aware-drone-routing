# AEROSIM LIVE — Hazard-Aware Drone Routing

A research prototype for exploring drone flight planning around contaminated surfaces while balancing predicted particulate disturbance, hazard-weighted exposure, and energy consumption.

## Project files

The complete project package includes:
- `AEROSIM_LIVE_3D.html` — standalone interactive 3D demonstration.
- `engine.js`, `ui.js` — simulation and user-interface code.
- `train_models.py`, `export_models.py`, `add_ml_probes.py`, `patch_refine.py` — model training and utilities.
- `data/` — supporting datasets.
- `models/` — trained models and validation metadata.
- `presentation/` — Designathon presentation (PPTX and PDF).
- `docs/` — engineering report and limitations.
- `validation/` — demonstration screenshots.

## Quick start

Open `AEROSIM_LIVE_3D.html` in a modern browser. To work with the Python models:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train_models.py
```

## Scientific scope

This is a hackathon research prototype, **not** a validated radiation-safety or environmental-remediation system. Some model inputs and demonstrations are synthetic or derived from literature; the outputs should not be used for real-world hazardous-area operations without independent validation.

## Status

The repository is being populated with the full AEROSIM project archive.