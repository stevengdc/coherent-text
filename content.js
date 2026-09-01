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
    () => {
      setTimeout(
        saveSelection,
        0
      );
    },
    true
  );


  document.addEventListener(
    "keyup",
    () => {
      setTimeout(
        saveSelection,
        0
      );
    },
    true
  );


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

  document.addEventListener(
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

      event.preventDefault();
      event.stopPropagation();

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
