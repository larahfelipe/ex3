# Performance do frontend

O que foi medido, o que foi mudado e o que foi deliberadamente deixado como está. A FASE 16 mediu e corrigiu; a TASK 20.5 fechou a auditoria; a TASK 20.7 mediu no navegador, na última seção. Cada uma declara seu commit de captura. A auditoria de requests tem documento próprio, em [`data-fetching.md`](data-fetching.md).

## Captura da FASE 16

| Item | Valor |
| --- | --- |
| Commit de captura | `d359afd` |
| Data | 2026-09-19 |
| Método | Análise estática do código e contagem de trabalho por evento; sem profiler de navegador — a medição em navegador só apareceu na TASK 20.7, na última seção |

## Gráficos — TASK 16.3

Nenhuma biblioteca de gráficos está instalada: os dois gráficos são SVG escrito à mão, o que já elimina a maior fonte de peso e de trabalho de layout do dashboard.

### Trabalho por evento de ponteiro

`performance-chart.tsx` refazia, a cada evento de `pointermove`, a projeção da série inteira e as duas strings de `path` — trabalho proporcional ao número de pontos, num evento que dispara na frequência do ponteiro. E, como o estado do ponto ativo morava no componente da seção, cada movimento também re-renderizava o seletor de período e a tabela de dias.

Correções:

| Mudança | Efeito |
| --- | --- |
| `PerformanceSeries` passou a ser componente próprio, dono do índice ativo | Mover o ponteiro re-renderiza a linha e o tooltip; o seletor de período e a tabela ficam fora |
| `useMemo` na série plotada, nos pontos e nos dois `path` | As strings são construídas uma vez por série, não uma vez por evento |
| `key={selectedRange}` no componente | Trocar de período zera o ponto ativo por remontagem, sem um `setState` cruzado entre componentes; a tabela, cujo estado vive na seção, continua aberta |

### Densidade de pontos

A caixa de desenho tem 600 unidades de largura, então dois pontos a menos de uma unidade de distância caem no mesmo pixel. `plottedSeriesOf` reduz a série ao passo necessário para no máximo `MAX_PLOTTED_POINTS` (600) pontos, preservando sempre o último — é ele que a manchete lê quando o ponteiro está fora. O período `MAX` de uma carteira antiga, que traria milhares de pontos diários, passa a desenhar no máximo 600.

A amostragem vale só para o desenho e para o tooltip. A tabela de `Performance as a table`, que é a alternativa acessível ao gráfico, continua listando todos os dias da resposta.

### Redimensionamento

Nenhum dos gráficos escuta `resize`. O de performance usa `viewBox` com `preserveAspectRatio="none"` e largura em CSS; o de alocação decide a orientação por container query (`@md`), e o anel é um SVG de tamanho fixo. O único `ResizeObserver` do projeto está em `components/ui/table.tsx` e só alterna um booleano.

### O que não foi feito, e por quê

| Item | Razão |
| --- | --- |
| Lazy loading dos gráficos | Os dois estão na primeira dobra do dashboard e não carregam biblioteca alguma: adiá-los trocaria bytes que não existem por um salto de layout |
| Memoização em `allocation-chart.tsx` | O componente não faz trabalho por evento de ponteiro: `selectAllocationGroups` e os arcos do anel só recalculam quando a resposta muda ou quando o usuário troca de visão, uma vez por clique |
| `React.memo` nos componentes financeiros | `Money`, `Percentage` e `Trend` formatam um valor e devolvem texto; o custo da comparação de props não se paga contra o da formatação |

## Tabelas — TASK 16.4

### Formatadores de número

`common/utils.ts` guardava as três instâncias de `Intl.DateTimeFormat` em constantes de módulo, mas `formatNumber` construía um `Intl.NumberFormat` **por chamada** — e `formatPrice` dois, porque `currencyFractionDigits` construía outro só para ler `resolvedOptions()`. Uma página de 50 posições chama os formatadores cerca de 450 vezes por renderização.

Medição com Node 24, o mesmo V8 do Chrome, em 450 formatações por rodada e 200 rodadas:

