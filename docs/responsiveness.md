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
| `lg` | 1024 px | layout público em duas colunas, grade de três colunas do dashboard e as duas grades do detalhe do ativo |
| `xl` | 1280 px | nenhum uso desde a TASK 15.2 |
| `@md` | container de 448 px | orientação do gráfico de alocação, em `allocation-chart.tsx` |

O corte real do produto é um só, em 640 px: abaixo dele a navegação é uma barra inferior e tudo empilha; acima dele a navegação é um trilho fixo de 10 rem e o conteúdo ocupa o restante. As variantes `lg` e `xl` refinam grades já empilhadas, nunca a navegação.

## Regras de layout

| # | Regra | Verificação |
| --- | --- | --- |
| R1 | Nenhuma rolagem horizontal do documento em qualquer largura a partir de 320 px | 1.4.10 · conteúdo em unidades relativas; transbordo confinado a container próprio |
| R2 | Transbordo permitido só dentro de região declarada, com nome e alcance por teclado | 1.4.10, 2.1.1 · `components/ui/table.tsx`, região nomeada e focável enquanto transborda |
| R3 | Alvo de toque de no mínimo 44 px em ponteiro grosseiro | 2.5.8 · `min-h-11` e `max-sm:min-w-11` em `sidebar.tsx` |
| R4 | Texto nunca truncado sem alternativa acessível ao valor completo | 1.4.4 · `title`/`sr-only` ou célula com valor exato |
| R5 | Ação principal da tela alcançável sem rolagem horizontal e sem sair do fluxo | 2.4.3 · `max-sm:w-full` nos botões de cabeçalho e de estado |
| R6 | Altura viva medida em `dvh`, não em `vh`, onde a barra do navegador ou o teclado virtual se movem | `dialog.tsx`, `alert-dialog.tsx`, `(public)/layout.tsx`, com `interactiveWidget: 'resizes-content'` no `viewport` da raiz |
| R7 | Nenhuma largura fixa maior que 320 px em elemento de fluxo | varredura de `min-w-` e de largura literal |

## Comportamento por largura

### 320 px e 375 px — abaixo de `sm`

| Região | Comportamento |
| --- | --- |
| Navegação | Barra fixa no rodapé, altura `--navigation-bar` (3.75 rem), quatro alvos de 44 px distribuídos — visão geral, ativos, conta e sair —, rótulo em `sr-only`, marca oculta |
| Shell da página | `<main>` com `pb-(--navigation-bar)` para não ficar sob a barra; o contêiner de `(protected)/layout.tsx`, comum a toda página, dá padding lateral de 16 px (`px-4`) e vertical de 32 px (`py-8`) |
| Dashboard | Pilha única: valor da carteira, gráfico de performance, alocação, resumo de posições, transações recentes |
| Alocação | Container abaixo de 448 px: anel acima, legenda abaixo, em coluna |
| Posições | Filtro, busca e ações em largura cheia; a tabela mostra ativo, valor e o menu de ações, com o resultado repetido sob o símbolo. Quantidade, preço médio, preço, alocação e as duas colunas de resultado saem de cena e seguem no detalhe do ativo, alcançável pelo link do símbolo |
| Tabelas do dashboard | Só colunas primárias: resumo de posições mostra ativo, valor de mercado e resultado; transações mostram data, tipo, ativo e detalhes. Quantidade, preço unitário e alocação saem de cena e seguem disponíveis no detalhe do ativo e no dialog de detalhes |
| Rolagem residual | O que ainda transborda fica dentro da região de `components/ui/table.tsx`, que só então é nomeada e recebe `Tab` — nunca no documento |
| Detalhe do ativo | Uma coluna; as duas grades `lg:grid-cols-2` ficam empilhadas |
| Formulários | Campos em coluna única; o `sm:grid-cols-2` do formulário de transação não se aplica |
| Dialogs | `w-full` sem margem lateral, cantos retos (`sm:rounded-lg` não se aplica), padding de 24 px — sobram 272 px de conteúdo em 320 px. O conteúdo é limitado a `max-h-dvh` e rola por dentro: quando é mais alto que a tela, o dialog ocupa a tela integral, e o rodapé com o CTA fica no fim da rolagem |
| Teclado virtual | `interactiveWidget: 'resizes-content'` encolhe o viewport de layout, e com ele todo `dvh`: o dialog se redimensiona sobre o teclado e o campo focado entra na área visível |
| Autenticação | Só a coluna do formulário; a coluna de arte é `max-lg:hidden`. O `main` tem `min-h-dvh`, então cresce em vez de recortar quando o teclado reduz a tela |

