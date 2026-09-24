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
| `retry` | até 2, exceto requisição rejeitada | Erro 4xx é rejeição da própria requisição: repetir dá o mesmo resultado, atrasa o estado de erro e, no caso de 401, corre com a expiração do interceptor |
| `gcTime` | default (5 min) | Navegar entre as três telas e voltar não refaz o que continua em cache |

Para o `retry` distinguir 4xx de 5xx, o interceptor de `web/src/lib/axios/axios.ts` passou a copiar `status` e `statusText` da resposta para o `ApiProxyError`; antes o corpo `{ message, _error }` chegava sem status e todo erro virava 500 no cliente.

## Inventário de queries

| Hook | Endpoint | Chave | Disparo | Justificativa |
| --- | --- | --- | --- | --- |
| `useActivePortfolio` | `GET /v1/portfolio?portfolioId=` com carteira escolhida; senão `GET /v1/portfolios?page=1&limit=1` | `['portfolios', 'details', id]` ou `['portfolios', 'page', {page,limit}]` | Toda tela protegida | O id da carteira escolhida vem do `localStorage` (`useSyncExternalStore`, com `undefined` no servidor para nada ser pedido antes da leitura); sem escolha, a mais antiga. Uma única entrada de cache serve as telas |
| `usePortfolios` | `GET /v1/portfolios` | `['portfolios', 'page', {page,limit}]` | `/portfolios` | Lista paginada da tela de carteiras |
| `useInstrumentSearch` | `GET /v1/instruments/search` | `['instruments', 'search', query]` | `AddAssetDialog`, depois de o usuário digitar | Campo vazio não pede nada (`skipToken`). Debounce de 500 ms, que Enter antecipa: a pausa é a de quem parou de digitar, então um termo custa cerca de uma das 30 buscas por minuto que a API concede; cada termo é uma chave, e o resultado anterior fica visível enquanto o próximo carrega |
| `useCurrentUser` | `GET /v1/user` | `['user']` | `sidebar.tsx` e `/account` | Nome e e-mail do cabeçalho de navegação; os dois consumidores compartilham a mesma chave, então é um request, não dois. Salvar o perfil grava a resposta do `PATCH` na chave, sem novo `GET` |
| `usePortfolioOverview` | `GET /v1/portfolio/overview` | `[...portfolio, 'overview']` | `PortfolioValueCard`, `PortfolioTotalValue` | Totais agregados que a listagem de posições não traz. Na tela de carteiras, uma consulta por linha, na mesma chave da Overview: a escrita de ativo ou transação invalida o escopo da carteira e atualiza as duas |
| `useAllocation` | `GET /v1/portfolio/allocation` | `[...portfolio, 'allocation']` | `AllocationChart` | Agrupamento por ativo e por classe, com percentuais calculados no servidor; o web ordena pelo percentual |
| `usePositions` | `GET /v1/portfolio/positions` | `[...portfolio, 'positions', listing]` | Resumo da Overview e tabela de `/assets` | Dois recortes distintos — 10 linhas sem filtro contra a listagem filtrada, ordenada e paginada —, logo duas chaves e dois requests |
| `usePosition` | `GET /v1/portfolio/positions/:symbol` | `[...portfolio, 'position', symbol]` | Detalhe do ativo | Uma posição com o desdobramento que a listagem não carrega |
| `usePerformance` | `GET /v1/portfolio/performance` | `[...portfolio, 'performance', params]` | Gráfico da Overview e do detalhe | Série temporal por período; trocar de período é outra chave, buscada uma vez e servida do cache nas trocas seguintes |
| `useTransactions` | `GET /v1/transactions` | `[...portfolio, 'transactions', filters]` | Overview (5 últimas) e detalhe do ativo (paginado por símbolo) | Recortes distintos da mesma listagem; nenhum deriva do outro |

Toda query com escopo de carteira usa `skipToken` enquanto a carteira não chegou: nenhuma delas dispara com `portfolioId` indefinido.

`usePositions`, `usePerformance` e `useTransactions` mantêm a página anterior visível enquanto a pedida carrega: paginar, ordenar ou trocar o período continua sendo **um** request por mudança de parâmetro, não dois. O placeholder só vale dentro da mesma carteira (`partialMatchKey` contra `['portfolio', id]`), então trocar a carteira ativa mostra o carregamento, nunca os números da anterior.

Criar, editar ou excluir carteira invalida `['portfolios']`; a edição invalida também o escopo da carteira, porque a moeda base muda os valores, e a exclusão remove o escopo do cache e descarta a escolha que apontava para ela.

