# TODO

Backlog de pendências técnicas e de produto encontradas durante a execução do [`PLAN.md`](PLAN.md). Entra aqui o que não é necessário para concluir a task em que foi encontrado. O que é crítico, bloqueante ou exigido pelos critérios da task corrente é corrigido na própria task.

## Convenções

- **Id** `TD-NNN`, sequencial e nunca reutilizado.
- **Origem:** task ou documento em que o item foi encontrado.
- **Encaminhamento:** task do `PLAN.md` que absorve o item, ou `avulso` quando nenhuma cobre.
- **Prioridade:** `alta` para risco de segurança ou de integridade de dados; `média` para comportamento incorreto ou contrato inconsistente; `baixa` para qualidade, tooling ou documentação.
- Detalhe já documentado em `docs/` é referenciado, não repetido.
- Item resolvido sai de **Abertos** e vai para **Resolvidos**, com a referência de onde foi tratado.

## Abertos

### TD-002 — Listagem de transações ignora `page` e não segue a ordem das operações

- **Origem:** TASK 3.4 · **Tipo:** API · **Prioridade:** média · **Encaminhamento:** TASK 6.4
- **Contexto:** `TransactionRepository.getAll` ordena por `id desc` e pagina pelo cursor `id < lastId`, mas o `id` é UUID v4 (`@default(uuid())`), aleatório. `page` é devolvido na resposta sem deslocar a consulta, e `lastId` só passa por `trim`, sem validação de formato. O ramo `limit === 0`, que omite o `take`, é inalcançável hoje porque `PaginationQuerySchema` exige `limit` positivo.
- **Impacto:** a ordem da listagem não corresponde à ordem das operações, e `page=2` sem `lastId` repete a primeira página. O ramo sem `take` volta a permitir listagem ilimitada (OWASP API4:2023) se o schema for relaxado.
- **Proposta:** ordenar na ordem do razão (`executedAt`, `createdAt`, `id`); adotar um único mecanismo de paginação (cursor opaco validado, ou `page`/`limit` com `skip`); remover o ramo sem `take`.

### TD-004 — Enumeração de e-mails no sign-up (risco aceito)

- **Origem:** revisão de segurança posterior à TASK 3.3 · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** TASK 20.4
- **Contexto:** `POST /v1/user/create` responde `User already exists` para e-mail cadastrado. Mantido como risco aceito em 2026-09-11; detalhes em `docs/authentication.md`, limitação 2.
- **Impacto:** permite descobrir se um e-mail tem conta, na vazão que o rate limit por IP deixa passar.
- **Proposta:** reavaliar quando o produto tiver confirmação de e-mail, que permite responder igual para e-mail novo e existente.

### TD-005 — Senha nova não é comparada a senhas vazadas nem normalizada

- **Origem:** `docs/authentication.md`, limitações 3 e 4 · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** TASK 20.4
- **Contexto:** o NIST SP 800-63B-4 pede recusar senhas presentes em listas de senhas comprometidas e normalizar Unicode antes do hash. Nenhum dos dois é feito.
- **Impacto:** senhas conhecidas de vazamentos são aceitas, e a mesma senha digitada com outra composição Unicode não confere.
- **Proposta:** tratar os dois juntos. Normalizar muda o valor verificado de contas existentes, então exige migração no login bem-sucedido (verificar com o valor bruto e regravar o hash normalizado). A checagem de vazamento depende de fonte externa, como a API de k-anonymity do Have I Been Pwned, ou de lista local.

### TD-006 — Rate limit em memória de processo e só por IP

- **Origem:** `docs/authentication.md`, limitação 5 · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** TASK 20.4
- **Contexto:** os contadores do `express-rate-limit` ficam na memória de cada processo (`docs/testing.md`), e a chave é o IP do cliente.
- **Impacto:** com mais de uma instância do backend, cada uma aplica o budget inteiro; um ataque distribuído entre IPs não esbarra no limite.
- **Proposta:** store compartilhado entre instâncias e limite adicional por conta no sign-in.

