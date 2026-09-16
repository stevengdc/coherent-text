const MENU_ID = "coerente-ptpt";

const DEFAULT_MODEL = "gpt-5.6-luna";

const DEFAULT_MODELS = {
  openai: DEFAULT_MODEL,
  anthropic: "claude-sonnet-5",
  gemini: "gemini-3.5-flash",
  xai: "grok-4.6",
  deepseek: "deepseek-flash"
};

let defaultPromptPromise;

function loadDefaultPrompt() {
  if (!defaultPromptPromise) {
    defaultPromptPromise = fetch(
      chrome.runtime.getURL("prompt.txt")
    ).then(response => {
      if (!response.ok) {
        throw new Error("Não foi possível carregar prompt.txt.");
      }

      return response.text();
    }).then(text => text.trim());
  }

  return defaultPromptPromise;
}


// ============================================================
// LOGS
// ============================================================

function log(message, data = null) {
  console.log(
    "[Coerente PT-PT]",
    message,
    data ?? ""
  );
}

function logError(message, error = null) {
  console.group(
    "[Coerente PT-PT] ERRO"
  );

  console.error(
    "Mensagem:",
    message
  );

  if (error) {
    console.error(
      "Erro:",
      error.message || error
    );

    if (error.stack) {
      console.error(
        "Stack:",
        error.stack
      );
    }
  }

  console.groupEnd();
}

function isSupportedPageUrl(url) {
  if (!url) {
    return false;
  }

  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://")
  );
}


// ============================================================
// INSTALAÇÃO
// ============================================================

chrome.runtime.onInstalled.addListener(
  async () => {

    log(
      "Extensão instalada/atualizada."
    );

    try {
      const defaultPrompt =
        await loadDefaultPrompt();

      await chrome.contextMenus.removeAll();

      chrome.contextMenus.create({
        id: MENU_ID,
        title: "Tornar mais coerente (PT-PT)",
        contexts: ["selection"]
      });

      const current =
        await chrome.storage.local.get([
          "model",
          "systemPrompt"
        ]);

      await chrome.storage.local.set({
        model:
          current.model ||
          DEFAULT_MODEL,

        systemPrompt:
          current.systemPrompt ||
          defaultPrompt
      });

      log(
        "Menu criado e configuração inicializada.",
        {
          model:
            current.model ||
            DEFAULT_MODEL
        }
      );

    } catch (error) {
      logError(
        "Erro durante a inicialização.",
        error
      );
    }
  }
);


log(
  "Service Worker iniciado."
);

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});


// ============================================================
// ENVIAR MENSAGEM PARA CONTENT SCRIPT
// ============================================================

async function sendMessageToFrame(
  tabId,
  frameId,
  message
) {
  try {
    log(
      "A enviar mensagem para content.js",
      {
        tabId,
        frameId,
        type:
          message.type
      }
    );

    return await chrome.tabs.sendMessage(
      tabId,
      message,
      {
        frameId
      }
    );

  } catch (error) {
    log(
      "content.js não respondeu. A tentar injeção manual.",
      {
        tabId,
        frameId,
        error:
          error.message
      }
    );

    try {
      await chrome.scripting.executeScript({
        target: {
          tabId,
          frameIds: [
            frameId
          ]
        },

        files: [
          "content.js"
        ]
      });

      log(
        "content.js injetado manualmente.",
        {
          tabId,
          frameId
        }
      );

    } catch (injectError) {
      log(
        "Não foi possível carregar content.js nesta página.",
        {
          error:
            injectError.message
        }
      );

      throw new Error(
        "Não consegui aceder ao editor desta página: " +
        injectError.message
      );
    }

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );

    try {
      const response =
        await chrome.tabs.sendMessage(
          tabId,
          message,
          {
            frameId
          }
        );

      log(
        "Mensagem enviada após injeção.",
        {
          tabId,
          frameId
        }
      );

      return response;

    } catch (retryError) {
      logError(
        "content.js continua sem responder.",
        retryError
      );

      throw new Error(
        "O content script foi carregado, mas não respondeu: " +
        retryError.message
      );
    }
  }
}


// ============================================================
// MENU DE CONTEXTO
// ============================================================

