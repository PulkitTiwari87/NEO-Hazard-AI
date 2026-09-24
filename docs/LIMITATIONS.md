# Limitations

## What this project is

An ML research/engineering project that trains statistical classifiers on
real NASA NeoWs orbital and physical features to learn patterns associated
with NASA/JPL's existing `is_potentially_hazardous_asteroid` classification,
plus unsupervised anomaly detection and model explainability over the same
feature space.

## What this project is NOT

- **Not an asteroid impact predictor.** No model here estimates impact
  probability. `is_potentially_hazardous_asteroid` is a geometric/orbital
  screening criterion (approximately: MOID with Earth ≤ 0.05 au AND
  absolute magnitude ≤ 22, per NASA/JPL's public definition of the term),
  not an impact forecast. A model that predicts this label is predicting
  *whether an object meets that screening criterion*, which is a much
  narrower and already-computable fact — not a novel risk assessment.
- **Not a planetary-defense decision system.** Nothing in this repository
  should inform any real decision about tracking, deflection, or civil
  response to a NEO.
- **Not a replacement for NASA/JPL/CNEOS.** NASA/JPL's own orbit
  determination and hazard screening are the authoritative source. This
  project consumes their public output; it does not audit, second-guess,
  or substitute for it.
- **Not evidence of anything until real data has been run through it.**
  See `docs/DATA_SOURCE.md` — as of this writing no ingestion has executed
  against the real NASA API in the environment used to build this
  scaffold, so no metric in this repository reflects real-world model
  performance yet.

## On "potentially hazardous"

NASA/JPL's own definition (per api.nasa.gov/CNEOS documentation) is a
screening rule based on the Minimum Orbit Intersection Distance (MOID) with
Earth's orbit and the object's absolute magnitude (a brightness-derived
size proxy). It does **not** mean:

- "will hit Earth"
- "likely to hit Earth"
- "a dangerous asteroid" in any calibrated probabilistic sense
- an assessment that accounts for the object's actual measured orbit
  uncertainty at the time you read this

This project passes that label through unmodified as the supervised target
and never recomputes, reinterprets, or "improves" it.

## On the anomaly detector

The Isolation Forest anomaly score (`src/anomaly/detect.py`) measures how
unusual an object's feature vector is relative to the rest of the dataset,
under that algorithm's specific random-partitioning method. Use the terms
**"ML anomaly score"** or **"feature-space statistical outlier."** Do not
use "dangerous," "high risk," or "NASA flags this as hazardous" to describe
it — it can flag an object as unusual purely because of a data-quality
artifact (e.g., an unusually short observation arc), with no relationship
to hazard.

## On SHAP explanations

SHAP values (`src/explainability/shap_analysis.py`) describe how much each
feature moved *this specific trained model's* output for *this specific
row*, relative to the model's average prediction over the explained
sample. They explain the model's behavior. They are not a causal
explanation of orbital dynamics and are never attributed to NASA.

## On the prediction API

`/api/predict` returns an ML model's output on user-supplied feature
values, run through the exact preprocessing pipeline used at training
time. Its `model_score` field (when present) is the classifier's raw
`predict_proba` output for the positive class — this has not been
independently calibrated against observed frequencies, so it should not be
read as a scientifically calibrated probability. The response text says so
explicitly.

## On dataset completeness and quality

Not yet known. NASA's own data has documented limitations (e.g. discovery
observational biases toward larger/brighter objects, incomplete orbital
solutions for recently discovered objects reflected in `data_arc_in_days`
and `observations_used`). Once ingestion runs, `data/processed/validation_report.json`
will report null percentages and record counts for the actual data
retrieved — this file should be read before drawing any conclusion from
model results.

## On the leakage-aware research benchmark

`docs/FEATURE_AUDIT.md` documents exactly which features directly define
(or are a NASA-side derived transform of) `is_potentially_hazardous_asteroid`,
and `docs/RESULTS.md` reports what happens to each model's performance once
those features are removed (Experiments B-D). A performance *drop* between
Experiment A and Experiments B-D is the expected, informative result, not
a regression — it is the measurement this project exists to make. A
leakage-audited experiment that still scores very highly is itself a
finding worth investigating (see `docs/FEATURE_AUDIT.md`'s Category C
features), not evidence to discard.

## On generalization

Even with strong test-set metrics on this dataset, that says nothing about
performance on: objects discovered after the dataset's retrieval date,
objects from a different discovery-survey population, or any operational
planetary-defense context. Test-set performance here measures only "how
well does this model recover NASA/JPL's own label from other NASA/JPL
fields for objects already in NeoWs" — a much narrower claim than
"hazard detection."
