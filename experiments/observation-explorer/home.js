const homeForm = document.getElementById("homeTokenForm");
const homeInput = document.getElementById("homeTokenInput");
const homeApiInput = document.getElementById("homeApiInput");
const homePayloadInput = document.getElementById("homePayloadInput");
const skipButton = document.getElementById("skipToken");
const clearButton = document.getElementById("clearSettings");
const homeSavedStatus = document.getElementById("homeSavedStatus");
const storageKeys = {
  token: "geoTiffCesiumToken",
  api: "geoTiffCatalogApi",
  payload: "geoTiffCatalogPayload",
};

const readStoredValue = (key) => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch (error) {
    console.warn("Unable to read stored setting", error);
    return "";
  }
};

const writeStoredValue = (key, value) => {
  try {
    if (!value) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Unable to store setting", error);
  }
};

const persistPayload = (payloadValue) => {
  if (!payloadValue) {
    writeStoredValue(storageKeys.payload, "");
    return false;
  }

  try {
    const parsed = JSON.parse(payloadValue);
    if (!Array.isArray(parsed)) {
      throw new Error("Payload must be a JSON array.");
    }
    writeStoredValue(storageKeys.payload, JSON.stringify(parsed));
    return true;
  } catch (error) {
    window.alert(
      "The payload must be valid JSON and formatted as an array of catalog entries."
    );
    return false;
  }
};

const storeSettings = (token, apiUrl) => {
  writeStoredValue(storageKeys.token, token);
  writeStoredValue(storageKeys.api, apiUrl);
};

const goToApp = () => {
  window.location.assign("app.html");
};

const updateSavedStatus = () => {
  if (!homeSavedStatus) {
    return;
  }

  const savedFields = [];
  if (readStoredValue(storageKeys.token)) {
    savedFields.push("token");
  }
  if (readStoredValue(storageKeys.api)) {
    savedFields.push("API URL");
  }
  if (readStoredValue(storageKeys.payload)) {
    savedFields.push("catalog payload");
  }

  if (savedFields.length === 0) {
    homeSavedStatus.textContent = "No saved settings found yet.";
    return;
  }

  homeSavedStatus.textContent = `Saved settings loaded for ${savedFields.join(
    ", "
  )}.`;
};

const preloadSettings = () => {
  homeInput.value = readStoredValue(storageKeys.token);
  homeApiInput.value = readStoredValue(storageKeys.api);
  homePayloadInput.value = readStoredValue(storageKeys.payload);
  updateSavedStatus();
};

homeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const token = homeInput.value.trim();
  const apiUrl = homeApiInput.value.trim();
  const payloadValue = homePayloadInput.value.trim();
  const hasPayload = persistPayload(payloadValue);
  if (!payloadValue || hasPayload) {
    storeSettings(token, apiUrl);
    goToApp();
  }
});

skipButton.addEventListener("click", () => {
  const apiUrl = homeApiInput.value.trim();
  const payloadValue = homePayloadInput.value.trim();
  const hasPayload = persistPayload(payloadValue);
  if (!payloadValue || hasPayload) {
    storeSettings("", apiUrl);
    goToApp();
  }
});

clearButton.addEventListener("click", () => {
  writeStoredValue(storageKeys.token, "");
  writeStoredValue(storageKeys.api, "");
  writeStoredValue(storageKeys.payload, "");
  homeInput.value = "";
  homeApiInput.value = "";
  homePayloadInput.value = "";
  updateSavedStatus();
});

preloadSettings();
