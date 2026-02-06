/* global Cesium */

const statusEl = document.getElementById("status");
const articleTitle = document.getElementById("articleTitle");
const articleBody = document.getElementById("articleBody");
const panel = document.getElementById("articlePanel");

let viewer;
let handler;

const pinBuilder = new Cesium.PinBuilder();
const pinImage = pinBuilder
  .fromColor(Cesium.Color.fromCssColorString("#f36c3d"), 48)
  .toDataURL();

const createImageryProvider = () =>
  new Cesium.OpenStreetMapImageryProvider({
    url: "https://a.tile.openstreetmap.org/",
  });

const buildViewer = async (token) => {
  const trimmedToken = token?.trim();
  const useToken = Boolean(trimmedToken);

  if (viewer) {
    viewer.destroy();
    viewer = undefined;
  }
  if (handler) {
    handler.destroy();
    handler = undefined;
  }

  statusEl.textContent = useToken
    ? "Connecting to Cesium ion…"
    : "Loading map without a token…";

  let terrainProvider;
  try {
    if (useToken) {
      Cesium.Ion.defaultAccessToken = trimmedToken;
      terrainProvider = await Cesium.createWorldTerrainAsync();
    } else {
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }

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
      imageryProvider: useToken ? undefined : createImageryProvider(),
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    await loadObservationPins();
    bindPickHandler();
  } catch (error) {
    statusEl.textContent = useToken
      ? "Unable to load Cesium terrain. Check your token and try again."
      : "Unable to load the map. Try again or add a token.";
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

const getTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
};

buildViewer(getTokenFromUrl());
