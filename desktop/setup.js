const form = document.querySelector("#setup-form");
const input = document.querySelector("#server-url");
const button = document.querySelector("#connect-button");
const status = document.querySelector("#setup-status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  button.disabled = true;
  button.textContent = "Checking address…";
  try {
    const result = await window.jcstudioSetup.configureServer(input.value.trim());
    if (!result || result.ok !== true) {
      status.textContent = result && typeof result.error === "string"
        ? result.error
        : "The address could not be saved. Check it and try again.";
      return;
    }
    status.style.color = "#276442";
    status.textContent = "Connected. Opening the secure JCStudio sign-in page…";
  } catch {
    status.textContent = "Could not connect. Check the address and try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Connect securely";
  }
});
