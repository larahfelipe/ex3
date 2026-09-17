# Inventário de componentes reutilizáveis — TASK 0.3

Classificação do frontend (`web/src`) no commit `8dc9edd`, para decidir o que preservar antes das FASES 8–13. 4.481 linhas de TS/TSX.

## UI primitives — `src/components/ui`

shadcn/ui sobre Radix, com `cn()` (`clsx` + `tailwind-merge`) e `class-variance-authority`. Base sólida, mantida.

| Componente | Base | Avaliação |
| --- | --- | --- |
| `button` | Radix Slot + CVA | **Preservar.** Variantes já cobrem o novo produto |
| `card` | — | **Preservar.** Base dos KPI cards da FASE 8 |
| `dialog`, `alert-dialog` | Radix | **Preservar.** Focus trap e `aria` vêm do Radix |
| `dropdown-menu`, `select` | Radix | **Preservar** |
| `input`, `label`, `checkbox` | Radix | **Preservar.** `checkbox` está sem consumidor desde que a tabela de ativos deixou de selecionar linhas |
| `table` | HTML semântico | **Preservar como primitive**, mas não cobre ordenação, seleção ou estado vazio — o consumidor implementa tudo |
| `pagination` | — | **Preservar.** Sem consumidor: a tabela de posições pagina com botões num `nav` próprio |
| `skeleton` | — | **Preservar.** Vira base do `LoadingState` (TASK 12.4) |
| `separator`, `tooltip` | Radix | **Preservar** |
| `sonner` | Sonner | **Preservar** |

**Ausentes e necessários:** `tabs`, `sheet` (nav mobile, TASK 13.2), `badge`, `chart`. Nenhuma biblioteca de gráficos está instalada — decisão pendente para a TASK 8.3.

## Layout components

| Componente | Avaliação |
| --- | --- |
| `components/sidebar.tsx` | **Refatorar.** Navegação hard-coded para `Overview`/`Assets`/`Account`, com o item ativo lido da rota por `usePathname`, também nas sub-rotas, como `Assets` no detalhe do ativo, e marcado com `aria-current="page"`; não suporta a árvore da TASK 13.1 nem tem equivalente mobile |
| `app/(protected)/layout.tsx` | **Preservar** como shell |
| `app/(public)/layout.tsx` | **Preservar** |
| `app/layout.tsx` | **Preservar** — fontes, tema, providers |

**Ausentes:** `PageHeader`, `SectionHeader` (TASK 12.3), navegação mobile (TASK 13.2).

## Feature components — `app/(protected)/(overview)/_components`

A Overview é a página principal, em `/`. O redirect permanente de `/` para `/assets` saiu de `next.config.js`; sign-in, sign-up e o acesso autenticado a uma rota pública levam a `/`. Navegador que guardou o 308 antigo segue indo para `/assets` até limpar o cache. A página lê a carteira principal e mostra o nome e a moeda base no cabeçalho, com estado de carregando, erro com nova tentativa e carteira ausente.

| Componente | Responsabilidade |
| --- | --- |
| `(overview)/page.tsx` | Cabeçalho e composição das seções: valor da carteira, performance, alocação ao lado das posições em telas largas, e transações recentes |
| `portfolio-value-card.tsx` | `PortfolioValueCard`, sobre `QuerySection`, com `GET /v1/portfolio/overview` numa lista de definição: valor total em destaque, variação do dia, valor investido e lucro ou prejuízo, com percentual, e o horário das cotações (`quotedAt`) em `<time>`. Vazio quando a carteira não tem posição com unidades: `totalValue` `0` sem `quotedAt`. Desatualizado quando a nova busca falha com valor em cache (`isRefetchError`): aviso `role="alert"` com nova tentativa acima dos últimos valores. Cotação de reserva do provedor aparece só pelo horário antigo |
| `allocation-chart.tsx` | `AllocationChart`, sobre `QuerySection`, com `GET /v1/portfolio/allocation`: seletor por classe (`byType`) ou por ativo (`byAsset`) em botões de rádio nativos no cabeçalho, anel em SVG decorativo (`aria-hidden`) e legenda em tabela, a alternativa textual, com cor, nome, percentual e valor na moeda base. Grupos na ordem da API; grupo sem `allocation` fica fora do anel e aparece como "Not available". Anel e legenda lado a lado quando o card tem ao menos 28rem (container query), empilhados abaixo disso. As cores vêm de uma paleta de 10 e se repetem a partir do 11º grupo (TD-025) |
| `positions-summary.tsx` | Posições em tabela, 10 por página, com a página anterior exibida enquanto a próxima carrega; o símbolo leva ao detalhe do ativo; sem posições, leva a `/assets?action=add-asset` |
| `recent-transactions.tsx` | As 5 transações mais recentes em `TransactionsTable`: a primeira página da listagem, que ordena por `executedAt` decrescente |