| Estratégia | Tempo por renderização |
| --- | --- |
| `new Intl.NumberFormat` por chamada | 12,6 ms |
| Formatador em cache | 0,32 ms |

Construir o formatador custava cerca de quarenta vezes o que formatar com ele custa, e sozinho consumia três quartos de um quadro de 16 ms a cada renderização da tabela. `numberFormatOf` passou a guardar as instâncias num `Map` chaveado pelas opções; as chaves distintas são limitadas pelos estilos, pelas moedas e pelas contagens de casas que os formatadores pedem, então o mapa não cresce com o volume de dados. A saída é idêntica: mesma locale, mesmas opções, só a instância é reaproveitada.

### Volume

| Item | Decisão |
| --- | --- |
| Paginação | Server-side em toda listagem: posições em 10, 25 ou 50 linhas, transações em 10 no detalhe do ativo e 5 na Overview. O número de linhas renderizadas não cresce com o tamanho da carteira |
| Virtualização | Não introduzida. Ela resolve listas cuja altura é imprevisível; aqui o teto é 50 linhas por página, e virtualizar custaria a semântica de `<table>`, a rolagem nativa da região e a busca do navegador dentro da página |
| `keepPreviousData` | Paginar, ordenar ou filtrar mantém a página anterior visível e esmaecida, sem desmontar e remontar o corpo da tabela a cada mudança |

### Renderização por tecla

Digitar na busca de posições re-renderiza a tabela, porque o texto digitado e a listagem moram no mesmo componente. Com os formatadores em cache, o que resta por tecla é a reconciliação de no máximo 50 linhas, e a requisição só sai 300 ms depois da última tecla. Isolar esse estado num componente próprio, como foi feito com o ponto ativo do gráfico, só se justifica com um profiler apontando o custo — sem navegador, não se mede, e não se refatora no escuro.

## Bundle — TASK 16.5

Medida usada em todo este trecho: soma dos bytes de `build/static/chunks`, o JavaScript que o navegador baixa. O Next 16 não imprime mais o tamanho por rota no `build`, e o `--webpack` então em uso não gerava `app-build-manifest.json`, então a comparação é do total antes e depois de cada mudança.

| Momento | Bytes |
| --- | --- |
| Antes da auditoria (`f61b61f`) | 1.574.940 |
| Depois | 1.558.141 |

### Três bibliotecas de ícones

O projeto importava ícones de `react-icons` (cinco conjuntos: `io5`, `md`, `lu`, `pi`, `rx`), de `@radix-ui/react-icons` e de `lucide-react` — 11, 9 e 13 ícones. `react-icons/lu` é o próprio Lucide reempacotado, e os outros dois conjuntos entregavam o mesmo desenho com outro traço, o que tornava o mesmo conceito visualmente diferente conforme a tela.

Tudo passou para `lucide-react`, a mais usada das três. Equivalências que não são renomeações diretas:

| Saiu | Entrou | Nota |
| --- | --- | --- |
| `CaretSortIcon` | `ChevronsUpDown` | mesmo par de setas do gatilho do select |
| `DotFilledIcon` | `Circle` em `h-2 w-2 fill-current` | o Lucide não tem ponto cheio; o círculo reduzido é o que o shadcn usa |
| `RxDashboard` | `LayoutGrid` | mesma grade de quatro células |
| `PiEyeClosed` | `EyeClosed` | olho fechado, não o `EyeOff` cortado |

Os ícones do Radix desenham numa caixa de 15 px e os do Lucide, de 24. Todos os usos já fixavam `h-4 w-4` ou `size={n}`; as duas exceções eram os botões de rolagem do select, que ganharam `h-4 w-4` para não crescerem.

### Dependências removidas

| Pacote | Importadores | Instalado |
| --- | --- | --- |
| `react-icons` | consolidado em `lucide-react` | 85 MB |
| `@radix-ui/react-icons` | consolidado em `lucide-react` | 4,6 MB |
| `next-themes` | nenhum (TD-046) | 48 KB |
| `lodash.isequal` + `@types/lodash.isequal` | nenhum | 68 KB |

São cerca de 90 MB a menos por install — o que mais pesa é o tempo de instalação e a imagem de build, não o bundle: os dois conjuntos de ícones já entravam no cliente apenas nos ícones usados, e por isso o total dos chunks cai só 16.799 bytes.

