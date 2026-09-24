# Testes — TASK 3.1

Infraestrutura de testes do backend. Registra as decisões que não são dedutíveis dos arquivos.

## Comandos

| Comando | O que roda | Precisa de banco |
| --- | --- | --- |
| `pnpm test` | suíte completa (unit + integração) | sim |
| `pnpm test:unit` | testes sem IO | não |
| `pnpm test:integration` | testes contra o banco real | sim |
| `pnpm test:unit:watch` | unit em watch | não |
| `pnpm test:db:up` / `pnpm test:db:down` | ciclo de vida do serviço `postgres-test` do `compose.yaml` da raiz | — |

`pnpm test` é o comando único da suíte. Localmente ele pressupõe o banco de pé (`pnpm test:db:up`); no CI o Postgres é um service container, então `pnpm test` basta. Em container, `docker compose run --rm backend-check` sobe o banco e roda os gates inteiros (ver `docs/containers.md`).

## Duas categorias, separadas por nome de arquivo

* **unit** — `src/**/*.test.ts`, colocados ao lado do código. Sem rede, sem banco, sem relógio real.
* **integração** — `src/**/*.integration.ts`, também colocados ao lado do código, contra o Postgres de teste e a aplicação Express inteira via `supertest`.

`App.test.ts` passou a ser `App.integration.ts`: ele exercita a pilha HTTP completa, então uma vez que existe banco disponível ele o consulta. Mantê-lo na faixa unit fazia `pnpm test:unit` ir de 0,5 s para 10 s e deixava de ser verdade que a faixa não toca IO.

A separação é por sufixo, não por diretório, porque o glob `src/**/*.test.ts` já era a convenção do repositório e `*.integration.ts` não colide com ele. Isso mantém `pnpm test:unit` executável sem nenhuma dependência externa — que é o que permite rodá-lo em watch.

Integração roda com `--test-concurrency=1`: os arquivos compartilham um único banco, e o `TRUNCATE` de um invalidaria as fixtures de outro rodando em paralelo.

Todo arquivo de integração chama `registerIntegrationHooks()` uma vez, dentro do `describe`. Ele registra o reset de banco e de rate limit por teste e o `$disconnect` no fim do arquivo. O disconnect não é zelo: o runner espera o processo de cada arquivo terminar, e um pool aberto o mantém vivo pelo idle timeout inteiro — esquecê-lo custava 10 s por arquivo, sem nenhum teste falhar.

## Banco de teste

`.env.test` é a **única** fonte da string de conexão, lida via `node --env-file`. Sob `NODE_ENV=test`, nem `config/Envs.ts` nem `prisma.config.ts` carregam o `.env` do desenvolvedor: o que a suíte não declarar fica ausente, em vez de ser preenchido por uma credencial que alcança outro banco. O serviço `postgres-test` do `compose.yaml` e o service container do CI usam as mesmas credenciais (`ex3`/`ex3`/`ex3_test`), então nenhum dos dois ambientes redefine configuração de banco. Como o `node --env-file` não sobrescreve variável já presente no ambiente, um `NODE_ENV` ou `DATABASE_URL` exportado vence o `.env.test`; por isso `resetDatabase()` recusa truncar fora de `NODE_ENV=test` (`NonTestDatabaseResetError`).

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

Os rate limiters guardam contadores em memória de processo, que sobrevivem a um teste. Os budgets são apertados de propósito (10 falhas de sign-in por conta e endereço a cada 15 min), então `resetRateLimits()` é chamado em `beforeEach` e limpa inteiros os `MemoryStore` de `rateLimitStores` em vez de listar chaves. `Harness.integration.ts` afirma que a conta de um sign-in que falhou está de fato sendo contada antes de resetar, para que um reset que não limpa nada falhe em vez de passar silenciosamente; o sign-in que acerta a senha devolve a tentativa e não serviria de prova. Os testes de endereço usam os blocos de documentação da RFC 5737, atestados pelos cabeçalhos do web com o `API_PROXY_SECRET` do `.env.test`.

## Mocks

