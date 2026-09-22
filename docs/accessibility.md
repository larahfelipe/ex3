# Baseline de acessibilidade — TASK 14.1

Checklist normativo do frontend (`web/src`), usado como critério das TASKS 14.2 a 14.7 e de toda task posterior que toque em UI. Cada item é uma regra verificável, com o meio de verificação e o ponto do código que a garante hoje.

## Referência

| Item | Valor |
| --- | --- |
| Norma | WCAG 2.2, nível AA |
| Escopo | `web/src` — rotas `(public)` e `(protected)`, primitives em `components/ui` |
| Commit de captura | `995b0bf` |
| Data de captura | 2026-09-19 |
| Idioma do documento | `<html lang="en">` em `app/layout.tsx` (1.3.1 / 3.1.1) |

Fora do escopo: backend, e-mails e qualquer superfície sem HTML.

## Enforcement disponível

| Camada | Mecanismo | Cobertura |
| --- | --- | --- |
| Estática | `eslint-plugin-jsx-a11y` (`flatConfigs.recommended`) em `pnpm lint`, com `--max-warnings=0` | Atributos ARIA inválidos, handler em elemento não interativo, `alt` ausente, label sem controle |
| Estrutural | `PageHeader`, `SectionHeader`, `LoadingState`, `EmptyState`, `NoResultsState`, `ErrorState`, `StaleState` | Hierarquia de headings e anúncio de estado por composição, não por repetição |
| Comportamental | Radix (`dialog`, `alert-dialog`, `select`, `dropdown-menu`, `tooltip`) | Foco preso, `aria-modal`, Esc, navegação por setas |
| Manual | Roteiro de teclado da TASK 14.3 e auditoria da TASK 14.7 | O que nenhuma das anteriores alcança |

Automação cobre parte do conjunto; nenhum item abaixo é considerado atendido só porque `lint` e axe passaram.

## 1. Teclado

| # | Regra | Verificação |
| --- | --- | --- |
| K1 | Toda ação é alcançável por `Tab` na ordem do DOM; nenhum `tabIndex` positivo | 2.1.1, 2.4.3 · varredura de `tabIndex` + percurso manual |
| K2 | `Enter` e `Space` ativam `<button>`; `Enter` ativa link | 2.1.1 · elementos nativos apenas; nenhum `<div>` com `onClick` |
| K3 | `Esc` fecha dialog, dropdown e select sem perder o dado já digitado | 2.1.2 · comportamento padrão do Radix, não sobrescrito |
| K4 | `Arrow` navega dentro de menu, select e grupo de rádio; `Tab` sai do grupo | 2.1.1 · `dropdown-menu`, `select` e o `fieldset` de período do gráfico |
| K5 | Nenhuma armadilha de teclado fora de dialog modal | 2.1.2 · percurso completo com `Tab` e `Shift+Tab` |
| K6 | Alvo de toque mínimo de 24×24 px; 44×44 px na navegação principal | 2.5.8 (AA) e 2.5.5 como regra interna · `NAVIGATION_ITEM_CLASS` em `sidebar.tsx` |
| K7 | Autenticação aceita colar em campo de senha e não exige transcrição de segredo | 3.3.8 · `sign-in` e `sign-up` sem bloqueio de `paste` |

## 2. Foco

| # | Regra | Verificação |
| --- | --- | --- |
| F1 | Indicador visível em todo elemento focável, com o par `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2` | 2.4.7 · `components/ui/button.tsx`, `input.tsx`, `checkbox.tsx` e todo controle próprio |
| F2 | Abrir overlay move o foco para dentro dele | 2.4.3 · Radix; nenhum `autoFocus` concorrente |
| F3 | Fechar overlay devolve o foco ao elemento de origem | 2.4.3 · Radix, desde que o gatilho continue montado ao fechar |
| F4 | Nenhum elemento focado é removido da árvore sem o foco ir para um destino previsível | 2.4.3 · trocar de página, limpar filtros, excluir linha; `QuerySection` devolve o foco ao `<h2>` da seção quando o conteúdo troca e o foco cai no `body` |
| F5 | O elemento focado não fica coberto pela barra de navegação fixa nem por overlay | 2.4.11 · viewport `sm` com a barra inferior; `--navigation-bar` já reserva o espaço em `(protected)/layout.tsx` |
| F6 | Foco não muda de contexto por conta de digitação ou de mudança de valor | 3.2.1, 3.2.2 · busca, selects de filtro e formulários |