### TD-007 — `style-src 'unsafe-inline'` na CSP do web

- **Origem:** correções posteriores à TASK 3.3 (CSP com nonce) · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** TASK 12.1
- **Contexto:** o HTML renderizado traz atributos `style`, que nonce não autoriza; detalhes em `docs/authentication.md`, limitação 7.
- **Impacto:** onde houver injeção de marcação, CSS injetado pode alterar a interface, sem executar script.
- **Proposta:** ao consolidar os tokens, trocar atributos `style` por classes, verificar os que chegam no HTML do servidor (inclusive os de dependências de UI) e remover `'unsafe-inline'` de `style-src` quando não restar nenhum.

### TD-008 — `web/src/app/globals.css` fora da formatação do Prettier

- **Origem:** validação das correções posteriores à TASK 3.3 · **Tipo:** tooling · **Prioridade:** baixa · **Encaminhamento:** TASK 12.1
- **Contexto:** `prettier --check src` no web aponta `src/app/globals.css`, mas o script `prettier` do projeto verifica só `src/**/*.{ts,tsx}`, então nem o script nem o CI detectam.
- **Impacto:** divergência de formatação em CSS passa despercebida.
- **Proposta:** formatar o arquivo e incluir `css` no glob do script.

### TD-010 — Catálogo de instrumentos sem cadastro pelo web

- **Origem:** catálogo de instrumentos, `docs/domain-model.md` · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** só admin escreve no catálogo, e só pela API (`POST /v1/instrument`, `PATCH /v1/instrument/:symbol`). O web não tem tela de administração nem seleção de instrumento, `GET /v1/instruments` não busca por símbolo ou nome, e não há carga de instrumentos além da migração, que criou os dos ativos existentes com `name` igual ao símbolo, tipo `OTHER` e sem `market` e `currency`.
- **Impacto:** adicionar ativo de símbolo que ainda não está no catálogo responde `404 Instrument not found in catalog`, e o usuário depende de um admin chamar a API. Os instrumentos migrados não têm moeda de cotação, que valuation e consolidação por moeda exigem.
- **Proposta:** busca no catálogo pela API, seleção do instrumento no cadastro de ativo e tela de administração no web, com a permissão de admin verificada pela API; completar os instrumentos migrados antes de qualquer cálculo que dependa de `currency`.

### TD-011 — Criação de carteiras sem limite por usuário

- **Origem:** várias carteiras por usuário · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `POST /v1/portfolio` exige só autenticação: não há teto de carteiras por usuário nem rate limit na rota. A listagem é paginada com `limit` até 100, então o custo de cada leitura não cresce com o total. A criação de transações tem a mesma ausência de teto, anterior às várias carteiras, e cada escrita de transação relê e percorre todas as transações da posição.
- **Impacto:** um usuário autenticado cria carteiras sem limite e faz a tabela `portfolios` crescer na vazão que a API aceitar (OWASP API4:2023). O custo de cada escrita de transação cresce linearmente com o razão da posição, sem alcançar posições de outras carteiras. O teto é decisão de produto e não foi fixado por conveniência da implementação.
- **Proposta:** definir com o produto o número máximo de carteiras por usuário, recusar a criação acima dele sem gravar e aplicar um rate limit às rotas de escrita.

### TD-012 — Carteira não pode ser renomeada nem excluída

- **Origem:** várias carteiras por usuário · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a API cria, lista e busca carteiras (`POST /v1/portfolio`, `GET /v1/portfolios`, `GET /v1/portfolio`), sem rota de edição nem de exclusão. Uma carteira só sai do banco com a exclusão da conta.
- **Impacto:** carteira criada por engano, com nome errado ou na moeda errada fica na conta, e a criação sem limite (TD-011) agrava o acúmulo.
- **Proposta:** edição de `name` e exclusão que remove ativos e transações da carteira numa transação serializável, como a exclusão de ativo. Decidir com o produto se `baseCurrency` pode mudar depois que a carteira tem transações e se a última carteira do usuário pode ser excluída.

