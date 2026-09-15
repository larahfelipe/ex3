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
| `input`, `label`, `checkbox` | Radix | **Preservar** |
| `table` | HTML semântico | **Preservar como primitive**, mas não cobre ordenação, seleção ou estado vazio — o consumidor implementa tudo |
| `pagination` | — | **Preservar** |
| `skeleton` | — | **Preservar.** Vira base do `LoadingState` (TASK 12.4) |
| `separator`, `tooltip` | Radix | **Preservar** |
| `sonner` | Sonner | **Preservar** |

**Ausentes e necessários:** `tabs`, `sheet` (nav mobile, TASK 13.2), `badge`, `chart`. Nenhuma biblioteca de gráficos está instalada — decisão pendente para a TASK 8.3.

## Layout components

| Componente | Avaliação |
| --- | --- |
| `components/sidebar.tsx` | **Refatorar.** Navegação hard-coded para `Overview`/`Assets`/`Account`, com o item ativo lido da rota por `usePathname` e marcado com `aria-current="page"`; não suporta a árvore da TASK 13.1 nem tem equivalente mobile |
| `app/(protected)/layout.tsx` | **Preservar** como shell |
| `app/(public)/layout.tsx` | **Preservar** |
| `app/layout.tsx` | **Preservar** — fontes, tema, providers |

**Ausentes:** `PageHeader`, `SectionHeader` (TASK 12.3), navegação mobile (TASK 13.2).

## Feature components — `app/(protected)/(overview)/_components`

A Overview é a página principal, em `/`. O redirect permanente de `/` para `/assets` saiu de `next.config.js`; sign-in, sign-up e o acesso autenticado a uma rota pública levam a `/`. Navegador que guardou o 308 antigo segue indo para `/assets` até limpar o cache. A página lê a carteira principal e mostra o nome e a moeda base no cabeçalho, com estado de carregando, erro com nova tentativa e carteira ausente. O gráfico de performance fica fora até existir a série histórica de valor da carteira.

| Componente | Responsabilidade |
| --- | --- |
| `(overview)/page.tsx` | Cabeçalho e composição das seções: resumo, alocação ao lado das posições em telas largas, e transações recentes |
| `overview-section.tsx` | `OverviewSection` enquadra a seção num card com título `h2` e resolve, a partir da query, carregando (`aria-busy`), erro com nova tentativa, vazio e conteúdo; o dado em cache segue exibido se a nova busca falhar. `LoadErrorAlert` é o erro com nova tentativa (`role="alert"`), usado também pelo resumo e pela página |
| `portfolio-summary.tsx` | KPIs de `GET /v1/portfolio/overview` numa lista de definição: valor total, valor investido, lucro ou prejuízo e variação do dia, com percentual |
| `allocation-summary.tsx` | Alocação por classe de instrumento: percentual, valor na moeda base e barra decorativa (`aria-hidden`) |
| `positions-summary.tsx` | Posições em tabela, 10 por página, com a página anterior exibida enquanto a próxima carrega; sem posições, leva a `/assets?action=add-asset` |
| `recent-transactions.tsx` | As 5 transações mais recentes: a primeira página da listagem, que ordena por `executedAt` decrescente. Data e hora no fuso do navegador, o mesmo em que o diálogo registra a execução |
| `amounts.tsx` | `Amount`, `SignedAmount` e `UnavailableValue`: valor ausente aparece como `-` e é lido como "Not available" |

## Feature components — `app/(protected)/assets/_components`

| Componente | Linhas | Avaliação |
| --- | --- | --- |
| `assets-table.tsx` | 497 | **Reescrever** na TASK 9.1. Acumula tabela, busca, ordenação, paginação, seleção de linha e menu de ações em um arquivo. Busca é client-side sobre a página corrente, inconsistente com a paginação server-side |
| `add-asset-dialog.tsx` | 193 | **Reaproveitar parcialmente.** O schema Zod e o padrão `FormProvider` migram para o Transaction Manager (TASK 9.3) |
| `add-asset-transaction-dialog.tsx` | 261 | **Reaproveitar parcialmente**, mesma razão |
| `delete-asset-dialog.tsx` | 61 | **Preservar como padrão** de confirmação destrutiva |
| `assets/page.tsx` | 255 | **Reescrever.** Orquestra quatro diálogos por uma união de strings, mantém paginação em `useState` e usa `window.history.pushState` direto (`replaceUrl`) em vez do router |

## Forms

Padrão consistente e adequado: `react-hook-form` + `zodResolver`, schema Zod co-localizado com o diálogo e exportado junto do componente. **Preservar o padrão.**

Lacunas: erro de servidor não é mapeado de volta para o campo; `aria-invalid`/`aria-describedby` não são aplicados (TASK 14.5).

## Data fetching

| Item | Avaliação |
| --- | --- |
| `lib/axios/axios.ts` | **Preservar.** Duas instâncias — `proxyApi` (browser, `/api`) e `serverApi` (server, `API_URL`) — resolvidas por `api.getInstance()`. Interceptor de 401 dispara sign-out e redireciona |
| `lib/axios/errors.ts` | **Preservar.** `ApiProxyError` normaliza o erro do backend |
| `lib/react-query.ts` | **Preservar**, revisar defaults (`retry: 2` em mutations é agressivo para operações financeiras) |
| `app/api/v1/*/types.ts` | **Preservar o padrão** de tipos co-localizados por rota |

**Hooks de domínio:** componente não conhece URL, Axios nem query key. `hooks/use-portfolio.ts` (carteira principal, visão geral, posições e alocação; as posições mantêm a página anterior enquanto a pedida carrega), `hooks/use-assets.ts` (ativos com a contagem de transações, cotações, criação e remoção), `hooks/use-transactions.ts` (listagem e criação) e `hooks/use-user.ts` (perfil, sign-in, sign-up e sign-out) montam a query ou a mutation sobre os proxies de `app/api/v1`. Hook escopado por carteira recebe a carteira e não dispara a requisição sem ela (`skipToken`); mutation sem carteira falha com toast.