## 3. Semântica

| # | Regra | Verificação |
| --- | --- | --- |
| S1 | Um `<h1>` por rota, vindo de `PageHeader`; seção com `<h2>` de `SectionHeader` referenciado por `aria-labelledby` | 1.3.1, 2.4.6 · inventário de headings |
| S2 | `<nav aria-label>`, `<main>` e `<header>` únicos e irmãos; nenhum landmark aninhado sem rótulo | 1.3.1, 2.4.1 · `sidebar.tsx` e `(protected)/layout.tsx` |
| S3 | Ação é `<button>`; navegação é `<a>`/`Link`. Nenhuma ação primária em `<div>` clicável | 1.3.1, 4.1.2 · regra de conclusão da TASK 14.2 |
| S4 | Tabela usa `<th>` com escopo, `<caption>` descrevendo o conteúdo e `aria-sort` na coluna ordenada | 1.3.1 · `positions-table.tsx`, `transactions-table.tsx` |
| S5 | Conjunto de itens irmãos é lista (`ul`/`ol`/`dl`); métricas ficam em `dt`/`dd` | 1.3.1 · `sidebar.tsx`, `Metric` em `financial.tsx` |
| S6 | Ícone decorativo tem `aria-hidden="true"`; controle só com ícone tem `aria-label` | 1.1.1, 4.1.2 · varredura dos ícones de `lucide-react` |
| S7 | O link do item de navegação atual carrega `aria-current="page"` | 4.1.2 · `sidebar.tsx` |

## 4. Contraste

| # | Regra | Verificação |
| --- | --- | --- |
| C1 | Texto normal ≥ 4.5:1 e texto grande ≥ 3:1 contra o próprio fundo | 1.4.3 · medição por par token/superfície |
| C2 | Borda, estado e indicador de foco ≥ 3:1 contra o adjacente | 1.4.11 · `--border`, `--focus`, `--input` |
| C3 | Cor é o único vetor de nenhuma informação: sinal, rótulo ou ícone acompanham o tom | 1.4.1 · `signedValueTone`, `Trend`, `ProfitLoss` |
| C4 | Nenhuma cor literal no código: tudo sai dos tokens de `globals.css` | 1.4.3 · varredura de `#`, `rgb(` e `hsl(` fora de `globals.css` |
| C5 | Texto redimensionável até 200% e refluxo em 320 px sem perda de conteúdo | 1.4.4, 1.4.10 · unidades relativas; verificado junto da FASE 15 |

A paleta clara dos tokens semânticos não tem consumidor em runtime — ver TD-048; C1 e C2 valem hoje sobre a paleta escura, mas as duas paletas passam por computação desde a correção registrada em TD-053. `color-scheme` é declarado por tema em `:root` e `.dark`, para que rolagem, seleção e os controles nativos (`<select>`, checkbox, scrollbar) sigam a paleta ativa em vez do padrão do navegador. As razões medidas estão em §Contraste medido.

## 5. Formulários

| # | Regra | Verificação |
| --- | --- | --- |
| P1 | Todo input tem nome acessível por `<Label htmlFor>`; `aria-label` só quando não há rótulo visível | 1.3.1, 3.3.2, 4.1.2 · `jsx-a11y/label-has-associated-control` |
| P2 | Erro de campo é associado por `aria-describedby` e marcado com `aria-invalid` | 3.3.1 · `FormField`/`ChoiceField` em todo formulário |
| P3 | A mensagem descreve o que corrigir, não só que falhou | 3.3.3 · texto das mensagens do Zod |
| P4 | Campo obrigatório é comunicado ao AT e visualmente | 3.3.2 · `required`/`aria-required` |
| P5 | Campo de identidade ou credencial tem `autocomplete` | 1.3.5 · `sign-in`, `sign-up`, `account` |
| P6 | Resultado de submit — sucesso e falha — é anunciado sem roubar o foco | 4.1.3 · `role="alert"` no formulário e toast do `sonner` |
| P7 | Dado já fornecido no fluxo não é pedido de novo sem necessidade | 3.3.7 · diálogos encadeados de ativo e transação |

## 6. Dialogs

