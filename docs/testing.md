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

`seedPortfolio()` monta o menor grafo coerente que a API consegue operar: usuário → carteira → ativo → transação. Nenhum valor é aleatório; símbolos e e-mails alternativos são passados explicitamente por quem precisa de mais de um.

## Cliente HTTP

`signIn()` autentica pelo endpoint real em vez de assinar um token localmente. A sessão é stateful (a `sessionVersion` do token precisa ser a da linha do usuário) e é o endpoint que incrementa essa versão, então o token obtido é o mesmo que um cliente real receberia. Assinar localmente fica restrito aos testes de token inválido, que precisam de claims forjadas.

Os rate limiters guardam contadores em memória de processo, que sobrevivem a um teste. Os budgets são apertados de propósito (10 tentativas de autenticação por 15 min), então `resetRateLimits()` é chamado em `beforeEach`. Ele depende de acertar a chave que o `express-rate-limit` deriva para o cliente loopback do `supertest`; `Harness.integration.ts` afirma que a chave está de fato sendo contada antes de resetar, para que um reset que não limpa nada falhe em vez de passar silenciosamente.

## Mocks

Não há utilitário próprio: `node:test` já traz `mock.method`, que substitui um método e restaura em `mock.restoreAll()`. Os singletons da aplicação são compartilhados dentro do processo de um arquivo de teste, e o runner dá um processo por arquivo — é isso que torna a substituição direta segura. `AuthMiddleware.test.ts` é o exemplo da convenção.

## Harness

`src/test/Harness.integration.ts` testa a própria infraestrutura: que as migrations criaram o schema, que as fixtures produzem um grafo coerente, que o reset zera todas as tabelas, que o cliente HTTP autentica e alcança rota protegida, e que o reset de rate limit acerta a chave real. É o teste que quebra primeiro quando o ambiente está errado, em vez de deixar as TASKS 3.2–3.4 falharem por motivo não relacionado.

## Regressão do fluxo de assets — TASK 3.3

`src/routes/Assets.integration.ts` fixa, pela API HTTP, o comportamento de adicionar, buscar, listar, paginar, ordenar, renomear e excluir ativos antes da remodelagem da FASE 4. Isso inclui o isolamento entre usuários: ativo de outra carteira responde exatamente como ativo inexistente, não aparece na listagem, não é renomeado e não é excluído.

**O teste descreve o que existe.** Uma inconsistência que não quebra o fluxo é fixada como está e sinalizada no próprio teste, até ser corrigida.

**Defeito conhecido vira teste `todo`.** O teste afirma o comportamento correto e hoje falha, reproduzindo o defeito. O `node:test` não reprova a suíte por um `todo`, nem avisa quando um passa a passar, então quem corrige o defeito remove a marcação e o teste passa a proteger a correção. O `ℹ todo N` do resumo é a contagem de defeitos abertos.

| Teste `todo` | Comportamento hoje | Origem |
| --- | --- | --- |
| duas carteiras com o mesmo símbolo | `Asset.symbol` é `@unique` global: o segundo usuário recebe 500 | baseline #19, FASE 4 (TASKs 4.2, 4.4 e 4.5) |

**Ordem.** Sem `sort`, a listagem não tem `ORDER BY` e a ordem não é garantida pelo Postgres. Os testes que comparam páginas usam `sort` sobre saldos distintos, e a ordem sem `sort` não é fixada.