## Componentes de exibição compartilhados — `src/components`

| Componente | Responsabilidade |
| --- | --- |
| `amounts.tsx` | `Amount`, `SignedAmount` e `UnavailableValue`: valor ausente aparece como `-` e é lido como "Not available" |
| `load-error-alert.tsx` | `LoadErrorAlert`, o erro com nova tentativa (`role="alert"`), usado pelas seções e pelas páginas da Overview, da tela de ativos e do detalhe do ativo |
| `query-section.tsx` | `QuerySection` enquadra a seção num card com título `h2` e resolve, a partir da query, carregando (`aria-busy`), erro com nova tentativa, vazio e conteúdo; o dado em cache segue exibido se a nova busca falhar. O erro com nova tentativa é o `LoadErrorAlert` compartilhado |
| `performance-chart.tsx` | `PerformanceChart`, sobre `QuerySection`, com `GET /v1/portfolio/performance`, da carteira inteira na Overview e de uma posição, por `symbol`, no detalhe do ativo: seletor de período em botões de rádio nativos no cabeçalho, de `1W` a `MAX`, com o período anterior exibido enquanto o novo carrega; linha em SVG decorativo (`aria-hidden`), com área sob ela, e a série inteira em tabela dentro de um `<details>`, a alternativa textual, com dia, valor, investido, aporte líquido e retorno. O ponteiro move o marcador e a leitura de dia, valor e retorno, que se posiciona do lado oposto ao ponto para não sair do card; sem ponteiro, a leitura é a do último ponto. Nenhum valor é calculado no web: os números viram coordenadas apenas para desenhar, e todo valor exibido é formatado da string decimal da API. O dia da série é formatado em UTC, o fuso em que ele fecha. `1D` fica fora do seletor (TD-032) |
| `transactions-table.tsx` | `TransactionsTable` lista as transações recebidas, com a coluna de ativo opcional, omitida no detalhe do ativo. Data e hora no fuso do navegador, o mesmo em que o diálogo registra a execução. Cada linha tem um botão "Details", cujo nome acessível inclui tipo, ativo e data, que abre `TransactionDetailsDialog` |
| `transaction-details-dialog.tsx` | `TransactionDetailsDialog` mostra a transação inteira num diálogo, enquanto o web não tem tela de detalhe: tipo e ativo no título, data de execução na descrição, e quantidade, preço unitário, taxas, impostos, corretora e notas numa lista de definição. Corretora e notas ausentes aparecem como "Not available"; nenhum total é calculado no web |
| `detail-item.tsx` | `DetailItem`, termo e valor de uma lista de definição, usado pelo diálogo de transação e pelo detalhe do ativo |

## Feature components — `app/(protected)/assets/[symbol]`

O detalhe do ativo, em `/assets/[symbol]`, abre pelo símbolo nas posições da Overview e na tabela de posições. Nenhum valor é calculado no web.

| Componente | Responsabilidade |
| --- | --- |
| `[symbol]/page.tsx` | Página de servidor que repassa o símbolo da rota a `AssetDetail` |
| `asset-detail.tsx` | `AssetDetail` lê a carteira principal e `GET /v1/portfolio/positions/:symbol` por `usePosition`. Cabeçalho com retorno à tela de ativos, símbolo em `h1` e nome. Visão geral na moeda da cotação: preço, variação do dia, fechamento anterior, horário da cotação em `<time>`, classe, mercado, moeda e setor. Posição na moeda base: quantidade, preço médio, preço, valor, alocação e resultado com percentual. Em seguida, a performance da posição e as transações do ativo. Carregando, erro com nova tentativa para a carteira e para a posição, carteira ausente e ativo fora da carteira, com atalho para a tela de ativos; valor ausente aparece como "Not available". Visão geral e posição lado a lado em telas largas |
| `asset-transactions.tsx` | `AssetTransactions`, sobre `QuerySection`, lista as transações do ativo por `GET /v1/transactions` com `symbol`, 10 por página, em `TransactionsTable` sem a coluna de ativo, com a página anterior exibida enquanto a próxima carrega e navegação anterior e próxima com a página atual anunciada (`aria-live`) |

## Feature components — `app/(protected)/assets/_components`

