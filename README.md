# Matchday — EURO 2020 dashboard

Interactive dashboard of modelled exposures from 1 June to 1 November 2021, with match-day breakdowns and a simulated no-match counterfactual.

## Explore

- Daily and cumulative exposure trajectories with selectable time windows.
- Match-level exposure components, ratios, country flags, and hover details.
- Animated match tour, timeline zoom, light/dark themes, and match-data CSV export.

## Measures

The match-to-background ratio is **match exposures / (baseline × day-of-week exposures)**. The weekday adjustment is the difference between baseline × day-of-week and baseline alone. Component breakdowns use the fitted trajectory; the no-match trajectory is a separate model simulation.

These are modelled exposures, not observed case counts. Cumulative values cover the currently selected dates.

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
