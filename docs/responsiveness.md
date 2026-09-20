# Baseline de responsividade — TASK 15.1

Comportamento de layout do frontend (`web/src`) em cada largura de validação, usado como critério das TASKS 15.2 a 15.4 e de toda task posterior que toque em UI. Cada linha descreve o que o código faz hoje, com o ponto que o garante.

## Referência

| Item | Valor |
| --- | --- |
| Escala | Breakpoints padrão do Tailwind CSS 4, sem override em `@theme` |
| Larguras de validação | 320, 375, 768, 1024, 1440 px |
| Escopo | `web/src` — rotas `(public)` e `(protected)`, primitives em `components/ui` |
| Commit de captura | `4363487` |
| Data de captura | 2026-09-19 |

| Variante | Largura mínima | Uso no projeto |
| --- | --- | --- |
| `max-sm` | até 639 px | 16 ocorrências — barra inferior, botão de largura cheia, rótulo em `sr-only` |
| `sm` | 640 px | 66 ocorrências — é o único corte estrutural do app |
| `md` | 768 px | nenhum uso direto; só a variante de container `@md` |
| `lg` | 1024 px | layout público em duas colunas e as duas grades do detalhe do ativo |
| `xl` | 1280 px | grade de três colunas do dashboard |
| `@md` | container de 448 px | orientação do gráfico de alocação, em `allocation-chart.tsx` |

O corte real do produto é um só, em 640 px: abaixo dele a navegação é uma barra inferior e tudo empilha; acima dele a navegação é um trilho fixo de 10 rem e o conteúdo ocupa o restante. As variantes `lg` e `xl` refinam grades já empilhadas, nunca a navegação.

## Regras de layout

| # | Regra | Verificação |
| --- | --- | --- |
| R1 | Nenhuma rolagem horizontal do documento em qualquer largura a partir de 320 px | 1.4.10 · conteúdo em unidades relativas; transbordo confinado a container próprio |
| R2 | Transbordo permitido só dentro de região declarada, com nome e alcance por teclado | 1.4.10, 2.1.1 · `performance-chart.tsx`; pendência das tabelas em TD-051 |
| R3 | Alvo de toque de no mínimo 44 px em ponteiro grosseiro | 2.5.8 · `min-h-11` e `max-sm:min-w-11` em `sidebar.tsx` |
| R4 | Texto nunca truncado sem alternativa acessível ao valor completo | 1.4.4 · `title`/`sr-only` ou célula com valor exato |
| R5 | Ação principal da tela alcançável sem rolagem horizontal e sem sair do fluxo | 2.4.3 · `max-sm:w-full` nos botões de cabeçalho e de estado |
| R6 | Altura viva medida em `dvh`, não em `vh`, onde a barra do navegador se move | `transaction-form-dialog.tsx`; pendência do layout público em §Lacunas |
| R7 | Nenhuma largura fixa maior que 320 px em elemento de fluxo | varredura de `min-w-` e de largura literal |

## Comportamento por largura

### 320 px e 375 px — abaixo de `sm`

| Região | Comportamento |
| --- | --- |
| Navegação | Barra fixa no rodapé, altura `--navigation-bar` (3.75 rem), quatro alvos de 44 px distribuídos — visão geral, ativos, conta e sair —, rótulo em `sr-only`, marca oculta |
| Shell da página | `<main>` com `pb-(--navigation-bar)` para não ficar sob a barra; padding lateral de `px-3` |
| Dashboard | Pilha única: valor da carteira, gráfico de performance, alocação, resumo de posições, transações recentes |
| Alocação | Container abaixo de 448 px: anel acima, legenda abaixo, em coluna |
| Posições | Filtro, busca e ações em largura cheia; tabela dentro de container com `overflow-auto`, que rola na horizontal |
| Detalhe do ativo | Uma coluna; as duas grades `lg:grid-cols-2` ficam empilhadas |
| Formulários | Campos em coluna única; o `sm:grid-cols-2` do formulário de transação não se aplica |
| Dialogs | `w-full` sem margem lateral, cantos retos (`sm:rounded-lg` não se aplica), padding de 24 px — sobram 272 px de conteúdo em 320 px |
| Autenticação | Só a coluna do formulário; a coluna de arte é `max-sm:hidden` |

### 768 px — acima de `sm`, abaixo de `lg`

| Região | Comportamento |
| --- | --- |
| Navegação | Trilho fixo à esquerda, `--navigation-rail` (10 rem), rótulo visível, marca visível; `<main>` deslocado por `ml-(--navigation-rail)` |
| Largura útil | 608 px de conteúdo, com padding lateral de `px-4` |
| Dashboard | Ainda em pilha única — a grade só divide em 1280 px |
| Alocação | Container acima de 448 px: passa de `@md`, anel e legenda lado a lado |
| Posições | Filtros em linha; tabela ainda pode transbordar conforme o número de colunas |
| Dialogs | Largura travada em `max-w-lg` (32 rem), centralizado, cantos arredondados |
| Autenticação | Coluna de arte volta a existir, mas empilhada sob o formulário: a grade só começa em 1024 px |

### 1024 px — `lg`

| Região | Comportamento |
| --- | --- |
| Largura útil | 864 px de conteúdo |
| Dashboard | Sem mudança: continua em pilha única até 1280 px |
| Detalhe do ativo | As duas grades passam a duas colunas |
| Autenticação | Tela dividida em duas colunas iguais, formulário à esquerda e arte à direita |
| Posições | Tabela normalmente cabe sem transbordo horizontal |

### 1440 px — `xl`

| Região | Comportamento |
| --- | --- |
| Largura útil | 1280 px de conteúdo |
| Dashboard | Grade de três colunas: alocação em uma, resumo de posições em duas (`xl:col-span-2`) |
| Demais regiões | Iguais a 1024 px; nenhum container cresce além do fluxo |

## Lacunas conhecidas na captura

Observadas ao escrever este documento, cada uma endereçada na task indicada:

| Lacuna | Regra | Task |
| --- | --- | --- |
| O dashboard só reflui em 1280 px: em 1024 px, uma tela larga exibe uma coluna única com muito espaço ocioso à direita | — | 15.2 |
| A tabela de posições resolve o excesso de colunas com rolagem horizontal indiscriminada, sem priorizar coluna nem oferecer alternativa ao dado secundário | R2, R4 | 15.3 |
| O container de rolagem de `components/ui/table.tsx` não alcança o teclado — TD-051 | R2 | 15.3 |
| Entre 640 px e 1024 px a coluna de arte da autenticação aparece empilhada sob o formulário, sem função | — | 15.4 |
| O layout público usa `h-screen`, e não `dvh`: com a barra do navegador móvel recolhendo, parte do formulário fica fora da área visível | R6 | 15.4 |
| Nenhum dialog assume a tela inteira abaixo de `sm`, e só o de transação limita a altura; com o teclado virtual aberto, o CTA do rodapé pode ficar inalcançável | R5, R6 | 15.4 |