| Componente | Linhas | Avaliação |
| --- | --- | --- |
| `positions-table.tsx` | 612 | Substituiu `assets-table.tsx`, que buscava só na página carregada. Lê `GET /v1/portfolio/positions` por `usePositions`, com busca, filtros, ordenação e paginação no servidor, sobre a carteira inteira: busca por símbolo ou nome enviada 300 ms depois da última tecla, filtros de classe e situação, ordenação por qualquer coluna em botões no cabeçalho com `aria-sort`, e 10, 25 ou 50 linhas por página, com a página anterior esmaecida enquanto a nova carrega. Colunas de ativo (símbolo, que leva ao detalhe do ativo, e nome), quantidade, preço médio, preço, valor, alocação, resultado e resultado percentual, na moeda base e sem cálculo no web. Carregando, erro com nova tentativa, vazio com atalho para adicionar ativo e sem resultado com atalho para limpar busca e filtros. Menu de ações por linha com nova transação e exclusão |
| `add-asset-dialog.tsx` | 193 | **Reaproveitar parcialmente.** O schema Zod e o padrão `FormProvider` migram para o Transaction Manager (TASK 9.3) |
| `add-asset-transaction-dialog.tsx` | 261 | **Reaproveitar parcialmente**, mesma razão |
| `delete-asset-dialog.tsx` | 61 | **Preservar como padrão** de confirmação destrutiva |
| `assets/page.tsx` | 196 | **Reescrita.** Cabeçalho com o nome e a moeda base da carteira e o botão de adicionar ativo; carregando, erro com nova tentativa e carteira ausente como na Overview. Orquestra os três diálogos, abertos também por `?action` e `symbol`, e ainda usa `window.history.pushState` direto (`replaceUrl`) em vez do router |

## Forms

Padrão consistente e adequado: `react-hook-form` + `zodResolver`, schema Zod co-localizado com o diálogo e exportado junto do componente. **Preservar o padrão.**

Lacunas: erro de servidor não é mapeado de volta para o campo; `aria-invalid`/`aria-describedby` não são aplicados (TASK 14.5).

## Data fetching

| Item | Avaliação |
| --- | --- |
| `lib/axios/axios.ts` | **Preservar.** Duas instâncias — `proxyApi` (browser, `/api`) e `serverApi` (server, `API_URL`) — resolvidas por `api.getInstance()`. Interceptor de 401 dispara sign-out e redireciona |
| `lib/axios/errors.ts` | **Preservar.** `ApiProxyError` normaliza o erro do backend, e `isNotFoundError` reconhece o 404 pelo `code` do corpo, que chega ao navegador pelo proxy |
| `lib/react-query.ts` | **Preservar**, revisar defaults (`retry: 2` em mutations é agressivo para operações financeiras) |
| `app/api/v1/*/types.ts` | **Preservar o padrão** de tipos co-localizados por rota |

**Hooks de domínio:** componente não conhece URL, Axios nem query key. `hooks/use-portfolio.ts` (carteira principal, visão geral, posições, posição por símbolo, alocação e performance; as posições mantêm a página anterior enquanto a pedida, com outra ordenação, busca ou filtro, carrega, e a posição por símbolo não repete a busca que respondeu 404), `hooks/use-assets.ts` (criação e remoção de ativo), `hooks/use-transactions.ts` (listagem, que mantém a página anterior enquanto a pedida carrega, e criação) e `hooks/use-user.ts` (perfil, sign-in, sign-up e sign-out) montam a query ou a mutation sobre os proxies de `app/api/v1`. Hook escopado por carteira recebe a carteira e não dispara a requisição sem ela (`skipToken`); mutation sem carteira falha com toast.

**Query keys e invalidação:** toda query key sai de `queryKeys`, em `lib/react-query.ts`, no formato `[raiz, ...escopo, recurso, parâmetros]`: `['user']` para o perfil, `['portfolios', página]` para a lista de carteiras e `['portfolio', portfolioId, recurso, parâmetros]` para o que pertence a uma carteira — `overview`, `positions`, `position`, `allocation`, `performance` e `transactions`. Os parâmetros são os da requisição, nunca um valor derivado, como o horário de atualização de outra query. Toda escrita bem-sucedida numa carteira, e o botão de atualizar da tela de ativos, invalidam `['portfolio', portfolioId]` por `useRefreshPortfolio`: as queries ativas do escopo buscam de novo, as inativas ficam obsoletas, e as desativadas por `skipToken` ficam de fora. Sign-in, sign-up e sign-out removem todo o cache, e um 401 de sessão recarrega a página em `/sign-in`; por isso as keys não levam o usuário (ver TD-023 sobre o `QueryClient` no servidor).

## State

| Item | Avaliação |
| --- | --- |
| `providers/app-provider.tsx` | **Preservar** — QueryClient, tema, toaster, progress bar, error boundary |
| `hooks/use-user.ts` | **Preservar.** Perfil do chamador por `GET /api/v1/user` e mutations de sign-in, sign-up e sign-out, que descartam o cache de queries da sessão anterior |
| `hooks/use-disclosure.ts` | **Preservar** — bom primitive de UI state |