### TD-013 — Web opera só a carteira mais antiga e ignora a moeda base

- **Origem:** várias carteiras por usuário · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a tela de ativos pede `GET /v1/portfolios` com `page=1&limit=1` e usa essa carteira, a mais antiga, em todas as chamadas; o web não tem seletor nem criação de carteira. O diálogo de transação envia e rotula o preço na `baseCurrency` da carteira, mas a tabela de ativos formata os valores com a moeda de `useUser` (`web/src/providers/user-provider.tsx`), que começa em BRL e muda pelo seletor da tabela, sem relação com `Portfolio.baseCurrency` e sem conversão.
- **Impacto:** carteiras criadas pela API não aparecem no web. Quem escolhe USD ou EUR no sign-up registra transações nessa moeda, mas vê os valores da tabela rotulados em BRL até trocar o seletor, e trocar o seletor só muda o símbolo exibido.
- **Proposta:** seletor e criação de carteira no web, com o rótulo inicial vindo da `baseCurrency` da carteira selecionada. Decidir com o produto se o seletor de moeda continua existindo enquanto não houver conversão cambial.

### TD-014 — Nome do usuário sem limite de tamanho

- **Origem:** revisão de segurança do sign-up com moeda base · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `name` é `z.string().optional()` em `CreateUserSchema` e `UpdateUserSchema`, sem `trim` nem máximo; o único teto é o limite do corpo JSON (`RequestLimits.JSON_BODY_SIZE`, 100 kB). O nome da carteira já usa `boundedTextSchema`.
- **Impacto:** cada conta grava um nome de até cerca de 100 kB, devolvido nas respostas que trazem o usuário, inclusive a listagem de admin (OWASP API4:2023). Nome só de espaços é aceito.
- **Proposta:** `boundedTextSchema` com máximo nomeado e documentado nos dois schemas, mantendo o campo opcional.

### TD-015 — Tamanho de página padrão repetido em cada repositório

- **Origem:** várias carteiras por usuário · **Tipo:** qualidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o `limit` padrão é o literal `10` em `AssetRepository.getAll` e `TransactionRepository.getAll`, e uma constante `DEFAULT_PAGE_LIMIT` local em `PortfolioRepository` e em `InstrumentRepository`. O teto de 100 fica em `PaginationQuerySchema`.
- **Impacto:** mudar o tamanho padrão exige tocar quatro arquivos, e os literais escapam de uma busca pela constante.
- **Proposta:** uma constante de paginação compartilhada, junto do teto do schema, usada pelos quatro repositórios.

### TD-016 — Ordem do razão entre transações com o mesmo `executedAt` e `createdAt`

- **Origem:** posição reconstruída do razão · **Tipo:** domínio · **Prioridade:** média · **Encaminhamento:** TASK 4.6
- **Contexto:** o razão é percorrido em ordem `executedAt`, depois `createdAt`, depois `id`. `executedAt` é informado por quem registra e pode se repetir entre operações; `createdAt` tem resolução de milissegundo e `id` é UUID v4, aleatório. Duas transações da mesma posição com o mesmo `executedAt`, gravadas no mesmo milissegundo, ficam na ordem dos ids, não na de gravação. A criação confere o razão com a linha nova depois das que têm `executedAt` igual ou anterior, onde o `createdAt` dela normalmente a coloca.
- **Impacto:** exige duas escritas na mesma posição, com o mesmo `executedAt`, no mesmo milissegundo. Quando acontece, a ordem conferida na criação pode não ser a da reconstrução seguinte: uma edição ou exclusão posterior pode ser recusada por um `SELL` que passou a vir antes da compra que o cobria, e a próxima escrita na posição pode gravar outro custo médio para as mesmas linhas. As migrações da posição e da transação percorrem o razão em `createdAt`, `id`. Os testes de ordem de `backend/src/routes/Transactions.integration.ts` gravam por requisições sequenciais e contam com milissegundos distintos.
- **Proposta:** desempatar por um número de sequência monotônico atribuído pelo banco na gravação, no lugar do `id`, com uma migração que numera as linhas existentes na ordem atual.

