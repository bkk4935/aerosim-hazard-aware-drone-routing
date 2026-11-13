# AEROSIM LIVE — offline 3D adaptive drone research demonstration

**Fastest start:** Double-click `AEROSIM_LIVE_3D.html` on your Mac. This browser file runs locally and needs **no install or internet**. It includes portable copies of the three previously fitted scikit-learn models. The 3D scene uses a projected drawing, not actual CFD or full UAV rigid-body flight dynamics.

## Demo (four clicks)

1. Open `AEROSIM_LIVE_3D.html` in Safari or Chrome. You should see a teal drone trajectory, a blue reference route, a quadcopter body, contamination zones, a worker-entry location, and an aircraft/particle/environment sidebar.
2. Click **Play mission**. Speed and altitude update along the 3D route.
3. During the flight click **Inject contamination spike**. Zone B dust, activity and wind direction change, and the planner recomputes a different route from the current aircraft state. The figures update automatically.
4. Change **Zone B: specific activity**, **particle size**, **dust surface load**, **wind**, **ventilation**, and **energy/dose priorities**. Use **Export result CSV** and **Camera snapshot PNG** to retain evidence for your presentation.

### What each output means

- **Energy Wh:** modelled from a scenario airframe-power baseline plus a *relative* wind/speed response from an AMOVFLY electrical-power regressor. Not a power test of the proposed airframe.
- **Dust mg:** a deliberately unvalidated rotor/surface disturbance approximation. There is no matched rotor–dust experiment in the training data.
- **Conditional inhalation µSv:** a first-order room transfer/re-entry scenario using hypothetical Bq/kg and legacy reference inhalation coefficients, not a site-specific exposure prediction.
- **External gamma µSv/h:** an independent environmental field scenario used in an avionics exposure proxy; no gamma field solver or occupational gamma dose model.
- **3D cloud:** visual markers to communicate the assumed dust release and advection, not CFD solution cells.

## Exactly what was trained

| File | Model | Experimental target | Held-out result |
|---|---|---|---|
| `models/energy.joblib` | HistGradientBoostingRegressor, 165 trees | Battery power (W), AMOVFLY 11,623 records/42 flights | Whole-flight held-out R² = 0.741; MAE 12.26 W |
| `models/jia_concentration.joblib` | HistGradientBoostingRegressor, 125 trees | Wind-tunnel dust g/m³, 405 rows/7 soils | Unseen-soil R² = 0.491; MAE 8.85 g/m³ |
| `models/bristol_detachment.joblib` | Standardised Logistic Regression | Morphology yes/no particle detachment, 109 particles | Five-fold balanced accuracy 0.733 |

The HTML embeds `models/portable_models.json`. Jia and Bristol are shown in the *ML diagnostics* panel but are **not** used as a fictitious calibrated rotor-release model. The CEA/CNRS Saharan dust `data/isotopes.csv` supplies measured/activity metadata for scenario context but is **not a fourth ML model**, and live zone activities are user-supplied scenario parameters. These data do not identify the airborne composition inside the Marcoule G2/G3 buildings.

## How the controller operates

A time-stepped route-planning demonstration uses a 21 × 17 grid with four altitude layers (0.7–2.2 m) and a set of discrete speeds (0.7–2.2 m/s). For candidate segments it evaluates a weighted combination of engineering power use, assumed dust release, conditional inhalation dose, time and external-field avionics proxy. Obstacle and clearance constraints apply. The event button replans the route from the animated drone's current position. This is **event-driven replanning**, not continuous closed-loop MPC, live radiation sensing, CFD or a PX4 flight-dynamics simulation.

## Files

- `AEROSIM_LIVE_3D.html` — entire offline 3D interactive demonstration (trained model JSON embedded).
- `engine.js` — route planner, conditional aerosol/dose and energy engineering equations.
- `ui.js` — sidebar, graphics, animation, scenario event.
- `template.html` — editable unassembled template; **open AEROSIM_LIVE_3D.html instead**.
- `models/portable_models.json` — browser-readable learned models.
- `models/*.joblib` — Python scikit-learn source models (trusted archive only).
- `train_models.py` / `export_models.py` — reproducibility tools.
- `data/*.csv` — three ML datasets and isotope scenario metadata.
- `BOM_estimates.csv` — mass/cost estimates for a hypothetical X500-based aircraft.
- `AEROSIM_LIVE_Engineering_Report.pdf` — full engineering and evidence report.

## Optional Python model retraining (not required for the 3D demo)

```
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python train_models.py
python export_models.py
```

**Caution:** the models were fitted with a specific scikit-learn environment. Regenerating them on a different library version can change results. The shipped portable JSON matches the shipped joblib models on the checked held-out examples.

## Next 3-person sprint

1. **Aero/structure:** benchmark thrust–RPM–power on the real airframe, constrain rotor wake via near-floor airflow tests and refine BOM/CAD.
2. **Data/physics:** calibrate rotor-to-dust emission in a safe, contained lab with non-radioactive surrogates, independent particle measurements and ventilation controls.
3. **Autonomy/demo:** integrate this planner with PX4/Gazebo SITL and compare a fixed route vs adaptive route under the same mission/room disturbances, with uncertainty bars.

All data values here are research/prototype values. Do **not** deploy for radiological safety decisions.