### Service worker

`next-pwa` vinha com o `runtimeCaching` padrão, que registrava 15 rotas no worker — entre elas uma `NetworkFirst` para `/api/`, guardando até 16 respostas por 24 horas, e uma `NetworkFirst` genérica para toda navegação. As respostas de `/api/v1/*` carregam as posições e o patrimônio do usuário autenticado: ficavam no Cache Storage do dispositivo, sobreviviam ao sign-out, que só apaga o cookie, e podiam ser servidas como números atuais quando a rede demorasse mais de 10 s.

O worker passou a precachear a saída do build e nada mais: `runtimeCaching: []`, `cacheStartUrl: false` e `dynamicStartUrl: false`. Nenhuma resposta dinâmica é gravada, e a instalação continua válida porque o precache já instala um handler de `fetch`.

| Item | Antes | Depois |
| --- | --- | --- |
| `registerRoute` no `sw.js` | 15 | 0 |
| Entradas no precache | 73 | 66 |
| `login-hero.jpeg` (1,93 MB) no precache | sim | não |

Na TASK 20.3 o PWA saiu inteiro: sem `next-pwa` não há worker nem precache, e a superfície descrita acima deixa de existir. O que este trecho registra é por que ela nunca deveria ter existido com o padrão do plugin.

### O que foi avaliado e mantido

| Item | Razão |
| --- | --- |
| `@tanstack/react-query-devtools` | Importado sem condição em `providers/app-provider.tsx`, mas o pacote exporta um componente que devolve `null` fora de `development`, e o painel é eliminado na build: nenhuma referência sobrou em `build/static/chunks` nem em `build/server`. O `Dockerfile` instala tudo no estágio de build e só o runtime roda com `--prod`, então a dependência de desenvolvimento não falta em lugar nenhum |
| `next-pwa` | Mantido aqui porque instalabilidade é decisão de produto, não de auditoria; o risco de ser um plugin parado em 2022 ficou em TD-057, e a decisão veio na TASK 20.3 — o PWA foi removido |
| `axios` | Usado nos route handlers e nos hooks, com interceptadores que centralizam sessão expirada e erro de API; trocar por `fetch` reescreveria essa camada sem ganho medido |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Base do `cn` e das variantes do `Button`; somados não chegam a 10 KB |

A arte do sign-in é hoje o maior arquivo servido — 1,93 MB contra 1,49 MB de todo o JavaScript do cliente — e continua sendo baixada em telefones, onde a coluna que a exibe é `hidden`. A correção mexe no `next/image` e no arquivo binário, fora do escopo desta task: está em TD-056, encaminhada para a TASK 20.5.

## Auditoria final — TASK 20.5

| Item | Valor |
| --- | --- |
| Commit de captura | `c426c5c` |
| Data | 2026-09-20 |
| Método | `build` e `next start` de produção locais, backend em `:8080`, conta recém-criada e carteira vazia; mediana de 8 amostras por rota. Sem navegador, pelo motivo em `accessibility.md`, §Auditoria automatizada |

| Métrica | Baseline | Atual | Gap |
| --- | --- | --- | --- |
| Bundle do cliente | 1.558.141 B (TASK 16.5, webpack) | 1.580.679 B (Turbopack) | nenhum: bundlers diferentes, comparação abaixo |
| Requests por página | inventário da TASK 16.1 | inalterado: 7 na Overview, 3 em `/assets`, 4 no detalhe, 1 em `/account` | duas ondas, pelo `portfolios` que abre as demais |
| TTFB | não medido antes | 7–8 ms nas páginas, 6–8 ms nas rotas de dados | nenhum |
| Maior arquivo servido | 2.020.657 B, baixado em todo viewport | 2.020.657 B, baixado só em `≥ lg` | o arquivo segue sem reencodificar (TD-056) |
| LCP, CLS e INP | nunca medidos | nunca medidos | sem navegador no ambiente (TD-054, TD-058) |

### Bundle

Mesma medida da TASK 16.5: soma dos bytes de `build/static/chunks`.

