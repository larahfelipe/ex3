# Testes — TASK 3.1

Infraestrutura de testes do backend. Registra as decisões que não são dedutíveis dos arquivos.

## Comandos

| Comando | O que roda | Precisa de banco |
| --- | --- | --- |
| `pnpm test` | suíte completa (unit + integração) | sim |
| `pnpm test:unit` | testes sem IO | não |
| `pnpm test:integration` | testes contra o banco real | sim |
| `pnpm test:unit:watch` | unit em watch | não |
| `pnpm test:db:up` / `pnpm test:db:down` | ciclo de vida do Postgres local | — |

`pnpm test` é o comando único da suíte. Localmente ele pressupõe o banco de pé (`pnpm test:db:up`); no CI o Postgres é um service container, então `pnpm test` basta.

## Duas categorias, separadas por nome de arquivo

* **unit** — `src/**/*.test.ts`, colocados ao lado do código. Sem rede, sem banco, sem relógio real.
* **integração** — `src/**/*.integration.ts`, também colocados ao lado do código, contra o Postgres de teste e a aplicação Express inteira via `supertest`.

`App.test.ts` passou a ser `App.integration.ts`: ele exercita a pilha HTTP completa, então uma vez que existe banco disponível ele o consulta. Mantê-lo na faixa unit fazia `pnpm test:unit` ir de 0,5 s para 10 s e deixava de ser verdade que a faixa não toca IO.

A separação é por sufixo, não por diretório, porque o glob `src/**/*.test.ts` já era a convenção do repositório e `*.integration.ts` não colide com ele. Isso mantém `pnpm test:unit` executável sem nenhuma dependência externa — que é o que permite rodá-lo em watch.

Integração roda com `--test-concurrency=1`: os arquivos compartilham um único banco, e o `TRUNCATE` de um invalidaria as fixtures de outro rodando em paralelo.

Todo arquivo de integração chama `registerIntegrationHooks()` uma vez, dentro do `describe`. Ele registra o reset de banco e de rate limit por teste e o `$disconnect` no fim do arquivo. O disconnect não é zelo: o runner espera o processo de cada arquivo terminar, e um pool aberto o mantém vivo pelo idle timeout inteiro — esquecê-lo custava 10 s por arquivo, sem nenhum teste falhar.

## Banco de teste

`.env.test` é a **única** fonte da string de conexão, lida via `node --env-file`. O `compose.yaml` e o service container do CI usam as mesmas credenciais (`ex3`/`ex3`/`ex3_test`), então nenhum dos dois ambientes redefine configuração de banco.

O armazenamento do container local é `tmpfs`: cada `up` começa com um cluster vazio. A suíte depende de o banco ser descartável, não de limpar o que deixou para trás.

Isolamento entre testes vem de `resetDatabase()`, chamado em `beforeEach`. A lista de tabelas é lida de `pg_tables` em vez de fixada no código — tabelas introduzidas pelas migrations da FASE 4 passam a ser truncadas sem editar o helper. `_prisma_migrations` é preservada, senão cada run reaplicaria o histórico inteiro sobre um schema já existente.

`TRUNCATE` exige identificadores interpolados (não dá para bindá-los como parâmetro). Os nomes vêm do catálogo do próprio banco de teste, nunca de entrada de teste; é a única chamada `$executeRawUnsafe` do repositório.

## Schema: migrations passaram a ser versionadas

`prisma/migrations` estava em `.gitignore`, e por isso o diretório não existia. O efeito era silencioso e grave: o `prisma migrate deploy` do workflow `migrate.yaml` nunca tinha nada para aplicar, e o schema em produção não era reproduzível a partir do repositório.

A entrada foi removida do `.gitignore` e a migration inicial (`0_init`) foi gerada a partir do `schema.prisma` com `prisma migrate diff --from-empty`. O banco de teste é provisionado pelo mesmo caminho que produção — `prisma migrate deploy` —, não por `db push`.

`relationMode = "prisma"` continua no schema, então o banco não tem foreign keys: as fixtures podem inserir um `Portfolio` com `userId` inexistente sem erro. É limitação herdada do modelo atual, reavaliada na FASE 4.

