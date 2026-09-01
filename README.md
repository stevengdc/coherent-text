# Coerente PT-PT

Extensão para Chrome que melhora texto selecionado, tornando-o mais claro, coerente e natural em português europeu. Funciona em campos de texto e em editores HTML, incluindo editores ricos usados no Salesforce.

## Funcionalidades

- Reescreve texto em português europeu (PT-PT).
- Preserva o significado e a informação original.
- Mantém a estrutura e os atributos de fragmentos HTML sempre que possível.
- Funciona em `input`, `textarea`, elementos `contenteditable` e editores como o CKEditor.
- Pode ser acionada pelo menu de contexto ou pelo atalho `Ctrl/Cmd + Shift + Y`.
- Permite configurar o modelo e as instruções usadas na reescrita.

## Requisitos

- Google Chrome ou outro navegador compatível com extensões Manifest V3.
- Uma chave da API da OpenAI com saldo disponível.

> A utilização da API da OpenAI pode ter custos. Consulte os preços e as condições aplicáveis à sua conta.

## Instalação local

1. Transfira ou clone este repositório.
2. Abra `chrome://extensions` no Chrome.
3. Ative o **Modo de programador**.
4. Selecione **Carregar expandida**.
5. Escolha a pasta deste projeto.

## Configuração

1. Clique no ícone da extensão.
2. Introduza a sua chave da API da OpenAI.
3. Confirme ou altere o modelo.
4. Personalize as instruções, se necessário.
5. Clique em **Guardar**.

A chave é guardada localmente pelo Chrome através de `chrome.storage.local`. Não é incluída no código nem enviada para este repositório. O texto selecionado e a chave são enviados diretamente para a API da OpenAI quando é pedida uma reescrita.

## Utilização

Selecione texto num campo ou editor compatível e use uma destas opções:

- clique com o botão direito e escolha **Tornar mais coerente (PT-PT)**;
- pressione `Ctrl + Shift + Y` no Windows/Linux ou `Cmd + Shift + Y` no macOS.

Após a resposta da API, a extensão substitui apenas a seleção pelo texto melhorado.

## Permissões

A extensão pede acesso a menus de contexto, armazenamento local, separadores, injeção de scripts e páginas visitadas. O acesso alargado a páginas é necessário para detetar e substituir seleções em editores, incluindo conteúdo apresentado dentro de `iframes`.

## Privacidade e segurança

- Nunca publique nem partilhe a sua chave da API.
- O conteúdo selecionado é enviado à OpenAI para processamento.
- HTML devolvido pela API é filtrado antes de ser reinserido; scripts, elementos perigosos, atributos de eventos e URLs `javascript:` são removidos.
- A extensão não funciona em páginas internas protegidas pelo navegador.

## Desenvolvimento

O projeto não requer compilação nem dependências. Depois de alterar os ficheiros, abra `chrome://extensions` e clique em **Atualizar** no cartão da extensão.

Estrutura principal:

- `manifest.json` — configuração da extensão;
- `background.js` — menu, configuração e comunicação com a API;
- `content.js` — leitura e substituição da seleção;
- `popup.html` e `popup.js` — interface de configuração;
- `prompt.txt` — instrução de referência;
- `icons/` — ícones usados pelo navegador.

## Contribuir

Contribuições são bem-vindas. Abra uma issue para discutir alterações relevantes ou envie um pull request com uma descrição clara do problema e da solução.

## Licença

Distribuído sob a licença [GNU General Public License v3.0](LICENSE).
