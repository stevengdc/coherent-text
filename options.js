const PROVIDERS = {
  openai: { name: "OpenAI", defaultModel: "gpt-5.6-luna", placeholder: "sk-..." },
  anthropic: { name: "Anthropic", defaultModel: "claude-sonnet-5", placeholder: "sk-ant-..." },
  gemini: { name: "Gemini", defaultModel: "gemini-3.5-flash", placeholder: "Chave da API Gemini" },
  xai: { name: "Grok (xAI)", defaultModel: "grok-4.6", placeholder: "xai-..." },
  deepseek: { name: "DeepSeek", defaultModel: "deepseek-flash", placeholder: "sk-..." }
};

const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const modelInput = document.getElementById("model");
const promptInput = document.getElementById("systemPrompt");
const status = document.getElementById("status");
const providerButtons = [...document.querySelectorAll(".provider")];

let activeProvider = null;
let apiKeys = {};
let models = {};
let defaultPrompt = "";

async function loadDefaultPrompt() {
  const response = await fetch(chrome.runtime.getURL("prompt.txt"));
  if (!response.ok) throw new Error("Não foi possível carregar prompt.txt.");
  return (await response.text()).trim();
}

function rememberVisibleProvider() {
  if (!activeProvider) return;
  apiKeys[activeProvider] = apiKeyInput.value.trim();
  models[activeProvider] = modelInput.value.trim();
}

function showProvider(provider) {
  rememberVisibleProvider();
  activeProvider = provider;
  const config = PROVIDERS[provider];

  providerButtons.forEach(button => {
    const selected = button.dataset.provider === provider;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  apiKeyLabel.textContent = `Chave da API — ${config.name}`;
  apiKeyInput.placeholder = config.placeholder;
  apiKeyInput.value = apiKeys[provider] || "";
  modelInput.value = models[provider] || config.defaultModel;
}

providerButtons.forEach(button => {
  button.addEventListener("click", () => showProvider(button.dataset.provider));
});

async function initialize() {
  const [stored, loadedPrompt] = await Promise.all([
    chrome.storage.local.get(["provider", "apiKeys", "models", "apiKey", "model", "systemPrompt"]),
    loadDefaultPrompt()
  ]);

  defaultPrompt = loadedPrompt;
  const initialProvider = PROVIDERS[stored.provider] ? stored.provider : "openai";
  apiKeys = { ...(stored.apiKeys || {}) };
  models = { ...(stored.models || {}) };

  if (!apiKeys.openai && stored.apiKey) apiKeys.openai = stored.apiKey;
  if (!models.openai && stored.model) models.openai = stored.model;

  promptInput.value = stored.systemPrompt || defaultPrompt;
  showProvider(initialProvider);
}

document.getElementById("save").addEventListener("click", async () => {
  rememberVisibleProvider();
  await chrome.storage.local.set({
    provider: activeProvider,
    apiKeys,
    models,
    systemPrompt: promptInput.value.trim() || defaultPrompt
  });

  status.textContent = "Configuração guardada.";
  window.setTimeout(() => { status.textContent = ""; }, 2500);
});

initialize().catch(error => {
  status.textContent = error.message;
});