| # | Regra | Verificação |
| --- | --- | --- |
| D1 | Todo overlay modal vem do Radix `Dialog` ou `AlertDialog`; nenhum modal próprio | 2.1.2, 4.1.2 · `components/ui/dialog.tsx`, `alert-dialog.tsx` |
| D2 | Todo dialog tem `DialogTitle` e `DialogDescription` reais, mesmo quando visualmente ocultos | 4.1.2 · inventário de dialogs |
| D3 | Confirmação destrutiva usa `AlertDialog`, com a ação destrutiva rotulada pelo efeito | 3.3.4 · exclusão de ativo e de transação |
| D4 | Fechar por Esc, por overlay e por botão leva ao mesmo estado | 2.1.2 · teste manual |
| D5 | Nenhum dialog abre outro dialog empilhado, exceto edição e exclusão que partem do detalhe da transação: abrem por cima dele para que cancelar volte ao detalhe com o foco no botão de origem | 2.4.3 · o fluxo ativo → transação fecha o primeiro antes de abrir o segundo; `transactions-table.tsx` |

## 7. Conteúdo dinâmico

| # | Regra | Verificação |
| --- | --- | --- |
| N1 | Carregamento usa `LoadingState`: `<output aria-busy="true">` com rótulo em `sr-only` e skeleton `aria-hidden` | 4.1.3 · `data-state.tsx` |
| N2 | Falha recuperável usa `ErrorState`/`StaleState` com `role="alert"` e ação de nova tentativa | 4.1.3, 3.3.1 · `data-state.tsx` |
| N3 | Contagem, paginação e total mudam dentro de `aria-live="polite"` | 4.1.3 · `PageNavigation`, em `page-navigation.tsx`, nas quatro listagens paginadas |
| N4 | Toast nunca é o único canal de um erro que bloqueia a tarefa | 4.1.3 · o estado também aparece na região afetada |
| N5 | Dado obsoleto exibido durante refetch é marcado com `aria-busy` no container | 4.1.3 · `isPlaceholderData` em `positions-table.tsx` |
| N6 | Sob `prefers-reduced-motion`, animação e transição não essenciais são neutralizadas em `globals.css`; o indicador de ocupado segue girando, mais devagar | 2.3.3 · bloco `@media (prefers-reduced-motion: reduce)`; transform de toque sob `motion-safe:` |
| N7 | Nenhuma atualização automática de conteúdo sem controle do usuário | 2.2.2 · refetch é disparado por ação ou por invalidação de mutação |

## Lacunas conhecidas na captura

Observadas ao escrever este checklist, cada uma endereçada na task indicada:

| Lacuna | Regra | Task |
| --- | --- | --- |
| Não existe link "pular para o conteúdo"; com a navegação antes do `<main>`, todo acesso por teclado atravessa a lista de seções | K1, 2.4.1 | 14.2 |
| `animate-pulse` na marca e `animate-spin` em `add-asset-dialog.tsx` rodam fora de `motion-safe` | N6 | 14.6 |
| `active:scale-90` nos itens de navegação não tem variante reduzida | N6 | 14.6 |
| Associação de erro por `aria-describedby`/`aria-invalid` não está uniformizada entre os formulários | P2 | 14.5 |
| `autoComplete="off"` em `sign-in-form.tsx` e `sign-up-form.tsx` impede o propósito declarado do campo e o preenchimento por gerenciador de senha | P5, K7 | 14.5 |
| Contraste dos tokens nunca foi medido, em nenhuma das duas paletas | C1, C2 | 14.7 |
| Nenhuma auditoria automatizada roda no repositório | — | 14.7 |

Encerradas desde a captura: o link de pulo e os landmarks em `8a3ef68`; a região rolável do gráfico em `b01bf45`; o destino de foco após fechar overlay em `e8cb974`; nome acessível, associação de erro, estado obrigatório e `autocomplete` em `717ada7`; movimento reduzido em `b6bda64`; a auditoria automatizada na TASK 20.6, medida em §Auditoria automatizada. A linha do contraste foi fechada em TD-053, com a medição na seção seguinte.

## Contraste medido

Medição determinística dos tokens de `app/globals.css`, nas duas paletas, restrita aos pares que o código produz de fato — cada `text-*` sobre a superfície em que ele aparece em `web/src`. Método: HSL do token convertido para sRGB, luminância relativa e razão de contraste da WCAG 2.x, com 4.5:1 para texto normal (1.4.3) e 3:1 para limite de componente e indicador de estado (1.4.11); fundo com alpha, como `bg-warning/10`, composto sobre `--background` antes da medição. Nenhum navegador é necessário para repetir a medição — as entradas são os próprios tokens.

