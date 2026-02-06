/* global Cesium */

const statusEl = document.getElementById("status");
const articleTitle = document.getElementById("articleTitle");
const articleBody = document.getElementById("articleBody");
const panel = document.getElementById("articlePanel");
const tokenForm = document.getElementById("tokenForm");
const tokenInput = document.getElementById("tokenInput");
const tokenClear = document.getElementById("tokenClear");

const TOKEN_STORAGE_KEY = "cesium.ion.token";

let viewer;
let handler;

const pinBuilder = new Cesium.PinBuilder();
const pinImage = pinBuilder
  .fromColor(Cesium.Color.fromCssColorString("#f36c3d"), 48)
  .toDataURL();

const buildViewer = async (token) => {
  if (!token) {
    statusEl.textContent = "Enter a Cesium ion token to load terrain.";
    return;
  }

  statusEl.textContent = "Connecting to Cesium ion…";
  Cesium.Ion.defaultAccessToken = token.trim();

  if (viewer) {
    viewer.destroy();
    viewer = undefined;
  }
  if (handler) {
    handler.destroy();
    handler = undefined;
  }

  try {
    const terrainProvider = await Cesium.createWorldTerrainAsync();

    viewer = new Cesium.Viewer("cesiumContainer", {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      terrainProvider,
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    await loadObservationPins();
    bindPickHandler();
  } catch (error) {
    statusEl.textContent =
      "Unable to load Cesium terrain. Check your token and try again.";
    console.error(error);
  }
};

const loadObservationPins = async () => {
  const dataSourcePromise = Cesium.GeoJsonDataSource.load(
    "data/observations.geojson",
    {
      clampToGround: true,
    }
  );

  const dataSource = await viewer.dataSources.add(dataSourcePromise);
  const entities = dataSource.entities.values;

  entities.forEach((entity) => {
    if (Cesium.defined(entity.position)) {
      entity.billboard = new Cesium.BillboardGraphics({
        image: pinImage,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        height: 48,
        width: 48,
      });
    }
  });

  viewer.flyTo(dataSource, {
    duration: 1.6,
  });

  statusEl.textContent = `${entities.length} observations loaded`;
};

const bindPickHandler = () => {
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);

    if (!Cesium.defined(picked) || !Cesium.defined(picked.id)) {
      return;
    }

    const entity = picked.id;
    const properties = entity.properties;
    if (!properties) {
      return;
    }

    const title = properties.title?.getValue() ?? entity.name ?? "Observation";
    const html = properties.articleHtml?.getValue();
    const url = properties.articleUrl?.getValue();
    const summary = properties.summary?.getValue();

    articleTitle.textContent = title;
    panel.scrollTo({ top: 0, behavior: "smooth" });

    let bodyMarkup = "";
    if (summary) {
      bodyMarkup += `<p>${summary}</p>`;
    }

    if (html) {
      bodyMarkup += html;
    } else if (url) {
      bodyMarkup += `<p><a href="${url}" target="_blank" rel="noopener">Read the full article</a></p>`;
    } else {
      bodyMarkup +=
        "<p>No article content is available for this observation.</p>";
    }

    articleBody.innerHTML = bodyMarkup;
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
};

const initializeFromStorage = () => {
  const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (savedToken) {
    tokenInput.value = savedToken;
    buildViewer(savedToken);
  } else {
    statusEl.textContent = "Enter a token to load terrain…";
  }
};

tokenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) {
    statusEl.textContent = "Paste a Cesium ion token to continue.";
    return;
  }

  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  buildViewer(token);
});

tokenClear.addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  tokenInput.value = "";
  statusEl.textContent = "Token cleared. Paste a new token to load terrain.";
  if (viewer) {
    viewer.destroy();
    viewer = undefined;
  }
  if (handler) {
    handler.destroy();
    handler = undefined;
  }
});

initializeFromStorage();
