# Matchday — EURO 2020 dashboard

Interactive contact and transmission results for 1 June–21 July 2021, using the current positive count-scale refit with fixed match contributions.

## Explore

- **Contacts** and **Transmissions** retain daily/cumulative trajectories, observed points, dashed background, match explorer, decomposition and impact map.
- **Compare** shows paired bars for match/background ratios and estimated match-associated counts, with sorting and optional separate count scales.
- Date selection filters cumulative summaries and the comparison/export rows. The single-outcome match explorer retains all eight selected matches.
- Exact match tables and full-precision CSV downloads follow the selected outcome; Compare exports both outcomes.
- Existing timeline zoom, match tour, theme switch and responsive layout are retained.

## Measures

The data are pooled England/Wales aggregate app estimates. Contacts count contact events, not unique exposed people. Transmissions use the S2 transmission estimates.

Fixed match M was estimated by subtracting the original fitted background from observed counts on all 11 match dates. The current positive background minimizes squared errors of `(observed - M) - background` on the count scale, using the same four-degree-of-freedom natural spline and weekday structure as the prior log-scale fit. Fixed M is an assumed match-day excess, not independent observation or causal identification.

The table's weekday D is an additive count adjustment. Background = B + D = B × weekday multiplier; fitted total = B + D + M; ratio = M / (B + D), shown as a multiple (×).

Background is a fitted reference, not a separately simulated no-match epidemic. Daily summaries include all 11 England/Wales match dates. The explorer and paired bars use the same eight requested matches as the analysis tables; comparison summaries explicitly count the matches in the date window. Separate count scales normalize each outcome to its own maximum and are labelled accordingly.

`data.js` is generated without rounding from `outputs/ferretti_contact_ratios_2026-09-25/count_scale_results/daily_plot_data.csv` and the two match tables in the parent analysis workspace. It includes the source daily CSV SHA-256. All plots, summaries, tables and downloads share this dataset.

To regenerate within the analysis workspace, run `python3 scripts/export_count_scale.py` from this directory.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. This is a static HTML/CSS/JavaScript site. D3, flag icons, and fonts load from external CDNs.

## Files

- `index.html`: dashboard layout
- `dashboard.css`: styles
- `dashboard.js`: charts and interactions
- `data.js`: aggregate model outputs

GitHub Pages serves the repository root from the `main` branch.
