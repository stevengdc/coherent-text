(() => {
  if (window.__COERENTE_PTPT_LOADED__) {
    console.log(
      "[Coerente PT-PT / content] content.js já estava carregado."
    );
    return;
  }

  window.__COERENTE_PTPT_LOADED__ = true;

  let savedRange = null;
  let savedEditable = null;

  let savedInput = null;
  let savedInputStart = null;
  let savedInputEnd = null;

  let floatingHost = null;
  let floatingMenu = null;
  let lastPointerPosition = null;

  const INLINE_MENU = [
    { command: "explain", label: "Explicar" },
    { command: "summarize", label: "Resumir" },
    { command: "key_points", label: "Destacar pontos principais" },
    { separator: true },
    { command: "improve_writing", label: "Aprimorar a escrita" },
    { command: "continue_writing", label: "Continuar a escrever" },
    { separator: true },
    {
      label: "Alterar o tamanho",
      children: [
        { command: "shorten", label: "Encurtar" },
        { command: "lengthen", label: "Alongar" }
      ]
    },
    {
      label: "Alterar o tom",
      children: [
        { command: "tone_informal", label: "Informal" },
        { command: "tone_direct", label: "Direto" },
        { command: "tone_friendly", label: "Amigável" },
        { command: "tone_confident", label: "Confiante" },
        { command: "tone_professional", label: "Profissional" }
      ]
    }
  ];


  // ==========================================================
  // ASSISTENTE FLUTUANTE
  // ==========================================================

  function createMenuItems(items, documentRoot) {
    const fragment = documentRoot.createDocumentFragment();

    for (const item of items) {
      if (item.separator) {
        const separator = documentRoot.createElement("div");
        separator.className = "separator";
        fragment.appendChild(separator);
        continue;
      }

      if (item.children) {
        const submenu = documentRoot.createElement("div");
        submenu.className = "submenu";

        const trigger = documentRoot.createElement("button");
        trigger.type = "button";
        trigger.className = "menu-item submenu-trigger";
        trigger.innerHTML = `<span>${item.label}</span><span aria-hidden="true">›</span>`;

        const panel = documentRoot.createElement("div");
        panel.className = "submenu-panel";
        panel.appendChild(createMenuItems(item.children, documentRoot));

        trigger.addEventListener("click", event => {
          event.stopPropagation();
          submenu.classList.toggle("open");
        });

        submenu.append(trigger, panel);
        fragment.appendChild(submenu);
        continue;
      }

      const button = documentRoot.createElement("button");
      button.type = "button";
      button.className = "menu-item";
      button.dataset.command = item.command;
      button.textContent = item.label;
      fragment.appendChild(button);
    }

    return fragment;
  }

  function ensureFloatingAssistant() {
    if (floatingHost?.isConnected) {
      return floatingHost;
    }

    floatingHost = document.createElement("div");
    floatingHost.id = "coerente-ptpt-floating-host";
    Object.assign(floatingHost.style, {
      all: "initial",
      position: "fixed",
      zIndex: "2147483647",
      display: "none"
    });

    const shadow = floatingHost.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      .assistant { position: relative; display: flex; align-items: stretch; border: 1px solid #d4d9e2; border-radius: 10px; background: #fff; box-shadow: 0 8px 26px rgba(15, 23, 42, .22); font: 13px/1.3 system-ui, sans-serif; color: #172033; }
      button { font: inherit; }
      .primary, .toggle { display: grid; place-items: center; height: 36px; border: 0; background: transparent; cursor: pointer; }
      .primary { width: 40px; border-radius: 9px 0 0 9px; }
      .primary img { width: 22px; height: 22px; display: block; }
      .toggle { width: 28px; border-left: 1px solid #e1e5eb; border-radius: 0 9px 9px 0; font-size: 13px; color: #465168; }
      .primary:hover, .toggle:hover, .primary:focus-visible, .toggle:focus-visible { background: #f0f3f8; outline: none; }
      .menu { position: absolute; top: calc(100% + 7px); left: 0; width: 250px; padding: 7px; border: 1px solid #d7dce5; border-radius: 11px; background: #fff; box-shadow: 0 14px 38px rgba(15, 23, 42, .2); display: none; }
      .menu.open { display: block; }
      .menu-title { padding: 7px 10px 6px; color: #7a8497; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .menu-item { width: 100%; min-height: 34px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 0; border-radius: 7px; background: transparent; color: #202a3d; text-align: left; cursor: pointer; white-space: nowrap; }
      .menu-item:hover, .menu-item:focus-visible { background: #eef2f8; outline: none; }
      .separator { height: 1px; margin: 6px 5px; background: #e7eaf0; }
      .submenu { position: relative; }
      .submenu-panel { position: absolute; top: -7px; left: calc(100% + 5px); min-width: 160px; padding: 7px; border: 1px solid #d7dce5; border-radius: 11px; background: #fff; box-shadow: 0 14px 38px rgba(15, 23, 42, .2); display: none; }
      .submenu:hover > .submenu-panel, .submenu:focus-within > .submenu-panel, .submenu.open > .submenu-panel { display: block; }
    `;

    const assistant = document.createElement("div");
    assistant.className = "assistant";

    const primary = document.createElement("button");
    primary.type = "button";
    primary.className = "primary";
    primary.title = "Tornar mais coerente (PT-PT)";
    primary.setAttribute("aria-label", "Tornar mais coerente (PT-PT)");

    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("icons/icon-32.png");
    icon.alt = "";
    primary.appendChild(icon);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "toggle";
    toggle.textContent = "⌄";
    toggle.title = "Abrir comandos";
    toggle.setAttribute("aria-label", "Abrir comandos");
    toggle.setAttribute("aria-expanded", "false");

    floatingMenu = document.createElement("div");
    floatingMenu.className = "menu";
    floatingMenu.setAttribute("role", "menu");

    const title = document.createElement("div");
    title.className = "menu-title";
    title.textContent = "Comandos";
    floatingMenu.append(title, createMenuItems(INLINE_MENU, document));

    floatingHost.addEventListener("mousedown", event => {
      event.preventDefault();
      event.stopPropagation();
    }, true);

    primary.addEventListener("click", () => runInlineCommand(null));
    toggle.addEventListener("click", event => {
      event.stopPropagation();
      const open = floatingMenu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    floatingMenu.addEventListener("click", event => {
      const button = event.target.closest("button[data-command]");
      if (button) runInlineCommand(button.dataset.command);
    });

    assistant.append(primary, toggle, floatingMenu);
    shadow.append(style, assistant);
    document.documentElement.appendChild(floatingHost);
    return floatingHost;
  }

  function hideFloatingAssistant() {
    if (!floatingHost) return;
    floatingHost.style.display = "none";
    floatingMenu?.classList.remove("open");
  }

  function getSelectionAnchorRect() {
    if (savedInput?.isConnected) {
      return savedInput.getBoundingClientRect();
    }

    if (savedRange) {
      const rect = savedRange.getBoundingClientRect();
      if (rect.width || rect.height) return rect;
    }

    return null;
  }

  function showFloatingAssistant(pointer = null) {
    const rect = getSelectionAnchorRect();
    if (!rect) return;

    const host = ensureFloatingAssistant();
    const point = pointer === undefined
      ? lastPointerPosition
      : pointer;
    const preferredX = point?.x ?? rect.right;
    const preferredY = point?.y ?? rect.bottom;
    const width = 70;
    const height = 44;

    host.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, preferredX + 8))}px`;
    host.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, preferredY + 10))}px`;
    host.style.display = "block";
  }

  function runInlineCommand(command) {
    if (!savedRange && !savedInput) {
      hideFloatingAssistant();
      showShortcutNotice("Selecione o texto que pretende alterar.");
      return;
    }

    hideFloatingAssistant();
    chrome.runtime.sendMessage({
      type: "COERENTE_INLINE_COMMAND",
      command
    }).catch(error => {
      log("Não foi possível executar o comando.", error);
      showShortcutNotice("Não foi possível executar o comando.");
    });
  }


  // ==========================================================
  // LOG
  // ==========================================================

  function log(message, data = null) {
    console.log(
      "[Coerente PT-PT / content]",
      message,
      data ?? ""
    );
  }


  // ==========================================================
  // ENCONTRAR EDITOR
  // ==========================================================

  function findEditable(node) {
    if (!node) {
      return null;
    }

    let element =
      node.nodeType === Node.ELEMENT_NODE
        ? node
        : node.parentElement;

    while (element) {
      if (element.isContentEditable) {
        return element;
      }

      if (
        element.getAttribute &&
        element.getAttribute("contenteditable") === "true"
      ) {
        return element;
      }

      if (
        element.getAttribute &&
        element.getAttribute("role") === "textbox"
      ) {
        return element;
      }

      element = element.parentElement;
    }

    // Fallback importante para CKEditor:
    // muitas vezes o BODY é o próprio contenteditable
    const body = document.body;

    if (
      body &&
      (
        body.isContentEditable ||
        body.getAttribute("contenteditable") === "true" ||
        body.getAttribute("role") === "textbox"
      )
    ) {
      return body;
    }

    return null;
  }


  // ==========================================================
  // RANGE -> HTML
  // ==========================================================

  function rangeToHtml(range) {
    const container =
      document.createElement("div");

    container.appendChild(
      range.cloneContents()
    );

    return container.innerHTML;
  }


  // ==========================================================
  // OBTER SELEÇÃO ATUAL
  // ==========================================================

  function getCurrentSelectionInfo() {
    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      return null;
    }

    const range =
      selection.getRangeAt(0);

    const editable =
      findEditable(
        range.commonAncestorContainer
      );

    if (!editable) {
      return null;
    }

    return {
      selection,
      range,
      editable,
      text:
        selection.toString(),
      html:
        rangeToHtml(range)
    };
  }


  // ==========================================================
  // GUARDAR SELEÇÃO
  // ==========================================================

  function saveSelection() {
    const active =
      document.activeElement;


    // --------------------------------------------------------
    // INPUT / TEXTAREA
    // --------------------------------------------------------

    if (
      active &&
      (
        active.tagName === "TEXTAREA" ||
        active.tagName === "INPUT"
      )
    ) {
      const start =
        active.selectionStart;

      const end =
        active.selectionEnd;

      if (
        typeof start === "number" &&
        typeof end === "number" &&
        end > start
      ) {
        savedInput =
          active;

        savedInputStart =
          start;

        savedInputEnd =
          end;

        savedRange =
          null;

        savedEditable =
          null;

        log(
          "Seleção INPUT guardada.",
          {
            start,
            end,
            text:
              active.value.slice(
                start,
                end
              )
          }
        );

        return true;
      }
    }


    // --------------------------------------------------------
    // RICH TEXT / CKEDITOR
    // --------------------------------------------------------

    const current =
      getCurrentSelectionInfo();

    if (!current) {
      return false;
    }

    savedRange =
      current.range.cloneRange();

    savedEditable =
      current.editable;

    savedInput =
      null;

    savedInputStart =
      null;

    savedInputEnd =
      null;

    log(
      "Seleção HTML guardada.",
      {
        text:
          current.text,

        html:
          current.html,

        editorTag:
          current.editable.tagName,

        editorClass:
          current.editable.className,

        editorRole:
          current.editable.getAttribute("role"),

        contentEditable:
          current.editable.getAttribute("contenteditable")
      }
    );

    return true;
  }


  // ==========================================================
  // EVENTOS
  // ==========================================================

  document.addEventListener(
    "selectionchange",
    () => {
      const selection =
        window.getSelection();

      if (
        selection &&
        selection.rangeCount > 0 &&
        !selection.isCollapsed
      ) {
        saveSelection();
      }
    },
    true
  );


  document.addEventListener(
    "mouseup",
    event => {
      lastPointerPosition = {
        x: event.clientX,
        y: event.clientY
      };

      setTimeout(
        () => {
          if (saveSelection()) {
            showFloatingAssistant(lastPointerPosition);
          } else if (!floatingHost?.contains(event.target)) {
            hideFloatingAssistant();
          }
        },
        0
      );
    },
    true
  );


  document.addEventListener(
    "keyup",
    event => {
      setTimeout(
        () => {
          if (saveSelection()) {
            showFloatingAssistant(
              event.shiftKey
                ? null
                : lastPointerPosition
            );
          }
        },
        0
      );
    },
    true
  );

  window.addEventListener("scroll", hideFloatingAssistant, true);
  window.addEventListener("resize", hideFloatingAssistant);
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") hideFloatingAssistant();
  }, true);


  document.addEventListener(
    "contextmenu",
    () => {
      const hadSavedSelection =
        !!savedRange ||
        !!savedInput;

      const updated =
        saveSelection();

      if (
        !updated &&
        hadSavedSelection
      ) {
        log(
          "Context menu colapsou a seleção; mantive a seleção anterior."
        );
      }
    },
    true
  );


  // ==========================================================
  // OBTER SELEÇÃO PARA O BACKGROUND
  // ==========================================================

  function getSavedSelection() {

    // --------------------------------------------------------
    // INPUT / TEXTAREA
    // --------------------------------------------------------

    if (
      savedInput &&
      savedInputStart !== null &&
      savedInputEnd !== null
    ) {
      const text =
        savedInput.value.slice(
          savedInputStart,
          savedInputEnd
        );

      return {
        hasSelection:
          true,

        type:
          "text",

        text,

        html:
          null
      };
    }


    // --------------------------------------------------------
    // RANGE GUARDADO
    // --------------------------------------------------------

    if (
      savedRange &&
      savedEditable &&
      document.contains(
        savedEditable
      )
    ) {
      const text =
        savedRange.toString();

      const html =
        rangeToHtml(
          savedRange
        );

      log(
        "A devolver seleção HTML guardada.",
        {
          text,
          html
        }
      );

      return {
        hasSelection:
          true,

        type:
          "html",

        text,

        html
      };
    }


    // --------------------------------------------------------
    // FALLBACK CRÍTICO PARA CKEDITOR
    //
    // Se não foi possível guardar antes, mas a seleção
    // continua ativa, usamos diretamente o Range atual.
    // --------------------------------------------------------

    const current =
      getCurrentSelectionInfo();

    if (current) {
      savedRange =
        current.range.cloneRange();

      savedEditable =
        current.editable;

      log(
        "Fallback CKEditor: seleção atual recuperada.",
        {
          text:
            current.text,

          html:
            current.html,

          editorTag:
            current.editable.tagName,

          editorClass:
            current.editable.className
        }
      );

      return {
        hasSelection:
          true,

        type:
          "html",

        text:
          current.text,

        html:
          current.html
      };
    }


    // --------------------------------------------------------
    // DIAGNÓSTICO
    // --------------------------------------------------------

    const selection =
      window.getSelection();

    const active =
      document.activeElement;

    return {
      hasSelection:
        false,

      diagnostic: {
        hasSavedRange:
          !!savedRange,

        hasSavedEditable:
          !!savedEditable,

        hasSavedInput:
          !!savedInput,

        currentSelectionText:
          selection?.toString() ||
          "",

        currentSelectionCollapsed:
          selection?.isCollapsed ??
          true,

        currentRangeCount:
          selection?.rangeCount ||
          0,

        activeElementTag:
          active?.tagName ||
          null,

        activeElementClass:
          active?.className ||
          null,

        activeElementRole:
          active
            ?.getAttribute?.("role") ||
          null,

        activeElementContentEditable:
          active
            ?.getAttribute?.("contenteditable") ||
          null,

        frameUrl:
          location.href,

        topFrame:
          window ===
          window.top
      }
    };
  }


  // ==========================================================
  // SANITIZAR HTML
  // ==========================================================

  function sanitizeHtml(html) {
    const template =
      document.createElement("template");

    template.innerHTML =
      html;

    const blockedTags = [
      "script",
      "iframe",
      "object",
      "embed",
      "style",
      "link",
      "meta"
    ];

    for (const tag of blockedTags) {
      template.content
        .querySelectorAll(tag)
        .forEach(
          element =>
            element.remove()
        );
    }

    template.content
      .querySelectorAll("*")
      .forEach(
        element => {
          for (
            const attribute of
            Array.from(
              element.attributes
            )
          ) {
            const name =
              attribute.name
                .toLowerCase();

            const value =
              attribute.value;

            if (
              name.startsWith("on")
            ) {
              element.removeAttribute(
                attribute.name
              );

              continue;
            }

            if (
              (
                name === "href" ||
                name === "src"
              ) &&
              /^\s*javascript:/i.test(
                value
              )
            ) {
              element.removeAttribute(
                attribute.name
              );
            }
          }
        }
      );

    return template.innerHTML;
  }


  // ==========================================================
  // HTML -> FRAGMENT
  // ==========================================================

  function htmlToFragment(html) {
    const template =
      document.createElement("template");

    template.innerHTML =
      sanitizeHtml(html);

    return template.content
      .cloneNode(true);
  }


  // ==========================================================
  // NOTIFICAR EDITOR
  // ==========================================================

  function notifyEditor(editable) {
    try {
      editable.dispatchEvent(
        new InputEvent(
          "input",
          {
            bubbles: true,
            composed: true,
            inputType:
              "insertText"
          }
        )
      );
    } catch {
      editable.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true,
            composed: true
          }
        )
      );
    }

    editable.dispatchEvent(
      new Event(
        "change",
        {
          bubbles: true,
          composed: true
        }
      )
    );
  }


  // ==========================================================
  // SUBSTITUIR INPUT
  // ==========================================================

  function replaceInput(text) {
    if (
      !savedInput ||
      savedInputStart === null ||
      savedInputEnd === null
    ) {
      return false;
    }

    savedInput.focus();

    savedInput.setRangeText(
      text,
      savedInputStart,
      savedInputEnd,
      "end"
    );

    savedInput.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true,
          composed: true
        }
      )
    );

    savedInput.dispatchEvent(
      new Event(
        "change",
        {
          bubbles: true,
          composed: true
        }
      )
    );

    savedInput =
      null;

    savedInputStart =
      null;

    savedInputEnd =
      null;

    return true;
  }


  // ==========================================================
  // SUBSTITUIR HTML NO CKEDITOR
  // ==========================================================

  function replaceHtml(html) {

    // Se não temos Range guardado, tentar recuperar
    // a seleção atual mais uma vez.
    if (
      !savedRange ||
      !savedEditable
    ) {
      const current =
        getCurrentSelectionInfo();

      if (current) {
        savedRange =
          current.range.cloneRange();

        savedEditable =
          current.editable;
      }
    }

    if (
      !savedRange ||
      !savedEditable
    ) {
      log(
        "Não existe Range válido para substituir."
      );

      return false;
    }

    if (
      !document.contains(
        savedEditable
      )
    ) {
      log(
        "O editor já não existe no DOM."
      );

      return false;
    }

    try {
      savedEditable.focus();

      const selection =
        window.getSelection();

      selection.removeAllRanges();

      selection.addRange(
        savedRange
      );


      const fragment =
        htmlToFragment(
          html
        );

      const insertedNodes =
        Array.from(
          fragment.childNodes
        );

      const firstNode =
        insertedNodes[0];

      const lastNode =
        insertedNodes[
          insertedNodes.length - 1
        ];


      // Apagar apenas o fragmento selecionado
      savedRange.deleteContents();


      // Inserir HTML novo
      savedRange.insertNode(
        fragment
      );


      // Cursor no final do conteúdo novo
      if (
        lastNode &&
        lastNode.parentNode
      ) {
        const cursorRange =
          document.createRange();

        cursorRange.setStartAfter(
          lastNode
        );

        cursorRange.collapse(true);

        selection.removeAllRanges();

        selection.addRange(
          cursorRange
        );
      }


      notifyEditor(
        savedEditable
      );


      log(
        "HTML substituído com sucesso.",
        {
          insertedHtml:
            html,

          firstNode:
            firstNode?.nodeName,

          lastNode:
            lastNode?.nodeName
        }
      );


      savedRange =
        null;

      savedEditable =
        null;


      return true;

    } catch (error) {
      console.error(
        "[Coerente PT-PT / content] Erro ao substituir HTML:",
        error
      );

      return false;
    }
  }


  // ==========================================================
  // MENSAGENS
  // ==========================================================

  chrome.runtime.onMessage.addListener(
    (
      message,
      sender,
      sendResponse
    ) => {

      if (
        message.type ===
        "COERENTE_GET_SELECTION"
      ) {
        const result =
          getSavedSelection();

        log(
          "Background pediu seleção.",
          result
        );

        sendResponse(
          result
        );

        return;
      }


      if (
        message.type ===
        "COERENTE_REPLACE_SELECTION"
      ) {
        log(
          "Background pediu substituição.",
          {
            contentType:
              message.contentType,

            contentLength:
              message.content
                ?.length
          }
        );

        try {
          let success =
            false;

          if (
            message.contentType ===
            "html"
          ) {
            success =
              replaceHtml(
                message.content
              );
          } else {
            success =
              replaceInput(
                message.content
              );
          }

          sendResponse({
            success
          });

        } catch (error) {
          sendResponse({
            success: false,
            error:
              error.message
          });
        }
      }
    }
  );


  // ==========================================================
  // ATALHO DE TECLADO
  // ==========================================================

  function showShortcutNotice(message) {
    const existing =
      document.getElementById(
        "coerente-ptpt-shortcut-notice"
      );

    existing?.remove();

    const notice =
      document.createElement("div");

    notice.id =
      "coerente-ptpt-shortcut-notice";

    notice.textContent =
      message;

    Object.assign(
      notice.style,
      {
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: "2147483647",
        padding: "10px 14px",
        borderRadius: "8px",
        background: "#111827",
        color: "#ffffff",
        font: "13px/1.4 system-ui, sans-serif",
        boxShadow:
          "0 6px 18px rgba(0, 0, 0, 0.25)"
      }
    );

    document.documentElement.appendChild(
      notice
    );

    setTimeout(
      () => notice.remove(),
      2500
    );
  }

  window.addEventListener(
    "keydown",
    event => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.code === "KeyY" &&
        !event.altKey;

      if (!isShortcut) {
        return;
      }

      if (event.repeat) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Guardar de forma síncrona antes de contactar o
      // background. O keyup acontece demasiado tarde quando a
      // seleção acabou de ser feita através do teclado.
      const hasSelection =
        saveSelection();

      if (!hasSelection) {
        log(
          "Atalho ignorado: não existe uma seleção válida."
        );

        showShortcutNotice(
          "Selecione o texto que pretende melhorar."
        );

        return;
      }

      log(
        "Atalho de teclado detetado."
      );

      chrome.runtime.sendMessage({
        type:
          "COERENTE_KEYBOARD_SHORTCUT"
      });
    },
    true
  );


  log(
    "content.js carregado.",
    {
      url:
        location.href,

      frame:
        window === window.top
          ? "top"
          : "iframe",

      bodyIsEditable:
        document.body?.isContentEditable,

      bodyRole:
        document.body?.getAttribute?.(
          "role"
        ),

      bodyClass:
        document.body?.className
    }
  );
})();