### 768 px — acima de `sm`, abaixo de `lg`

| Região | Comportamento |
| --- | --- |
| Navegação | Trilho fixo à esquerda, `--navigation-rail` (10 rem), rótulo visível, marca visível; `<main>` deslocado por `ml-(--navigation-rail)` |
| Largura útil | 640 px de conteúdo, com padding lateral de 24 px (`sm:px-6`) |
| Dashboard | Ainda em pilha única — a grade só divide em 1280 px |
| Alocação | Container acima de 448 px: passa de `@md`, anel e legenda lado a lado |
| Posições | Filtros em linha; as oito colunas voltam e a tabela pode transbordar, dentro da região rolável nomeada |
| Dialogs | Largura travada em `max-w-lg` (32 rem), centralizado, cantos arredondados, altura limitada a `calc(100dvh - 2rem)` para sobrar a moldura |
| Autenticação | Só a coluna do formulário, centralizada: a arte entra junto com a grade, em 1024 px |

### 1024 px — `lg`

| Região | Comportamento |
| --- | --- |
| Largura útil | 752 px de conteúdo com o menu expandido e 880 px com ele recolhido, com padding lateral de 32 px (`lg:px-8`) |
| Dashboard | Grade de três colunas: alocação em uma, resumo de posições em duas (`lg:col-span-2`), com ~490 px para a tabela com o menu expandido |
| Detalhe do ativo | As duas grades passam a duas colunas |
| Autenticação | Tela dividida em duas colunas iguais, formulário à esquerda e arte à direita |
| Posições | Tabela normalmente cabe sem transbordo horizontal |

### 1440 px — `xl`

| Região | Comportamento |
| --- | --- |
| Largura útil | 1152 px de conteúdo com o menu expandido e 1280 px com ele recolhido, com padding lateral de 40 px (`xl:px-10`) |
| Dashboard | Mesma grade de 1024 px, com ~760 px para a tabela do resumo com o menu expandido |
| Demais regiões | Iguais a 1024 px. O contêiner da página para de crescer em 1536 px (`max-w-(--breakpoint-2xl)`) e se centraliza à direita do menu, o que só acontece acima de 1824 px com o menu expandido |

## Lacunas conhecidas na captura

Observadas ao escrever este documento, cada uma endereçada na task indicada:

| Lacuna | Regra | Task |
| --- | --- | --- |
| ~~O dashboard só reflui em 1280 px~~ — resolvido na TASK 15.2: a grade passou a dividir em `lg` | — | 15.2 |
| ~~A tabela de posições resolve o excesso de colunas com rolagem horizontal indiscriminada~~ — resolvido na TASK 15.3: abaixo de `sm` só ativo, valor e ações, com o detalhe do ativo como alternativa | R2, R4 | 15.3 |
| ~~O container de rolagem de `components/ui/table.tsx` não alcança o teclado~~ — resolvido na TASK 15.3 · TD-051 | R2 | 15.3 |
| ~~Entre 640 px e 1024 px a coluna de arte da autenticação aparece empilhada sob o formulário~~ — resolvido na TASK 15.4: a arte é `max-lg:hidden`, e aparece só com a grade | — | 15.4 |
| ~~O layout público usa `h-screen`, e não `dvh`~~ — resolvido na TASK 15.4 | R6 | 15.4 |
| ~~Nenhum dialog assume a tela inteira abaixo de `sm`, e só o de transação limita a altura~~ — resolvido na TASK 15.4: o limite e a rolagem vivem nos dois primitives, e o viewport da raiz encolhe com o teclado | R5, R6 | 15.4 |
