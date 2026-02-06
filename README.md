# CesiumJS Experiments

A growing collection of small CesiumJS explorations. Each experiment lives in its own directory and can be opened directly from this repository once a static web server is running.

## Experiments

<table>
  <tr>
    <td align="center">
      <a href="experiments/observation-explorer/index.html">
        <img
          src="assets/thumbnails/observation-explorer.svg"
          alt="Observation Explorer thumbnail"
          width="280"
        />
        <br />
        <strong>Observation Explorer</strong>
        <br />
        <span>Pin-based globe tour that previews observation articles and records flyovers.</span>
      </a>
    </td>
  </tr>
</table>

## Run locally

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000/experiments/observation-explorer/](http://localhost:8000/experiments/observation-explorer/) in your browser.

## Repository layout

- `experiments/`: Individual CesiumJS experiment directories.
- `assets/thumbnails/`: Images used by the README experiment matrix.
- `PROMPTS.md`: Running log of prompts handled for this repository.
