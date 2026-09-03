const MENU_ID = "coerente-ptpt";

const DEFAULT_MODEL = "gpt-5.6-luna";

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
          "systemPrompt"
        ]);

      if (
        !settings.apiKey
      ) {
        throw new Error(
          "Não existe uma API key configurada."
        );
      }

      const model =
        settings.model ||
        DEFAULT_MODEL;

      const prompt =
        settings.systemPrompt ||
        await loadDefaultPrompt();

      log(
        "Configuração carregada.",
        {
          model,
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
            settings.apiKey,
            model,
            prompt
          );

      } else {
        result =
          await improvePlainText(
            selection.text,
            settings.apiKey,
            model
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
  systemPrompt
) {
  log(
    "A enviar HTML para a OpenAI.",
    {
      model,
      length:
        html.length
    }
  );

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body:
          JSON.stringify({
            model,

            instructions:
              systemPrompt,

            input:
              "Fragmento HTML a melhorar:\n\n" +
              html,

            max_output_tokens:
              4000
          })
      }
    );

  return await parseResponse(
    response
  );
}


// ============================================================
// OPENAI - TEXTO SIMPLES
// ============================================================

async function improvePlainText(
  text,
  apiKey,
  model
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

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body:
          JSON.stringify({
            model,

            instructions:
              plainPrompt,

            input:
              text,

            max_output_tokens:
              4000
          })
      }
    );

  return await parseResponse(
    response
  );
}


// ============================================================
// PARSE RESPOSTA
// ============================================================

async function parseResponse(
  response
) {
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

  if (
    typeof data.output_text ===
    "string"
  ) {
    output =
      data.output_text;

  } else if (
    Array.isArray(
      data.output
    )
  ) {
    output =
      data.output
        .flatMap(
          item =>
            item.content ||
            []
        )
        .filter(
          item =>
            typeof item.text ===
            "string"
        )
        .map(
          item =>
            item.text
        )
        .join("");
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
