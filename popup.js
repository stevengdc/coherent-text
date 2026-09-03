const apiKey = document.getElementById("apiKey");
const model = document.getElementById("model");
const prompt = document.getElementById("systemPrompt");
const status = document.getElementById("status");

async function loadDefaultPrompt() {
  const response = await fetch(chrome.runtime.getURL("prompt.txt"));

  if (!response.ok) {
    throw new Error("Não foi possível carregar prompt.txt.");
  }

  return (await response.text()).trim();
}

let defaultPrompt = "";

Promise.all([
  chrome.storage.local.get(["apiKey", "model", "systemPrompt"]),
  loadDefaultPrompt()
]).then(([data, loadedPrompt]) => {
  defaultPrompt = loadedPrompt;
  apiKey.value = data.apiKey || "";
  model.value = data.model || "gpt-5.4-mini";
  prompt.value = data.systemPrompt || defaultPrompt;
}).catch(error => {
  status.textContent = error.message;
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKey.value.trim(),
    model: model.value.trim() || "gpt-5.4-mini",
    systemPrompt: prompt.value.trim() || defaultPrompt
  });
  status.textContent = "Guardado.";
  setTimeout(() => status.textContent = "", 2000);
});