Todos os 62 pares medidos passam no limite da regra que exercem, nas duas paletas (script `scratchpad/contrast.mjs`, refeito com os tokens atuais). Os seis pares que reprovavam foram corrigidos só no valor do token — nenhuma classe de uso mudou:

| Par | Onde aparece | Claro (era) | Escuro (era) | Limite |
| --- | --- | --- | --- | --- |
| `--destructive` como texto | ação de exclusão em `transaction-details-dialog.tsx`, no menu da linha de `positions-table.tsx` e na lista de `portfolios/page.tsx` | 5.75:1 (3.76:1) | 7.31:1 (2.01:1) | 4.5:1 |
| `--primary-foreground` sobre `--primary` | rótulo de todo botão primário; `/0.9` no hover | 16.95:1 (16.95:1) | 5.71:1, 4.74:1 no hover (3.49:1) | 4.5:1 |
| `--border`/`--input` sobre `--background` | borda de campo, única pista visual do controle | `--input` 3.52:1 (1.24:1) | `--input` 3.50:1 (1.33:1) | 3:1 |
| `--destructive-foreground` sobre `--destructive` | botão sólido de exclusão; `/0.9` no hover | 5.50:1, 4.84:1 no hover (3.60:1) | 6.53:1, 5.40:1 no hover (9.59:1) | 4.5:1 |
| `--muted-foreground` sobre `--muted` | texto secundário em superfície de realce | 4.91:1 (4.39:1) | 6.00:1 (6.00:1) | 4.5:1 |
| `--warning` sobre `bg-warning/10` | chip de alerta | 5.00:1 (4.40:1) | 10.28:1 (10.28:1) | 4.5:1 |

`--border` continua abaixo de 3:1 nas duas paletas (1.24:1 claro, 1.33:1 escuro) por decisão: ele é só separador decorativo desde a correção, e todo controle interativo — input, select, segmented control — usa `--input` para a borda, que passa. `AlertDialog`/`Dialog` usa `bg-scrim/80` em vez de `bg-black/80` para o overlay, e `Input`/`SelectTrigger`/o textarea de notas ganharam `aria-[invalid=true]:border-negative`, então o estado inválido também é visível fora do foco.

Os demais pares passam nas duas paletas, com folga: texto padrão 20.14:1 e 19.24:1; `--muted-foreground` sobre `--background` 5.40:1 e 7.96:1; `--negative` 4.80:1 e 7.31:1; `--positive` 5.58:1 e 9.96:1; `--info` 5.94:1 e 9.09:1; anel de foco 20.14:1 e 6.40:1.

A paleta clara ainda não tem consumidor em runtime (TD-048): a medição prova que ela passaria se ativada, não que foi vista renderizada. TD-053 está resolvido — os seis pares passam por computação nas duas paletas — mas a paleta clara segue sem auditoria visual real até TD-048 ser endereçado.

## Auditoria automatizada — TASK 20.6

Executada em 2026-09-20 contra o build de produção servido por `next start`, com a API e o banco de desenvolvimento e uma conta semeada com uma posição (`PETR4`) e duas compras, para que tabela com linhas, gráfico com série e diálogo de exclusão existissem de fato.

| Item | Valor |
| --- | --- |
| Ferramenta | axe-core 4.10.3, injetado na página |
| Navegador | Firefox headless dirigido por WebDriver BiDi sobre o `WebSocket` global do Node 24, sem Playwright nem Selenium |
| Alvo | `http://localhost:3010`, build do commit `801839c` |
| Viewports | 1280×800 e 390×844 |
| Regras | conjunto padrão do axe: WCAG 2.0/2.1/2.2 A e AA mais best-practices |

### Resultado

Violações por estado, com o número de nós:

| Estado | 1280×800 | 390×844 |
| --- | --- | --- |
| `/sign-in` sem sessão | — | `color-contrast` ×2 |
| `/sign-up` sem sessão | — | `color-contrast` ×2 |
| `/` | — | `color-contrast` ×2 |
| `/assets` | — | `color-contrast` ×1 |
| `/assets/PETR4` | — | `color-contrast` ×2 |
| `/account` | — | — |
| `/assets` com o dialog de ativo aberto | — | `color-contrast` ×1 |
| `/assets` com busca sem resultado | — | `color-contrast` ×1 |