async function handleImproveRequest(
  info,
  tab
) {

    log(
      "Menu clicado.",
      {
        tabId:
          tab?.id,

        frameId:
          info.frameId,

        selectionLength:
          info.selectionText?.length ||
          0,

        preview:
          info.selectionText?.substring(
            0,
            150
          )
      }
    );

    if (
      info.menuItemId !==
      MENU_ID
    ) {
      return;
    }

    if (
      !tab ||
      !tab.id
    ) {
      logError(
        "Tab inválida."
      );

      return;
    }

    const pageIsSupported =
      isSupportedPageUrl(
        info.pageUrl
      ) ||
      isSupportedPageUrl(
        tab.url
      );

    const frameIsSupported =
      isSupportedPageUrl(
        info.frameUrl
      ) ||
      info.frameUrl?.startsWith(
        "about:blank"
      ) ||
      info.frameUrl?.startsWith(
        "about:srcdoc"
      );

    if (
      !pageIsSupported &&
      !frameIsSupported
    ) {
      log(
        "Ação ignorada numa página protegida pelo Chrome.",
        {
          pageUrl:
            info.pageUrl ||
            tab.url,
          frameUrl:
            info.frameUrl
        }
      );

      return;
    }

    const frameId =
      typeof info.frameId ===
      "number"
        ? info.frameId
        : 0;

    try {

      // ------------------------------------------------------
      // OBTER SELEÇÃO
      // ------------------------------------------------------

      const selection =
        await sendMessageToFrame(
          tab.id,
          frameId,
          {
            type:
              "COERENTE_GET_SELECTION"
          }
        );

      console.log(
        "[Coerente PT-PT] Seleção recebida COMPLETA:",
        JSON.stringify(
          selection,
          null,
          2
        )
      );

      if (!selection) {
        console.error(
          "[Coerente PT-PT] content.js não devolveu qualquer objeto."
        );
      } else {
        console.log(
          "[Coerente PT-PT] hasSelection:",
          selection.hasSelection
        );

        console.log(
          "[Coerente PT-PT] type:",
          selection.type
        );

        console.log(
          "[Coerente PT-PT] text:",
          selection.text
        );

        console.log(
          "[Coerente PT-PT] html:",
          selection.html
        );

        console.log(
          "[Coerente PT-PT] diagnóstico:",
          selection.diagnostic
        );
      }

      if (
        !selection ||
        !selection.hasSelection
      ) {
        throw new Error(
          "Não encontrei uma seleção válida no editor."
        );
      }


      // ------------------------------------------------------
      // CONFIGURAÇÃO
      // ------------------------------------------------------

      const settings =
        await chrome.storage.local.get([
          "apiKey",
          "model",
          "provider",
          "apiKeys",
          "models",
          "systemPrompt"
        ]);

      const provider = settings.provider || "openai";
      const apiKeys = { ...(settings.apiKeys || {}) };
      const models = { ...DEFAULT_MODELS, ...(settings.models || {}) };

      if (!apiKeys.openai && settings.apiKey) apiKeys.openai = settings.apiKey;
      if (!settings.models?.openai && settings.model) models.openai = settings.model;

      const apiKey = apiKeys[provider];
      const model = models[provider] || DEFAULT_MODELS[provider];

      if (!apiKey) {
        throw new Error(
          "Não existe uma chave de API configurada para o fornecedor ativo."
        );
      }

      const prompt =
        settings.systemPrompt ||
        await loadDefaultPrompt();

      log(
        "Configuração carregada.",
        {
          model,
          provider,
          hasKey:
            true
        }
      );


      // ------------------------------------------------------
      // OPENAI
      // ------------------------------------------------------

      let result;

      if (
        selection.type ===
        "html"
      ) {
        result =
          await improveHtml(
            selection.html,
            apiKey,
            model,
            prompt,
            provider
          );

      } else {
        result =
          await improvePlainText(
            selection.text,
            apiKey,
            model,
            provider
          );
      }

      log(
        "Resposta da OpenAI recebida.",
        {
          length:
            result.length,

          preview:
            result.substring(
              0,
              200
            )
        }
      );


      // ------------------------------------------------------
      // SUBSTITUIR
      // ------------------------------------------------------

      const replaceResult =
        await sendMessageToFrame(
          tab.id,
          frameId,
          {
            type:
              "COERENTE_REPLACE_SELECTION",

            content:
              result,

            contentType:
              selection.type
          }
        );

      log(
        "Resultado da substituição.",
        replaceResult
      );

      if (
        !replaceResult ||
        !replaceResult.success
      ) {
        throw new Error(
          replaceResult?.error ||
          "Não consegui substituir o conteúdo no editor."
        );
      }

      log(
        "Texto substituído com sucesso."
      );

    } catch (error) {
      log(
        "O processamento não foi concluído.",
        {
          error:
            error.message
        }
      );
    }
  }

