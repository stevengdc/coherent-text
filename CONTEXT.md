# Contexto da aplicação — Coerente PT-PT

Este documento destina-se a permitir que o desenvolvimento da extensão continue noutro chat ou ambiente sem ser necessário reconstruir o contexto do projeto. Deve ser atualizado sempre que houver alterações relevantes na arquitetura, no fluxo de dados ou na configuração.

## Resumo

**Coerente PT-PT** é uma extensão Chrome Manifest V3 que melhora texto selecionado em campos de texto e editores HTML, incluindo editores ricos e conteúdo dentro de `iframes` (por exemplo, Salesforce).

A extensão envia a seleção para um fornecedor de IA configurado pelo utilizador e substitui apenas a seleção pela resposta melhorada. O objetivo editorial é produzir português europeu claro, natural, coerente e moderadamente formal, preservando a informação e a estrutura HTML.

## Repositório e fluxo Git

- Repositório principal: `https://github.com/stevengdc/coherent-text`
- Branch principal: `main`
- Pasta local habitual: `C:\Users\steven.camara\Extensões\coherent-text`
- O GitHub é a fonte principal do projeto.
- Antes de iniciar alterações, executar `git pull origin main`.
- No fim, validar, criar um commit e executar `git push origin main`.
- Nunca incluir chaves de API no código, na documentação ou no repositório.

## Tecnologias e execução

- Extensão Chrome Manifest V3.
- JavaScript, HTML e CSS sem framework.
- Não existe compilação, gestor de pacotes ou dependências de execução.
- A extensão é carregada localmente através de `chrome://extensions` → **Modo de programador** → **Carregar expandida**.
- Após alterações, é necessário clicar em **Atualizar** no cartão da extensão.

## Ficheiros principais

| Ficheiro | Responsabilidade |
| --- | --- |
| `manifest.json` | Manifesto, permissões, service worker, content script, página de opções e ícones. |
| `background.js` | Menu de contexto, abertura das opções, configuração, escolha do fornecedor, pedidos às APIs e comunicação com o content script. |
| `content.js` | Deteta e lê a seleção, apresenta o assistente flutuante, distingue texto simples de HTML, sanitiza e substitui o conteúdo no editor. |
| `options.html` | Página completa de configuração aberta ao clicar no ícone da extensão. |
| `options.js` | Carrega, migra, apresenta e guarda fornecedor, chaves, modelos e instrução. |
| `prompt.txt` | Fonte única da instrução de escrita inicial. |
| `commands.json` | Fonte única das instruções predefinidas dos comandos adicionais. |
| `README.md` | Documentação pública de instalação, configuração e utilização. |
| `icons/` | Ícones usados pelo Chrome. |

Os antigos `popup.html` e `popup.js` foram removidos. O clique no ícone chama `chrome.runtime.openOptionsPage()` e abre `options.html` num separador próprio.

## Fluxo funcional

1. O utilizador seleciona conteúdo num editor.
2. Aciona **Tornar mais coerente (PT-PT)** no menu de contexto ou usa `Ctrl/Cmd + Shift + Y`.
   Em alternativa, mantém `Ctrl` premido durante 500 ms com texto selecionado para apresentar o botão flutuante: o ícone executa a melhoria normal e a seta abre os comandos adicionais. O botão permanece visível depois de libertar a tecla e fecha com outro toque em `Ctrl` ou com `Esc`. Qualquer atalho iniciado durante os 500 ms cancela a abertura.
3. `background.js` pede a seleção ao `content.js` no frame correto.
4. `content.js` devolve o texto ou o fragmento HTML selecionado.
5. `background.js` lê o fornecedor ativo, a respetiva chave, o modelo e a instrução.
6. O pedido é adaptado ao formato da API selecionada.
7. A resposta é normalizada para texto.
8. `content.js` substitui apenas a seleção original e aplica a sanitização necessária ao HTML.

Se o content script não responder, o service worker tenta injetá-lo manualmente no frame e repete a mensagem.

## Fornecedores suportados

| Identificador | Nome apresentado | Endpoint usado | Modelo inicial |
| --- | --- | --- | --- |
| `openai` | OpenAI | `https://api.openai.com/v1/responses` | `gpt-5.6-luna` |
| `anthropic` | Anthropic | `https://api.anthropic.com/v1/messages` | `claude-sonnet-5` |
| `gemini` | Gemini | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `gemini-3.5-flash` |
| `xai` | Grok (xAI) | `https://api.x.ai/v1/chat/completions` | `grok-4.6` |
| `deepseek` | DeepSeek | `https://api.deepseek.com/chat/completions` | `deepseek-flash` |