## Provisionamento: script, não `--test-global-setup`

`pnpm test:integration` roda `src/test/PrepareTestDatabase.ts` como processo separado antes do runner. A flag `--test-global-setup` do Node seria o lugar natural, mas ela resolve o módulo de setup **sincronamente**, o que ignora os hooks de loader do `tsx`: qualquer import do arquivo de setup (`./TestDatabase`, `@/infra/...`) falha com `ERR_MODULE_NOT_FOUND`.

O script faz duas coisas: prova que o banco responde (`SELECT 1` — com driver adapter o `$connect` resolve mesmo inacessível, ver `docs/toolchain.md`) e aplica as migrations. Se o banco não responde, a mensagem aponta `pnpm test:db:up` em vez de vazar stack do Prisma.

## Fixtures

`src/test/Fixtures.ts` escreve via Prisma Client direto, **não** pelos repositories: os repositories são o código sob teste nas TASKS 3.3/3.4, e fixtures construídas sobre eles mascarariam defeitos.

A exceção é a senha, que passa pelo mesmo `Bcrypt` da aplicação — é o que permite que um teste faça sign-in de verdade com `FIXTURE_PASSWORD`. O digest é calculado uma vez por processo de teste, já que todo usuário de fixture compartilha a mesma senha.

`seedPortfolio()` monta o menor grafo coerente que a API consegue operar: usuário → carteira → ativo → transação, com o ativo ligado ao instrumento do seu símbolo. `createAsset` cria esse instrumento com `name` igual ao símbolo e tipo `OTHER` quando ele ainda não existe, como a migração do catálogo faz com os dados existentes; `createInstrument` cadastra o instrumento para os testes que precisam do símbolo no catálogo antes de chamar a API. Nenhum valor é aleatório; símbolos e e-mails alternativos são passados explicitamente por quem precisa de mais de um. `createPortfolio` aceita nome, moeda base e data de criação, para os testes que precisam de várias carteiras do mesmo usuário em ordem conhecida.

## Cliente HTTP

`signIn()` autentica pelo endpoint real em vez de assinar um token localmente. A sessão é stateful (a `sessionVersion` do token precisa ser a da linha do usuário) e é o endpoint que incrementa essa versão, então o token obtido é o mesmo que um cliente real receberia. Assinar localmente fica restrito aos testes de token inválido, que precisam de claims forjadas.

Os rate limiters guardam contadores em memória de processo, que sobrevivem a um teste. Os budgets são apertados de propósito (10 tentativas de autenticação por 15 min), então `resetRateLimits()` é chamado em `beforeEach`. Ele depende de acertar a chave que o `express-rate-limit` deriva para o cliente loopback do `supertest`; `Harness.integration.ts` afirma que a chave está de fato sendo contada antes de resetar, para que um reset que não limpa nada falhe em vez de passar silenciosamente.

## Mocks

