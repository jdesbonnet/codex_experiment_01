/* global Cesium */

const statusEl = document.getElementById("status");
const productListEl = document.getElementById("productList");
const productSummaryEl = document.getElementById("productSummary");
const productDetailEl = document.getElementById("productDetail");
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const renderModeInputs = document.querySelectorAll(
  "input[name=renderMode]"
);

const DEFAULT_AOI_BOUNDS = {
  west: -122.071,
  south: 37.364,
  east: -121.891,
  north: 37.492,
};

let viewer;
let productCatalog = [];
let activeProduct;
let activeLayer;
let activeMode = "rgb";
let selectionSource;
let timelineEntitiesSource;
let lastSelectionTime;
let supportsGeoTiff = true;

const storageKeys = {
  token: "geoTiffCesiumToken",
  api: "geoTiffCatalogApi",
  payload: "geoTiffCatalogPayload",
};

const createImageryProvider = () =>
  new Cesium.OpenStreetMapImageryProvider({
    url: "https://a.tile.openstreetmap.org/",
  });

const setStatus = (message) => {
  statusEl.textContent = message;
};

const setGeoTiffSupportState = (supported) => {
  supportsGeoTiff = supported;
  renderModeInputs.forEach((input) => {
    input.disabled = !supported;
  });
};

const readStoredValue = (key) => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch (error) {
    console.warn("Unable to read stored setting", error);
    return "";
  }
};

const getTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? readStoredValue(storageKeys.token);
};

const getApiFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("api") ?? readStoredValue(storageKeys.api);
};

const getPayloadFromStorage = () => {
  const stored = readStoredValue(storageKeys.payload);
  if (!stored) {
    return null;
  }
  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error("Stored payload is not an array");
  }
  return parsed;
};

const formatDateLabel = (rawDate) => {
  if (typeof rawDate !== "string") {
    return "";
  }
  return rawDate;
};

const parseApiDate = (rawDate) => {
  if (typeof rawDate !== "string") {
    return null;
  }
  const normalized = rawDate.includes("T")
    ? rawDate
    : `${rawDate}T00:00:00Z`;
  const dateObj = new Date(normalized);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
};

const buildProductFromApi = (entry, index) => {
  if (!entry.url || typeof entry.url !== "string") {
    throw new Error(`Missing URL for product entry ${index + 1}`);
  }
  const dateObj = parseApiDate(entry.date);
  if (!dateObj) {
    throw new Error(`Invalid date for product entry ${index + 1}`);
  }
  const cloudValue = Number(entry.cloud);
  const cloudCover = Number.isFinite(cloudValue)
    ? Math.round(cloudValue * 100)
    : 0;
  return {
    id: `${entry.name ?? "product"}-${index + 1}`.replace(/\s+/g, "-"),
    name: entry.name ?? `Product ${index + 1}`,
    date: formatDateLabel(entry.date),
    cloudCover,
    url: entry.url,
    aoiBounds: DEFAULT_AOI_BOUNDS,
    dateObj,
  };
};

const fetchProductApi = async (apiUrl) => {
  const response = await fetch(apiUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("API response was not an array");
  }
  return payload.map((entry, index) => buildProductFromApi(entry, index));
};