**Fronteira servidor↔UI:** dado de servidor — carteira, visão geral, posições, alocação, performance, transações e perfil — vem só do React Query. `useState` guarda estado de interface: diálogo aberto, símbolo selecionado, o texto digitado na busca e a listagem pedida, com página, tamanho, ordenação e filtros. As tabelas exibem a paginação canônica da resposta e formatam os valores na moeda que a resposta informa.

## Utilities

| Item | Avaliação |
| --- | --- |
| `lib/utils.ts` → `cn()` | **Preservar** |
| `common/utils.ts` → `formatNumber`, `formatMoney`, `formatPrice`, `formatUnitAmount`, `formatQuantity`, `formatPercent`, `formatQuoteTime`, `formatExecutionTime`, `signedValueTone` | **Promover a primitive.** Formatadores centrais, compartilhados pela tela de ativos, pelo detalhe do ativo e pela Overview: preço e quantidade com as casas decimais do valor recebido, valor de uma unidade com ao menos 4 algarismos significativos, para que o preço abaixo de um centavo não vire zero, percentual com duas casas, dia e hora da cotação no fuso do navegador e a cor pelo sinal; viram base de `Money`/`Percentage` (TASK 12.2) |
| `common/utils.ts` → `truncateText`, `sanitizeInputValue` | **Preservar** |
| `common/utils.ts` → `replaceUrl` | **Remover.** `window.history.pushState` direto conflita com o router do Next (TASK 13.3) |
| `common/constants.ts` | **Preservar e expandir** — rotas, com a do detalhe do ativo por símbolo, cookies, moedas, fontes, rótulos e tons dos tipos de transação |
| `types/index.ts` | **Preservar** utilitários (`Maybe`, `WithId`, `Pagination`); **remover** `TailwindColors*`, acoplamento à paleta do Tailwind sem uso justificado |

## Duplicações relevantes

1. **Cálculo financeiro em três lugares** — `dominance`/`totalInvestedValue` no proxy (`api/v1/assets/route.ts`), preço médio em `asset-transaction-table-cell.tsx`, `investedValue` no backend. Uma única fonte de verdade na FASE 5. **Resolvido:** o componente de transação saiu junto com a listagem por símbolo, o proxy foi removido, e o web exibe os valores que o backend calcula, como a alocação e o resultado por posição de `GET /v1/portfolio/positions`.
2. **Bloco `try/catch` idêntico em todas as 9 rotas de proxy** — mesmas 4 linhas de leitura do cookie + mesmo `catch`. Candidato a um wrapper único.
3. **Bloco `catch` idêntico nos 16 controllers do backend** — resolvido por error handler global (TASK 1.6).
4. **Dois pacotes de ícones**: `react-icons` e `lucide-react`, ambos em uso nos mesmos arquivos (`add-asset-dialog.tsx`, `add-asset-transaction-dialog.tsx`, `sidebar.tsx`, `app-provider.tsx`). Consolidar em `lucide-react` (TASK 16.5/20.3).
5. **Schema Zod duplicado entre front e back** — `AddAssetSchema` (web) e `CreateAssetSchema` (backend) repetem as mesmas regras sem contrato compartilhado.

## Componentes excessivamente específicos

* `assets-table.tsx` — acoplado a `LimitPerPageOptions` e ao tipo `PageRequest` importados de `../page`, dependência circular de fato entre página e componente. **Resolvido:** a tabela de posições que o substituiu define as próprias opções e não importa nada da página.

## Candidatos a virar primitive

| Origem | Primitive de destino | Task |
| --- | --- | --- |
| `formatNumber` + `CURRENCIES` | `Money`, `Percentage` | 12.2 |
| cor pelo sinal em `signedValueTone` e `SignedAmount` de `components/amounts.tsx` | `ProfitLoss`, `Trend` | 12.1 / 12.2 |
| `Skeleton` em uso ad-hoc | `LoadingState` | 12.4 |
| `QuerySection` e `LoadErrorAlert` | `EmptyState`, `ErrorState`, `NoResultsState`, `StaleState` | 12.4 |
| cabeçalho repetido em `assets/page.tsx`, `account/page.tsx` e `(overview)/page.tsx` | `PageHeader`, `SectionHeader` | 12.3 |

## Resumo

**Preservar sem alteração relevante:** todos os primitives de `components/ui`, camada axios, providers de app, `use-disclosure`, padrão de formulários, padrão de tipos por rota.

**Refatorar:** `sidebar`, defaults do React Query, `common/utils`.

**Reescrever:** `assets-table` e `assets/page`, já reescritos; a tabela deu lugar a `positions-table`.

**Criar:** primitives financeiras, componentes de estado de dados, navegação mobile, camada de gráficos.