**Busca.** A API não tem busca: o web filtra por substring de símbolo a página já carregada (`assets-table.tsx`), então nunca encontra ativo de outra página (baseline #25, TASK 9.1). O teste cobre o que esse filtro exige da API, que a listagem não seja estreitada por parâmetros de query além de paginação e ordenação. O filtro em si fica sem teste automatizado: o web não tem faixa unit (o CI declara a suíte do web como E2E, FASE 17), e o componente é substituído na TASK 9.1.

## Correções posteriores à TASK 3.3

Os achados da task foram corrigidos, e os testes que os fixavam passaram a proteger a correção:

| Achado | Hoje | Onde |
| --- | --- | --- |
| símbolo em branco gravado como `''` (`min(1)` rodava antes do `trim`) | `trim` e caixa alta rodam antes dos limites: 400 | `validation/schema/asset/AssetSymbolSchema.ts` |
| `limit` fracionário aceito e devolvido como tamanho de página | `page` e `limit` inteiros positivos, `limit` até 100 (OWASP API4:2023): 400 | `validation/schema/PaginationQuerySchema.ts` |
| `DELETE` de ativo ausente respondia 400, e o `GET`, 404 | 404 em `GET`, `PATCH` e `DELETE` | `services/asset/DeleteAssetService.ts`, `services/asset/UpdateAssetService.ts` |
| transações excluídas por `assetSymbol` sem escopo de carteira, risco latente para a TASK 4.2 | toda consulta de `TransactionRepository`, exclusão em lote inclusive, filtra pela carteira através do ativo (`asset: { portfolioId }`) | `infra/database/TransactionRepository.ts` |
| `PATCH` de transação somava o novo impacto à posição sem desfazer o anterior, e respondia `Transaction created` | a edição desfaz o impacto gravado e aplica o novo; responde `Transaction updated` | `infra/database/TransactionRepository.ts`, `services/transaction/UpdateTransactionService.ts` |
| linha do razão e posição gravadas em escritas independentes: `SELL`s concorrentes passavam pela mesma checagem | uma transação serializável por escrita: dos `SELL`s concorrentes, só passam os que a posição cobre | `infra/database/PrismaClient.ts`, `infra/database/TransactionRepository.ts` |
| edição ou exclusão que levava a posição abaixo de zero era aceita | 400 `ACC_NEGATIVE_AMOUNT`, sem alterar nada | `infra/database/TransactionRepository.ts` |
| `type` de transação com `min`/`max` antes do `trim`: `' buy '` recusado | `trim` e caixa alta antes de comparar com `BUY`/`SELL` | `validation/schema/transaction/TransactionTypeSchema.ts` |
| id de transação aceito como qualquer string e levado ao banco | UUID validado no schema: 400 | `validation/schema/transaction/TransactionIdSchema.ts` |
| exclusão de ativo e de conta em escritas independentes; conta com ativos respondia 500 | uma transação serializável cada, dependentes primeiro | `infra/database/AssetRepository.ts`, `infra/database/UserRepository.ts` |

**Símbolo novo e símbolo gravado.** Só o símbolo que vai ser gravado (`POST /v1/asset` e o `newSymbol` do rename) segue a allowlist de letras e dígitos, a mesma do formulário do web. Endereçar um ativo existente exige só o formato normalizado, então um símbolo gravado antes da allowlist (ex.: `BRK.B`) continua sendo lido, renomeado e excluído sem migração.

**Escopo por carteira antes da remodelagem.** A relação `Transaction → Asset` terá de mudar de chave quando a unicidade global do símbolo cair (#19), mas o filtro por carteira já está em todas as consultas: a remodelagem o preserva em vez de precisar introduzi-lo. Enquanto o símbolo for único global, excluir transações de outra carteira com o mesmo símbolo não é reproduzível em teste; o `todo` #19, ao passar, é o momento de acrescentar esse caso. A remodelagem em si (símbolo único por carteira, transação ligada ao ativo por id) fica para a FASE 4, nas TASKs 4.2, 4.4 e 4.5, depois da TASK 3.4.

**Razão e posição na mesma transação.** Criar, editar e excluir uma transação lê a posição do ativo, calcula a posição resultante e grava a linha do razão e a posição em uma única transação `SERIALIZABLE` (`PrismaClient.runSerializable`). A posição é conferida sobre a leitura feita dentro da transação; se uma escrita concorrente a invalidar, o Postgres aborta um dos lados (`P2034`), que é reexecutado do início, até 3 tentativas. Um terceiro conflito seguido propaga como 500. O Prisma não expõe `SELECT ... FOR UPDATE` fora de SQL cru, e a transação serializável dá a mesma garantia pela API tipada. Exclusão de ativo e de conta usam o mesmo mecanismo, para não deixar transação órfã.

**Rename.** As transações acompanham o ativo renomeado: com `relationMode = "prisma"`, o Prisma emula a atualização em cascata de `Transaction.assetSymbol`. A suspeita de transações órfãs no rename não se confirmou, e o teste passou a fixar o comportamento.

**Precisão.** `amount`, `price` e `balance` são `Float`, então a posição é conferida em ponto flutuante: `BUY 0.3`, `SELL 0.1`, `SELL 0.2` recusa o último por resíduo de arredondamento. A troca por decimal pertence à remodelagem da FASE 4.

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
* `amount` ou `price` zero, negativo ou string recebem 400 em `POST` e `PATCH`, sem alterar nada. String numérica não é convertida, porque o schema não faz coerção.

**Bugs de consistência conhecidos.** Os do baseline já corrigidos continuam fixados pelos testes que protegem a correção: dupla contabilização na edição (#15), checagem de carteira sem `await` na exclusão (#16, primeira parte), escritas não atômicas (#17) e mensagem de criação na edição (#21). Os que dependem da remodelagem da FASE 4 são reproduzidos por testes `todo`, na convenção da TASK 3.3:

| Teste `todo` | Comportamento hoje | Origem |
| --- | --- | --- |
| custo das unidades mantidas após `SELL` | `balance` soma o custo da compra e subtrai o valor da venda: `BUY 10 @ 10` e `SELL 5 @ 30` deixam 5 unidades com `balance` −50 | baseline #18, TASK 4.10 |
| vender posição fracionária até zero | `0.3 − 0.1 − 0.2` fica abaixo de zero em `Float`, e o último `SELL` recebe 400 | TD-001, TASK 4.5 |
| posição editada igual à sequência editada recalculada | a edição move a posição por incremento em ponto flutuante: `0.1 + 0.3` editado para `0.3 + 0.3` grava `0.6000000000000001` | TD-001, TASKs 4.6 e 4.7 |
| posição após exclusão igual às transações restantes recalculadas | a exclusão subtrai o impacto em ponto flutuante: `0.1 + 0.2` sem o `0.1` grava `0.20000000000000004` | baseline #16, TD-001, TASKs 4.6 e 4.8 |
| custo acima do maior número finito | `amount` e `price` não têm limite superior: `1e200 × 1e200` responde 201 e grava `Infinity` no `balance` | TD-009, TASK 4.5 |

**Recálculo como referência.** Os critérios das TASKs 4.7 e 4.8 comparam a posição com a que a sequência de transações produziria. Os testes gravam essa sequência, pela API, num segundo ativo da mesma carteira e comparam as duas posições, em vez de fixar o valor esperado. Assim, o teste continua valendo quando a posição passar a ser reconstruída a partir do razão (TASK 4.6). As sequências fracionárias foram escolhidas porque divergem na aritmética de `double` usada hoje, o que foi conferido antes de virarem teste.

**Pendências.** O que a task encontrou sem ser necessário para concluí-la está em [`TODO.md`](../TODO.md): TD-001 (tipo numérico), TD-002 (paginação da listagem de transações) e TD-009 (limite superior de `amount` e `price`).