| Momento | Bundler | Bytes |
| --- | --- | --- |
| Baseline da TASK 16.5 (`d359afd`) | webpack | 1.558.141 |
| Entrada desta task | Turbopack | 1.594.975 |
| Entrada desta task, mesmo código sob `--webpack` | webpack | 1.538.621 |
| Saída desta task | Turbopack | 1.580.679 |

Contra o baseline direto, o número acusaria 36.834 bytes de regressão que não existem: a TASK 20.3 devolveu o `build` ao Turbopack ao remover o PWA, e o baseline é uma build webpack. Comparando bundler com bundler, o código escrito desde a FASE 16 tirou 19.520 bytes do cliente; o Turbopack, sobre esse mesmo código, emite 56.354 bytes a mais (+3,7 %) — preço de um `Compiled successfully` em 241 ms contra 3,8 s. O maior chunk isolado tem 427.816 bytes.

### A arte do sign-in — TD-056

`priority` está **deprecado no Next 16**, substituído por `preload`, e não emite mais o `<link rel="preload">` que o nome sugere: o HTML servido não tinha preload algum. O que o prop fazia era manter a busca ansiosa de um `<img>` que o browser baixa mesmo sob `display:none` — e a coluna é `max-lg:hidden`. Todo telefone baixava 1,93 MB de decoração que nunca aparece.

A arte passou a ser `background-image` da própria coluna. O fundo de um elemento que não gera caixa não é buscado, então abaixo de `lg` a requisição deixa de existir; em `≥ lg` os bytes são os mesmos, buscados depois do CSS em vez de durante o parse do HTML. Como era o único uso de `next/image` no projeto, o runtime do componente também saiu do cliente.

| Item | Antes | Depois |
| --- | --- | --- |
| Requisição em viewport `< lg` | 2.020.657 B | nenhuma |
| Requisição em viewport `≥ lg` | 2.020.657 B | 2.020.657 B |
| Runtime do `next/image` no bundle | 14.296 B | 0 |
| HTML de `/sign-in` | 19.928 B | 19.392 B |

Resta o arquivo: 1,93 MB de JPEG onde um WebP na largura que a coluna usa resolveria em torno de um décimo. Não há codificador neste ambiente — `sharp`, `cwebp`, `magick` e PIL ausentes —, e a reencodificação segue aberta em TD-056, agora como item único.

### Requests

O inventário da TASK 16.1 ([`data-fetching.md`](data-fetching.md)) continua valendo: nenhuma query nova entrou nas fases 17 a 20, e a TASK 20.2 passou todas as de carteira por `usePortfolioScopedQuery`, que as suspende até o id existir.

| Página | Primeira onda | Segunda onda | Total |
| --- | --- | --- | --- |
| `/` | `currentUser`, `portfolios` | `overview`, `performance`, `allocation`, `positions`, `transactions` | 7 |
| `/assets` | `currentUser`, `portfolios` | `positions` | 3 |
| `/assets/[symbol]` | `currentUser`, `portfolios` | `position`, `transactions` | 4 |
| `/account` | `currentUser` | — | 1 |

A segunda onda é paralela; o que a atrasa é a dependência do id da carteira, o limite já registrado em `data-fetching.md`, §Waterfall.

### TTFB

| Página | TTFB |
| --- | --- |
| `/sign-in` | 8 ms |
| `/` | 8 ms |
| `/assets` | 7 ms |
| `/account` | 8 ms |

| Rota de dados | Pelo proxy do web | Direto na API | Custo do proxy |
| --- | --- | --- | --- |
| `/v1/user` | 6 ms | 3 ms | 3 ms |
| `/v1/portfolios` | 7 ms | 3 ms | 4 ms |
| `/v1/portfolio/overview` | 8 ms | 4 ms | 4 ms |
| `/v1/portfolio/positions` | 8 ms | 4 ms | 4 ms |

O salto pelo proxy custa de 3 a 4 ms: uma requisição HTTP a mais no mesmo host, mais a leitura do cookie e a montagem do `Authorization`. É o preço do token fora do navegador, descrito em `security.md`, §Cookie de sessão.

