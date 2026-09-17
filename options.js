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
const commandPromptsContainer = document.getElementById("commandPrompts");
const providerButtons = [...document.querySelectorAll(".provider")];

let activeProvider = null;
let apiKeys = {};
let models = {};
let defaultPrompt = "";
let defaultCommands = {};

async function loadDefaultPrompt() {
  const response = await fetch(chrome.runtime.getURL("prompt.txt"));
  if (!response.ok) throw new Error("Não foi possível carregar prompt.txt.");
  return (await response.text()).trim();
}

async function loadDefaultCommands() {
  const response = await fetch(chrome.runtime.getURL("commands.json"));
  if (!response.ok) throw new Error("Não foi possível carregar commands.json.");
  return response.json();
}

function renderCommandPrompts(commandPrompts = {}) {
  commandPromptsContainer.replaceChildren();

  for (const [id, command] of Object.entries(defaultCommands)) {
    const wrapper = document.createElement("div");
    wrapper.className = "command-item";

    const label = document.createElement("label");
    label.htmlFor = `command-${id}`;
    label.textContent = command.label;

    const textarea = document.createElement("textarea");
    textarea.id = `command-${id}`;
    textarea.dataset.command = id;
    textarea.spellcheck = true;
    textarea.value = commandPrompts[id] || command.instruction;

    wrapper.append(label, textarea);
    commandPromptsContainer.appendChild(wrapper);
  }
}

function readCommandPrompts() {
  return Object.fromEntries(
    [...commandPromptsContainer.querySelectorAll("textarea[data-command]")]
      .map(textarea => [
        textarea.dataset.command,
        textarea.value.trim() || defaultCommands[textarea.dataset.command].instruction
      ])
  );
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
  const [stored, loadedPrompt, loadedCommands] = await Promise.all([
    chrome.storage.local.get(["provider", "apiKeys", "models", "apiKey", "model", "systemPrompt", "commandPrompts"]),
    loadDefaultPrompt(),
    loadDefaultCommands()
  ]);

  defaultPrompt = loadedPrompt;
  defaultCommands = loadedCommands;
  const initialProvider = PROVIDERS[stored.provider] ? stored.provider : "openai";
  apiKeys = { ...(stored.apiKeys || {}) };
  models = { ...(stored.models || {}) };

  if (!apiKeys.openai && stored.apiKey) apiKeys.openai = stored.apiKey;
  if (!models.openai && stored.model) models.openai = stored.model;

  promptInput.value = stored.systemPrompt || defaultPrompt;
  renderCommandPrompts(stored.commandPrompts || {});
  showProvider(initialProvider);
}

document.getElementById("resetCommands").addEventListener("click", () => {
  renderCommandPrompts();
  status.textContent = "Instruções predefinidas repostas. Guarde para aplicar.";
});

document.getElementById("save").addEventListener("click", async () => {
  rememberVisibleProvider();
  await chrome.storage.local.set({
    provider: activeProvider,
    apiKeys,
    models,
    systemPrompt: promptInput.value.trim() || defaultPrompt,
    commandPrompts: readCommandPrompts()
  });

  status.textContent = "Configuração guardada.";
  window.setTimeout(() => { status.textContent = ""; }, 2500);
});

initialize().catch(error => {
  status.textContent = error.message;
});
