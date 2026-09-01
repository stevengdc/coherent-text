const DEFAULT_PROMPT =
"Reescreve o texto em português europeu (PT-PT), tornando-o mais coerente, claro, natural e fluido. Mantém exatamente o significado e a informação original. Não inventes informação, não acrescentes comentários e não uses português do Brasil. Mantém o tom e o nível de formalidade do original. Devolve apenas o texto final, sem aspas nem explicações.";

const apiKey = document.getElementById("apiKey");
const model = document.getElementById("model");
const prompt = document.getElementById("systemPrompt");
const status = document.getElementById("status");

chrome.storage.local.get(["apiKey","model","systemPrompt"], data => {
  apiKey.value = data.apiKey || "";
  model.value = data.model || "gpt-5.4-mini";
  prompt.value = data.systemPrompt || DEFAULT_PROMPT;
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKey.value.trim(),
    model: model.value.trim() || "gpt-5.4-mini",
    systemPrompt: prompt.value.trim() || DEFAULT_PROMPT
  });
  status.textContent = "Guardado.";
  setTimeout(() => status.textContent = "", 2000);
});