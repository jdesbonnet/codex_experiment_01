/* global Cesium */

const statusEl = document.getElementById("status");
const articleTitle = document.getElementById("articleTitle");
const articleBody = document.getElementById("articleBody");
const panel = document.getElementById("articlePanel");
const tourDurationInput = document.getElementById("tourDuration");
const startTourButton = document.getElementById("startTour");
const stopTourButton = document.getElementById("stopTour");
const startRecordingButton = document.getElementById("startRecording");
const stopRecordingButton = document.getElementById("stopRecording");
const downloadRecordingLink = document.getElementById("downloadRecording");

let viewer;
let handler;
let renderStopTimeout;
let hasScheduledRenderStop = false;
let observationEntities = [];
let isTouring = false;
let activeSpinCleanup;
let tourRunId = 0;
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

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
  if (renderStopTimeout) {
    window.clearTimeout(renderStopTimeout);
    renderStopTimeout = undefined;
  }
  hasScheduledRenderStop = false;

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
    bindTourControls();
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

  observationEntities = entities.filter((entity) =>
    Cesium.defined(entity.position)
  );

  observationEntities.forEach((entity) => {
    if (Cesium.defined(entity.position)) {
      entity.billboard = new Cesium.BillboardGraphics({
        image: pinImage,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        height: 48,
        width: 48,
      });
    }
  });

  await viewer.flyTo(dataSource, {
    duration: 1.6,
  });

  scheduleRenderStop();

  statusEl.textContent = `${entities.length} observations loaded`;
};

const updateArticleFromEntity = (entity) => {
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
    bodyMarkup += "<p>No article content is available for this observation.</p>";
  }

  articleBody.innerHTML = bodyMarkup;
};

const scheduleRenderStop = () => {
  if (hasScheduledRenderStop || !viewer) {
    return;
  }

  hasScheduledRenderStop = true;
  renderStopTimeout = window.setTimeout(() => {
    if (!viewer) {
      return;
    }

    viewer.clock.shouldAnimate = false;
    viewer.scene.requestRenderMode = true;
    viewer.scene.requestRender();
  }, 5000);
};

const bindPickHandler = () => {
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);

    if (!Cesium.defined(picked) || !Cesium.defined(picked.id)) {
      return;
    }

    const entity = picked.id;
    updateArticleFromEntity(entity);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
};

const getTourDurationMs = () => {
  const parsed = Number.parseFloat(tourDurationInput?.value);
  const seconds = Number.isFinite(parsed) ? parsed : 8;
  return Math.min(30, Math.max(3, seconds)) * 1000;
};

const ensureActiveRendering = () => {
  if (!viewer) {
    return;
  }
  if (renderStopTimeout) {
    window.clearTimeout(renderStopTimeout);
    renderStopTimeout = undefined;
    hasScheduledRenderStop = false;
  }
  viewer.clock.shouldAnimate = true;
  viewer.scene.requestRenderMode = false;
};

const stopActiveSpin = () => {
  if (activeSpinCleanup) {
    activeSpinCleanup();
    activeSpinCleanup = undefined;
  }
};

const spinAroundEntity = (entity, durationMs, runId) =>
  new Promise((resolve) => {
    if (!viewer) {
      resolve();
      return;
    }

    const position = entity.position?.getValue(viewer.clock.currentTime);
    if (!position) {
      resolve();
      return;
    }

    const camera = viewer.scene.camera;
    const initialHeading = camera.heading;
    const pitch = Cesium.Math.clamp(camera.pitch, -1.4, -0.1);
    const distance = Cesium.Cartesian3.distance(camera.position, position);
    const range = Math.max(800, distance);
    const startTime = performance.now();

    const spinStep = () => {
      if (!viewer || !isTouring || runId !== tourRunId) {
        viewer?.scene.preRender.removeEventListener(spinStep);
        camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        resolve();
        return;
      }

      const elapsed = performance.now() - startTime;
      const angle =
        initialHeading + (elapsed / durationMs) * Cesium.Math.TWO_PI;
      camera.lookAt(position, new Cesium.HeadingPitchRange(angle, pitch, range));

      if (elapsed >= durationMs) {
        viewer.scene.preRender.removeEventListener(spinStep);
        camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        resolve();
      }
    };

    stopActiveSpin();
    activeSpinCleanup = () => {
      viewer.scene.preRender.removeEventListener(spinStep);
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    };

    viewer.scene.preRender.addEventListener(spinStep);
  });

const flyToEntity = (entity) =>
  viewer.flyTo(entity, {
    duration: 2.4,
  });

const startTour = async () => {
  if (!viewer || isTouring || observationEntities.length === 0) {
    return;
  }

  isTouring = true;
  tourRunId += 1;
  const runId = tourRunId;
  startTourButton.disabled = true;
  stopTourButton.disabled = false;
  statusEl.textContent = "Tour running…";
  downloadRecordingLink.hidden = true;

  ensureActiveRendering();

  for (const entity of observationEntities) {
    if (!isTouring || runId !== tourRunId) {
      break;
    }
    try {
      await flyToEntity(entity);
    } catch (error) {
      console.warn("Unable to fly to observation", error);
    }
    if (!isTouring || runId !== tourRunId) {
      break;
    }
    updateArticleFromEntity(entity);
    await spinAroundEntity(entity, getTourDurationMs(), runId);
  }

  finishTour();
};

const finishTour = () => {
  isTouring = false;
  stopActiveSpin();
  startTourButton.disabled = false;
  stopTourButton.disabled = true;
  statusEl.textContent = isRecording
    ? "Recording in progress…"
    : "Tour finished.";
  if (!isRecording) {
    scheduleRenderStop();
  }
};

const stopTour = () => {
  if (!isTouring) {
    return;
  }
  tourRunId += 1;
  isTouring = false;
  finishTour();
};

const startRecording = () => {
  if (!viewer || isRecording) {
    return;
  }

  const canvas = viewer.scene.canvas;
  const stream = canvas.captureStream(60);
  const options = {};
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    options.mimeType = "video/webm;codecs=vp9";
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    options.mimeType = "video/webm;codecs=vp8";
  } else if (MediaRecorder.isTypeSupported("video/webm")) {
    options.mimeType = "video/webm";
  }

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, options);
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  });
  mediaRecorder.addEventListener("stop", () => {
    const blob = new Blob(recordedChunks, {
      type: mediaRecorder.mimeType || "video/webm",
    });
    const url = URL.createObjectURL(blob);
    downloadRecordingLink.href = url;
    downloadRecordingLink.download = `observation-tour-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.webm`;
    downloadRecordingLink.hidden = false;
    statusEl.textContent = "Recording ready to download.";
  });

  mediaRecorder.start();
  isRecording = true;
  startRecordingButton.disabled = true;
  stopRecordingButton.disabled = false;
  statusEl.textContent = "Recording in progress…";
  ensureActiveRendering();
};

const stopRecording = () => {
  if (!mediaRecorder || !isRecording) {
    return;
  }
  mediaRecorder.stop();
  isRecording = false;
  startRecordingButton.disabled = false;
  stopRecordingButton.disabled = true;
  if (!isTouring) {
    scheduleRenderStop();
  }
};

const bindTourControls = () => {
  startTourButton?.addEventListener("click", startTour);
  stopTourButton?.addEventListener("click", stopTour);
  startRecordingButton?.addEventListener("click", startRecording);
  stopRecordingButton?.addEventListener("click", stopRecording);
};

const getTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
};

buildViewer(getTokenFromUrl());
