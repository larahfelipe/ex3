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
| S6 | Ícone decorativo tem `aria-hidden="true"`; controle só com ícone tem `aria-label` | 1.1.1, 4.1.2 · varredura de `lucide-react` e `react-icons` |
| S7 | O link do item de navegação atual carrega `aria-current="page"` | 4.1.2 · `sidebar.tsx` |

## 4. Contraste

| # | Regra | Verificação |
| --- | --- | --- |
| C1 | Texto normal ≥ 4.5:1 e texto grande ≥ 3:1 contra o próprio fundo | 1.4.3 · medição por par token/superfície |
| C2 | Borda, estado e indicador de foco ≥ 3:1 contra o adjacente | 1.4.11 · `--border`, `--focus`, `--input` |
| C3 | Cor é o único vetor de nenhuma informação: sinal, rótulo ou ícone acompanham o tom | 1.4.1 · `signedValueTone`, `Trend`, `ProfitLoss` |
| C4 | Nenhuma cor literal no código: tudo sai dos tokens de `globals.css` | 1.4.3 · varredura de `#`, `rgb(` e `hsl(` fora de `globals.css` |
| C5 | Texto redimensionável até 200% e refluxo em 320 px sem perda de conteúdo | 1.4.4, 1.4.10 · unidades relativas; verificado junto da FASE 15 |

A paleta clara dos tokens semânticos não tem consumidor em runtime — ver TD-048. C1 e C2 valem hoje sobre a paleta escura.

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
| N6 | Animação não essencial só roda sob `motion-safe`; spinner permanece legível sem animação | 2.3.3 · regra de conclusão da TASK 14.6 |
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
