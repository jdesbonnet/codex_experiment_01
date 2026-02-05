/* global Cesium */

const statusEl = document.getElementById("status");
const articleTitle = document.getElementById("articleTitle");
const articleBody = document.getElementById("articleBody");
const panel = document.getElementById("articlePanel");

Cesium.Ion.defaultAccessToken = "";

const viewer = new Cesium.Viewer("cesiumContainer", {
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  fullscreenButton: false,
});

viewer.scene.globe.enableLighting = true;
viewer.scene.skyAtmosphere.show = true;
viewer.scene.globe.depthTestAgainstTerrain = true;

const pinBuilder = new Cesium.PinBuilder();
const pinImage = pinBuilder
  .fromColor(Cesium.Color.fromCssColorString("#f36c3d"), 48)
  .toDataURL();

const dataSourcePromise = Cesium.GeoJsonDataSource.load(
  "data/observations.geojson",
  {
    clampToGround: true,
  }
);

viewer.dataSources.add(dataSourcePromise).then((dataSource) => {
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
});

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

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