### TD-017 — API recusa os tipos de transação além de `BUY` e `SELL`

- **Origem:** remodelagem da transação · **Tipo:** domínio · **Prioridade:** média · **Encaminhamento:** TASK 4.6 para os tipos que movem a posição; TASK 10.1 para `DIVIDEND` e `INTEREST`
- **Contexto:** o enum `TransactionType` guarda os 11 tipos de `docs/domain-model.md`, mas `TransactionTypeSchema` aceita só `RecordableTransactionTypes` (`BUY` e `SELL`), e `replayLedger` lança para qualquer outro tipo. O efeito de `DEPOSIT`, `WITHDRAWAL` e `ADJUSTMENT` está nas decisões em aberto do modelo de domínio, e `quantity` e `unitPrice` positivos obrigatórios não descrevem todos os tipos (um `SPLIT` tem fator, não preço).
- **Impacto:** proventos, desdobramentos, bonificações, transferências, aportes e ajustes não são registráveis; enviar um deles responde 400 sem gravar.
- **Proposta:** implementar em `replayLedger` o efeito de cada tipo definido no modelo de domínio, com a validação de campos própria do tipo e testes, e só então incluí-lo em `RecordableTransactionTypes`; decidir com o produto os tipos em aberto antes de aceitá-los.

### TD-018 — Formulário de transação do web sem taxas, impostos, corretora e notas

- **Origem:** remodelagem da transação · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** TASK 9.3
- **Contexto:** a API aceita `fees`, `taxes`, `broker` e `notes`, mas `web/src/app/(protected)/assets/_components/add-asset-transaction-dialog.tsx` envia só `type`, `quantity`, `unitPrice`, `executedAt` e a moeda base da carteira como `currency`. O web não edita nem exclui transação e não exibe `executedAt`.
- **Impacto:** transação criada pelo web grava taxas e impostos zero, e o custo médio omite a corretagem e os impostos que o usuário pagou até a transação ser editada pela API.
- **Proposta:** incluir os quatro campos no formulário, com os mesmos limites da API, junto com a edição e a exclusão de transação no web.

## Resolvidos

### TD-001 — Valores financeiros em ponto flutuante

- **Tipo:** domínio · **Prioridade:** alta
- **Resolução:** quantidade, preço unitário, taxas e impostos da transação e `quantity`, `averageCost` e `balance` da posição são `DECIMAL(38,18)`; a reconstrução usa `Prisma.Decimal`, e a API recebe e devolve esses valores como string decimal. A migração converteu os `double` existentes pela menor representação decimal de cada um. O teste "sells a fractional position down to exactly zero" de `backend/src/routes/Transactions.integration.ts` deixou de ser `todo`. Ver `docs/domain-model.md`, §Valores, moedas e datas.

### TD-009 — `amount` e `price` de transação sem limite superior

- **Tipo:** segurança · **Prioridade:** alta
- **Resolução:** `decimalSchema` e `positiveDecimalSchema` limitam a entrada ao que `DECIMAL(38,18)` guarda sem arredondar, e a reconstrução recusa com 400 `POSITION_OUT_OF_RANGE`, sem gravar, o razão que passa por posição fora da coluna. O teste `todo` de overflow deu lugar aos testes do teto da coluna em `backend/src/routes/Transactions.integration.ts`.

### TD-003 — Exclusão de ativo sem teste com o mesmo símbolo em outra carteira

- **Tipo:** teste · **Prioridade:** média
- **Resolução:** com o catálogo de instrumentos, duas carteiras podem ter o mesmo instrumento. O teste "keeps the asset and transactions another portfolio holds in the same instrument" de `backend/src/routes/Assets.integration.ts` exclui o ativo de uma carteira e confirma que o ativo e as transações da outra ficam intactos.
