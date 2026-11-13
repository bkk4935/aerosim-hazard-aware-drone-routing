# Data provenance, validation and usage boundaries

This repository packages the Team Bath Designathon's AEROSIM LIVE research demonstrator. It is not a peer-reviewed environmental radiation model or a deployed UAV controller.

## Sources referenced by the original project

The original project's HTML/report identifies external sources used or consulted, including:

- **AMOVFLY** — drone flight/electrical-power dataset: https://github.com/YujiaoHu/AMOVFLY-Dataset
- **University of Bristol research dataset** — particle detachment / morphology: https://data.bris.ac.uk/data/dataset/352w3w27knzbo2b4ujazj371oz
- **Zenodo records** cited in the demo and associated report: https://zenodo.org/records/14003603 and https://zenodo.org/records/19594026
- **ICRP Publication 119** — reference coefficients, not site measurements: https://www.icrp.org/publication.asp?id=ICRP%20Publication%20119

Review each primary publication/dataset and its individual licence before redistributing any external observations or derivative tables. The presence of a dataset in this research bundle **does not grant new rights over the original source material**. Data attribution and science assumptions are described more fully in the included engineering report.

## Distinguish these layers

1. **Source evidence**: AMOVFLY flight power, Jia wind-tunnel soil dust, Bristol particle morphology observations, and isotope scenario metadata.
2. **Fitted models**: three separate ML models. Their reported hold-outs/CV do not transfer to a complete aircraft/safety system.
3. **Engineering assumptions**: rotor disturbance, dispersion, ventilation, conditional dose and energy-cost combination are demonstrative scenario calculations without matched ground-truth measurements.
4. **Controller and visualization**: illustrative grid search and event-driven replanning in a rendered scene; not live closed-loop UAV control, CFD, validated sensing or indoor mapping.

Specific activity and isotope scenario values are not inferred from live radiation measurements and cannot establish environmental safety. Even a low simulated disturbance or dose should **not** be treated as an acceptable real-world threshold.

## Before presenting as a research result

- Independently verify that all references/data licences permit the intended public distribution.
- Re-run the original validation and inspect data splits/feature definitions and applicability range.
- Measure rotor downwash and entrainment with nonradioactive surrogates in a controlled setup before claiming a predictive rotor dust model.
- Separate simulated objective improvement from experimentally demonstrated reductions.