Nenhuma violação de impacto `critical` em nenhum estado, nos dois viewports, e nenhuma regra além de `color-contrast` reprovada — o critério "axe sem violação crítica" está atendido.

### Contraste medido pelo axe

Todo nó reprovado era o mesmo par: `#fef2f2` sobre `#e65000`, 3,48:1 contra o mínimo de 4,5:1 — `--primary-foreground` sobre `--primary`, que §Contraste medido calculava em 3,49:1 a partir do token. Os nós eram o rótulo do botão primário e o chip selecionado dos grupos de rádio de período e de agrupamento do gráfico. A auditoria da seção seguinte confirma que o token corrigido resolve os três nós.

Em 1280×800 a regra `color-contrast` volta como **incompleta com zero nós** em toda página: nessa largura ela não avaliou nada neste arnês, enquanto numa página de controle trivial avalia normalmente em qualquer largura. O traço em desktop na tabela acima é ausência de medição, não ausência de defeito — em telas largas o contraste segue coberto pela medição estática da seção anterior, que parte dos mesmos tokens.

### Incompleto que exige revisão manual

`aria-hidden-focus` ×3, nos dois viewports, enquanto um dialog está aberto: o Radix marca os irmãos do conteúdo modal com `aria-hidden="true"` e eles continuam tabuláveis no DOM. Para o leitor de tela o conteúdo está corretamente oculto; quem contém o teclado é o focus trap do Radix, que este arnês não consegue exercitar — ver Limites do arnês.

### Teclado e foco

| Verificação | Resultado |
| --- | --- |
| Ordem de tabulação em `/assets` com dados | pular para o conteúdo → navegação → conta → sair → adicionar ativo → atualizar → busca → dois filtros → oito cabeçalhos ordenáveis → link do símbolo → ações da linha → paginação; nenhum `tabIndex` positivo e nenhuma armadilha (K1, K5) |
| Menu de ações da linha | `Enter` abre, `aria-expanded` acompanha, `Arrow` percorre os itens, `Enter` seleciona (K4) |
| `AlertDialog` de exclusão | rotulado e descrito por id, irmãos ocultos, `Tab` cicla entre `Cancel` e `Confirm` sem sair, `Esc` fecha sem excluir (D2, D3, D4) |
| Alternativa textual do gráfico | `summary` "Performance as a table" é focável e abre uma tabela de 247 linhas com `caption` em `sr-only`; axe segue limpo com ela aberta (1.1.1) |
| Estrutura anunciada | um `h1` por rota, `h2` por seção com `aria-labelledby`, nenhum controle sem nome acessível, `lang="en"` (S1, S2, S6) |

### Corrigido nesta task

| Achado | Correção |
| --- | --- |
| `link-in-text-block`: o link dentro do parágrafo de `sign-in` e `sign-up` se distinguia só pela cor (1.4.1) | sublinhado permanente no link inline |
| Toda rota servia o mesmo `<title>`, sem identificar a página (2.4.2) | `title.template` na raiz e título por segmento, incluindo `generateMetadata` no detalhe do ativo |
| Fechar overlay deixava o foco no `body` (F3): o Radix devolve o foco ao `DialogTrigger`, e nenhum dialog daqui usa gatilho — todos abrem por estado, então `triggerRef` é sempre nulo | `hooks/use-focus-return.ts`, aplicado em `components/ui/dialog.tsx` e `alert-dialog.tsx` |

O fluxo que abre o dialog pelo menu da linha continua perdendo o foco ao fechar, por um motivo distinto do corrigido acima: está em TD-066, resolvido na auditoria de 2026-09-22.

### Limites do arnês

- A janela headless nunca recebe ativação: `document.hasFocus()` é sempre `false` e o Firefox não dispara `focus`, `focusin` nem `blur`, embora `document.activeElement` mude. Duas consequências: `:focus-visible` nunca casa, então o anel de foco não pode ser observado renderizado e F1 segue verificado pelo par de classes no código; e o focus trap do Radix, que depende de `focusin`, não roda, então nem a contenção do teclado no modal nem a recuperação de um foco roubado podem ser medidas aqui.
- O Lighthouse não foi executado: o pacote não está instalado. O critério "accessibility ≥ 95" da TASK 14.7 continua não verificado, em TD-054.
- Leitor de tela real (NVDA, VoiceOver), clareza da mensagem de erro e equivalência do conteúdo alternativo permanecem no roteiro manual deste documento — nenhuma ferramenta decide por eles.