Criar ativo com `listing` — registro de instrumento privado a partir da listagem do provedor — invalida `['instruments']` (`queryKeys.visibleInstruments()`), o prefixo que cobre toda busca de `useInstrumentSearch`: o instrumento registrado passa a vir entre os que o usuário vê, com o selo *Private*, e não mais como listagem nova. Criar ativo sem `listing` não invalida nada em `['instruments']`, porque nenhum instrumento foi escrito.

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
| Duplicidade | Nenhuma. Chamadas repetidas do mesmo hook — `useActivePortfolio` em quatro telas, `useCurrentUser` em duas — compartilham chave e são atendidas por uma requisição só |
| N+1 no proxy | Nenhum. Cada Route Handler de `app/api/v1` faz exatamente uma chamada ao backend |
| N+1 no backend | Nenhum. `GetPortfolioPositionsService`, `GetPortfolioOverviewService`, `GetPortfolioAllocationService` e `GetPortfolioPositionService` buscam cotações e câmbio em lote, num `Promise.all` por request. O histórico por instrumento da performance tinha uma leitura a mais, corrigida na [auditoria de 2026-09-24](#auditoria-de-requests-e-integrações--2026-09-24) |
| Refetch excessivo | Era o achado real: sem `staleTime`, cada montagem refazia tudo — voltar de `/assets` para a Overview custava cinco requests que nada mudariam. Resolvido pelo default de 60 s |
| Retry desnecessário | Era achado real: um 404 de ativo inexistente virava três requisições. Resolvido pelo `retry` que não repete requisição rejeitada |

## Invalidação

`useRefreshPortfolio` invalida o prefixo `['portfolio', portfolioId]`, o que alcança overview, alocação, performance, posições, posição e transações numa chamada. É o que roda depois de criar ativo, criar, editar e excluir transação, e excluir ativo — toda escrita do produto —, sem ser esperado: a mutation resolve com a resposta da API, o diálogo que a disparou fecha, e a revalidação corre atrás, com os dados em cache à vista até ela chegar.

Duas escolhas deliberadas:

* **As escritas de ativo e transação não invalidam `['portfolios']` nem `['user']`**, que nenhuma delas altera. Carteiras têm a invalidação própria, descrita no inventário. O perfil não revalida `['user']` no sucesso: a resposta do `PATCH` já traz o usuário salvo e é gravada na chave.
* **`queryClient.clear()` ao montar o layout público.** Descartar o cache inteiro na troca de sessão é requisito de segurança, não de performance: nenhum dado de uma conta pode sobreviver para a próxima. É feito ao montar, não no sign-out, porque remover queries ainda observadas as refaz sem sessão.

## Auditoria de requests e integrações — 2026-09-24

### Atualização otimista

Só onde a recusa do servidor é rara e desfazer não custa nada ao usuário. Onde o servidor decide algo que a interface não sabe prever, a tela espera a resposta.

| Escrita | Otimista | Motivo |
| --- | --- | --- |
| Nome do perfil | Sim | O formulário valida pela mesma regra da API, então a recusa é rara, e renomear de novo desfaz. O nome muda na navegação e no formulário ao enviar; a falha restaura o nome anterior e revalida `['user']`, porque um timeout pode ter gravado o novo; o erro aparece no formulário |
| Senha | Não | Trocar a senha encerra a sessão no servidor (`sessionVersion`); não há estado da interface a antecipar |
| Criar, editar e excluir transação | Não | O ledger é validado no servidor — venda acima das unidades mantidas na data, moeda única por posição, posição dentro da faixa suportada — e cada escrita recalcula posição, custo médio e performance no servidor. Antecipar exibiria números que a API pode recusar ou calcular diferente |
| Criar ativo | Não | O servidor resolve o instrumento, e o privado a partir da listagem do provedor; a linha depende de cotação que o cliente não tem |
| Excluir ativo ou carteira | Não | Irreversível e em cascata. O `ConfirmDeletionDialog` fica aberto até a resposta e mostra a falha no lugar (TD-064); o foco devolvido depende da lista já revalidada |
| Criar e editar carteira | Não | Trocar a moeda base reprecifica todos os valores no servidor; o diálogo mostra a recusa no lugar |

### Estratégias de carregamento

| Estratégia | Situação |
| --- | --- |
| Skeleton e estado por seção | Já existiam: cada seção tem o próprio carregamento, erro e vazio (`QuerySection`) |
| Página anterior visível | Já existia: paginar, ordenar e trocar o período mantêm os dados à vista até o próximo chegar |
| Código fora do bundle da rota | Feito: `sideEffects` no `package.json` tirou o calendário e a UI não usada das rotas públicas e da conta (ver `performance.md`) |
| Diálogos sob demanda | Não feito: o custo sairia do carregamento e iria para o primeiro clique da ação principal da tela (ver `performance.md`) |
| Prefetch da próxima página | Não feito: com a página anterior visível, paginar já não bloqueia, e cada prefetch é um request contra o limite de 120 por minuto |
| Prefetch do detalhe no hover | Não feito: o detalhe pede performance e indicadores, que podem buscar histórico no provedor. Seria gastar cota do plano sem clique |
| Waterfall carteira → escopo | Mantido (TD-055) |

### Refresh do valor da carteira

O botão invalida o escopo da carteira com `cancelRefetch: false`: um clique durante a revalidação junta-se a ela em vez de reiniciá-la, e o botão fica `aria-disabled` até ela terminar. No backend, a cotação vale 60 s (`QUOTE_TIME_TO_LIVE_MS`), então repetir o refresh dentro do minuto refaz a leitura do banco, mas não chama o provedor.

### Backend e provedor

| Achado | Correção |
| --- | --- |
| A borda de uma série sem fechamento era pedida ao provedor a cada leitura: fim de semana e feriado depois do último fechamento, dias antes da listagem ou antes do primeiro pregão da janela, símbolo que o provedor responde 404. `missingRangesOf` volta a pedir essas janelas, porque nada é gravado para elas | O adaptador responde vazio de novo, sem requisição, a janela que o provedor respondeu sem preço ou com 404, por uma hora (`EMPTY_HISTORY_TIME_TO_LIVE_MS`) e até 10.000 janelas. Janela com preço e falha não ficam guardadas: a primeira muda o que falta, a segunda já pausa o provedor por 30 s |
| Consultas idênticas de histórico simultâneas faziam uma requisição cada — o detalhe do ativo pede performance e indicadores juntos, e os dois terminam na mesma janela até hoje | Uma consulta já em curso para o mesmo símbolo, intervalo e janela é aproveitada, como na cotação |
| `GetPriceHistoryService` lia o instrumento antes do histórico gravado, uma consulta sequencial a mais por instrumento em toda leitura de performance e indicadores | O instrumento só é lido quando falta algo a pedir ao provedor; a série em dia custa uma consulta |

Tudo fica na memória do processo, como o cache de cotações. Cada instância tem o próprio cache, e ele se perde num cold start.

### Índices

Os existentes cobrem as leituras: fechamentos e câmbio por `(instrumentId, timestamp, …)` e `(currency, baseCurrency, timestamp, …)` em faixa de datas, posições por `(portfolioId, instrumentId)`, transações por `(portfolioId, instrumentId)`. O ledger da carteira e a listagem de transações filtram por `portfolioId` e ordenam por `executedAt` depois de filtrar; com o volume de uma carteira pessoal, essa ordenação é pequena. Um índice `(portfolioId, executedAt)` passa a valer quando o `EXPLAIN` de `GET /v1/transactions` ou da performance mostrar essa ordenação no p95 medido.

### Redis: critérios de adoção

Não adotado. Tudo o que um cache compartilhado resolveria hoje se resolve na memória do processo, porque o custo que ele evita — chamada ao provedor, contagem de rate limit — é por instância e ainda não foi medido. Passa a se justificar quando houver ao menos um destes, medido:

* **Rate limit entre instâncias (TD-006).** Com mais de uma instância servindo tráfego, o limite efetivo é o budget vezes o número de instâncias. Se isso deixar de ser aceitável, os contadores precisam de um store compartilhado.
* **Cota do provedor.** Se o consumo medido do plano (TD-020) mostrar a mesma cotação ou janela de histórico pedida por várias instâncias, ou de novo depois de cada cold start, a ponto de ameaçar a cota.
* **Revogação de sessão sem banco.** Hoje `sessionVersion` é lido do Postgres a cada request autenticado. Só se essa leitura aparecer no p95 medido.

Antes de Redis, a ordem é: ajustar os TTLs com o consumo medido; fixar o número de instâncias; guardar no Postgres o que precisa sobreviver a um restart, como as janelas vazias, numa tabela de cobertura.

## Limite conhecido

A medição foi estática: leitura do código de queries, proxies e serviços. Não há waterfall observado em navegador nem número de requests contado em runtime, pelo mesmo motivo registrado em `accessibility.md` — o ambiente da implementação não tem navegador nem permissão de rede. A verificação em runtime entra no harness de TD-054.
