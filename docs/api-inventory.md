# Inventário de rotas e contratos — TASK 0.2

Catálogo do estado da API capturado no commit `8dc9edd`, mantido como linha de base; o que deixou de valer desde então está em [Superado desde o snapshot](#superado-desde-o-snapshot). Duas camadas HTTP coexistem:

* **Backend Express** (`backend/src/routes`) — API de domínio, autenticada por `Authorization: Bearer <jwt>`.
* **Proxy Next.js** (`web/src/app/api/v1`) — Route Handlers consumidos pelo browser; leem o JWT do cookie `httpOnly` `ex3:token` e o repassam ao backend. O browser nunca fala com o backend diretamente.

## Convenções atuais

**Autenticação (backend).** `authMiddleware` exige `Authorization: Bearer <token>`, verifica a assinatura com `JWT_SECRET` e **também** exige que o token esteja gravado em `users.accessToken`. Um token válido cuja linha foi sobrescrita por outro login deixa de autenticar — não há sessão concorrente.

**Erro (backend).** Cada controller captura a própria exceção e responde `{ name, message }` com o status de `ApplicationError`; erro desconhecido cai no default `500 InternalServerError`. Não existe `code` estável nem `details`. Não existe error handler global.

**Erro (proxy).** `ApiProxyError` → `{ message, _error? }` com o status/statusText propagados do backend.

**Paginação.** `assets` e `transactions` retornam `{ page, limit, total, totalPages }`; `transactions` acrescenta `lastId`. Nenhum outro endpoint pagina. Defaults de `page`/`limit` residem no repositório, não no schema.

**Efeitos colaterais.** Nenhuma operação é atômica: escrita de `transactions` e atualização de `assets` são chamadas independentes ao Prisma.

---

## Backend — Users

| Método | Path | Auth | Payload | Response 2xx | Erros |
| --- | --- | --- | --- | --- | --- |
| POST | `/v1/user` | não | `{ email, password }` (`GetUserSchema`) | `200` `{ id, name, email, accessToken, createdAt, updatedAt }` | `400` payload inválido · `404` `User not found` — **também** quando a senha está errada, o que evita enumeração de usuários mas usa um status semanticamente incorreto |
| POST | `/v1/user/create` | não | `{ name?, email, password }` (`CreateUserSchema`) | `201` `{ user, message: 'User created successfully' }` | `400` · `409`/`400` `User already exists` |
| GET | `/v1/users` | sim | — | `200` `{ users }` | `401` · `403` se `!user.isAdmin` |
| POST | `/v1/user/sign-out` | sim | — | `200` `{ message }` | `401` |
| PATCH | `/v1/user` | sim | `{ name?, oldPassword?, newPassword? }` | `200` `{ user, message }` | `400` · `401` `Invalid password` |
| DELETE | `/v1/user` | sim | `{ password }` | `200` `{ message }` | `400` · `401` |

**Efeito colateral relevante:** `POST /v1/user` (sign-in) emite um JWT novo e **sobrescreve** `users.accessToken`, invalidando a sessão anterior. `POST /v1/user/create` cria o `Portfolio` do usuário no mesmo fluxo (1:1).

**Nota de contrato:** sign-in é um `POST /v1/user`, semanticamente uma leitura. Divergência a resolver na FASE 6.

---

## Backend — Portfolios

| Método | Path | Auth | Payload | Response 2xx | Erros |
| --- | --- | --- | --- | --- | --- |
| GET | `/v1/portfolio` | sim | — | `200` `Omit<Portfolio,'assets'>` | `401` · `404` `Portfolio not found for this user` |
| GET | `/v1/portfolios` | sim | — | `200` `{ portfolios }` | `401` · `403` se `!user.isAdmin` |

Sem paginação e sem filtros. Um usuário possui no máximo um portfolio (`Portfolio.userId @unique`).

---

## Backend — Assets

| Método | Path | Auth | Payload | Response 2xx | Erros |
| --- | --- | --- | --- | --- | --- |
| GET | `/v1/asset/:symbol` | sim | param `symbol` (1–6 chars, upper) | `200` `Asset` | `400` · `401` · `404` `Asset not found in portfolio` |
| GET | `/v1/assets` | sim | query `page?`, `limit?`, `sort?` (`asc`\|`desc`) | `200` `{ assets, pagination, sort? }` | `400` · `401` · `404` `Portfolio not found` |
| POST | `/v1/asset` | sim | `{ symbol }` | `201` `{ asset, message }` | `400` · `401` · `404` portfolio · conflito `Asset already exists in portfolio` |
| PATCH | `/v1/asset/:symbol` | sim | param `symbol` + body `{ newSymbol }` | `200` `{ asset, message }` | `400` · `401` · `404` |
| DELETE | `/v1/asset/:symbol` | sim | param `symbol` | `200` `{ message }` | `400` · `401` · `404` |

**Filtros:** apenas ordenação (`sort`) por um campo fixo definido no repositório. Não há busca server-side por símbolo.

**Efeitos colaterais:** `DELETE` remove o asset e suas transações em cascata lógica. `PATCH` renomeia o símbolo, que é a chave estrangeira de `transactions.assetSymbol`.

**Restrição herdada do schema:** `assets.symbol` é `@unique` globalmente — `PETR4` pode existir em uma única carteira em toda a base.

---

## Backend — Transactions

| Método | Path | Auth | Payload | Response 2xx | Erros |
| --- | --- | --- | --- | --- | --- |
| GET | `/v1/transaction/:id` | sim | param `id` | `200` `Transaction` | `400` · `404` `Transaction not found for this asset` |
| GET | `/v1/transactions/:assetSymbol` | sim | param `assetSymbol` + query `page?`, `limit?`, `lastId?` | `200` `{ transactions, pagination: { page, limit, total, totalPages, lastId } }` | `400` · `401` · `404` |
| GET | `/v1/transactions/:assetSymbol/count` | sim | param `assetSymbol` | `200` `{ buy, sell }` | `400` · `401` · `404` |
| POST | `/v1/transaction` | sim | `{ type: 'BUY'\|'SELL', amount>0, price>0, assetSymbol }` | `201` `{ transaction, message }` | `400` payload ou `resulting amount cannot be negative` · `401` · `404` |
| PATCH | `/v1/transaction/:id` | sim | param `id` + body `{ type, amount, price }` | `200` `{ message }` | `400` · `401` · `404` |
| DELETE | `/v1/transaction/:id` | sim | param `id` | `200` `{ message }` | `400` · `401` · `404` |

**`GET /v1/transaction/:id` não verifica posse.** O service recebe apenas `id`; qualquer usuário autenticado lê a transação de qualquer outro. Falha de autorização a corrigir na FASE 6.

**Efeitos colaterais e defeitos conhecidos:**

* `POST` grava a transação e então aplica `increment`/`decrement` em `assets.amount` e `assets.balance`, sem transação de banco.
* `PATCH` aplica o impacto novo **sem reverter o impacto anterior** — dupla contabilização. Também responde com a mensagem `'Transaction created successfully'`.
* `DELETE` reverte por delta a partir dos valores originais da transação, sem recalcular a posição a partir do ledger remanescente; e a checagem de portfolio não usa `await`, sendo sempre verdadeira.
* Não existem tipos além de `BUY`/`SELL`: proventos, aportes e desdobramentos não são representáveis.
* `executedAt` não existe — a data da operação é `createdAt`.

---

## Proxy Next.js

| Método | Path | Auth | Comportamento |
| --- | --- | --- | --- |
| POST | `/api/v1/sign-up` | não | encaminha para `POST /v1/user/create` |
| POST | `/api/v1/sign-in` | não | encaminha para `POST /v1/user`; grava `accessToken` no cookie `ex3:token` (`httpOnly`, `sameSite: strict`, `secure` em produção); devolve o usuário sem o token |
| POST | `/api/v1/sign-out` | cookie | encaminha para `POST /v1/user/sign-out` para revogar a sessão no servidor e então apaga o cookie; o cookie é apagado mesmo se a API falhar |
| GET | `/api/v1/assets` | cookie | encaminha para `GET /v1/assets`; **soma `totalBalance` e calcula `dominance` por ativo no proxy** |
| POST | `/api/v1/assets/create` | cookie | encaminha para `POST /v1/asset` |
| GET/PATCH/DELETE | `/api/v1/assets/[symbol]` | cookie | encaminha para `/v1/asset/:symbol` |
| GET | `/api/v1/transactions/[symbol]` | cookie | encaminha para `GET /v1/transactions/:assetSymbol` |
| GET | `/api/v1/transactions/[symbol]/count` | cookie | encaminha para `GET /v1/transactions/:assetSymbol/count` |
| POST | `/api/v1/transactions/create` | cookie | encaminha para `POST /v1/transaction` |

**Sem cobertura no proxy:** `PATCH`/`DELETE` de transaction, `/v1/portfolio`, `/v1/portfolios`, `/v1/users`, `PATCH`/`DELETE` de user. A tela de conta e a edição de transação não têm rota proxy correspondente.

**Regra financeira no proxy:** `totalBalance` e `dominance` são calculados em `web/src/app/api/v1/assets/route.ts`. Viola a diretriz 4 do plano e será removido na FASE 5/6.

---

## Classificação

Todas as rotas (17 backend + 9 proxy) estão classificadas acima. Nenhuma rota do repositório ficou sem entrada.

| Destino na evolução | Rotas |
| --- | --- |
| Preservar com ajuste de contrato | sign-in, sign-up, sign-out, users CRUD |
| Substituir por endpoints de produto (FASE 6) | `/v1/assets`, `/v1/asset/:symbol`, `/v1/portfolio` |
| Remodelar sobre o novo domínio (FASE 4) | todas as rotas de transaction |
| Corrigir autorização antes de qualquer reuso | `GET /v1/transaction/:id` |
| Criar | overview, positions, performance, allocation, income |

---

## Padrão de resposta

Contrato de toda resposta de erro da API e de todo endpoint novo que lista.

**Erro.** O corpo é `{ code, message, details }`, inclusive no `404` de rota inexistente e no `429` do rate limit.

* `code` — categoria estável de `Errors` (`backend/src/config/Constants.ts`), uma por status: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `PAYLOAD_TOO_LARGE` (413), `TOO_MANY_REQUESTS` (429), `INTERNAL_SERVER_ERROR` (500).
* `message` — texto para exibição; num erro de validação, as mensagens dos campos recusados separadas por vírgula.
* `details` — sempre presente. Num erro de validação, um `{ path, message }` por campo recusado, com `path` em notação de ponto (índice de lista como segmento) e vazio quando o problema é o corpo inteiro; nos demais erros, `[]`. Não carrega stack, SQL nem outro detalhe interno.

O proxy do web mantém `{ message, _error }`, com o corpo da API em `_error`.

**Listagem paginada.** Query `page`, inteiro a partir de 1 com padrão 1, e `pageSize`, inteiro de 1 a 100 (`MAX_PAGE_LIMIT`) com padrão 10. Resposta `{ items, page, pageSize, total, totalPages }`, com `totalPages = ⌈total / pageSize⌉`, zero quando não há itens; página além da última responde `items` vazio com os mesmos totais. A ordenação de cada listagem é explícita e documentada com o endpoint. `GET /v1/assets`, `GET /v1/portfolios` e `GET /v1/instruments` são anteriores ao padrão e continuam com `limit` e `pagination` (TD-021).

---

## Superado desde o snapshot

| No snapshot | Hoje | Referência |
| --- | --- | --- |
| Sessão validada contra o token gravado em `users.accessToken` | Claim `sessionVersion` comparada a `users.sessionVersion`, em token com expiração | `docs/authentication.md` |
| Sign-in responde `404 User not found`, também para senha errada | `401 Invalid email or password`, idêntico para e-mail inexistente | `docs/authentication.md` |
| Cada controller captura a própria exceção; não há error handler global | Os controllers propagam e `errorHandlerMiddleware` responde `{ code, message, details }`; erro não previsto vira `500` genérico e é registrado. Rota inexistente e rate limit respondem no mesmo formato ([Padrão de resposta](#padrão-de-resposta)) | `backend/src/middleware/ErrorHandlerMiddleware.ts` |
| Defaults de `page`/`limit` residem no repositório, sem validação | `page` e `limit` são inteiros positivos e `limit` vai até 100, validados no schema; os defaults continuam no repositório | `backend/src/validation/schema/PaginationQuerySchema.ts` |
| Nenhuma operação é atômica | O sign-up cria usuário e carteira na mesma transação de banco. Escrita de transação (linha do razão e posição do ativo), exclusão de ativo e exclusão de conta rodam cada uma em uma transação serializável, e a falha de qualquer etapa desfaz a operação inteira | `backend/src/infra/database/PrismaClient.ts`, `docs/testing.md` |
| `PATCH /v1/transaction/:id` soma o novo impacto à posição sem desfazer o anterior e responde `Transaction created` | Reconstrói a posição a partir do razão, com a linha editada no lugar da original, e responde `Transaction updated` | `docs/testing.md` |
| Só o `SELL` é comparado à posição, e a exclusão não compara | Criação, edição e exclusão recusam com `400`, sem gravar, o razão em que algum `SELL` venderia mais do que a posição detém naquele ponto, inclusive excluir um `BUY` do qual um `SELL` depende | `docs/testing.md` |
| Id de transação é qualquer string não vazia; id inválido responde `404` | UUID validado no schema; id inválido responde `400` | `backend/src/validation/schema/transaction/TransactionIdSchema.ts` |
| `DELETE /v1/user` de conta com ativos responde `500` | Remove conta, carteiras, ativos e transações na mesma transação | `docs/authentication.md` |
| `symbol` de 1–6 caracteres, em caixa alta | Normalizado (`trim`, caixa alta) antes dos limites; símbolo novo aceita só letras e dígitos | `backend/src/validation/schema/asset/AssetSymbolSchema.ts` |
| Ativo ausente em `PATCH`/`DELETE` respondia `400` | `404`, como no `GET` | `docs/testing.md` |
| `GET /v1/transaction/:id` não verifica posse; o `DELETE` checa o portfolio sem `await` | Toda consulta de transaction é escopada pela carteira do usuário, e transação de outra carteira responde como inexistente em `GET`, `PATCH` e `DELETE`. A linha "Corrigir autorização antes de qualquer reuso" da classificação está atendida | `backend/src/infra/database/TransactionRepository.ts` |
| `assets.symbol` é `@unique` globalmente: `PETR4` só existe em uma carteira | O símbolo pertence ao catálogo de instrumentos, único por símbolo; cada carteira tem no máximo um ativo por instrumento, e várias carteiras podem ter o mesmo | `docs/domain-model.md` |
| `transactions.assetSymbol` liga transação e ativo, e o rename atualiza essa chave | A transação grava `portfolioId` e `instrumentId`. O rename liga o ativo ao instrumento do novo símbolo e leva as transações junto, na mesma transação serializável | `backend/src/infra/database/AssetRepository.ts` |
| `POST /v1/asset` e o `newSymbol` do `PATCH /v1/asset/:symbol` aceitam qualquer símbolo válido | O símbolo precisa estar no catálogo; fora dele, `404 Instrument not found in catalog` | `backend/src/services/asset/CreateAssetService.ts`, `backend/src/services/asset/UpdateAssetService.ts` |
| Não há catálogo de instrumentos | `GET /v1/instruments` (query `page?`, `limit?`; `200` `{ pagination, instruments }`, ordenado por símbolo) para qualquer usuário autenticado; `POST /v1/instrument` (`201` `{ instrument, message }`) e `PATCH /v1/instrument/:symbol` (`200` `{ instrument, message }`) só para admin, `403` aos demais; `market` aceita só `B3`, `NYSE`, `NASDAQ` e `CRYPTO`, e outro valor responde `400` | `backend/src/routes/InstrumentRoutes.ts` |
| Um portfolio por usuário (`Portfolio.userId @unique`); `GET /v1/portfolio` devolve o do chamador e `GET /v1/portfolios` lista todos, sem paginação, só para admin | Cada usuário tem N carteiras, com `name` e `baseCurrency`. `GET /v1/portfolios` (query `page?`, `limit?`; `200` `{ pagination, portfolios }`, em ordem de criação) lista só as do chamador; `GET /v1/portfolio` (query `portfolioId`; `200` `Omit<Portfolio,'assets'>`) devolve uma delas; `POST /v1/portfolio` (`{ name, baseCurrency }`; `201` `{ portfolio, message }`) cria outra. Carteira de outro usuário responde `404 Portfolio not found for this user`, como inexistente | `backend/src/routes/PortfolioRoutes.ts` |
| Rotas de ativo e de transação resolvem a carteira pelo usuário autenticado | Exigem `portfolioId`, na query em `GET` e `DELETE` e no corpo em `POST` e `PATCH`; ausente ou fora do formato UUID, `400`; carteira de outro usuário ou inexistente, `404`. As rotas de transação por id não recebem carteira e resolvem a transação pelo dono da carteira em que ela foi gravada | `backend/src/validation/schema/PortfolioScopeSchema.ts` |
| `POST /v1/user/create` cria o `Portfolio` do usuário no mesmo fluxo (1:1) | O corpo exige `baseCurrency` (ISO 4217), e a primeira carteira se chama `Main`, nessa moeda, gravada na mesma escrita do usuário | `docs/authentication.md` |
| Sem proxy para `/v1/portfolio` e `/v1/portfolios` | `GET /api/v1/portfolios` repassa a query ao backend, e os proxies de ativo e de transação repassam a query string com o `portfolioId`. A tela de ativos opera a carteira mais antiga (TD-013) e posta transação em `/api/v1/transactions/create`; antes usava `/api/v1/transactions`, que não tem handler | `web/src/app/api/v1/portfolios/route.ts` |
| `Asset` com `amount` e `balance`, movidos por `increment`/`decrement` a cada escrita de transação | A posição (tabela `positions`) tem `quantity`, `averageCost` e `investedValue`, e as respostas de ativo trazem os três no lugar de `amount` e `balance`. Criar, editar e excluir transação reconstroem a posição a partir das transações dela; `investedValue` é o custo das unidades detidas, `quantity × averageCost`, e `GET /v1/assets` com `sort` ordena por ele, com `sort.field` `investedValue`. O valor de mercado não entra nessas respostas e vem de `GET /v1/assets/valuations` | `docs/domain-model.md` |
| `POST /v1/transaction` recebe `{ type, amount>0, price>0, assetSymbol }` em `number` | Recebe `{ type, quantity, unitPrice, fees?, taxes?, currency, executedAt, broker?, notes?, assetSymbol, portfolioId }`. `quantity` e `unitPrice` são strings decimais positivas, e `fees` e `taxes` strings decimais com padrão `'0'`, todas com até 20 dígitos inteiros e 18 casas, sem expoente nem zero à esquerda; `currency` é ISO 4217; `executedAt` é ISO 8601 com fuso; `broker` tem até 60 caracteres e `notes` até 500, com padrão `null`. As respostas de transação trazem esses campos, `portfolioId` e `instrumentId`, com os decimais em string | `backend/src/validation/schema/transaction/TransactionEntrySchema.ts` |
| `PATCH /v1/transaction/:id` recebe `{ type, amount, price }` | Recebe o corpo do `POST` sem `assetSymbol` e `portfolioId` e substitui todos os campos: opcional omitido volta ao padrão | `backend/src/validation/schema/transaction/UpdateTransactionSchema.ts` |
| Não existem tipos além de `BUY`/`SELL`, e `executedAt` não existe | O banco guarda os 11 tipos do modelo de domínio, e a API aceita `BUY` e `SELL` até a reconstrução implementar os demais (TD-017). O razão segue `executedAt` e depois a ordem de gravação, e transação retroativa entra no razão pela sua data | `docs/domain-model.md` |
| Quantidades e valores de transação e posição em `Float` | `DECIMAL(38,18)`; as respostas de ativo trazem `quantity`, `averageCost` e `investedValue` em string. Valor que a coluna arredondaria recebe 400; escrita cujo razão passa por posição fora da coluna, `quantity × averageCost` incluído, recebe 400 `POSITION_OUT_OF_RANGE`, e transação em moeda diferente das outras da posição, 400 `CURRENCY_MISMATCH`, sem gravar | `docs/domain-model.md` |
| A tela de ativos calcula o preço médio a partir das transações listadas, somando compras e vendas | Exibe o `averageCost` de `GET /v1/portfolio/positions`, na moeda base, sem recalcular; o formulário de transação envia quantidade, preço unitário, taxas e impostos em string, `executedAt`, corretora e notas, com a `baseCurrency` da carteira como `currency` na criação e a moeda da transação na edição | `web/src/components/transaction-form-dialog.tsx` |
| O proxy `/api/v1/assets` soma `totalBalance` e calcula `dominance` sobre `balance` | O proxy foi removido, e nenhuma rota do web calcula valor financeiro. A tabela de posições da tela de ativos exibe a alocação e os demais valores de `GET /v1/portfolio/positions`, na moeda base, sem total no rodapé | `web/src/app/(protected)/assets/_components/positions-table.tsx` |
| Nenhuma rota de cotação ou valor de mercado | `GET /v1/assets/valuations` (query `portfolioId` e `symbols`, separados por vírgula, até 100, repetidos avaliados uma vez; `200` `{ valuations }`) avalia os ativos que a carteira detém entre os símbolos e omite os demais. Cada item traz `symbol` e `outcome`: `valued`, com `quote` (`price`, `currency`, `timestamp`, `source` e, quando o provedor o tem, `previousClose`), `marketValue` e, quando comparáveis, `profitLoss` e `profitLossPercent`; ou `not-found` e `unavailable`, sem mudar o `200`. Query inválida responde `400`, e carteira de outro usuário `404`. O web não consome o endpoint desde que a tabela de posições passou a ler `GET /v1/portfolio/positions`, e o proxy `/api/v1/assets/valuations` foi removido (TD-034) | `docs/domain-model.md` |
| Nenhum indicador consolidado da carteira | `GET /v1/portfolio/overview` (query `portfolioId`; `200` `{ baseCurrency, totalValue, investedValue, profitLoss, profitLossPercent, dayChange, dayChangePercent, quotedAt }`) consolida as posições na moeda base da carteira, convertidas pelo câmbio do provedor de cotação. `quotedAt` é o instante ISO 8601 da cotação ou taxa mais antiga usada em `totalValue` e acompanha esse total. Indicador que depende de cotação, taxa ou fechamento anterior ausente, e percentual de base zero, ficam fora do corpo, sem mudar o `200`. Query inválida responde `400`, e carteira de outro usuário `404`. O web lê pelo proxy `GET /api/v1/portfolio/overview`, com o hook `usePortfolioOverview` | `docs/domain-model.md` |
| Nenhuma lista de posições com valor de mercado | `GET /v1/portfolio/positions` (query `portfolioId`, `page` e `pageSize` e, opcionais, `sortBy`, `sortOrder`, `search`, `type` e `status`; `200` `{ items, page, pageSize, total, totalPages }`) lista as posições da carteira. `sortBy` é `symbol` (padrão), `quantity`, `averageCost`, `marketPrice`, `marketValue`, `allocation`, `profitLoss` ou `profitLossPercent`, e `sortOrder` é `asc` (padrão) ou `desc`; por um valor, a posição sem ele vai por último nos dois sentidos, e o empate segue a ordem de `symbol`. `search`, até 120 caracteres, busca sem diferenciar caixa em `symbol` e `name`; `type` é a classe do instrumento, e `status` é `open`, com unidades, ou `closed`, sem unidades. `total` conta só as posições que atendem aos filtros. Cada item traz `symbol`, `name`, `quantity`, `baseCurrency` e, quando calculáveis, `averageCost`, `marketPrice`, `marketValue`, `allocation`, `profitLoss` e `profitLossPercent`, na moeda base. Campo que depende de cotação ou taxa ausente fica fora do item, sem mudar o `200`. Query inválida responde `400`, e carteira de outro usuário `404`. O web lê pelo proxy `GET /api/v1/portfolio/positions`, com o hook `usePositions` | `docs/domain-model.md` |
| `GET /v1/asset/:symbol` devolve o ativo, sem cotação nem valor de mercado | `GET /v1/portfolio/positions/:symbol` (query `portfolioId`; `200` com a posição) descreve uma posição da carteira, com ou sem unidades: os campos do item de `GET /v1/portfolio/positions`, com a alocação sobre a carteira inteira, `type`, `market`, `currency` e `sector` do catálogo e `quote`, a cotação corrente na moeda em que foi cotada, com `price`, `currency`, `timestamp` e, quando calculáveis, `previousClose`, `dayChange` e `dayChangePercent`. O símbolo é normalizado como na escrita. Campo que depende de cotação ou taxa ausente fica fora do corpo, sem mudar o `200`. Símbolo sem posição na carteira responde `404 Asset not found in portfolio`, sem consultar o provedor; query ou símbolo inválido, `400`; carteira de outro usuário, `404`. O web lê pelo proxy `GET /api/v1/portfolio/positions/[symbol]`, com o hook `usePosition`, e não usa `GET /v1/asset/:symbol` (TD-034) | `docs/domain-model.md` |
| Nenhuma distribuição da carteira | `GET /v1/portfolio/allocation` (query `portfolioId`; `200` `{ baseCurrency, totalValue, byAsset, byType, bySector, byCurrency }`) distribui as posições com unidades da carteira, na moeda base, por ativo (`symbol` e `name`), `type`, `sector` e moeda da cotação. Cada grupo traz `marketValue` e `allocation`, a soma dos valores das suas posições em `GET /v1/portfolio/positions`. Campo que depende de cotação ou taxa ausente fica fora do grupo, e `totalValue` fora do corpo, sem mudar o `200`. Query inválida responde `400`, e carteira de outro usuário `404`. O web lê pelo proxy `GET /api/v1/portfolio/allocation`, com o hook `useAllocation` | `docs/domain-model.md` |
| `GET /v1/transactions/:assetSymbol` ordena por `id`, um UUID aleatório, pagina por `lastId` e ignora `page` (TD-002) | `GET /v1/transactions` (query `portfolioId` e, opcionais, `symbol`, `type`, `broker`, `dateFrom`, `dateTo`, `page` e `pageSize`; `200` `{ items, page, pageSize, total, totalPages }`) lista as transações da carteira do mais recente ao mais antigo, por `executedAt` e depois pela ordem de gravação. Cada item traz os campos da transação e o `symbol` do instrumento. `symbol` e `type` são normalizados como na escrita, `broker` é comparado ao valor gravado, e `dateFrom` e `dateTo` são instantes ISO 8601 com fuso, inclusivos, sobre `executedAt`; filtro sem correspondência responde `items` vazio. Query inválida responde `400`, e carteira de outro usuário `404`. A listagem por símbolo e o proxy `/api/v1/transactions/[symbol]` foram removidos. O web lê a listagem pelo proxy `GET /api/v1/transactions`, com o hook `useTransactions` | `backend/src/infra/database/TransactionRepository.ts` |
| `GET /v1/transactions/:assetSymbol/count` conta as compras e vendas de um ativo, e a tabela da tela de ativos pede uma contagem por linha | Cada item de `GET /v1/assets` traz `transactionCount` (`{ buy, sell }`), as transações `BUY` e `SELL` do ativo na carteira, contadas para a página inteira numa única consulta agrupada; tipo sem transação conta zero. O endpoint e o proxy `/api/v1/transactions/[symbol]/count` foram removidos. O web não lê mais a listagem de ativos nem a contagem, e o proxy `GET /api/v1/assets` foi removido (TD-034) | `backend/src/services/asset/GetAllAssetsService.ts` |
| Nenhuma rota devolve o perfil do chamador; o web guarda em `localStorage` o usuário do sign-in, e a tabela de ativos rotula os valores com uma moeda escolhida num seletor, sem conversão | `GET /v1/user` (autenticado; `200` `{ user: { id, name, email, createdAt, updatedAt } }`) devolve o perfil do chamador, sem colunas de credencial nem `isAdmin`. O proxy `GET /api/v1/user` repassa com o cookie de sessão, e a área protegida lê o perfil pelo React Query, sem `localStorage`. O seletor de moeda saiu: a tabela de posições formata os valores na `baseCurrency` que a resposta informa | `docs/authentication.md` |
| Nenhuma série histórica da carteira | `GET /v1/portfolio/performance` (query `portfolioId`, `range?` — `1W`, `1M`, `3M`, `6M`, `1Y` (padrão), `YTD` ou `MAX` —, `benchmark?`, símbolo do catálogo, e `symbol?`; `200` `{ baseCurrency, from, to, series, benchmark? }`) devolve o valor da carteira no fechamento de cada dia negociado da janela, na moeda base. Cada ponto traz `date`, `value`, `investedValue`, `netContribution` e `twr`, o retorno ponderado no tempo acumulado desde o primeiro ponto, que não conta como ganho o aporte nem a retirada do dia. Dia em que falta o fechamento ou o câmbio de alguma posição detida fica fora da série, sem mudar o `200`. A janela termina no início do dia corrente em UTC, exclusivo, e `MAX` começa no dia da primeira transação do razão. Com `benchmark`, o corpo traz `{ symbol, currency, series }`, cada ponto com `close` e o retorno sobre o primeiro fechamento da janela; símbolo fora do catálogo responde `404 Instrument not found in catalog`. Com `symbol`, a série é a da posição daquele símbolo, reconstruída só das transações dela, e símbolo sem posição na carteira responde `404 Asset not found in portfolio`. Query inválida responde `400`, e carteira de outro usuário `404`. O web lê pelo proxy `GET /api/v1/portfolio/performance`, com o hook `usePerformance`, pede `symbol` no detalhe do ativo e não pede `benchmark` | `backend/src/domain/PortfolioPerformance.ts` |
| `PATCH` e `DELETE` de transaction sem rota proxy; o web não edita nem exclui transação | `PATCH` e `DELETE` `/api/v1/transactions/[id]` (cookie) encaminham para `/v1/transaction/:id`, com o id codificado na URL, e o backend valida o UUID e a posse. O web edita e exclui pelo diálogo de detalhes da transação, no detalhe do ativo e na Overview, com confirmação antes de excluir, e nenhuma mutation repete sozinha a requisição que falhou | `web/src/app/api/v1/transactions/[id]/route.ts` |
