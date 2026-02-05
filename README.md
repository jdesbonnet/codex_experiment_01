# Observation Explorer

A lightweight CesiumJS web app that renders observation points from a GeoJSON file as map pins. Click a pin to read the associated article content.

## Run locally

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

## Usage

1. Pan/zoom the globe to browse observation locations.
2. Click a map pin to load the related observation summary and article content.
3. Use the "Read the full article" link when an observation points to an external URL.

## CesiumJS configuration

The app loads CesiumJS from the public CDN, so an internet connection is required.
If you want to enable Cesium Ion assets (terrain, imagery, etc.), add your access
token in `app.js` by setting `Cesium.Ion.defaultAccessToken`.

## Project structure

- `index.html`: App shell and layout.
- `styles.css`: Layout and visual styling.
- `app.js`: Cesium viewer configuration and interaction logic.
- `data/observations.geojson`: Observation feature data.

## Data format

Observation features live in `data/observations.geojson`. Each feature supports:

- `title`: Display name.
- `summary`: Short summary shown above the article.
- `articleHtml`: HTML snippet injected into the side panel.
- `articleUrl`: Link to a full article (shown if no HTML is provided).