const buildViewer = async (token) => {
  const trimmedToken = token?.trim();
  const useToken = Boolean(trimmedToken);

  if (useToken) {
    Cesium.Ion.defaultAccessToken = trimmedToken;
  }

  let terrainProvider;
  try {
    terrainProvider = useToken
      ? await Cesium.createWorldTerrainAsync()
      : new Cesium.EllipsoidTerrainProvider();
  } catch (error) {
    console.warn("Falling back to ellipsoid terrain", error);
    terrainProvider = new Cesium.EllipsoidTerrainProvider();
  }

  viewer = new Cesium.Viewer("cesiumContainer", {
    animation: true,
    timeline: true,
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
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
  viewer.clock.shouldAnimate = false;
  viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
  viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;
  viewer.scene.screenSpaceCameraController.inertiaZoom = 0;

  selectionSource = new Cesium.CustomDataSource("active-product");
  timelineEntitiesSource = new Cesium.CustomDataSource("product-timeline");
  viewer.dataSources.add(selectionSource);
  viewer.dataSources.add(timelineEntitiesSource);

  viewer.clock.onTick.addEventListener(() => {
    if (!activeProduct) {
      return;
    }

    const currentTime = viewer.clock.currentTime;
    if (
      lastSelectionTime &&
      Cesium.JulianDate.secondsDifference(currentTime, lastSelectionTime) === 0
    ) {
      return;
    }

    const closest = findClosestProduct(currentTime);
    if (!closest) {
      return;
    }

    const difference = Math.abs(
      Cesium.JulianDate.secondsDifference(currentTime, closest.julianDate)
    );

    if (difference < 43200 && closest !== activeProduct) {
      selectProduct(closest, { flyTo: false, updateClock: false });
    }
  });
};

const findClosestProduct = (julianDate) => {
  if (productCatalog.length === 0) {
    return null;
  }

  return productCatalog.reduce((closest, product) => {
    const diff = Math.abs(
      Cesium.JulianDate.secondsDifference(julianDate, product.julianDate)
    );
    if (!closest || diff < closest.diff) {
      return { product, diff };
    }
    return closest;
  }, null)?.product;
};

const createTimelineEntities = () => {
  timelineEntitiesSource.entities.removeAll();

  productCatalog.forEach((product) => {
    const start = product.julianDate;
    const stop = Cesium.JulianDate.addDays(
      product.julianDate,
      1,
      new Cesium.JulianDate()
    );

    const center = Cesium.Rectangle.center(product.aoiRectangle);
    timelineEntitiesSource.entities.add({
      id: product.id,
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({ start, stop }),
      ]),
      position: Cesium.Cartesian3.fromRadians(center.longitude, center.latitude),
      point: new Cesium.PointGraphics({
        pixelSize: 6,
        color: Cesium.Color.fromCssColorString("#ffd97d"),
        outlineColor: Cesium.Color.fromCssColorString("#1f2d24"),
        outlineWidth: 1,
      }),
    });
  });
};

const updateTimelineRange = () => {
  if (productCatalog.length === 0) {
    return;
  }

  const dates = productCatalog.map((product) => product.julianDate);
  const start = Cesium.JulianDate.addDays(
    dates[0],
    -10,
    new Cesium.JulianDate()
  );
  const stop = Cesium.JulianDate.addDays(
    dates[dates.length - 1],
    10,
    new Cesium.JulianDate()
  );

  viewer.clock.startTime = start;
  viewer.clock.stopTime = stop;
  viewer.clock.currentTime = dates[dates.length - 1];
  viewer.timeline.zoomTo(start, stop);
};

const updateProductList = () => {
  productListEl.innerHTML = "";
  if (productCatalog.length === 0) {
    productSummaryEl.textContent = "No products available.";
    return;
  }
  productSummaryEl.textContent = `${productCatalog.length} products from ${
    productCatalog[0].date
  } to ${productCatalog[productCatalog.length - 1].date}`;

  productCatalog.forEach((product) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "product-card";
    card.dataset.productId = product.id;
    card.innerHTML = `
      <strong>${product.name}</strong>
      <span class="product-meta">${product.date} · Cloud cover ${product.cloudCover}%</span>
    `;
    card.addEventListener("click", () => {
      selectProduct(product, { flyTo: true, updateClock: true });
    });
    productListEl.appendChild(card);
  });
};

const updateProductDetail = () => {
  if (!activeProduct) {
    productDetailEl.innerHTML =
      "<p>Select a product on the timeline or list to load imagery.</p>";
    return;
  }

  productDetailEl.innerHTML = `
    <h4>${activeProduct.name}</h4>
    <dl>
      <dt>Product ID</dt>
      <dd>${activeProduct.id}</dd>
      <dt>Date</dt>
      <dd>${activeProduct.date}</dd>
      <dt>Cloud cover</dt>
      <dd>${activeProduct.cloudCover}%</dd>
      <dt>COG URL</dt>
      <dd><span>${activeProduct.url}</span></dd>
      <dt>Mode</dt>
      <dd>${activeMode.toUpperCase()}</dd>
    </dl>
  `;
};

