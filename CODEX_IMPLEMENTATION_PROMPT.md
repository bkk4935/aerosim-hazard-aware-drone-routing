# Copy/paste into Codex to develop the next validated version

Continue the existing AEROSIM LIVE repo, preserving every source observation, the three pretrained models, the browser demo, and its clearly marked assumptions. No artificial radiation measurements and no claims of actual Marcoule room activity.

Priorities:
1. Put the 3D route visualisation and sidebar into a maintainable modular project while preserving the single-file export. Make the controls for air pressure, humidity, dust density, room ventilation, gamma field, isotope activity, worker-reentry timing, battery mass and rotor diameter respond consistently.
2. Upgrade the kinematic-only motion model to PX4/Gazebo X500 SITL with fixed initial attitude and an obstacle-avoiding position controller; keep SITL outputs distinct from aerosol predictions.
3. Add independent airframe thrust–power tests and rotor-to-floor shear/entrainment experiment interfaces. Report unavailable calibration parameters instead of inferring actual radioactivity from aerosol class.
4. Replace the current conditional inhalation proxy with a traceable multi-compartment model and separate isotope/chemical-form dependent coefficients, with input-dependent uncertainty and site-specific parameters when measured.
5. Group held-out validation by flight, soil, surface material and source study. Keep all four units and calibration sources traceable. Report uncertainty and counterexamples where the adaptive path fails.
6. Show physical airframe BOM and CAD mass budget, battery margin, indoor positioning failures and contamination of onboard equipment. Do not reuse a toy Geiger module as a professional safety sensor.
7. Add confidence/coverage warnings on the UI for all untested airframe/particle/soil regimes; do not backpropagate imputed labels as measured truth.
8. Verify the browser controls with a headless UI test, including contamination event and CSV export. Rebuild the standalone HTML for sharing offline.

Do not connect to a live drone or radioactive material without a controlled, approved safety plan. Start by reporting the baseline architecture and failing tests; make incremental changes, run the tests, and update README and provenance with each meaningful change.
