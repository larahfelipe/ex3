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

## Superado desde o snapshot

| No snapshot | Hoje | Referência |
| --- | --- | --- |
| Sessão validada contra o token gravado em `users.accessToken` | Claim `sessionVersion` comparada a `users.sessionVersion`, em token com expiração | `docs/authentication.md` |
| Sign-in responde `404 User not found`, também para senha errada | `401 Invalid email or password`, idêntico para e-mail inexistente | `docs/authentication.md` |
| Cada controller captura a própria exceção; não há error handler global | Os controllers propagam e `errorHandlerMiddleware` responde `{ name, message }`; erro não previsto vira `500` genérico e é registrado | `backend/src/middleware/ErrorHandlerMiddleware.ts` |
| Defaults de `page`/`limit` residem no repositório, sem validação | `page` e `limit` são inteiros positivos e `limit` vai até 100, validados no schema; os defaults continuam no repositório | `backend/src/validation/schema/PaginationQuerySchema.ts` |
| Nenhuma operação é atômica | O sign-up cria usuário e carteira na mesma transação de banco. Escrita de transação (linha do razão e posição do ativo), exclusão de ativo e exclusão de conta rodam cada uma em uma transação serializável | `backend/src/infra/database/PrismaClient.ts` |
| `PATCH /v1/transaction/:id` soma o novo impacto à posição sem desfazer o anterior e responde `Transaction created` | Desfaz o impacto gravado, aplica o novo e responde `Transaction updated` | `docs/testing.md` |
| Só o `SELL` é comparado à posição, e a exclusão não compara | Criação, edição e exclusão recusam com `400` o que deixaria a posição negativa, inclusive excluir um `BUY` do qual um `SELL` depende | `docs/testing.md` |
| Id de transação é qualquer string não vazia; id inválido responde `404` | UUID validado no schema; id inválido responde `400` | `backend/src/validation/schema/transaction/TransactionIdSchema.ts` |
| `DELETE /v1/user` de conta com ativos responde `500` | Remove conta, carteiras, ativos e transações na mesma transação | `docs/authentication.md` |
| `symbol` de 1–6 caracteres, em caixa alta | Normalizado (`trim`, caixa alta) antes dos limites; símbolo novo aceita só letras e dígitos | `backend/src/validation/schema/asset/AssetSymbolSchema.ts` |
| Ativo ausente em `PATCH`/`DELETE` respondia `400` | `404`, como no `GET` | `docs/testing.md` |
| `GET /v1/transaction/:id` não verifica posse; o `DELETE` checa o portfolio sem `await` | Toda consulta de transaction é escopada pela carteira do usuário, e transação de outra carteira responde como inexistente em `GET`, `PATCH` e `DELETE`. A linha "Corrigir autorização antes de qualquer reuso" da classificação está atendida | `backend/src/infra/database/TransactionRepository.ts` |
| `assets.symbol` é `@unique` globalmente: `PETR4` só existe em uma carteira | O símbolo pertence ao catálogo de instrumentos, único por símbolo; cada carteira tem no máximo um ativo por instrumento, e várias carteiras podem ter o mesmo | `docs/domain-model.md` |
| `transactions.assetSymbol` liga transação e ativo, e o rename atualiza essa chave | A transação grava `portfolioId` e `instrumentId`. O rename liga o ativo ao instrumento do novo símbolo e leva as transações junto, na mesma transação serializável | `backend/src/infra/database/AssetRepository.ts` |
| `POST /v1/asset` e o `newSymbol` do `PATCH /v1/asset/:symbol` aceitam qualquer símbolo válido | O símbolo precisa estar no catálogo; fora dele, `404 Instrument not found in catalog` | `backend/src/services/asset/CreateAssetService.ts`, `backend/src/services/asset/UpdateAssetService.ts` |
| Não há catálogo de instrumentos | `GET /v1/instruments` (query `page?`, `limit?`; `200` `{ pagination, instruments }`, ordenado por símbolo) para qualquer usuário autenticado; `POST /v1/instrument` (`201` `{ instrument, message }`) e `PATCH /v1/instrument/:symbol` (`200` `{ instrument, message }`) só para admin, `403` aos demais | `backend/src/routes/InstrumentRoutes.ts` |
| Um portfolio por usuário (`Portfolio.userId @unique`); `GET /v1/portfolio` devolve o do chamador e `GET /v1/portfolios` lista todos, sem paginação, só para admin | Cada usuário tem N carteiras, com `name` e `baseCurrency`. `GET /v1/portfolios` (query `page?`, `limit?`; `200` `{ pagination, portfolios }`, em ordem de criação) lista só as do chamador; `GET /v1/portfolio` (query `portfolioId`; `200` `Omit<Portfolio,'assets'>`) devolve uma delas; `POST /v1/portfolio` (`{ name, baseCurrency }`; `201` `{ portfolio, message }`) cria outra. Carteira de outro usuário responde `404 Portfolio not found for this user`, como inexistente | `backend/src/routes/PortfolioRoutes.ts` |
| Rotas de ativo e de transação resolvem a carteira pelo usuário autenticado | Exigem `portfolioId`, na query em `GET` e `DELETE` e no corpo em `POST` e `PATCH`; ausente ou fora do formato UUID, `400`; carteira de outro usuário ou inexistente, `404`. As rotas de transação por id não recebem carteira e resolvem a transação pelo dono da carteira em que ela foi gravada | `backend/src/validation/schema/PortfolioScopeSchema.ts` |
| `POST /v1/user/create` cria o `Portfolio` do usuário no mesmo fluxo (1:1) | O corpo exige `baseCurrency` (ISO 4217), e a primeira carteira se chama `Main`, nessa moeda, gravada na mesma escrita do usuário | `docs/authentication.md` |
| Sem proxy para `/v1/portfolio` e `/v1/portfolios` | `GET /api/v1/portfolios` repassa a query ao backend, e os proxies de ativo e de transação repassam a query string com o `portfolioId`. A tela de ativos opera a carteira mais antiga (TD-013) e posta transação em `/api/v1/transactions/create`; antes usava `/api/v1/transactions`, que não tem handler | `web/src/app/api/v1/portfolios/route.ts` |
