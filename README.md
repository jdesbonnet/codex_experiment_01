# Observation Explorer

A lightweight CesiumJS web app that renders observation points from a GeoJSON file as map pins. Click a pin to read the associated article content.

## Run locally

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

## Data format

Observation features live in `data/observations.geojson`. Each feature supports:

- `title`: Display name.
- `summary`: Short summary shown above the article.
- `articleHtml`: HTML snippet injected into the side panel.
- `articleUrl`: Link to a full article (shown if no HTML is provided).