Não há utilitário próprio: `node:test` já traz `mock.method`, que substitui um método e restaura em `mock.restoreAll()`. Os singletons da aplicação são compartilhados dentro do processo de um arquivo de teste, e o runner dá um processo por arquivo — é isso que torna a substituição direta segura. `AuthMiddleware.test.ts` é o exemplo da convenção. A exceção é o `PrismaClient`: a instância é um proxy cujo descritor de `runSerializable` não traz o método, e `mock.method` sobre ela falha; `injectWriteFailure` substitui o método em `PrismaClient.prototype` (ver [Atomicidade das operações financeiras](#atomicidade-das-operações-financeiras)).

## Harness

`src/test/Harness.integration.ts` testa a própria infraestrutura: que as migrations criaram o schema, que as fixtures produzem um grafo coerente, que o reset zera todas as tabelas, que o cliente HTTP autentica e alcança rota protegida, que o reset de rate limit acerta a chave real, e que a falha injetada atinge só a escrita escolhida e desfaz as anteriores. É o teste que quebra primeiro quando o ambiente está errado, em vez de deixar as TASKS 3.2–3.4 falharem por motivo não relacionado.

## Regressão do fluxo de assets — TASK 3.3

`src/routes/Assets.integration.ts` fixa, pela API HTTP, o comportamento de adicionar, buscar, listar, paginar, ordenar, renomear e excluir ativos antes da remodelagem da FASE 4. Isso inclui o isolamento entre usuários: ativo de outra carteira responde exatamente como ativo inexistente, não aparece na listagem, não é renomeado e não é excluído.

**O teste descreve o que existe.** Uma inconsistência que não quebra o fluxo é fixada como está e sinalizada no próprio teste, até ser corrigida.

**Defeito conhecido vira teste `todo`.** O teste afirma o comportamento correto e hoje falha, reproduzindo o defeito. O `node:test` não reprova a suíte por um `todo`, nem avisa quando um passa a passar, então quem corrige o defeito remove a marcação e o teste passa a proteger a correção. O `ℹ todo N` do resumo é a contagem de defeitos abertos.

O único `todo` da suíte, duas carteiras com o mesmo símbolo (baseline #19: `Asset.symbol` era `@unique` global e o segundo usuário recebia 500), passou com o catálogo de instrumentos e virou teste comum. Ver [Catálogo de instrumentos](#catálogo-de-instrumentos).

**Ordem.** Sem `sort`, a listagem não tem `ORDER BY` e a ordem não é garantida pelo Postgres. Os testes que comparam páginas usam `sort` sobre saldos distintos, e a ordem sem `sort` não é fixada.

**Busca.** A API não tem busca: o web filtra por substring de símbolo a página já carregada (`assets-table.tsx`), então nunca encontra ativo de outra página (baseline #25, TASK 9.1). O teste cobre o que esse filtro exige da API, que a listagem não seja estreitada por parâmetros de query além de paginação e ordenação. O filtro em si fica sem teste automatizado: o web não tem faixa unit (o CI declara a suíte do web como E2E, FASE 17), e o componente é substituído na TASK 9.1.

## Correções posteriores à TASK 3.3

Os achados da task foram corrigidos, e os testes que os fixavam passaram a proteger a correção:

| Achado | Hoje | Onde |
| --- | --- | --- |
| símbolo em branco gravado como `''` (`min(1)` rodava antes do `trim`) | `trim` e caixa alta rodam antes dos limites: 400 | `validation/schema/asset/AssetSymbolSchema.ts` |
| `limit` fracionário aceito e devolvido como tamanho de página | `page` e `limit` inteiros positivos, `limit` até 100 (OWASP API4:2023): 400 | `validation/schema/PaginationQuerySchema.ts` |
| `DELETE` de ativo ausente respondia 400, e o `GET`, 404 | 404 em `GET`, `PATCH` e `DELETE` | `services/asset/DeleteAssetService.ts`, `services/asset/UpdateAssetService.ts` |
| transações excluídas por `assetSymbol` sem escopo de carteira, risco latente para a remodelagem do domínio | toda consulta do razão, exclusão em lote de ativo e de conta inclusive, filtra pelo `portfolioId` gravado na transação | `infra/database/TransactionRepository.ts`, `infra/database/AssetRepository.ts` |
| `PATCH` de transação somava o novo impacto à posição sem desfazer o anterior, e respondia `Transaction created` | a edição desfaz o impacto gravado e aplica o novo; responde `Transaction updated` | `infra/database/TransactionRepository.ts`, `services/transaction/UpdateTransactionService.ts` |
| linha do razão e posição gravadas em escritas independentes: `SELL`s concorrentes passavam pela mesma checagem | uma transação serializável por escrita: dos `SELL`s concorrentes, só passam os que a posição cobre | `infra/database/PrismaClient.ts`, `infra/database/TransactionRepository.ts` |
| edição ou exclusão que levava a posição abaixo de zero era aceita | 400 `ACC_NEGATIVE_AMOUNT`, sem alterar nada | `infra/database/TransactionRepository.ts` |
| `type` de transação com `min`/`max` antes do `trim`: `' buy '` recusado | `trim` e caixa alta antes de comparar com `BUY`/`SELL` | `validation/schema/transaction/TransactionTypeSchema.ts` |
| id de transação aceito como qualquer string e levado ao banco | UUID validado no schema: 400 | `validation/schema/transaction/TransactionIdSchema.ts` |
| exclusão de ativo e de conta em escritas independentes; conta com ativos respondia 500 | uma transação serializável cada, dependentes primeiro | `infra/database/AssetRepository.ts`, `infra/database/UserRepository.ts` |

**Símbolo novo e símbolo gravado.** Só o símbolo que vai ser gravado (`POST /v1/asset` e o `newSymbol` do rename) segue a allowlist de letras e dígitos, a mesma do formulário do web. Endereçar um ativo existente exige só o formato normalizado, então um símbolo gravado antes da allowlist (ex.: `BRK.B`) continua sendo lido, renomeado e excluído sem migração.

**Escopo por carteira.** A transação grava `portfolioId` e `instrumentId`, e toda consulta do razão filtra pela carteira do chamador. Com o catálogo de instrumentos, duas carteiras podem ter o mesmo instrumento, e o teste de exclusão de ativo com o mesmo instrumento em outra carteira confirma que as transações dela ficam intactas.

**Razão e posição na mesma transação.** Criar, editar e excluir uma transação lê as transações da posição, reconstrói a posição sobre o razão como ele fica depois da escrita e grava a linha do razão e a posição em uma única transação `SERIALIZABLE` (`PrismaClient.runSerializable`). O razão é conferido sobre a leitura feita dentro da transação; se uma escrita concorrente a invalidar, o Postgres aborta um dos lados (`P2034`), que é reexecutado do início, até 3 tentativas. Um terceiro conflito seguido propaga como 500. A tentativa recusada não grava nada, nem para desfazer em seguida: a escrita entraria na detecção de conflitos serializáveis, e `SELL`s concorrentes recusados esgotariam as tentativas uns dos outros. O Prisma não expõe `SELECT ... FOR UPDATE` fora de SQL cru, e a transação serializável dá a mesma garantia pela API tipada. Exclusão de ativo e de conta usam o mesmo mecanismo, para não deixar transação órfã.

**Rename.** O rename liga o ativo ao instrumento do novo símbolo e leva junto as transações da carteira no instrumento antigo, na mesma transação serializável. Símbolo fora do catálogo responde 404. Símbolo que a carteira já tem responde 400 sem mover nada: o índice único `(portfolioId, instrumentId)` recusa a escrita e a transação inteira é desfeita, transações inclusive.

**Precisão.** Com `amount`, `price` e `balance` em `Float`, `BUY 0.3`, `SELL 0.1`, `SELL 0.2` recusava o último por resíduo de arredondamento. As colunas passaram a `DECIMAL(38,18)`, e o teste que reproduzia o defeito passou a proteger a correção. Ver [Transação remodelada](#transação-remodelada).

**Cobertura acrescentada.**

* `src/routes/Transactions.integration.ts`: transação de outro usuário responde como inexistente em `GET`, `PATCH` e `DELETE`, sem alterar a transação nem a posição; listagem e contagem só enxergam a carteira do chamador, inclusive em carteira com mais ativos que uma página.
* `src/routes/Assets.integration.ts`: símbolo fora da allowlist, fronteira de 100 no tamanho de página e rename (caixa, símbolo legado, allowlist, ativo de outra carteira como inexistente, transações levadas junto).
* `src/routes/Transactions.integration.ts`, razão: `BUY` soma e `SELL` subtrai da posição; `SELL` além da posição recusado sem gravar; edição substitui o impacto em vez de somar; edição ou exclusão que levaria a posição abaixo de zero recusada sem alterar nada; de três `SELL`s concorrentes sobre posição 1, só um passa. Validação: `type` em qualquer caixa e com espaços aceito, em branco ou desconhecido recusado sem gravar; id que não é UUID → 400 em `GET`, `PATCH` e `DELETE`.
* `src/config/App.integration.ts`: falha não prevista responde 500 genérico, sem detalhe interno, e é registrada uma única vez.
* `src/routes/Authentication.integration.ts`: sign-ups concorrentes para o mesmo e-mail e exclusão de conta (ver `docs/authentication.md`).

## Transações atuais — TASK 3.4

`src/routes/Transactions.integration.ts` cobre, pela API HTTP, criação, edição e exclusão de `BUY` e `SELL` e a recusa por saldo insuficiente. A maior parte já existia desde as correções posteriores à TASK 3.3 (razão, posse e validação, acima). A task acrescentou o que faltava ao escopo:

* a criação responde com a linha gravada, e o `GET` do id devolve o mesmo corpo;
* criar transação em ativo de outra carteira responde como ativo inexistente, sem gravar nem mover a posição;
* a edição que troca `BUY` por `SELL` move a posição nos dois sentidos;
* a exclusão de um `SELL` devolve à posição o que ele tinha retirado;
* `quantity` ou `unitPrice` zero, negativo ou fora do formato de string decimal recebem 400 em `POST` e `PATCH`, sem alterar nada. Número JSON não é convertido, porque o schema não faz coerção.

**Bugs de consistência conhecidos.** Os do baseline já corrigidos continuam fixados pelos testes que protegem a correção: dupla contabilização na edição (#15), checagem de carteira sem `await` na exclusão (#16, primeira parte), escritas não atômicas (#17) e mensagem de criação na edição (#21). Os que dependem da remodelagem da FASE 4 são reproduzidos por testes `todo`, na convenção da TASK 3.3:

| Teste `todo` | Comportamento hoje | Origem |
| --- | --- | --- |
| custo das unidades mantidas após `SELL` | `balance` soma o custo da compra e subtrai o valor da venda: `BUY 10 @ 10` e `SELL 5 @ 30` deixam 5 unidades com `balance` −50 | baseline #18, TASK 4.10 |

Os dois `todo` que comparavam a posição editada e a posição após exclusão ao recálculo da sequência passaram com a posição reconstruída do razão e viraram testes comuns. Ver [Posição reconstruída do razão](#posição-reconstruída-do-razão).

Os de venda fracionária até zero e de custo acima do maior número finito passaram com a transação remodelada: o primeiro virou teste comum, e o segundo deu lugar aos testes do teto de `DECIMAL(38,18)`. Ver [Transação remodelada](#transação-remodelada).

**Recálculo como referência.** Os critérios das TASKs 4.7 e 4.8 comparam a posição com a que a sequência de transações produziria. Os testes gravam essa sequência, pela API, num segundo ativo da mesma carteira e comparam as duas posições, em vez de fixar o valor esperado, e por isso continuaram valendo quando a posição passou a ser reconstruída a partir do razão. As sequências fracionárias foram escolhidas porque divergiam na aritmética incremental de `double` usada antes, o que foi conferido antes de virarem teste.

**Pendências.** O que a task encontrou sem ser necessário para concluí-la está em [`TODO.md`](../TODO.md): TD-002 (paginação da listagem de transações). TD-001 (tipo numérico) e TD-009 (limite superior de `amount` e `price`) foram resolvidos pela [transação remodelada](#transação-remodelada).

## Catálogo de instrumentos

`src/routes/Instruments.integration.ts` cobre o catálogo pela API HTTP:

* admin cadastra instrumento, com símbolo, tipo, mercado, moeda e país normalizados para caixa alta;
* o mesmo símbolo, em qualquer caixa, não gera um segundo instrumento: 400 `Instrument already exists in catalog`;
* símbolo fora da allowlist, tipo fora da lista, moeda que não é ISO 4217, país que não tem duas letras, nome em branco ou acima do limite e mercado ausente recebem 400 sem gravar;
* admin completa os atributos de um instrumento, e o símbolo enviado no corpo é ignorado; corpo sem atributos recebe 400, e símbolo fora do catálogo, 404;
* usuário que não é admin recebe 403 ao cadastrar ou editar, sem alterar o catálogo;
* qualquer usuário autenticado lista o catálogo, paginado e ordenado por símbolo;
* excluir a conta de quem detém um instrumento remove os ativos e mantém o instrumento.

As suítes de ativos e de transações passaram a cobrir o mesmo instrumento em duas carteiras. Abrir o ativo na segunda carteira reusa o instrumento, o razão e a contagem de uma carteira não enxergam as transações da outra, e excluir o ativo de uma carteira mantém o ativo e as transações da outra (TD-003). Abrir ativo ou renomear para símbolo fora do catálogo responde 404, e renomear para símbolo que a carteira já tem responde 400 sem mover transações.

**Migração.** A suíte roda sobre o schema final e não exercita a migração dos dados existentes. A do catálogo foi conferida à parte, sobre um banco com as migrations anteriores e dados no formato antigo: cria um instrumento por símbolo, liga ativos e transações sem perda e aborta antes de qualquer alteração quando existe transação sem ativo. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, sobre o banco de teste migrado, confirma que as migrations produzem o schema.

## Várias carteiras por usuário

`src/routes/Portfolios.integration.ts` cobre as carteiras pela API HTTP:

* o chamador cria carteira, com `name` sem espaços nas pontas e `baseCurrency` em caixa alta; nome no limite de 60 caracteres é aceito, e nome ou moeda base inválidos recebem 400 sem gravar;
* a listagem traz só as carteiras do chamador, em ordem de criação, e se divide em páginas disjuntas que cobrem o total, a última parcial; chamador sem carteira recebe a listagem vazia, e tamanho de página fora dos limites de `PaginationQuerySchema` recebe 400;
* o `GET` devolve carteira do chamador, carteira de outro usuário responde exatamente como inexistente, e `portfolioId` ausente ou que não é UUID recebe 400.

As suítes de ativos e de transações ganharam um bloco `portfolio scope`: carteira de outro usuário no `portfolioId` responde exatamente como carteira inexistente, e `portfolioId` ausente ou que não é UUID recebe 400, sem alterar ativo, transação nem posição. Duas carteiras do mesmo usuário mantêm separadas as posições no mesmo instrumento, e a transação por id, que não traz carteira na rota, é lida, editada e excluída em qualquer carteira do dono. `src/routes/Authentication.integration.ts` cobre o sign-up na moeda escolhida, a recusa de moeda base ausente ou desconhecida sem criar conta e a exclusão de conta com todas as carteiras (ver `docs/authentication.md`).

**Ordem.** Os testes de listagem gravam as carteiras fora da ordem de criação, com `createdAt` separados por um dia, para que a ordem afirmada venha do `ORDER BY` e não da ordem de inserção.

**Migração.** Como a do catálogo, a migração dos dados existentes foi conferida à parte, sobre um banco com as migrations anteriores e dados no formato antigo: a carteira existente vira `Main`, em BRL, com `createdAt` e `updatedAt` iguais à data de cadastro do usuário; carteira sem usuário aborta a migração antes de qualquer alteração; o índice único de `userId` vira índice simples, e uma segunda carteira do mesmo usuário é aceita. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

## Posição reconstruída do razão

`Position` (tabela `positions`) guarda `quantity`, `averageCost` e `balance`, e cada carteira tem no máximo uma posição por instrumento. As rotas e o `AssetRepository` ainda falam em ativo, e as respostas de ativo trazem os três campos no lugar de `amount`. As afirmações de posição em `src/routes/Transactions.integration.ts` e `src/routes/Assets.integration.ts` conferem os três.

A unicidade já estava coberta pela suíte de ativos: símbolo que a carteira já tem, em qualquer caixa, responde 400, e duas carteiras, do mesmo usuário ou não, têm posições separadas no mesmo instrumento. O bloco `ledger` de `src/routes/Transactions.integration.ts` passou a cobrir a reconstrução:

* `BUY` pondera o custo médio pela quantidade e `SELL` o mantém: `BUY 10 @ 10`, `BUY 10 @ 20` e `SELL 5 @ 30` deixam 15 unidades a 15;
* editar um `BUY` reprecifica as linhas seguintes, e excluir um `SELL` também;
* a edição que deixa um `SELL` posterior acima do que a posição detém naquele ponto é recusada sem alterar nada, mesmo quando a quantidade final continuaria positiva;
* posição que chega a zero volta a custo médio zero.

`balance` mantém o significado anterior, a soma de `±quantity × unitPrice`, e continua reproduzido pelo `todo` de custo após `SELL`.

**Recusa sem escrita.** Criação, edição e exclusão conferem em memória o razão candidato, com a linha nova no ponto da sua data de execução, a editada reordenada pela data nova ou sem a excluída, e só gravam quando ele é aceito, pelo motivo descrito em "Razão e posição na mesma transação".

**Ordem.** O razão é percorrido em ordem `executedAt`, depois ordem de gravação. O teste "replays entries executed and created at the same instant in recording order, not id order" grava, com o mesmo `executedAt` e `createdAt`, um `BUY` com o id que ordena por último e depois um `SELL` com o que ordena primeiro, e confirma que a escrita seguinte na posição é aceita e reconstrói a posição nessa ordem.

**Migração.** Conferida à parte, sobre um banco com as migrations anteriores e dados no formato antigo: renomeia `assets` para `positions`, com chave primária e índices; reconstrói `quantity`, `averageCost` e `balance` de cada posição a partir das suas transações, substituindo o valor gravado quando diverge e zerando a posição sem transações; transações no mesmo instante seguem a ordem do id; o resultado é igual, bit a bit, à reconstrução em TypeScript, inclusive com valores fracionários; um razão que vende mais do que detém aborta a migração sem alterar nada. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

## Transação remodelada

`Transaction` grava `quantity`, `unitPrice`, `fees`, `taxes`, `currency`, `executedAt`, `broker` e `notes`, e `type` é o enum `TransactionType`. Quantidades e valores de transação e posição são `DECIMAL(38,18)` e trafegam como string decimal. As fixtures gravam strings e compartilham `FIXTURE_EXECUTED_AT`, então a ordem do razão entre elas cai para a ordem de gravação. Os testes comparam decimais pela string de `toFixed()`, porque o `toJSON` de `Prisma.Decimal` usa expoente em valores pequenos.

O bloco `ledger` de `src/routes/Transactions.integration.ts` passou a cobrir:

* vender posição fracionária até exatamente zero;
* taxas e impostos no custo da compra, com o custo médio truncado em 18 casas;
* valores pequenos devolvidos em notação simples, sem expoente;
* transação em moeda diferente das outras da posição recusada com `CURRENCY_MISMATCH`, sem gravar;
* `BUY` retroativo entrando no razão pela data de execução e reprecificando a posição;
* `SELL` executado antes da compra que o cobriria recusado, na criação e na edição que o move para antes dela;
* posição no teto de `DECIMAL(38,18)` aceita, e a escrita que o passaria, em quantidade ou em `balance`, recusada com `POSITION_OUT_OF_RANGE`.

O bloco de validação cobre, em `POST` e `PATCH`, sem gravar nem mover a posição: tipo em branco, desconhecido ou ainda não aceito pela API (`DIVIDEND`); decimal em `number`, negativo, com expoente, com zero à esquerda, com ponto sem casas, com espaços, vazio, com 21 dígitos inteiros ou 19 casas, e zero em `quantity` e `unitPrice`; `currency` ausente ou fora de ISO 4217; `executedAt` ausente, sem hora, sem fuso ou em outro formato; `broker` e `notes` acima do limite. Um teste confere que a criação grava cada campo como enviado, com o `executedAt` enviado com fuso devolvido em UTC, e que a edição substitui todos, voltando os opcionais omitidos ao padrão.

**Migração.** Conferida à parte, sobre um banco com as migrations anteriores e dados no formato antigo: nenhuma transação perdida; `amount` e `price` convertidos pela menor representação decimal de cada `double` (`0.1` e `0.2` somam exatamente `0.3`, e `BUY 0.3`, `SELL 0.1`, `SELL 0.2` zeram a posição); `currency` da moeda base de cada carteira e `executedAt = createdAt`; posições reconstruídas em decimal, com custo médio truncado em 18 casas; colunas, nulabilidade e enum como no schema; tabela temporária removida. Aborta sem alterar nada com tipo fora do enum, transação sem carteira, `amount` ou `price` zero, negativo, com mais de 18 casas ou a partir de 10²⁰, razão que vende mais do que detém, `DIVIDEND` no razão e razão que passa por posição fora da coluna, mesmo terminando dentro dela. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

## Reconstrução determinística da posição

`rebuildPosition`, em `src/domain/PositionLedger.ts`, reconstrói a posição a partir do razão sem IO; `TransactionRepository` lê as transações da posição, entrega o razão candidato e grava o resultado. `src/domain/PositionLedger.test.ts` a cobre na faixa unit:

* `BUY` pondera o custo médio com taxas e impostos, e `investedValue` é `quantity × averageCost`;
* `SELL` mantém o custo médio e o zera quando nada resta;
* custo médio e `investedValue` truncados em 18 casas;
* as 24 permutações de um razão de quatro transações reconstroem a mesma posição;
* transações com o mesmo `executedAt` seguem a ordem de gravação, e a ainda não gravada vem por último;
* recusados: `SELL` antes da compra que o cobriria, razão com duas moedas, razão que passa por posição fora da coluna e `investedValue` fora da coluna com os demais valores dentro dela;
* tipo que a reconstrução não implementa lança.

**Ordem de gravação.** `Transaction.sequence` é `BIGINT` único, preenchido pelo banco na inserção e nunca devolvido pela API. `createTransaction` aceita `id` e `createdAt`, o que permite gravar transações no mesmo instante com ids em ordem contrária à de gravação.

**Migração.** Conferida à parte, sobre um banco com as migrations anteriores: numera as transações existentes em ordem `createdAt`, `id`, através das posições; em tabela vazia, a primeira inserção recebe 1; a inserção seguinte continua do maior número; a coluna é `bigint` não nula, com o default da sequência que ela possui, e o índice único recusa número repetido. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

## Exclusão de transação

`TransactionRepository.delete` reconstrói a posição a partir das transações restantes e grava a exclusão e a posição na mesma transação serializável. Além dos testes de exclusão do bloco `ledger` (devolver o que um `SELL` retirou, reprecificar as linhas seguintes, recusar a exclusão de um `BUY` do qual um `SELL` depende), dois cobrem a consistência da exclusão:

* "leaves a position after a deletion equal to replaying the remaining transactions" exclui um `BUY` do meio de um razão com taxas, impostos e um `SELL` e um `BUY` posteriores, e compara a posição com a obtida gravando só as transações restantes numa posição vazia. Nesse razão, retirar o impacto da linha excluída por delta daria outro custo médio.
* "rolls back the deletion when writing the position fails, keeping the transaction" remove a posição direto no banco, para que a gravação dela falhe depois de a linha ser excluída, e confirma a resposta 500 com a transação ainda gravada.

## Atomicidade das operações financeiras

Criar, editar e excluir transação, renomear ativo, excluir ativo e excluir conta escrevem em mais de uma tabela dentro de uma única `runSerializable` (ver "Razão e posição na mesma transação"). Para cada uma, um teste faz a última escrita falhar, depois das anteriores, e confirma a resposta 500 genérica com o estado anterior intacto:

* criação de transação: a gravação da posição falha depois da inserção; o razão mantém só as transações anteriores e a posição não muda;
* edição de transação: a gravação da posição falha depois da alteração; a transação continua como gravada e a posição não muda;
* exclusão de transação: o teste de [Exclusão de transação](#exclusão-de-transação);
* rename de ativo: o teste do índice único, descrito em "Rename";
* exclusão de ativo: a remoção da posição falha depois da remoção das transações; posição e transações continuam gravadas;
* exclusão de conta: a remoção do usuário falha depois da remoção de transações, posições e carteiras; as quatro tabelas mantêm as linhas da conta.

A última escrita é a que tem mais escritas anteriores a desfazer; uma falha em etapa anterior interrompe a operação antes das seguintes.

**Falha injetada.** Criação, edição, exclusão de ativo e exclusão de conta não têm falha natural na última escrita. `injectWriteFailure(t, model, action)`, em `src/test/TestDatabase.ts`, faz `model.action` rejeitar dentro da transação real de `runSerializable` até o fim do teste, e as demais consultas seguem normalmente, então o que o teste observa é o rollback do Postgres. A falha não é prevista: sai pelo error handler como 500 e é registrada, e o teste silencia `console.error`. O teste do harness confere que só a escrita escolhida falha e que a anterior é desfeita, para que um helper que falhasse antes da primeira escrita não deixasse os testes de rollback passarem sem desfazer nada.
