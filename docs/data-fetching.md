# Auditoria de requests do web — TASK 16.1

Todo request do browser nasce de um hook de `web/src/hooks` sobre o TanStack Query, atravessa o proxy Next em `web/src/app/api/v1` e chega ao backend. Este documento inventaria cada um, diz o que o dispara e justifica, request a request, por que ele existe. Regra de leitura: **nenhuma tela dispara um request que não esteja nesta tabela.**

| Item | Valor |
| --- | --- |
| Commit da auditoria | `6e955aa` |
| Data | 2026-09-19 |
| Escopo | `web/src/hooks`, `web/src/lib/react-query.ts`, `web/src/lib/axios`, consumidores em `web/src/app/(protected)` |

## Defaults do cliente

Em `web/src/lib/react-query.ts`, valendo para toda query:

| Opção | Valor | Razão |
| --- | --- | --- |
| `staleTime` | 60 s | `YahooFinanceProvider` serve a mesma cotação por `QUOTE_TIME_TO_LIVE_MS` (60 s). Repetir o request dentro da janela devolve os mesmos números e gasta cota do plano à toa. Escrita não depende disso: toda mutação invalida o escopo da carteira |
| `refetchOnWindowFocus` | `false` | Alternar de aba não é sinal de que o mercado mudou; a janela de 60 s já cobre a volta |
| `refetchOnReconnect` | default (`true`) | Reconectar é sinal de que o cliente ficou fora do ar por tempo indeterminado; o `staleTime` ainda filtra o que está fresco |
| `retry` | até 2, exceto requisição rejeitada | Erro 4xx é rejeição da própria requisição: repetir dá o mesmo resultado, atrasa o estado de erro e, no caso de 401, corre com o sign-out do interceptor |
| `gcTime` | default (5 min) | Navegar entre as três telas e voltar não refaz o que continua em cache |

Para o `retry` distinguir 4xx de 5xx, o interceptor de `web/src/lib/axios/axios.ts` passou a copiar `status` e `statusText` da resposta para o `ApiProxyError`; antes o corpo `{ message, _error }` chegava sem status e todo erro virava 500 no cliente.

## Inventário de queries

| Hook | Endpoint | Chave | Disparo | Justificativa |
| --- | --- | --- | --- | --- |
| `usePrimaryPortfolio` | `GET /v1/portfolios?page=1&limit=1` | `['portfolios', {page,limit}]` | Toda tela protegida | O cliente não conhece o id da carteira: não está na URL nem no cookie de sessão. Uma única entrada de cache serve as três telas |
| `useCurrentUser` | `GET /v1/user` | `['user']` | `sidebar.tsx` e `/account` | Nome e e-mail do cabeçalho de navegação; os dois consumidores compartilham a mesma chave, então é um request, não dois |
| `usePortfolioOverview` | `GET /v1/portfolio/overview` | `[...portfolio, 'overview']` | `PortfolioValueCard` | Totais agregados que a listagem de posições não traz |
| `useAllocation` | `GET /v1/portfolio/allocation` | `[...portfolio, 'allocation']` | `AllocationChart` | Agrupamento por classe e por ativo, com percentuais calculados no servidor |
| `usePositions` | `GET /v1/portfolio/positions` | `[...portfolio, 'positions', listing]` | Resumo da Overview e tabela de `/assets` | Dois recortes distintos — 10 linhas sem filtro contra a listagem filtrada, ordenada e paginada —, logo duas chaves e dois requests |
| `usePosition` | `GET /v1/portfolio/positions/:symbol` | `[...portfolio, 'position', symbol]` | Detalhe do ativo | Uma posição com o desdobramento que a listagem não carrega |
| `usePerformance` | `GET /v1/portfolio/performance` | `[...portfolio, 'performance', params]` | Gráfico da Overview e do detalhe | Série temporal por período; trocar de período é outra chave, buscada uma vez e servida do cache nas trocas seguintes |
| `useTransactions` | `GET /v1/transactions` | `[...portfolio, 'transactions', filters]` | Overview (5 últimas) e detalhe do ativo (paginado por símbolo) | Recortes distintos da mesma listagem; nenhum deriva do outro |

Toda query com escopo de carteira usa `skipToken` enquanto a carteira não chegou: nenhuma delas dispara com `portfolioId` indefinido.

`usePositions`, `usePerformance` e `useTransactions` usam `placeholderData: keepPreviousData`: paginar, ordenar ou trocar o período mantém a página anterior visível e continua sendo **um** request por mudança de parâmetro, não dois.

## Waterfall

Existe um nível, e só um: `GET /v1/portfolios` precisa resolver antes das demais queries da tela.

```text
/v1/portfolios
└─ em paralelo: overview · allocation · performance · positions · transactions
```

Na Overview isso são 1 + 5 requests, sendo os cinco simultâneos. O nível extra é inerente ao contrato atual — o id da carteira não existe no cliente antes da listagem — e custa um round trip apenas na primeira tela da sessão, porque as 60 s de `staleTime` cobrem as navegações seguintes. Eliminá-lo depende de a API entregar a carteira primária junto da sessão, registrado em TD-055.

Nenhuma tela encadeia um segundo nível: `usePosition`, `usePerformance` e `useTransactions` do detalhe do ativo partem todas da mesma carteira e correm juntas.

## O que a auditoria procurou e não encontrou

| Suspeita | Resultado |
| --- | --- |
| Duplicidade | Nenhuma. Chamadas repetidas do mesmo hook — `usePrimaryPortfolio` em três telas, `useCurrentUser` em duas — compartilham chave e são atendidas por uma requisição só |
| N+1 no proxy | Nenhum. Cada Route Handler de `app/api/v1` faz exatamente uma chamada ao backend |
| N+1 no backend | Nenhum. `GetPortfolioPositionsService`, `GetPortfolioOverviewService`, `GetPortfolioAllocationService` e `GetPortfolioPositionService` buscam cotações e câmbio em lote, num `Promise.all` por request |
| Refetch excessivo | Era o achado real: sem `staleTime`, cada montagem refazia tudo — voltar de `/assets` para a Overview custava cinco requests que nada mudariam. Resolvido pelo default de 60 s |
| Retry desnecessário | Era achado real: um 404 de ativo inexistente virava três requisições. Resolvido pelo `retry` que não repete requisição rejeitada |

## Invalidação

`useRefreshPortfolio` invalida o prefixo `['portfolio', portfolioId]`, o que alcança overview, alocação, performance, posições, posição e transações numa chamada. É o que roda depois de criar ativo, criar, editar e excluir transação, e excluir ativo — toda escrita do produto.

Duas escolhas deliberadas:

* **Não invalidar `['portfolios']` nem `['user']`.** Nenhuma escrita do produto altera a lista de carteiras ou o usuário.
* **`queryClient.removeQueries()` sem filtro no sign-in, sign-up e sign-out.** Descartar o cache inteiro na troca de sessão é requisito de segurança, não de performance: nenhum dado de uma conta pode sobreviver para a próxima.

## Limite conhecido

A medição foi estática: leitura do código de queries, proxies e serviços. Não há waterfall observado em navegador nem número de requests contado em runtime, pelo mesmo motivo registrado em `accessibility.md` — o ambiente da implementação não tem navegador nem permissão de rede. A verificação em runtime entra no harness de TD-054.