Os números são de `localhost`, processo quente e carteira vazia: medem o caminho, não o banco. O custo de consulta cresce com o livro, e é o backend que o paga — a FASE 15 instrumentou essas rotas. Como a FASE 16 não mediu TTFB, o que está aqui é o próprio baseline.

### LCP, CLS e INP

Não medidos nesta captura. O LCP foi medido depois, na TASK 20.7, na última seção deste documento; CLS e INP continuam sem número. O que a leitura do código sustenta:

| Métrica | O que se sabe |
| --- | --- |
| LCP | Em `≥ lg` o candidato no sign-in é a arte, e a mudança acima troca o momento da busca sem mudar os bytes; abaixo de `lg` o maior elemento passa a ser o cartão de sign-in, que é texto e campo. No dashboard não há imagem alguma: o maior elemento é o cartão de patrimônio |
| CLS | Todo estado de carregamento reserva altura explícita — `LoadingState` com `h-40` por padrão, `h-96` na listagem de posições, e esqueletos com a forma do conteúdo nos cartões e nos gráficos. Nenhuma imagem entra no fluxo. O que nenhuma leitura decide é se a altura reservada é a do conteúdo que chega, e é exatamente essa diferença que o CLS mede |
| INP | O trabalho por interação foi o alvo das TASKs 16.3 e 16.4: projeção do gráfico memoizada, formatadores em cache, busca com 300 ms de debounce. Sem medição, segue sendo argumento, não número |

### Gráficos e tabelas — TASK 20.5

Reverificados depois das refatorações das fases 17 a 20, sem regressão: `MAX_PLOTTED_POINTS` continua igual a `CHART_WIDTH`, com a amostragem por passo que preserva o último ponto; os quatro `useMemo` de `performance-chart.tsx` seguem na série plotada, nos pontos e nos dois `path`; o `Map` de `Intl.NumberFormat` segue em `common/utils.ts`; e a paginação continua server-side em 10, 25 ou 50 posições, 10 transações no detalhe do ativo, 10 no resumo de posições e 5 na Overview.

## Medição em navegador — TASK 20.7

A TASK 20.5 deixou LCP, CLS e INP como lacuna por falta de navegador. Um Firefox 155 headless, dirigido por WebDriver BiDi, fechou metade dela em 2026-09-20, contra o build de produção servido por `next start` em `localhost:3010`, com uma conta semeada com uma posição e duas compras.

| Item | Valor |
| --- | --- |
| Commit de captura | `69ca10c` |
| Método | `PerformanceObserver` com `buffered: true` para o LCP, `first-contentful-paint` da Paint Timing e `responseStart - requestStart` da Navigation Timing |
| Ressalva | Tudo em `localhost`, sem latência de rede e sem throttling: os tempos são o piso do que o código consegue, não a experiência de campo |

| Rota | LCP 1280×800 | LCP 390×844 | FCP | TTFB |
| --- | --- | --- | --- | --- |
| `/sign-in` sem sessão | 47 ms | 65 ms | 47–65 ms | 7 ms |
| `/sign-up` sem sessão | 50 ms | 51 ms | 50–51 ms | 9–14 ms |
| `/` | 255 ms | 225 ms | 51 ms | 9–12 ms |
| `/assets` | 216 ms | 194 ms | 51–52 ms | 9–14 ms |
| `/assets/PETR4` | 220 ms | 188 ms | 51–52 ms | 9–13 ms |
| `/account` | 39 ms | 86 ms | 39–86 ms | 9 ms |

O orçamento do LCP é 2,5 s; a pior rota fica em um décimo disso. A distância entre FCP e LCP nas rotas protegidas — cerca de 170 ms — é o intervalo entre o esqueleto e o dado da API, exatamente o waterfall de TD-055. O elemento de LCP é a lista de métricas do cartão de patrimônio nas telas com dado e o parágrafo do formulário nas demais; a arte do sign-in não é candidata em nenhuma largura desde a TASK 20.5.

O que continua sem número: o **CLS**, porque o Firefox não implementa o tipo de entrada `layout-shift` — só Chromium expõe —, e o **INP**, que exige interação real numa janela ativa, que o arnês headless nunca tem. Ambos seguem em TD-054, junto do Lighthouse.