## Auditoria automatizada — cadastro de instrumento e menu lateral (2026-09-21)

Executada contra `next dev` com uma conta semeada (`PETR4` do catálogo, um instrumento privado e uma posição de cada), Firefox headless por WebDriver BiDi e axe-core 4.11.1, nas duas paletas e em 1280×800, 820×1180 e 390×844 — arnês e limites em §Auditoria automatizada — TASK 20.6.

### Corrigido nesta task

| Achado | Correção |
| --- | --- |
| `fieldset disabled={isSubmitting}` em todo formulário de diálogo desabilitava os campos assim que `handleSubmit` chamava `setValue`, e o `blur` disparado pelo `disabled` corria antes do `setFocus` do RHF: o foco caía no `body`, não no primeiro campo inválido (F4, 3.3.1) | `fieldset` sem `disabled` em `instrument-registration.tsx`, `add-asset-dialog.tsx`, `transaction-form-dialog.tsx` e `portfolio-form-dialog.tsx`; o botão de troca de vista (catálogo ↔ cadastro) e o link "Buscar no catálogo" continuam desabilitados durante o submit, individualmente |
| `RegistrationForm` registra os campos na ordem do formulário, com os `SegmentedControl` de classe e mercado antes de símbolo e nome; `shouldFocusError` do RHF foca nessa ordem de registro, não na ordem visual, então um símbolo vazio focava "Stocks" (2.4.3, F6) | `shouldFocusError: false` mais um focus handler que percorre `REGISTRATION_FIELDS`, a ordem visual, e foca o primeiro campo com erro |
| `ChoiceField` (grupo de rádio) não tinha nenhuma pista visual de erro — só a mensagem abaixo indicava o campo inválido, ao contrário de `Input`, que já ganha borda vermelha (1.4.1, 3.3.1) | `data-invalid` no `fieldset` mais `in-data-invalid:border-negative` em `SegmentedControl` |
| `section[aria-labelledby]` da tabela de posições rolável tinha o mesmo rótulo ("Positions") do `<h2>` da seção que a contém, então em telas que precisam rolar (≥768px de tabela, <820px de viewport) os dois landmarks ficavam indistinguíveis (`landmark-unique`, 1.3.1, 2.4.1) | `label="Positions table"` e `"Transactions table"` em `Table`, distintos do heading da seção |
| `Dialog`/`AlertDialogContent` não tinha `outline` próprio; num diálogo cujo conteúdo rolava (registro de instrumento em telas baixas), nada indicava visualmente o limite do modal quando o foco estava num controle já visível (2.4.11) | `outline-hidden` no conteúdo, junto do anel de foco de cada controle interno, que já bastava — mudança preventiva, sem achado de reprovação associado |

Depois das correções, zero violações do axe em toda página, todo diálogo e as duas paletas, nos três viewports.

### Persistência sem consumidor no servidor

O estado expandido/recolhido do menu lateral é lido do cookie `ex3:navigation` em `(protected)/layout.tsx` antes da primeira renderização, então alternar, recarregar e reabrir a aplicação nunca produz o menu no estado errado por um instante (2.4.3, sem *flash*); verificado no arnês alternando, recarregando com o cookie já gravado e conferindo a largura do `nav` no primeiro paint.

## Auditoria de UX/UI e acessibilidade (2026-09-22)

Revisão por leitura de todo `web/src`, organizada em etapas, cada uma com os gates do `web` (`lint`, `typecheck`, `build`) e um commit próprio.

### Primitives e tokens