const updateActiveListCard = () => {
  const cards = productListEl.querySelectorAll(".product-card");
  cards.forEach((card) => {
    card.classList.toggle(
      "active",
      card.dataset.productId === activeProduct?.id
    );
  });
};

const createNdviRasterFunction = () => {
  if (!Cesium.RasterFunction) {
    return null;
  }

  const ramp = [
    { stop: -0.2, color: Cesium.Color.fromCssColorString("#6b2f2f") },
    { stop: 0, color: Cesium.Color.fromCssColorString("#c87f4b") },
    { stop: 0.2, color: Cesium.Color.fromCssColorString("#e2c65c") },
    { stop: 0.4, color: Cesium.Color.fromCssColorString("#a9d86f") },
    { stop: 0.6, color: Cesium.Color.fromCssColorString("#5dbb63") },
    { stop: 0.8, color: Cesium.Color.fromCssColorString("#1f8a4c") },
  ];

  const pickColor = (value) => {
    const clampValue = Math.max(-1, Math.min(1, value));
    for (let i = 0; i < ramp.length - 1; i += 1) {
      const current = ramp[i];
      const next = ramp[i + 1];
      if (clampValue <= next.stop) {
        const t = (clampValue - current.stop) / (next.stop - current.stop);
        return Cesium.Color.lerp(current.color, next.color, t, new Cesium.Color());
      }
    }
    return ramp[ramp.length - 1].color;
  };

  return new Cesium.RasterFunction({
    numberOfInputs: 2,
    evaluate: (pixel, result) => {
      const nir = pixel[0];
      const red = pixel[1];
      if (!Number.isFinite(nir) || !Number.isFinite(red) || nir + red === 0) {
        result.red = 0;
        result.green = 0;
        result.blue = 0;
        result.alpha = 0;
        return result;
      }
      const ndvi = (nir - red) / (nir + red);
      const color = pickColor(ndvi);
      result.red = Math.round(color.red * 255);
      result.green = Math.round(color.green * 255);
      result.blue = Math.round(color.blue * 255);
      result.alpha = 255;
      return result;
    },
  });
};

const createGeoTiffProvider = async (product) => {
  if (!supportsGeoTiff || !Cesium.GeoTIFFImageryProvider?.fromUrl) {
    throw new Error("GeoTIFF imagery provider is unavailable in this build.");
  }

  const options = {
    enablePickFeatures: false,
    maximumLevel: 16,
  };

  if (activeMode === "rgb") {
    options.bandIndices = [0, 1, 2];
  } else {
    options.bandIndices = [3, 0];
    const rasterFunction = createNdviRasterFunction();
    if (rasterFunction) {
      options.rasterFunction = rasterFunction;
    }
  }

  return Cesium.GeoTIFFImageryProvider.fromUrl(product.url, options);
};

const updateImageryLayer = async () => {
  if (!activeProduct || !viewer) {
    return;
  }

  if (!supportsGeoTiff) {
    setStatus(
      "GeoTIFF imagery provider is unavailable in this build. Use a Cesium build with GeoTIFF support."
    );
    return;
  }

  setStatus(`Loading ${activeMode.toUpperCase()} imagery…`);

  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer, true);
    activeLayer = undefined;
  }

  try {
    const provider = await createGeoTiffProvider(activeProduct);
    activeLayer = viewer.imageryLayers.addImageryProvider(provider);
    activeLayer.alpha = 1.0;

    if (activeMode === "rgb") {
      activeLayer.brightness = 1.1;
      activeLayer.contrast = 1.25;
      activeLayer.saturation = 1.15;
      activeLayer.gamma = 1.05;
    }

    setStatus(
      `${activeProduct.name} loaded · ${activeMode.toUpperCase()} mode`
    );
  } catch (error) {
    console.error("Unable to load GeoTIFF imagery", error);
    setStatus("Unable to load the GeoTIFF imagery. Check the COG URL.");
  }
};

