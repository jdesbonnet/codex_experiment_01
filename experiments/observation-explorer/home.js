const homeForm = document.getElementById("homeTokenForm");
const homeInput = document.getElementById("homeTokenInput");
const skipButton = document.getElementById("skipToken");

const goToApp = (token) => {
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  const url = params.toString()
    ? `app.html?${params.toString()}`
    : "app.html";
  window.location.assign(url);
};

homeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const token = homeInput.value.trim();
  goToApp(token);
});

skipButton.addEventListener("click", () => {
  goToApp("");
});