| Achado | Correção |
| --- | --- |
| `SelectTrigger` e o botão de fechar do `Dialog` mostravam o anel com `focus:`, também depois de um clique; o resto dos controles usa `focus-visible:` (F1) | par `focus-visible:` nos dois; o link de pulo continua em `focus:`, porque só existe na tela enquanto focado |
| Botão de fechar do `Dialog` com 16×16 px, abaixo do alvo mínimo (K6, 2.5.8) | alvo de 24×24 px com o ícone no mesmo centro; saíram as classes `data-[state=open]:`, que o `DialogClose` do Radix nunca recebe |
| `summary` da tabela de performance e botão de ordenação da tabela de posições usavam `outline-none`, que também apaga o contorno em `forced-colors` | `outline-hidden`, como no resto do código |
| Ação destrutiva em texto variava entre `text-negative` e `text-destructive`; `--negative` sobre `--accent`, o fundo do item de menu focado, dá 4.36:1 na paleta clara | `text-destructive` em toda ação de exclusão: 5.23:1 claro e 5.51:1 escuro sobre `--accent`, 7.21:1 escuro sobre `--surface-elevated`. `--negative` fica para valor e erro |
| Cabeçalho e título de `Dialog` e `AlertDialog` com espaçamento e entrelinha diferentes; `leading-none` encavalava título quebrado em duas linhas no celular | mesmo `space-y-1.5` e `leading-tight tracking-tight` nos dois; `AlertDialogCancel` perdeu o `mt-2`, que somava ao `gap-2` do rodapé só no celular |
| Botões de ação com `h-9` sobrescrito no tamanho padrão, ao lado de `size="sm"` com outro padding; submit de autenticação com `p-6` sobre `h-10` | `size="sm"` em toda ação de 36 px e `size="lg"` no submit de sign-in e sign-up |
| `align-center`, classe que não existe, em `(public)/layout.tsx` e nos dois formulários de autenticação, junto de `flex-col` sem `flex` | removidas, sem mudança de layout |
| Link de autoria do rodapé público sem indicador de foco (F1) | anel `focus-visible:` e hover |
| `pagination.tsx`, `CardTitle`, `CardDescription` e catorze partes de `dropdown-menu`/`select` sem consumidor | removidos |

Ícones de `lucide-react` 1.x já saem com `aria-hidden="true"` quando não recebem `aria-*`, `role` nem `title` (`buildLucideIconNode`); o `aria-hidden` explícito que o código tem é redundante, não falta, e o que S6 exige continua sendo o `aria-label` do controle só com ícone.

### Foco e paginação

| Achado | Correção |
| --- | --- |
| Quatro `nav` de paginação idênticos, copiados em `positions-summary.tsx`, `positions-table.tsx`, `asset-transactions.tsx` e `portfolios/page.tsx` | `PageNavigation` em `components/page-navigation.tsx` |
| "Next" na penúltima página e "Previous" na segunda ficavam `disabled` com o foco em cima: o navegador soltava o foco no `body` e o próximo `Tab` recomeçava do topo (F4) | `aria-disabled` nos botões dos extremos, que continuam focáveis, são lidos como indisponíveis e ignoram a ativação |
| Excluir a última transação da lista, ou a última de uma página, trocava a tabela pelo estado vazio e desmontava junto o elemento que receberia o foco (TD-052, F4) | `QuerySection` foca o `<h2>` da seção quando o conteúdo exibido troca e o foco, que estava na seção ou num diálogo aberto a partir dela, caiu no `body`; foco em outro lugar da página não é tocado |
| Diálogo aberto por item de menu devolvia o foco a um item já desmontado (TD-066, F3) | `useFocusReturn` registra o gatilho do menu, pelo `aria-labelledby` que o Radix põe no conteúdo com o id do gatilho |

### Formulários e conta

| Achado | Correção |
| --- | --- |
| Erro da API no sign-in e no sign-up — credencial inválida, e-mail já cadastrado, limite de tentativas — só aparecia em toast (N4, 3.3.1) | alerta `role="alert"` no formulário, como nos diálogos; o `409` do sign-up vai para o campo de e-mail, com foco; os toasts de erro saíram de `useSignIn` e `useSignUp` |
| Sign-in e sign-up desabilitavam cada campo durante o envio, e Enter num campo o desabilitava com o foco em cima — o mesmo defeito do `fieldset disabled` já corrigido nos diálogos (F4) | campos seguem habilitados; quem impede o reenvio é o botão |
| O submit de todo formulário ficava `disabled` durante o envio: ativado pelo teclado, perdia o foco para o `body`, e o próximo `Tab` depois de um envio recusado recomeçava do topo (F4, 2.4.3) | `SubmitButton`, com `aria-disabled` e o clique cancelado enquanto envia, o que cancela também a submissão implícita por Enter num campo |
| Tela de conta: nome e e-mail em `Input disabled`, fora da ordem de `Tab` e anunciados como campos indisponíveis, e um formulário de senha que aceitava digitação ao lado de "Update" sempre desabilitado, sem rota que o atendesse | nome editável e e-mail como texto numa lista de definição; troca de senha com senha atual, nova e confirmação, pelo novo `PATCH /api/v1/user`. Senha atual errada vai para o próprio campo, com foco, e a descrição da seção avisa que a troca encerra a sessão |
| A política de senha só aparecia depois do erro (3.3.2) | dica "At least 15 characters" ligada por `aria-describedby` à senha do sign-up e à nova senha da conta |
| Sign-in e sign-up validavam em `onChange`, com erro a cada tecla antes de o campo ser deixado | `onTouched`, como nos diálogos |
| "Login", "Register", "Login instead", "Logged in as", "Logged out successfully" e dois toasts no sign-up, ao lado de "Sign out" no menu | "Sign in", "Create account", "Sign in instead", "Signed in as", "Signed out" e um toast só; conta sem nome é saudada pelo e-mail |

