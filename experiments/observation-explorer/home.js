const homeForm = document.getElementById("homeTokenForm");
const homeInput = document.getElementById("homeTokenInput");
const homeApiInput = document.getElementById("homeApiInput");
const skipButton = document.getElementById("skipToken");

const goToApp = (token, apiUrl) => {
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  if (apiUrl) {
    params.set("api", apiUrl);
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
  goToApp(token, apiUrl);
});

skipButton.addEventListener("click", () => {
  const apiUrl = homeApiInput.value.trim();
  goToApp("", apiUrl);
});
