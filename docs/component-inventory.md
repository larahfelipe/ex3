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
| `components/sidebar.tsx` | **Refatorar.** Navegação hard-coded para `Assets`/`Account`; não suporta a árvore da TASK 13.1 nem tem equivalente mobile |
| `app/(protected)/layout.tsx` | **Preservar** como shell |
| `app/(public)/layout.tsx` | **Preservar** |
| `app/layout.tsx` | **Preservar** — fontes, tema, providers |

**Ausentes:** `PageHeader`, `SectionHeader` (TASK 12.3), navegação mobile (TASK 13.2).

## Feature components — `app/(protected)/assets/_components`

| Componente | Linhas | Avaliação |
| --- | --- | --- |
| `assets-table.tsx` | 497 | **Reescrever** na TASK 9.1. Acumula tabela, busca, ordenação, paginação, seletor de moeda, seleção de linha e menu de ações em um arquivo. Busca é client-side sobre a página corrente, inconsistente com a paginação server-side |
| `asset-transaction-table-cell.tsx` | 97 | **Remover.** Origem do N+1 (TASK 7.4) e contém regra financeira — calcula preço médio no componente visual (viola a diretriz 4) |
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

**Problema estrutural:** não existe camada de hooks de domínio. Cada componente monta a própria `useQuery` com URL literal e query key ad-hoc (`['assets', page, limit]`, `['transactions', symbol]`). É exatamente a lacuna das TASKS 7.2 e 7.3.

## State

| Item | Avaliação |
| --- | --- |
| `providers/app-provider.tsx` | **Preservar** — QueryClient, tema, toaster, progress bar, error boundary |
| `providers/user-provider.tsx` (166 l.) | **Refatorar.** Mistura sessão, mutations de auth e preferência de moeda; mantém `isLoading`/`user` em `useState` em vez de derivar do React Query |
| `hooks/use-user.ts` | **Preservar** |
| `hooks/use-disclosure.ts` | **Preservar** — bom primitive de UI state |

**Duplicação de estado servidor↔UI:** `assets/page.tsx` mantém `pagination` em `useState` e a repassa como parâmetro de query; a resposta traz a paginação canônica, que é ignorada. Alvo da TASK 7.1.

## Utilities

| Item | Avaliação |
| --- | --- |
| `lib/utils.ts` → `cn()` | **Preservar** |
| `common/utils.ts` → `formatNumber` | **Promover a primitive.** Único formatador central; vira base de `Money`/`Percentage` (TASK 12.2) |
| `common/utils.ts` → `truncateText`, `sanitizeInputValue` | **Preservar** |
| `common/utils.ts` → `replaceUrl` | **Remover.** `window.history.pushState` direto conflita com o router do Next (TASK 13.3) |
| `common/constants.ts` | **Preservar e expandir** — rotas, cookies, moedas, fontes |
| `types/index.ts` | **Preservar** utilitários (`Maybe`, `WithId`, `Pagination`); **remover** `TailwindColors*`, acoplamento à paleta do Tailwind sem uso justificado |

## Duplicações relevantes

1. **Cálculo financeiro em três lugares** — `dominance`/`totalBalance` no proxy (`api/v1/assets/route.ts`), preço médio em `asset-transaction-table-cell.tsx`, `balance` no backend. Uma única fonte de verdade na FASE 5.
2. **Bloco `try/catch` idêntico em todas as 9 rotas de proxy** — mesmas 4 linhas de leitura do cookie + mesmo `catch`. Candidato a um wrapper único.
3. **Bloco `catch` idêntico nos 16 controllers do backend** — resolvido por error handler global (TASK 1.6).
4. **Dois pacotes de ícones**: `react-icons` e `lucide-react`, ambos em uso no mesmo arquivo (`assets-table.tsx`). Consolidar em `lucide-react` (TASK 16.5/20.3).
5. **Schema Zod duplicado entre front e back** — `AddAssetSchema` (web) e `CreateAssetSchema` (backend) repetem as mesmas regras sem contrato compartilhado.

## Componentes excessivamente específicos

* `asset-transaction-table-cell.tsx` — uma célula de tabela que busca dados e faz contas.
* `assets-table.tsx` — acoplado a `LimitPerPageOptions`/`PaginationInitialState` importados de `../page`, dependência circular de fato entre página e componente.

## Candidatos a virar primitive

| Origem | Primitive de destino | Task |
| --- | --- | --- |
| `formatNumber` + `CURRENCIES` | `Money`, `Percentage` | 12.2 |
| formatação `text-green-600`/`text-red-600` espalhada | `ProfitLoss`, `Trend` | 12.1 / 12.2 |
| `Skeleton` em uso ad-hoc | `LoadingState` | 12.4 |
| ausente | `EmptyState`, `ErrorState`, `NoResultsState`, `StaleState` | 12.4 |
| cabeçalho repetido em `assets/page.tsx` e `account/page.tsx` | `PageHeader`, `SectionHeader` | 12.3 |

## Resumo

**Preservar sem alteração relevante:** todos os primitives de `components/ui`, camada axios, providers de app, `use-disclosure`, padrão de formulários, padrão de tipos por rota.

**Refatorar:** `sidebar`, `user-provider`, defaults do React Query, `common/utils`.

**Reescrever:** `assets-table`, `assets/page`, e remover `asset-transaction-table-cell`.

**Criar:** hooks de domínio, primitives financeiras, componentes de estado de dados, navegação mobile, camada de gráficos.
