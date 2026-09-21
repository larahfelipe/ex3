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
| F4 | Nenhum elemento focado é removido da árvore sem o foco ir para um destino previsível | 2.4.3 · trocar de página, limpar filtros, excluir linha |
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

A paleta clara dos tokens semânticos não tem consumidor em runtime — ver TD-048. C1 e C2 valem hoje sobre a paleta escura. As razões medidas estão em §Contraste medido.

## 5. Formulários

| # | Regra | Verificação |
| --- | --- | --- |
| P1 | Todo input tem nome acessível por `<Label htmlFor>`; `aria-label` só quando não há rótulo visível | 1.3.1, 3.3.2, 4.1.2 · `jsx-a11y/label-has-associated-control` |
| P2 | Erro de campo é associado por `aria-describedby` e marcado com `aria-invalid` | 3.3.1 · formulários de transação, ativo e autenticação |
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
| D5 | Nenhum dialog abre outro dialog empilhado | 2.4.3 · o fluxo ativo → transação fecha o primeiro antes de abrir o segundo |

## 7. Conteúdo dinâmico

| # | Regra | Verificação |
| --- | --- | --- |
| N1 | Carregamento usa `LoadingState`: `<output aria-busy="true">` com rótulo em `sr-only` e skeleton `aria-hidden` | 4.1.3 · `data-state.tsx` |
| N2 | Falha recuperável usa `ErrorState`/`StaleState` com `role="alert"` e ação de nova tentativa | 4.1.3, 3.3.1 · `data-state.tsx` |
| N3 | Contagem, paginação e total mudam dentro de `aria-live="polite"` | 4.1.3 · `positions-table.tsx`, `asset-transactions.tsx`, `positions-summary.tsx` |
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

Encerradas desde a captura: o link de pulo e os landmarks em `8a3ef68`; a região rolável do gráfico em `b01bf45`; o destino de foco após fechar overlay em `e8cb974`; nome acessível, associação de erro, estado obrigatório e `autocomplete` em `717ada7`; movimento reduzido em `b6bda64`; a auditoria automatizada na TASK 20.6, medida em §Auditoria automatizada. A linha do contraste continua aberta, com a medição na seção seguinte e a decisão em TD-053.

## Contraste medido

Medição determinística dos tokens de `app/globals.css`, nas duas paletas, restrita aos pares que o código produz de fato — cada `text-*` sobre a superfície em que ele aparece em `web/src`. Método: HSL do token convertido para sRGB, luminância relativa e razão de contraste da WCAG 2.x, com 4.5:1 para texto normal (1.4.3) e 3:1 para limite de componente e indicador de estado (1.4.11); fundo com alpha, como `bg-warning/10`, composto sobre `--background` antes da medição. Nenhum navegador é necessário para repetir a medição — as entradas são os próprios tokens.

Pares reprovados:

| Par | Onde aparece | Claro | Escuro | Limite |
| --- | --- | --- | --- | --- |
| `--destructive` como texto | ação "Delete transaction" em `transaction-details-dialog.tsx` | 3.76:1 | 2.01:1 | 4.5:1 |
| `--primary-foreground` sobre `--primary` | rótulo de todo botão primário | 16.95:1 | 3.49:1 | 4.5:1 |
| `--border` e `--input` sobre `--background` | borda de campo, única pista visual do controle | 1.24:1 | 1.33:1 | 3:1 |
| `--destructive-foreground` sobre `--destructive` | botão sólido de exclusão | 3.60:1 | 9.59:1 | 4.5:1 |
| `--muted-foreground` sobre `--muted` | texto secundário em superfície de realce | 4.39:1 | 6.00:1 | 4.5:1 |
| `--warning` sobre `bg-warning/10` | chip de alerta | 4.40:1 | 10.28:1 | 4.5:1 |

Os demais pares passam nas duas paletas, com folga: texto padrão 20.14:1 e 19.24:1; `--muted-foreground` sobre `--background` 4.83:1 e 7.96:1; `--negative` 4.80:1 e 7.31:1; `--positive` 5.58:1 e 10.46:1; `--info` 5.94:1 e 9.55:1; anel de foco 20.14:1 e 5.27:1; pior série do gráfico 3.02:1 e 5.27:1.

Como só a paleta escura tem consumidor em runtime (TD-048), as reprovações que hoje afetam o usuário são as três primeiras. Correção registrada em TD-053: o ajuste é no token, em `globals.css`, não na classe de cada uso.

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

Todo nó reprovado é o mesmo par: `#fef2f2` sobre `#e65000`, 3,48:1 contra o mínimo de 4,5:1 — `--primary-foreground` sobre `--primary`, que §Contraste medido calcula em 3,49:1 a partir do token. Os nós são o rótulo do botão primário e o chip selecionado dos grupos de rádio de período e de agrupamento do gráfico. A renderização confirma TD-053; a escolha do novo valor continua sendo decisão de design sobre o token, não sobre a classe de cada uso.

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

O fluxo que abre o dialog pelo menu da linha continua perdendo o foco ao fechar, por um motivo distinto do corrigido acima: está em TD-066.

### Limites do arnês

- A janela headless nunca recebe ativação: `document.hasFocus()` é sempre `false` e o Firefox não dispara `focus`, `focusin` nem `blur`, embora `document.activeElement` mude. Duas consequências: `:focus-visible` nunca casa, então o anel de foco não pode ser observado renderizado e F1 segue verificado pelo par de classes no código; e o focus trap do Radix, que depende de `focusin`, não roda, então nem a contenção do teclado no modal nem a recuperação de um foco roubado podem ser medidas aqui.
- O Lighthouse não foi executado: o pacote não está instalado. O critério "accessibility ≥ 95" da TASK 14.7 continua não verificado, em TD-054.
- Leitor de tela real (NVDA, VoiceOver), clareza da mensagem de erro e equivalência do conteúdo alternativo permanecem no roteiro manual deste documento — nenhuma ferramenta decide por eles.