Os identificadores dos modelos são editáveis na página de opções para permitir mudanças futuras sem alterações ao código.

## Configuração e armazenamento

A configuração é guardada em `chrome.storage.local`:

```text
provider: string
apiKeys: {
  openai: string,
  anthropic: string,
  gemini: string,
  xai: string,
  deepseek: string
}
models: {
  openai: string,
  anthropic: string,
  gemini: string,
  xai: string,
  deepseek: string
}
systemPrompt: string
commandPrompts: {
  explain: string,
  summarize: string,
  key_points: string,
  improve_writing: string,
  continue_writing: string,
  shorten: string,
  lengthen: string,
  tone_informal: string,
  tone_direct: string,
  tone_friendly: string,
  tone_confident: string,
  tone_professional: string
}
```

Existe compatibilidade com a configuração antiga: `apiKey` e `model` são tratados como valores OpenAI quando ainda não existe a nova estrutura.

As chaves ficam apenas no armazenamento local do perfil Chrome. Como se trata de uma extensão executada no cliente, os pedidos são enviados diretamente do service worker para a API escolhida.

## Instruções de escrita

- `prompt.txt` é a fonte única da instrução HTML inicial.
- A página de opções carrega esse ficheiro como valor predefinido.
- O utilizador pode personalizar a instrução; o valor personalizado fica em `systemPrompt`.
- Para texto simples, `background.js` utiliza uma instrução curta própria, sem regras de HTML.
- `commands.json` contém as instruções predefinidas de Explicar, Resumir, Destacar pontos principais, Aprimorar a escrita, Continuar a escrever, Encurtar, Alongar e dos cinco tons.
- A página de opções permite personalizar cada comando; os valores ficam em `commandPrompts`.
- A resposta não deve conter cercas Markdown como ````html`.

## Formatos das APIs

- **OpenAI:** Responses API, com `instructions`, `input` e `max_output_tokens`.
- **Anthropic:** Messages API, com `system`, `messages`, `max_tokens`, `x-api-key` e `anthropic-version`.
- **Gemini:** `generateContent`, com `systemInstruction`, `contents`, `generationConfig` e `x-goog-api-key`.
- **Grok e DeepSeek:** formato Chat Completions compatível com OpenAI, com mensagens `system` e `user` e autenticação Bearer.

Todas as respostas são convertidas num único texto final antes de serem devolvidas ao content script. Os erros HTTP são apresentados internamente através das mensagens devolvidas pelas APIs, quando disponíveis.

## Segurança e privacidade

- Nunca registar chaves de API nos logs.
- Nunca enviar uma chave para um fornecedor diferente do selecionado.
- Não acrescentar scripts, CSS ou URLs ao HTML produzido.
- Não modificar URLs, endereços de email, nomes próprios, números ou referências do conteúdo original.
- `content.js` deve continuar a remover scripts, elementos perigosos, atributos de eventos e URLs `javascript:` antes de reinserir HTML.
- As permissões `<all_urls>` são necessárias para trabalhar em editores e `iframes` de vários sites; devem ser revistas cuidadosamente antes de qualquer restrição.

## Validação antes de publicar

1. Confirmar que `manifest.json` é JSON válido.
2. Verificar a sintaxe de `background.js`, `content.js` e `options.js`.
3. Executar `git diff --check`.
4. Recarregar a extensão em `chrome://extensions` e confirmar que não existem erros do service worker.
5. Clicar no ícone e confirmar que a página de opções abre num separador.
6. Selecionar texto, manter `Ctrl` premido durante 500 ms e confirmar que o assistente flutuante aparece e permanece visível. Confirmar que outro toque em `Ctrl` ou `Esc` o fecha e que `Ctrl+C` não o abre.
7. Confirmar que o ícone executa a melhoria normal e que a seta abre todos os comandos e submenus.
8. Confirmar que trocar de fornecedor não perde os valores introduzidos nos outros fornecedores.
9. Testar pelo menos texto simples e HTML num editor compatível.
10. Sempre que possível, testar cada fornecedor com uma chave válida sem expor a chave em logs ou capturas.
11. Confirmar `git status`, criar o commit e fazer push para `origin/main`.

## Estado conhecido

- A versão do manifesto após corrigir a repetição automática da tecla `Ctrl` é `2.4.3`.
- A sintaxe dos ficheiros JavaScript e o manifesto foram validados localmente.
- Os pedidos reais a cada fornecedor dependem de chaves válidas e devem ser testados pelo utilizador ou num ambiente seguro.
- Se um modelo deixar de existir, alterar primeiro o modelo na página de opções; atualizar o valor predefinido no código apenas quando necessário.