O contrato do proxy foi exercitado por `curl` contra o `compose` local: nome salvo com o cookie mantido, senha atual errada em `400` `VALIDATION` sem `details`, nova senha curta em `400` com `path` `newPassword`, corpo inválido em `400` do proxy, troca aceita com `Set-Cookie` apagando `ex3:token`, `GET /api/v1/user` seguinte em `401`, sign-in com a senha antiga recusado e com a nova aceito.

### Exclusões

| Achado | Correção |
| --- | --- |
| A exclusão de ativo fechava o diálogo no clique, sem estado de pendência: um segundo clique reenviava o `DELETE`, que respondia `404`, e a falha só aparecia em toast (TD-064, N4, 3.3.1) | `ConfirmDeletionDialog`, o diálogo das três exclusões: fica aberto até a exclusão terminar, sem fechar por "Cancel", `Esc` ou clique fora enquanto ela corre, e mostra a recusa num alerta no próprio diálogo; o toast de erro saiu de `useDeleteAsset` |
| O confirmar das exclusões de transação e carteira ficava `disabled` durante a exclusão e soltava o foco no `body`, onde ele continuava depois de uma recusa (F4, 2.4.3) | confirmar `aria-disabled` com o clique ignorado enquanto exclui, como o `SubmitButton` |
| Depois de excluir um ativo, o foco em "Add asset" era pedido com o diálogo ainda aberto, e o `FocusScope` o devolvia ao diálogo; a volta ao gatilho do menu da linha excluída caía no `body` (F4) | a página espera o diálogo desmontar para focar "Add asset", como a de carteiras faz com "New portfolio" |
| "Confirm" e "Are you sure you want to delete…" no ativo, diante de "Delete transaction" e "Delete portfolio" nos outros dois | "Delete asset" e "Delete {symbol}?", com a consequência na descrição |
| Com uma carteira só, "Delete" ficava `disabled`, fora da ordem de `Tab`, e a explicação abaixo da lista não estava ligada a ele (1.3.1, 4.1.2) | `aria-disabled`, focável e com `aria-describedby` apontando para a explicação |
| `?action=delete` sem `symbol` abria a confirmação de "Unknown", com o confirmar desabilitado | ignorado, como `add-transaction` sem `symbol` |

### Sessão e acesso direto

| Achado | Correção |
| --- | --- |
| Sessão expirada no meio do uso recarregava a página no sign-in, e o toast "Session expired" se perdia na recarga: o formulário aparecia sem explicar por que o usuário saiu (N4, 3.3.1) | `reason=session-expired` na URL do sign-in, pelo interceptor e pelo proxy, e um aviso acima do formulário |
| Link direto para uma rota protegida sem sessão, ou sessão expirada numa tela funda, terminava na Overview depois do sign-in, e o usuário refazia o caminho | o sign-in volta ao caminho e à query pedidos, em `next`, aceitos só como caminho desta origem |
| Fechar qualquer diálogo da tela de ativos empilhava no histórico uma entrada igual à atual, e Voltar parecia não fazer nada; aberto por link, como "Add asset" da Overview, o diálogo fechado reabria no Voltar | parâmetros de diálogo escritos com `history.replaceState` |
| Refresh ou link compartilhado voltava o gráfico de performance a `1Y` e as carteiras, as posições da Overview e as transações do ativo à primeira página | período e página na URL, empilhados a cada mudança para Voltar desfazê-la, como na tabela de posições |