**Query keys e invalidação:** toda query key sai de `queryKeys`, em `lib/react-query.ts`, no formato `[raiz, ...escopo, recurso, parâmetros]`: `['user']` para o perfil, `['portfolios', página]` para a lista de carteiras e `['portfolio', portfolioId, recurso, parâmetros]` para o que pertence a uma carteira — `overview`, `positions`, `allocation`, `assets`, `asset-valuations` e `transactions`. Os parâmetros são os da requisição, nunca um valor derivado, como o horário de atualização de outra query. Toda escrita bem-sucedida numa carteira, e o botão de atualizar da tela de ativos, invalidam `['portfolio', portfolioId]` por `useRefreshPortfolio`: as queries ativas do escopo buscam de novo, as inativas ficam obsoletas, e as desativadas por `skipToken` ficam de fora. Sign-in, sign-up e sign-out removem todo o cache, e um 401 de sessão recarrega a página em `/sign-in`; por isso as keys não levam o usuário (ver TD-023 sobre o `QueryClient` no servidor).

## State

| Item | Avaliação |
| --- | --- |
| `providers/app-provider.tsx` | **Preservar** — QueryClient, tema, toaster, progress bar, error boundary |
| `hooks/use-user.ts` | **Preservar.** Perfil do chamador por `GET /api/v1/user` e mutations de sign-in, sign-up e sign-out, que descartam o cache de queries da sessão anterior |
| `hooks/use-disclosure.ts` | **Preservar** — bom primitive de UI state |

**Fronteira servidor↔UI:** dado de servidor — carteira, visão geral, posições, alocação, ativos com a contagem de transações, transações, cotações e perfil — vem só do React Query. `useState` guarda estado de interface: diálogo aberto, busca, modo de seleção, símbolo selecionado e a página e o limite pedidos. As tabelas exibem a paginação canônica da resposta e formatam os valores na moeda que a resposta informa; a tabela de ativos lê a contagem de transações da própria linha, sem requisição por ativo.

## Utilities

| Item | Avaliação |
| --- | --- |
| `lib/utils.ts` → `cn()` | **Preservar** |
| `common/utils.ts` → `formatNumber`, `formatMoney`, `formatPrice`, `formatQuantity`, `formatPercent`, `signedValueTone` | **Promover a primitive.** Formatadores centrais, compartilhados pela tela de ativos e pela Overview: preço e quantidade com as casas decimais do valor recebido, percentual com duas casas e a cor pelo sinal; viram base de `Money`/`Percentage` (TASK 12.2) |
| `common/utils.ts` → `truncateText`, `sanitizeInputValue` | **Preservar** |
| `common/utils.ts` → `replaceUrl` | **Remover.** `window.history.pushState` direto conflita com o router do Next (TASK 13.3) |
| `common/constants.ts` | **Preservar e expandir** — rotas, cookies, moedas, fontes |
| `types/index.ts` | **Preservar** utilitários (`Maybe`, `WithId`, `Pagination`); **remover** `TailwindColors*`, acoplamento à paleta do Tailwind sem uso justificado |

## Duplicações relevantes

1. **Cálculo financeiro em três lugares** — `dominance`/`totalInvestedValue` no proxy (`api/v1/assets/route.ts`), preço médio em `asset-transaction-table-cell.tsx`, `investedValue` no backend. Uma única fonte de verdade na FASE 5.
2. **Bloco `try/catch` idêntico em todas as 9 rotas de proxy** — mesmas 4 linhas de leitura do cookie + mesmo `catch`. Candidato a um wrapper único.
3. **Bloco `catch` idêntico nos 16 controllers do backend** — resolvido por error handler global (TASK 1.6).
4. **Dois pacotes de ícones**: `react-icons` e `lucide-react`, ambos em uso no mesmo arquivo (`assets-table.tsx`). Consolidar em `lucide-react` (TASK 16.5/20.3).
5. **Schema Zod duplicado entre front e back** — `AddAssetSchema` (web) e `CreateAssetSchema` (backend) repetem as mesmas regras sem contrato compartilhado.

## Componentes excessivamente específicos

* `assets-table.tsx` — acoplado a `LimitPerPageOptions` e ao tipo `PageRequest` importados de `../page`, dependência circular de fato entre página e componente.

## Candidatos a virar primitive

| Origem | Primitive de destino | Task |
| --- | --- | --- |
| `formatNumber` + `CURRENCIES` | `Money`, `Percentage` | 12.2 |
| cor pelo sinal em `signedValueTone` e `SignedAmount` da Overview | `ProfitLoss`, `Trend` | 12.1 / 12.2 |
| `Skeleton` em uso ad-hoc | `LoadingState` | 12.4 |
| `OverviewSection` e `LoadErrorAlert`, locais à Overview | `EmptyState`, `ErrorState`, `NoResultsState`, `StaleState` | 12.4 |
| cabeçalho repetido em `assets/page.tsx`, `account/page.tsx` e `(overview)/page.tsx` | `PageHeader`, `SectionHeader` | 12.3 |

## Resumo

**Preservar sem alteração relevante:** todos os primitives de `components/ui`, camada axios, providers de app, `use-disclosure`, padrão de formulários, padrão de tipos por rota.

**Refatorar:** `sidebar`, defaults do React Query, `common/utils`.

**Reescrever:** `assets-table` e `assets/page`.

**Criar:** primitives financeiras, componentes de estado de dados, navegação mobile, camada de gráficos.