chrome.contextMenus.onClicked.addListener(
  handleImproveRequest
);


// O content script deteta o atalho no próprio editor. Desta
// forma, o frame exato da seleção chega diretamente ao background.
chrome.runtime.onMessage.addListener(
  (
    message,
    sender
  ) => {
    if (
      message.type !==
      "COERENTE_KEYBOARD_SHORTCUT"
    ) {
      return;
    }

    if (
      !sender.tab?.id
    ) {
      logError(
        "O atalho foi usado sem um separador válido."
      );

      return;
    }

    handleImproveRequest(
      {
        menuItemId:
          MENU_ID,
        frameId:
          sender.frameId ?? 0
      },
      sender.tab
    );
  }
);


// ============================================================
// OPENAI - HTML
// ============================================================

async function improveHtml(
  html,
  apiKey,
  model,
  systemPrompt,
  provider
) {
  log(
    "A enviar HTML para a OpenAI.",
    {
      model,
      length:
        html.length
    }
  );

  return await requestProvider({
    provider,
    apiKey,
    model,
    instructions: systemPrompt,
    input: "Fragmento HTML a melhorar:\n\n" + html
  });
}


// ============================================================
// OPENAI - TEXTO SIMPLES
// ============================================================

async function improvePlainText(
  text,
  apiKey,
  model,
  provider
) {
  const plainPrompt = `
Reescreve o texto em português europeu (PT-PT).

Torna-o mais coerente, claro, natural e moderadamente formal.

Mantém rigorosamente o significado original.

Não acrescentes explicações.

Devolve apenas o texto final.
`;

  log(
    "A enviar texto simples.",
    {
      model,
      length:
        text.length
    }
  );

  return await requestProvider({
    provider,
    apiKey,
    model,
    instructions: plainPrompt.trim(),
    input: text
  });
}


// ============================================================
// FORNECEDORES DE IA
// ============================================================

async function requestProvider({ provider, apiKey, model, instructions, input }) {
  let url;
  let headers = { "Content-Type": "application/json" };
  let body;

  if (provider === "openai") {
    url = "https://api.openai.com/v1/responses";
    headers.Authorization = `Bearer ${apiKey}`;
    body = { model, instructions, input, max_output_tokens: 4000 };
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model,
      max_tokens: 4000,
      system: instructions,
      messages: [{ role: "user", content: input }]
    };
  } else if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    headers["x-goog-api-key"] = apiKey;
    body = {
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: "user", parts: [{ text: input }] }],
      generationConfig: { maxOutputTokens: 4000 }
    };
  } else {
    const baseUrl = provider === "xai"
      ? "https://api.x.ai/v1/chat/completions"
      : "https://api.deepseek.com/chat/completions";
    url = baseUrl;
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input }
      ],
      stream: false,
      max_tokens: 4000
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const raw =
    await response.text();

  log(
    "Resposta HTTP OpenAI.",
    {
      status:
        response.status,

      ok:
        response.ok
    }
  );

  let data;

  try {
    data =
      JSON.parse(
        raw
      );

  } catch (error) {
    logError(
      "Resposta JSON inválida.",
      raw
    );

    throw new Error(
      "A OpenAI devolveu uma resposta inválida."
    );
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error?.message ||
      `Erro OpenAI HTTP ${response.status}`
    );
  }

  let output = "";

  if (provider === "openai") {
    output = typeof data.output_text === "string"
      ? data.output_text
      : (data.output || []).flatMap(item => item.content || [])
          .filter(item => typeof item.text === "string")
          .map(item => item.text).join("");
  } else if (provider === "anthropic") {
    output = (data.content || []).filter(item => item.type === "text")
      .map(item => item.text || "").join("");
  } else if (provider === "gemini") {
    output = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "").join("");
  } else {
    output = data.choices?.[0]?.message?.content || "";
  }

  if (
    !output.trim()
  ) {
    throw new Error(
      "A OpenAI respondeu sem conteúdo."
    );
  }

  output =
    output
      .replace(
        /^```html\s*/i,
        ""
      )
      .replace(
        /^```\s*/,
        ""
      )
      .replace(
        /```$/,
        ""
      )
      .trim();

  return output;
}
