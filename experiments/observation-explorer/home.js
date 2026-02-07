const homeForm = document.getElementById("homeTokenForm");
const homeInput = document.getElementById("homeTokenInput");
const homeApiInput = document.getElementById("homeApiInput");
const homePayloadInput = document.getElementById("homePayloadInput");
const skipButton = document.getElementById("skipToken");
const payloadStorageKey = "geoTiffCatalogPayload";

const persistPayload = (payloadValue) => {
  if (!payloadValue) {
    sessionStorage.removeItem(payloadStorageKey);
    return false;
  }

  try {
    const parsed = JSON.parse(payloadValue);
    if (!Array.isArray(parsed)) {
      throw new Error("Payload must be a JSON array.");
    }
    sessionStorage.setItem(payloadStorageKey, JSON.stringify(parsed));
    return true;
  } catch (error) {
    window.alert(
      "The payload must be valid JSON and formatted as an array of catalog entries."
    );
    return false;
  }
};

const goToApp = (token, apiUrl, hasPayload) => {
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  if (apiUrl) {
    params.set("api", apiUrl);
  }
  if (hasPayload) {
    params.set("payload", "1");
  }
  const url = params.toString()
    ? `app.html?${params.toString()}`
    : "app.html";
  window.location.assign(url);
};

homeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const token = homeInput.value.trim();
  const apiUrl = homeApiInput.value.trim();
  const payloadValue = homePayloadInput.value.trim();
  const hasPayload = persistPayload(payloadValue);
  if (!payloadValue || hasPayload) {
    goToApp(token, apiUrl, hasPayload);
  }
});

skipButton.addEventListener("click", () => {
  const apiUrl = homeApiInput.value.trim();
  const payloadValue = homePayloadInput.value.trim();
  const hasPayload = persistPayload(payloadValue);
  if (!payloadValue || hasPayload) {
    goToApp("", apiUrl, hasPayload);
  }
});