const updateSelectionRectangle = () => {
  selectionSource.entities.removeAll();
  if (!activeProduct) {
    return;
  }

  selectionSource.entities.add({
    rectangle: {
      coordinates: activeProduct.aoiRectangle,
      material: Cesium.Color.fromCssColorString("#4fbf7a").withAlpha(0.2),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#2f8d5c"),
    },
  });
};

const selectProduct = (product, { flyTo, updateClock }) => {
  activeProduct = product;
  updateActiveListCard();
  updateProductDetail();
  updateSelectionRectangle();

  if (updateClock) {
    viewer.clock.currentTime = product.julianDate;
    lastSelectionTime = product.julianDate;
  }

  if (flyTo) {
    viewer.camera.flyTo({
      destination: product.aoiRectangle,
      duration: 1.4,
    });
  }

  updateImageryLayer();
};

const zoomTimeline = (direction) => {
  if (!viewer) {
    return;
  }

  const start = viewer.clock.startTime;
  const stop = viewer.clock.stopTime;
  const spanSeconds = Math.abs(
    Cesium.JulianDate.secondsDifference(stop, start)
  );
  const center = Cesium.JulianDate.addSeconds(
    start,
    spanSeconds / 2,
    new Cesium.JulianDate()
  );
  const zoomFactor = direction === "in" ? 0.5 : 2;
  const newSpan = spanSeconds * zoomFactor;

  const newStart = Cesium.JulianDate.addSeconds(
    center,
    -newSpan / 2,
    new Cesium.JulianDate()
  );
  const newStop = Cesium.JulianDate.addSeconds(
    center,
    newSpan / 2,
    new Cesium.JulianDate()
  );

  viewer.clock.startTime = newStart;
  viewer.clock.stopTime = newStop;
  viewer.timeline.zoomTo(newStart, newStop);
};

const attachUIHandlers = () => {
  renderModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      activeMode = input.value;
      updateProductDetail();
      updateImageryLayer();
    });
  });

  zoomInButton.addEventListener("click", () => zoomTimeline("in"));
  zoomOutButton.addEventListener("click", () => zoomTimeline("out"));
};

const initializeProducts = async () => {
  const apiUrl = getApiFromUrl().trim();
  let payload;
  try {
    payload = getPayloadFromStorage();
  } catch (error) {
    console.error("Stored payload invalid", error);
    setStatus("Stored payload is invalid. Clear settings to continue.");
    productCatalog = [];
  }

  if (payload) {
    setStatus("Loading products from pasted payload…");
    productCatalog = payload.map((entry, index) =>
      buildProductFromApi(entry, index)
    );
  } else if (apiUrl) {
    setStatus("Loading products from API…");
    productCatalog = await fetchProductApi(apiUrl);
  } else {
    setStatus("Add an API endpoint or paste a JSON payload to load products.");
    productCatalog = [];
  }
  productCatalog.sort((a, b) => a.dateObj - b.dateObj);

  productCatalog = productCatalog.map((product) => ({
    ...product,
    julianDate: Cesium.JulianDate.fromDate(product.dateObj),
    aoiRectangle: Cesium.Rectangle.fromDegrees(
      product.aoiBounds.west,
      product.aoiBounds.south,
      product.aoiBounds.east,
      product.aoiBounds.north
    ),
  }));

  updateProductList();
  createTimelineEntities();
  if (productCatalog.length > 0) {
    updateTimelineRange();
    selectProduct(productCatalog[productCatalog.length - 1], {
      flyTo: true,
      updateClock: true,
    });
  }
};

const startApp = async () => {
  try {
    setStatus("Connecting to Cesium…");
    await buildViewer(getTokenFromUrl());
    setGeoTiffSupportState(Boolean(Cesium.GeoTIFFImageryProvider?.fromUrl));
    attachUIHandlers();
    await initializeProducts();
  } catch (error) {
    console.error("Unable to start app", error);
    setStatus("Unable to start the Cesium experience.");
  }
};

startApp();