Não há utilitário próprio: `node:test` já traz `mock.method`, que substitui um método e restaura em `mock.restoreAll()`. Os singletons da aplicação são compartilhados dentro do processo de um arquivo de teste, e o runner dá um processo por arquivo — é isso que torna a substituição direta segura. `AuthMiddleware.test.ts` é o exemplo da convenção. A exceção é o `PrismaClient`: a instância é um proxy cujo descritor de `runSerializable` não traz o método, e `mock.method` sobre ela falha; `injectWriteFailure` substitui o método em `PrismaClient.prototype` (ver [Atomicidade das operações financeiras](#atomicidade-das-operações-financeiras)).

## Harness

`src/test/Harness.integration.ts` testa a própria infraestrutura: que as migrations criaram o schema, que as fixtures produzem um grafo coerente, que o reset zera todas as tabelas, que o cliente HTTP autentica e alcança rota protegida, que o reset de rate limit acerta a chave real, e que a falha injetada atinge só a escrita escolhida e desfaz as anteriores. É o teste que quebra primeiro quando o ambiente está errado, em vez de deixar as TASKS 3.2–3.4 falharem por motivo não relacionado.

## Regressão do fluxo de assets — TASK 3.3

`src/routes/Assets.integration.ts` fixa, pela API HTTP, o comportamento de adicionar, renomear e excluir ativos. Isso inclui o isolamento entre usuários: ativo de outra carteira responde exatamente como ativo inexistente, não é renomeado e não é excluído. As leituras que a suíte também fixava saíram com `GET /v1/asset/:symbol`, `GET /v1/assets` e `GET /v1/assets/valuations`; o que a tela de ativos lê hoje está em [Valuation](#valuation).

**O teste descreve o que existe.** Uma inconsistência que não quebra o fluxo é fixada como está e sinalizada no próprio teste, até ser corrigida.

**Defeito conhecido vira teste `todo`.** O teste afirma o comportamento correto e hoje falha, reproduzindo o defeito. O `node:test` não reprova a suíte por um `todo`, nem avisa quando um passa a passar, então quem corrige o defeito remove a marcação e o teste passa a proteger a correção. O `ℹ todo N` do resumo é a contagem de defeitos abertos.

O único `todo` da suíte, duas carteiras com o mesmo símbolo (baseline #19: `Asset.symbol` era `@unique` global e o segundo usuário recebia 500), passou com o catálogo de instrumentos e virou teste comum. Ver [Catálogo de instrumentos](#catálogo-de-instrumentos).

**Busca.** A busca da tela de ativos, que antes filtrava no web a página já carregada e nunca encontrava ativo de outra página (baseline #25), é feita por `GET /v1/portfolio/positions` sobre todas as posições da carteira (ver [Valuation](#valuation)).

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
| `type` de transação com `min`/`max` antes do `trim`: `' buy '` recusado | `trim` e caixa alta antes de comparar com os tipos aceitos | `validation/schema/transaction/TransactionTypeSchema.ts` |
| id de transação aceito como qualquer string e levado ao banco | UUID validado no schema: 400 | `validation/schema/transaction/TransactionIdSchema.ts` |
| exclusão de ativo e de conta em escritas independentes; conta com ativos respondia 500 | uma transação serializável cada, dependentes primeiro | `infra/database/AssetRepository.ts`, `infra/database/UserRepository.ts` |

**Símbolo novo e símbolo gravado.** Só o símbolo que vai ser gravado (`POST /v1/asset` e o `newSymbol` do rename) segue a allowlist de letras e dígitos, a mesma do formulário do web. Endereçar um ativo existente exige só o formato normalizado, então um símbolo gravado antes da allowlist (ex.: `BRK.B`) continua sendo lido, renomeado e excluído sem migração.

**Escopo por carteira.** A transação grava `portfolioId` e `instrumentId`, e toda consulta do razão filtra pela carteira do chamador. Com o catálogo de instrumentos, duas carteiras podem ter o mesmo instrumento, e o teste de exclusão de ativo com o mesmo instrumento em outra carteira confirma que as transações dela ficam intactas.

**Razão e posição na mesma transação.** Criar, editar e excluir uma transação lê as transações da posição, reconstrói a posição sobre o razão como ele fica depois da escrita e grava a linha do razão e a posição em uma única transação `SERIALIZABLE` (`PrismaClient.runSerializable`). O razão é conferido sobre a leitura feita dentro da transação; se uma escrita concorrente a invalidar, o Postgres aborta um dos lados (`P2034`), que é reexecutado do início, até 3 tentativas. Um terceiro conflito seguido propaga como 500. A tentativa recusada não grava nada, nem para desfazer em seguida: a escrita entraria na detecção de conflitos serializáveis, e `SELL`s concorrentes recusados esgotariam as tentativas uns dos outros. O Prisma não expõe `SELECT ... FOR UPDATE` fora de SQL cru, e a transação serializável dá a mesma garantia pela API tipada. Exclusão de ativo e de conta usam o mesmo mecanismo, para não deixar transação órfã.

**Rename.** O rename liga o ativo ao instrumento do novo símbolo e leva junto as transações da carteira no instrumento antigo, na mesma transação serializável. Símbolo fora do catálogo responde 404. Símbolo que a carteira já tem responde 400 sem mover nada: o índice único `(portfolioId, instrumentId)` recusa a escrita e a transação inteira é desfeita, transações inclusive.

**Precisão.** Com `amount`, `price` e `balance` em `Float`, `BUY 0.3`, `SELL 0.1`, `SELL 0.2` recusava o último por resíduo de arredondamento. As colunas passaram a `DECIMAL(38,18)`, e o teste que reproduzia o defeito passou a proteger a correção. Ver [Transação remodelada](#transação-remodelada).

**Cobertura acrescentada.**

* `src/routes/Transactions.integration.ts`: transação de outro usuário responde como inexistente em `GET`, `PATCH` e `DELETE`, sem alterar a transação nem a posição; a listagem só enxerga a carteira do chamador, inclusive em carteira com mais ativos que uma página.
* `src/routes/Assets.integration.ts`: símbolo fora da allowlist, fronteira de 100 no tamanho de página e rename (caixa, símbolo legado, allowlist, ativo de outra carteira como inexistente, transações levadas junto).
* `src/routes/Transactions.integration.ts`, razão: `BUY` soma e `SELL` subtrai da posição; `SELL` além da posição recusado sem gravar; edição substitui o impacto em vez de somar; edição ou exclusão que levaria a posição abaixo de zero recusada sem alterar nada; de três `SELL`s concorrentes sobre posição 1, só um passa. Validação: `type` em qualquer caixa e com espaços aceito, em branco ou desconhecido recusado sem gravar; id que não é UUID → 400 em `GET`, `PATCH` e `DELETE`.
* `src/config/App.integration.ts`: falha não prevista responde 500 genérico, sem detalhe interno, e é registrada uma única vez.
* `src/routes/Authentication.integration.ts`: sign-ups concorrentes para o mesmo e-mail, nome da primeira carteira pedido no sign-up, aparado ou recusado em branco e acima de 60 caracteres, e exclusão de conta (ver `docs/authentication.md`).

## Transações atuais — TASK 3.4

`src/routes/Transactions.integration.ts` cobre, pela API HTTP, criação, edição e exclusão de `BUY` e `SELL` e a recusa por saldo insuficiente. A maior parte já existia desde as correções posteriores à TASK 3.3 (razão, posse e validação, acima). A task acrescentou o que faltava ao escopo:

* a criação responde com a linha gravada, e o `GET` do id devolve o mesmo corpo;
* criar transação em ativo de outra carteira responde como ativo inexistente, sem gravar nem mover a posição;
* a edição que troca `BUY` por `SELL` move a posição nos dois sentidos;
* a exclusão de um `SELL` devolve à posição o que ele tinha retirado;
* `quantity` ou `unitPrice` zero, negativo ou fora do formato de string decimal recebem 400 em `POST` e `PATCH`, sem alterar nada. Número JSON não é convertido, porque o schema não faz coerção.

**Bugs de consistência conhecidos.** Os do baseline já corrigidos continuam fixados pelos testes que protegem a correção: dupla contabilização na edição (#15), checagem de carteira sem `await` na exclusão (#16, primeira parte), escritas não atômicas (#17) e mensagem de criação na edição (#21). Os que dependiam da remodelagem da FASE 4 foram reproduzidos por testes `todo`, na convenção da TASK 3.3, e nenhum continua `todo`.

O de custo das unidades mantidas após `SELL` (baseline #18) passou quando `balance`, que somava o custo da compra e subtraía o valor da venda, deu lugar a `investedValue`, e virou teste comum: `BUY 10 @ 10` e `SELL 5 @ 30` deixam 5 unidades com `investedValue` 50, onde `balance` ficava em −50. Ver [Posição reconstruída do razão](#posição-reconstruída-do-razão).

Os dois `todo` que comparavam a posição editada e a posição após exclusão ao recálculo da sequência passaram com a posição reconstruída do razão e viraram testes comuns. Ver [Posição reconstruída do razão](#posição-reconstruída-do-razão).

Os de venda fracionária até zero e de custo acima do maior número finito passaram com a transação remodelada: o primeiro virou teste comum, e o segundo deu lugar aos testes do teto de `DECIMAL(38,18)`. Ver [Transação remodelada](#transação-remodelada).

**Recálculo como referência.** Os critérios das TASKs 4.7 e 4.8 comparam a posição com a que a sequência de transações produziria. Os testes gravam essa sequência, pela API, num segundo ativo da mesma carteira e comparam as duas posições, em vez de fixar o valor esperado, e por isso continuaram valendo quando a posição passou a ser reconstruída a partir do razão. As sequências fracionárias foram escolhidas porque divergiam na aritmética incremental de `double` usada antes, o que foi conferido antes de virarem teste.

**Pendências.** O que a task encontrou sem ser necessário para concluí-la está em [`TODO.md`](../TODO.md): TD-002 (paginação da listagem de transações). TD-001 (tipo numérico) e TD-009 (limite superior de `amount` e `price`) foram resolvidos pela [transação remodelada](#transação-remodelada).

## Catálogo de instrumentos

`src/routes/Instruments.integration.ts` cobre o catálogo pela API HTTP:

* admin cadastra instrumento, com símbolo, tipo, mercado, moeda e país normalizados para caixa alta;
* o mesmo símbolo, em qualquer caixa, não gera um segundo instrumento: 400 `Instrument already exists in catalog`;
* símbolo fora da allowlist, tipo fora da lista, moeda que não é ISO 4217, país que não tem duas letras, nome em branco ou acima do limite e mercado ausente ou fora da tabela recebem 400 sem gravar;
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

`Position` (tabela `positions`) guarda `quantity`, `averageCost` e `investedValue`, e cada carteira tem no máximo uma posição por instrumento. As rotas e o `AssetRepository` ainda falam em ativo, e as respostas de ativo trazem os três campos no lugar de `amount`. As afirmações de posição em `src/routes/Transactions.integration.ts` e `src/routes/Assets.integration.ts` conferem os três.

A unicidade já estava coberta pela suíte de ativos: símbolo que a carteira já tem, em qualquer caixa, responde 400, e duas carteiras, do mesmo usuário ou não, têm posições separadas no mesmo instrumento. O bloco `ledger` de `src/routes/Transactions.integration.ts` passou a cobrir a reconstrução:

* `BUY` pondera o custo médio pela quantidade e `SELL` o mantém: `BUY 10 @ 10`, `BUY 10 @ 20` e `SELL 5 @ 30` deixam 15 unidades a 15;
* editar um `BUY` reprecifica as linhas seguintes, e excluir um `SELL` também;
* a edição que deixa um `SELL` posterior acima do que a posição detém naquele ponto é recusada sem alterar nada, mesmo quando a quantidade final continuaria positiva;
* posição que chega a zero volta a custo médio zero.

`investedValue` é o custo das unidades detidas, `quantity × averageCost`, e o valor recebido na venda não entra nele: `BUY 10 @ 10` e `SELL 5 @ 30` deixam `investedValue` 50.

**Recusa sem escrita.** Criação, edição e exclusão conferem em memória o razão candidato, com a linha nova no ponto da sua data de execução, a editada reordenada pela data nova ou sem a excluída, e só gravam quando ele é aceito, pelo motivo descrito em "Razão e posição na mesma transação".

**Ordem.** O razão é percorrido em ordem `executedAt`, depois ordem de gravação. O teste "replays entries executed and created at the same instant in recording order, not id order" grava, com o mesmo `executedAt` e `createdAt`, um `BUY` com o id que ordena por último e depois um `SELL` com o que ordena primeiro, e confirma que a escrita seguinte na posição é aceita e reconstrói a posição nessa ordem.

**Migração.** Conferida à parte, sobre um banco com as migrations anteriores e dados no formato antigo: renomeia `assets` para `positions`, com chave primária e índices; reconstrói `quantity`, `averageCost` e `balance` de cada posição a partir das suas transações, substituindo o valor gravado quando diverge e zerando a posição sem transações; transações no mesmo instante seguem a ordem do id; o resultado é igual, bit a bit, à reconstrução em TypeScript, inclusive com valores fracionários; um razão que vende mais do que detém aborta a migração sem alterar nada. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

**Migração do custo.** Conferida à parte, sobre um banco com as migrations anteriores e posições gravadas: renomeia `balance` para `investedValue`, com tipo, nulabilidade e padrão do schema; grava `quantity × averageCost` truncado em 18 casas, inclusive em posição com `balance` negativo após venda acima do custo, com custo médio fracionário e no teto da coluna; e aborta sem alterar nada quando algum produto não cabe em `DECIMAL(38,18)`. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

## Transação remodelada

`Transaction` grava `quantity`, `unitPrice`, `fees`, `taxes`, `currency`, `executedAt`, `broker` e `notes`, e `type` é o enum `TransactionType`. Quantidades e valores de transação e posição são `DECIMAL(38,18)` e trafegam como string decimal. As fixtures gravam strings e compartilham `FIXTURE_EXECUTED_AT`, então a ordem do razão entre elas cai para a ordem de gravação. Os testes comparam decimais pela string de `toFixed()`, porque o `toJSON` de `Prisma.Decimal` usa expoente em valores pequenos.

O bloco `ledger` de `src/routes/Transactions.integration.ts` passou a cobrir:

* vender posição fracionária até exatamente zero;
* taxas e impostos no custo da compra, com o custo médio truncado em 18 casas;
* valores pequenos devolvidos em notação simples, sem expoente;
* transação em moeda diferente das outras da posição recusada com `CURRENCY_MISMATCH`, sem gravar;
* `BUY` retroativo entrando no razão pela data de execução e reprecificando a posição;
* `SELL` executado antes da compra que o cobriria recusado, na criação e na edição que o move para antes dela;
* `DIVIDEND`, `JCP` e `INTEREST` gravados sem mover a posição, e `BONUS` somando unidades pelo custo atribuído, zero inclusive;
* posição no teto de `DECIMAL(38,18)` aceita, e a escrita que o passaria, em quantidade ou em `investedValue`, recusada com `POSITION_OUT_OF_RANGE`.

O bloco de validação cobre, em `POST` e `PATCH`, sem gravar nem mover a posição: tipo em branco, desconhecido ou ainda não aceito pela API (`SPLIT`); decimal em `number`, negativo, com expoente, com zero à esquerda, com ponto sem casas, com espaços, vazio, com 21 dígitos inteiros ou 19 casas, e zero em `quantity` e em `unitPrice`, este em todo tipo menos `BONUS`, com o `path` `unitPrice` no detalhe; `currency` ausente ou fora de ISO 4217; `executedAt` ausente, sem hora, sem fuso ou em outro formato; `broker` e `notes` acima do limite. Um teste confere que a criação grava cada campo como enviado, com o `executedAt` enviado com fuso devolvido em UTC, e que a edição substitui todos, voltando os opcionais omitidos ao padrão.

**Migração.** Conferida à parte, sobre um banco com as migrations anteriores e dados no formato antigo: nenhuma transação perdida; `amount` e `price` convertidos pela menor representação decimal de cada `double` (`0.1` e `0.2` somam exatamente `0.3`, e `BUY 0.3`, `SELL 0.1`, `SELL 0.2` zeram a posição); `currency` da moeda base de cada carteira e `executedAt = createdAt`; posições reconstruídas em decimal, com custo médio truncado em 18 casas; colunas, nulabilidade e enum como no schema; tabela temporária removida. Aborta sem alterar nada com tipo fora do enum, transação sem carteira, `amount` ou `price` zero, negativo, com mais de 18 casas ou a partir de 10²⁰, razão que vende mais do que detém, `DIVIDEND` no razão e razão que passa por posição fora da coluna, mesmo terminando dentro dela. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

**Migração do `JCP`.** Só acrescenta o valor ao enum `TransactionType`, depois de `DIVIDEND`, sem tocar em linha gravada. `prisma migrate diff`, sobre o banco de teste migrado, não aponta diferença.

## Reconstrução determinística da posição

`rebuildPosition`, em `src/domain/PositionLedger.ts`, reconstrói a posição a partir do razão sem IO; `TransactionRepository` lê as transações da posição, entrega o razão candidato e grava o resultado. `src/domain/PositionLedger.test.ts` a cobre na faixa unit:

* `BUY` pondera o custo médio com taxas e impostos, e `investedValue` é `quantity × averageCost`;
* `SELL` mantém o custo médio e o zera quando nada resta;
* custo médio e `investedValue` truncados em 18 casas;
* as 24 permutações de um razão de quatro transações reconstroem a mesma posição;
* transações com o mesmo `executedAt` seguem a ordem de gravação, e a ainda não gravada vem por último;
* `BONUS` soma quantidade e custo atribuído, zero inclusive;
* `DIVIDEND`, `JCP` e `INTEREST` não alteram quantidade nem custo, com ou sem unidades detidas, e em outra moeda recusam o razão;
* recusados: `SELL` antes da compra que o cobriria, razão com duas moedas, razão que passa por posição fora da coluna e `investedValue` fora da coluna com os demais valores dentro dela;
* tipo que a reconstrução não implementa (`SPLIT`) lança;
* `realizeProfitLoss` realiza cada venda pelo custo médio antes dela, com o mesmo resultado nas 24 permutações de compra, venda, recompra e venda; trunca cada venda em 18 casas; e devolve a recusa do replay.

`src/domain/PositionIndicators.test.ts` cobre `describePositionIndicators` com um instante fixo: a variação de cada janela contra o último fechamento no seu primeiro dia ou antes, com fechamentos fora de ordem e fora do horário de meia-noite; a mínima e a máxima só do último ano, sem o fechamento lido antes dele; `openedOn` junto de cada `change`; `closes` a partir da abertura do ano, sem o fechamento lido antes dela, ou a partir do primeiro fechamento quando o histórico é mais curto; um fechamento por dia, o mais recente, quando mais de uma fonte observou o dia, na mínima, na máxima, na variação e na série; a janela que o histórico não alcança, a que o fechamento mais recente não alcança e a aberta em zero sem `change`; nenhum indicador de preço sem fechamento no último ano; o realizado de cada venda, a renda líquida de taxas e impostos, a do último ano, o `yieldOnCost` e o `since` com o razão fora de ordem; prejuízo realizado sem `yieldOnCost` quando nada está investido; e razão que não se reconstrói lança. O bloco `indicators` de `src/routes/Portfolios.integration.ts` cobre a rota contra o banco, com fechamentos semeados relativos ao dia corrente: preço, com `openedOn` e a série desde a abertura do ano, e retorno de uma posição com compra, venda e dividendo; posição sem transação nem fechamento com o corpo vazio; símbolo fora da carteira com 404, sem ler histórico; carteira de outro usuário com 404 e `portfolioId` ausente com 400. A variação `YTD` fica fora da asserção de integração, porque nos três primeiros dias de janeiro os fechamentos semeados caem no seu primeiro dia; a unit a cobre com data fixa.

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

## Provedor de cotação falso

Nenhum teste chama provedor de cotação real. `src/test/FakeMarketDataProvider.ts` implementa `MarketDataProvider` sobre os preços que recebe no construtor, por símbolo, e devolve cada um com `source` `fake`; com `isAvailable: false`, toda consulta responde `unavailable`. Cada teste cria o seu e o entrega ao código que recebe um `MarketDataProvider`, sem estado mutável compartilhado. O construtor exige ao menos um preço por símbolo, então símbolo sem preço é o que está fora do mapa e responde `not-found`. Taxa de câmbio é semeada sob os códigos do par, como `USDBRL` para um dólar em reais, e o fechamento anterior vai no próprio preço, em `previousClose`.

O falso ignora mercado, moeda e intervalo: traduzir o instrumento e respeitar o alcance de cada intervalo cabe ao adaptador real.

`src/test/FakeMarketDataProvider.test.ts` confere na faixa unit o contrato em que os testes se apoiam: cotação mais recente em qualquer ordem de carga, histórico em ordem crescente, início do intervalo incluído e fim excluído, intervalo vazio, símbolo sem preço, taxa de câmbio pelo par e indisponibilidade. `tsconfig.build.json` exclui `src/test`, então o falso não entra no build.

## Adaptador Yahoo Finance

`src/infra/market-data/YahooFinanceProvider.test.ts` roda na faixa unit, sem rede: o construtor recebe `fetchResponse` e `now`, e cada teste cria o seu provedor, com respostas e relógio próprios. Cobre:

* tradução por mercado (`PETR4.SA`, `AAPL`, `KO`, `BTC-USD`) numa única requisição, com a chave só no header `x-api-key`, nunca na URL, redirect recusado e timeout;
* instrumento de mercado fora da tabela, sem mercado ou moeda, ou com símbolo fora de letras e dígitos responde `not-found` sem requisição;
* símbolo ausente da resposta responde `not-found` e fica em cache;
* cache por `QUOTE_TIME_TO_LIVE_MS` e nova requisição quando expira; consulta simultânea de um símbolo aproveita a requisição em curso; lotes de no máximo `QUOTE_BATCH_SIZE` símbolos;
* sem chave, toda cotação responde `unavailable` sem requisição;
* status de erro, timeout e falha de rede respondem `unavailable`, abrem a pausa de `FAILURE_COOLDOWN_MS` e não registram a chave; durante a falha, a última cotação recebida é devolvida com o `timestamp` em que foi observada;
* resposta fora do formato e cotação inválida (moeda em unidade menor, como `BRp`, preço negativo ou fora de `DECIMAL(38,18)`, horário ausente) respondem `unavailable`, sem afetar as válidas do mesmo lote;
* fechamento anterior arredondado como o preço, e descartado quando inválido sem recusar a cotação;
* câmbio: par `USDBRL=X` no cache das cotações, código inválido ou igual à base como `not-found` sem requisição, taxa cotada em moeda diferente da base como `unavailable` e pausa compartilhada com a falha de cotação;
* histórico: `period1`, `period2` e `interval` da requisição, fechamentos nulos descartados, intervalo semiaberto em ordem crescente, `range-not-served` sem requisição para início além do alcance do intervalo, intervalo vazio, 404 como `not-found` e série com tamanhos divergentes como `unavailable`.

O teste espelha no topo as constantes do adaptador de que depende.

## Valuation

`src/domain/PositionValuation.test.ts`, na faixa unit, cobre `valuePosition`: valor de mercado com lucro e percentual; truncamento em direção a zero no produto e no quociente; valores nos limites de `DECIMAL(38,18)` sem perda de dígitos; `profitLoss` ausente com razão noutra moeda ou sem transações; percentual ausente sem valor investido; `not-found` e `unavailable` repassados.

`GET /v1/assets/valuations`, que avaliava os símbolos pedidos de uma carteira, foi removido com a suíte que o cobria; a tabela de posições lê `GET /v1/portfolio/positions`. A resposta `unavailable` sem chave de provedor, sem nenhuma chamada a `fetch`, é fixada no adaptador, em `src/infra/market-data/YahooFinanceProvider.test.ts`.

`src/domain/PortfolioValuation.test.ts`, na faixa unit, cobre `summarizePortfolio`: soma na moeda base com resultado e variação do dia; conversão pela taxa da moeda da cotação e da moeda das transações; truncamento em direção a zero nos totais e percentuais, inclusive na variação negativa; totais nos limites de `DECIMAL(38,18)` sem perda de dígitos; indicadores ausentes sem cotação, sem taxa, sem moeda do custo ou sem fechamento anterior; posição sem unidades ignorada; carteira vazia com totais zero. Cobre também `valuePositionsInBaseCurrency`: cada posição na moeda base com a sua alocação; alocação sobre a carteira inteira quando só parte dela é listada; truncamento de preço, valor e fração; posição nos limites de `DECIMAL(38,18)` sem perda de dígitos; campos ausentes sem cotação ou sem taxa; custo sem moeda; posição sem unidades com valor e alocação zero; carteira de valor zero na escala sem alocação. Cobre ainda `allocatePortfolio`: distribuição por ativo, tipo, setor e moeda sem a posição sem unidades, com setor `null` por último; em cada grupo, a soma dos valores e frações truncados das suas posições, com toda distribuição dentro da tolerância sobre `totalValue` e sobre 1; moeda da cotação no lugar da do catálogo, e a do catálogo sem cotação; total, frações e valor do grupo ausentes sem cotação ou sem taxa; carteira sem posições com unidades de valor zero e distribuições vazias; carteira de valor zero na escala sem alocação. Cobre `matchesPositionFilter`: toda posição sem critério; busca sem diferenciar caixa em símbolo e nome; classe; situação, com a menor quantidade representável como em carteira e a quantidade zero como encerrada; e os critérios combinados. E `sortPositionsBy`: comparação decimal, não lexicográfica, nos dois sentidos, com a posição sem o valor por último em ambos, e empate na ordem recebida. E `foreignCurrenciesOf`, com cada moeda diferente da base uma vez. E `describePosition`: a posição na moeda base ao lado do catálogo e da cotação na moeda dela, com variação do dia e percentual; truncamento em direção a zero de ambos; sem fechamento anterior, sem variação nem percentual; fechamento anterior zero, sem percentual; e, sem cotação, só os campos da posição e do catálogo.

O bloco `overview` de `src/routes/Portfolios.integration.ts` cobre `GET /v1/portfolio/overview`, trocando `getQuotes` e `getExchangeRates` do singleton por um `FakeMarketDataProvider`: indicadores da carteira pedida, sem as posições de outra carteira do mesmo usuário nem a posição sem unidades, com câmbio pedido só para a moeda estrangeira; indicadores que dependem de cotação fora do corpo com o provedor indisponível; carteira vazia na sua moeda base; carteira de outro usuário igual à inexistente; `portfolioId` ausente ou malformado com 400.

O bloco `positions` do mesmo arquivo cobre `GET /v1/portfolio/positions` com a mesma troca: posições da carteira pedida em ordem de `symbol` e na moeda base, com a posição sem unidades e sem as de outra carteira do mesmo usuário, e câmbio pedido só para a moeda estrangeira; última página e página além dela com os mesmos totais, cotando fora da página só as posições com unidades; ordem de `symbol` decrescente, com a mesma cotação; ordem por um valor nos dois sentidos antes de paginar, com a posição sem o valor por último e todas as posições filtradas cotadas; busca por símbolo e nome sem diferenciar caixa, classe e situação, sozinhas e combinadas, com `total` e `totalPages` só das posições filtradas e busca sem correspondência como página vazia; itens sem os campos que dependem de cotação com o provedor indisponível; carteira vazia como página vazia no maior `pageSize`; carteira de outro usuário igual à inexistente; `portfolioId`, `page`, `pageSize`, `sortBy`, `sortOrder`, `search`, `type` ou `status` ausente, malformado ou fora dos limites com 400.

O bloco `by symbol`, dentro de `positions`, cobre `GET /v1/portfolio/positions/:symbol` com a mesma troca: a posição pelo símbolo sem diferenciar caixa, com catálogo, cotação e variação do dia, cotando também as demais posições com unidades e pedindo câmbio só para a moeda estrangeira; a posição sem unidades, cotada ao lado das com unidades; a posição sem cotação nem os campos que dependem dela com o provedor indisponível; símbolo sem posição na carteira pedida, inclusive o de outra carteira do mesmo usuário, com 404 e sem consultar o provedor; valores pequenos devolvidos em notação simples, sem expoente; carteira de outro usuário igual à inexistente; `portfolioId` ausente ou malformado e símbolo vazio ou longo demais com 400.

O bloco `allocation` do mesmo arquivo cobre `GET /v1/portfolio/allocation` com a mesma troca: distribuição da carteira pedida por ativo, tipo, setor e moeda, na moeda base, sem a posição sem unidades nem as de outra carteira do mesmo usuário, cotando só as posições com unidades e pedindo câmbio só para a moeda estrangeira; grupos sem valores nem frações com o provedor indisponível; carteira vazia na sua moeda base, de valor zero e com distribuições vazias; carteira de outro usuário igual à inexistente; `portfolioId` ausente ou malformado com 400.

`node --env-file` não sobrescreve variável já exportada no shell, então nenhum teste depende de `.env.test` omitir `YAHOO_FINANCE_API_KEY`: nenhuma rota chega ao `getQuotes` ou ao `getExchangeRates` do singleton com instrumento ou moeda cotável sem que o teste os troque.

## Corpo de erro

`src/config/App.integration.ts` fixa o corpo `{ code, message, details }` ([Padrão de resposta](api-inventory.md#padrão-de-resposta)) na rota inexistente (404), no payload acima do limite (413), no JSON malformado (400), no rate limit (429) e na falha não prevista (500), com `details` vazio. Um payload que o schema recusa responde 400 com um `{ path, message }` por campo recusado em `details`.

## Listagem de transações

O bloco `listing` de `src/routes/Transactions.integration.ts` cobre `GET /v1/transactions`: transações da carteira pedida do mais recente ao mais antigo, com a ordem de gravação desempatando o mesmo `executedAt`, cada item com os campos da transação e o `symbol` do instrumento, sem as de outra carteira do mesmo usuário; filtros por `symbol` e `type` em qualquer caixa, por `broker` igual ao valor gravado, com outra caixa, `%` e `_` sem correspondência, e por `dateFrom` e `dateTo` inclusivos e em qualquer fuso, combinados, invertidos e sem correspondência; páginas sem repetir nem pular transação, e página além da última, até a maior que o schema aceita, com `items` vazio e os mesmos totais; filtro ou página malformados com 400. O bloco `portfolio scope` inclui o endpoint, e os testes que listavam por símbolo, nas suítes de transações e de ativos, passaram a filtrar por `symbol`.

## Cotações gravadas

`src/domain/PriceHistory.test.ts` cobre, sem banco, o que falta buscar de uma série: o instante levado ao início do seu dia em UTC; o intervalo inteiro quando nada está gravado; nada a pedir quando os fechamentos alcançam o dia corrente; cada borda isolada e as duas juntas; o dia sem negociação entre os extremos, que nunca é repedido; o intervalo que termina no passado, preservado inteiro; e o intervalo restrito ao dia corrente, que não pede nada. O agora é parâmetro, nunca `new Date()` dentro do teste.

`src/services/market-data/GetPriceHistoryService.integration.ts` cobre a orquestração contra o banco, com relógio fixo e o `getHistoricalPrices` do `FakeMarketDataProvider` substituído por `t.mock.method` em cada caso: o que é pedido ao provedor exclui o dia corrente e chega com o intervalo diário; série que já alcança o dia corrente não chama o provedor; só os dias posteriores ao fechamento mais novo são pedidos; provedor que não responde devolve o que está gravado; e símbolo fora do catálogo é recusado com `NotFoundError`.

`src/infra/database/MarketQuoteRepository.integration.ts` é a primeira suíte de integração de repositório: não sobe a API nem usa o cliente HTTP, e confere pelo `PrismaClient` o que a tabela guarda, com `registerIntegrationHooks` e o instrumento de `createInstrument`. Cobre `recordDailyCloses`: uma linha por dia de negociação, com o instante no início do dia em UTC, o decimal exato e o instrumento da linha; dia já gravado pela mesma fonte mantendo o preço primeiro observado, com o retorno contando só os dias novos; o mesmo dia de outra fonte como linha própria; e lista vazia sem gravar nada.

## Performance da carteira

`src/domain/PortfolioPerformance.test.ts` cobre, sem banco, a resolução da janela e a série: meses inteiros para trás a partir do início do dia corrente em UTC, o ano corrente do `YTD`, o dia da primeira transação do `MAX` e a janela vazia do razão sem transação; a posição valorizada a cada fechamento, com retorno zero no primeiro ponto; o aporte do dia que não conta como ganho; o provento líquido pago no dia contado como retorno; as unidades de `BONUS` sem aporte; a posição cotada em outra moeda levada à moeda base pela taxa do dia; o dia sem taxa e o dia sem fechamento de alguma posição detida, ambos fora da série; o benchmark sobre o primeiro fechamento da janela; e a carteira sem nada cotado, de série vazia. O agora é parâmetro, nunca `new Date()` dentro do teste.

O bloco `performance` de `src/routes/Portfolios.integration.ts` cobre `GET /v1/portfolio/performance` contra o banco, trocando `getHistoricalPrices` e `getHistoricalExchangeRate` do singleton por `t.mock.method`, como as demais rotas trocam a cotação: a série da carteira pedida na moeda base, com a janela que chegou ao provedor; a posição em moeda estrangeira convertida pela taxa de cada dia, com o par pedido uma vez; o benchmark ao lado da carteira; benchmark fora do catálogo com 404; a série de uma só posição, pelo símbolo sem diferenciar caixa, sem buscar fechamento nem câmbio das demais; símbolo sem posição na carteira com 404; carteira sem transação como janela vazia; carteira de outro usuário igual à inexistente; e `portfolioId`, `range`, `benchmark` ou `symbol` ausente ou malformado com 400. Os fechamentos são semeados relativos ao dia corrente, e não em datas fixas, que a suíte deixaria para trás.
