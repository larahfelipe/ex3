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

### TD-013 — Web opera só a carteira mais antiga

- **Origem:** várias carteiras por usuário · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a Overview e a tela de ativos pedem `GET /v1/portfolios` com `page=1&limit=1` (`usePrimaryPortfolio`) e usam essa carteira, a mais antiga, em todas as chamadas; o web não tem seletor nem criação de carteira. O diálogo de transação, a tabela de ativos e a Overview usam a `baseCurrency` dessa carteira; na tabela de ativos, só as colunas de preço, valor de mercado e lucro usam a moeda da cotação, e nas transações recentes da Overview o preço unitário usa a moeda da transação.
- **Impacto:** carteiras criadas pela API não aparecem no web, e quem tem mais de uma não vê o resumo nem registra ou consulta transações das demais pela interface.
- **Proposta:** seletor e criação de carteira no web, com a Overview, a tela de ativos e o diálogo de transação escopados pela carteira selecionada e rotulados na `baseCurrency` dela. `usePositions` mantém a página anterior enquanto a pedida carrega (`keepPreviousData`); com seletor, a troca de carteira exibiria por instantes as posições da anterior, então o placeholder deve valer só dentro da mesma carteira.

### TD-014 — Nome do usuário sem limite de tamanho

- **Origem:** revisão de segurança do sign-up com moeda base · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `name` é `z.string().optional()` em `CreateUserSchema` e `UpdateUserSchema`, sem `trim` nem máximo; o único teto é o limite do corpo JSON (`RequestLimits.JSON_BODY_SIZE`, 100 kB). O nome da carteira já usa `boundedTextSchema`.
- **Impacto:** cada conta grava um nome de até cerca de 100 kB, devolvido nas respostas que trazem o usuário, inclusive a listagem de admin (OWASP API4:2023). Nome só de espaços é aceito. Conta criada pela API sem nome recebe `name` `null`, que `SignInResponseData` no web declara como `string`, e o toast de sign-in mostra `Logged in as null`; o perfil de `GET /api/v1/user` já trata o `null`.
- **Proposta:** `boundedTextSchema` com máximo nomeado e documentado nos dois schemas. Decidir com o produto se o nome passa a ser obrigatório; enquanto for opcional, tipar `name` como `string | null` em `SignInResponseData`.

### TD-015 — Tamanho de página padrão repetido em cada repositório

- **Origem:** várias carteiras por usuário · **Tipo:** qualidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o `limit` padrão das listagens anteriores ao padrão de resposta (TD-021) é o literal `10` em `AssetRepository.getAll` e uma constante `DEFAULT_PAGE_LIMIT` local em `PortfolioRepository` e em `InstrumentRepository`. O teto de 100 e o `pageSize` padrão das listagens no padrão ficam em `PaginationQuerySchema`.
- **Impacto:** mudar o tamanho padrão exige tocar quatro arquivos, e o literal escapa de uma busca pela constante.
- **Proposta:** usar o padrão do schema nos três repositórios, junto com a migração de cada listagem em TD-021.

### TD-017 — API recusa os tipos de transação além de `BUY` e `SELL`

- **Origem:** remodelagem da transação · **Tipo:** domínio · **Prioridade:** média · **Encaminhamento:** `avulso` para os tipos que movem a posição, até a representação de cada um estar definida; TASK 10.1 para `DIVIDEND` e `INTEREST`
- **Contexto:** o enum `TransactionType` guarda os 11 tipos de `docs/domain-model.md`, mas `TransactionTypeSchema` aceita só `RecordableTransactionTypes` (`BUY` e `SELL`), e `rebuildPosition` (`backend/src/domain/PositionLedger.ts`) lança para qualquer outro tipo. O efeito de `DEPOSIT`, `WITHDRAWAL` e `ADJUSTMENT` está nas decisões em aberto do modelo de domínio, e `quantity` e `unitPrice` positivos obrigatórios não descrevem todos os tipos (um `SPLIT` tem fator, não preço).
- **Impacto:** proventos, desdobramentos, bonificações, transferências, aportes e ajustes não são registráveis; enviar um deles responde 400 sem gravar.
- **Proposta:** implementar em `rebuildPosition` o efeito de cada tipo definido no modelo de domínio, com a validação de campos própria do tipo e testes, e só então incluí-lo em `RecordableTransactionTypes`; decidir com o produto os tipos em aberto antes de aceitá-los.

### TD-018 — Formulário de transação do web sem taxas, impostos, corretora e notas

- **Origem:** remodelagem da transação · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** TASK 9.3
- **Contexto:** a API aceita `fees`, `taxes`, `broker` e `notes`, mas `web/src/app/(protected)/assets/_components/add-asset-transaction-dialog.tsx` envia só `type`, `quantity`, `unitPrice`, `executedAt` e a moeda base da carteira como `currency`. O web não edita nem exclui transação e não exibe `executedAt`.
- **Impacto:** transação criada pelo web grava taxas e impostos zero, e o custo médio omite a corretagem e os impostos que o usuário pagou até a transação ser editada pela API.
- **Proposta:** incluir os quatro campos no formulário, com os mesmos limites da API, junto com a edição e a exclusão de transação no web.

### TD-020 — Consumo da cota do provedor de cotação não medido

- **Origem:** integração com a YH Finance API · **Tipo:** integração · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a cota e o preço dos planos da YH Finance API não foram confirmados. O lote de 10 símbolos, o cache de 60 segundos, o timeout de 5 segundos e a pausa de 30 segundos depois de falha são assumidos, não medidos (`backend/src/infra/market-data/YahooFinanceProvider.ts`). Cache e pausa ficam na memória de cada processo, como o rate limit de TD-006. A visão geral da carteira consome a mesma cota com um par de câmbio por moeda estrangeira das posições, e a lista de posições cota, a cada página pedida, todas as posições com unidades, porque a alocação depende do total.
- **Impacto:** acima da cota, o provedor recusa as requisições e as cotações passam à última recebida ou a `unavailable` até a cota renovar. Com mais de uma instância do backend, cada uma consulta o provedor por conta própria e multiplica o consumo.
- **Proposta:** confirmar nos termos do plano contratado a cota, o limite por minuto e o máximo de símbolos por requisição; medir as requisições por carregamento da tela de ativos e ajustar as constantes; cache compartilhado quando houver mais de uma instância.

### TD-021 — Listagens anteriores ao padrão de resposta

- **Origem:** TASK 6.1 · **Tipo:** API · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `GET /v1/assets`, `GET /v1/portfolios` e `GET /v1/instruments` recebem `limit` e respondem a lista sob o nome da entidade, com `pagination: { page, limit, total, totalPages }`, fora do padrão de listagem paginada de `docs/api-inventory.md` (Padrão de resposta). O web consome as duas primeiras.
- **Impacto:** o cliente trata dois formatos de paginação, e trocar uma listagem antiga para o padrão quebra a tela que a consome.
- **Proposta:** migrar cada listagem ao padrão junto com a tela que a consome, ou removê-la quando a tela passar ao endpoint que a substitui; tratar TD-015 na mesma mudança.

### TD-022 — Indicadores da carteira sem variação cambial

- **Origem:** TASK 6.2 · **Tipo:** domínio · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `GET /v1/portfolio/overview` e `GET /v1/portfolio/positions` convertem preço, valor de mercado, custo e fechamento anterior pela taxa de câmbio mais recente (`backend/src/domain/PortfolioValuation.ts`). A transação não guarda a taxa da data da operação, e o fechamento anterior do par de câmbio não é usado.
- **Impacto:** com posições em moeda diferente da base, `profitLoss`, da carteira e de cada posição, não inclui o ganho ou a perda cambial desde a compra, e `dayChange` não inclui a variação do câmbio no dia; o `totalValue` de ontem somado ao `dayChange` não reproduz o de hoje quando o câmbio mudou.
- **Proposta:** decidir com o produto se os indicadores refletem o câmbio; se sim, gravar a taxa na transação ou obtê-la do histórico de preços, e usar o fechamento anterior do par na variação do dia.

### TD-023 — `QueryClient` do web compartilhado entre requisições no servidor

- **Origem:** TASK 7.3 · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `web/src/lib/react-query.ts` cria o `QueryClient` no escopo do módulo, e o `AppProvider`, componente cliente, também renderiza no servidor. Os hooks de domínio usam só `useQuery` e `useMutation`, que não buscam na renderização do servidor, e o isolamento entre usuários depende de o cache do navegador ser descartado no sign-in, no sign-up, no sign-out e no recarregamento após 401, porque as query keys não levam o usuário.
- **Impacto:** nenhum hoje. Se uma tela passar a buscar no servidor (`prefetchQuery`, `useSuspenseQuery` ou hidratação), o mesmo cache atende requisições de usuários diferentes, e dado de um usuário pode ser servido a outro.
- **Proposta:** criar um `QueryClient` por requisição no servidor e um único no navegador, como a documentação do TanStack Query orienta para o App Router, antes de a primeira busca no servidor entrar.

## Resolvidos

### TD-002 — Listagem de transações ignora `page` e não segue a ordem das operações

- **Tipo:** API · **Prioridade:** média
- **Resolução:** `GET /v1/transactions` substitui `GET /v1/transactions/:assetSymbol` no padrão de listagem paginada: `page` e `pageSize` deslocam a consulta com `skip` e `take`, sempre limitados, e a ordem é a inversa do razão, `executedAt` e depois `sequence`, do mais recente ao mais antigo. `lastId` e o ramo sem `take` saíram com a listagem antiga. A coluna de transações da tela de ativos, único consumidor, passou a usar `GET /v1/transactions/:assetSymbol/count`, que conta todas as transações do ativo, e não só as da primeira página. Ver `docs/api-inventory.md`, §Superado desde o snapshot, e `docs/testing.md`, §Listagem de transações.

### TD-019 — Nenhum provedor de cotação real

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** `YahooFinanceProvider`, em `backend/src/infra/market-data/YahooFinanceProvider.ts`, implementa `MarketDataProvider` sobre a YH Finance API, escolhida com o produto para B3, NYSE, NASDAQ e cripto, com histórico intradiário e diário. A chave fica em `YAHOO_FINANCE_API_KEY`, só no backend. O código do provedor é derivado de `market`, que o catálogo passou a restringir a esses mercados, e a resposta é validada antes de chegar ao domínio. `GET /v1/assets/valuations` expõe valor de mercado e lucro por ativo, e a tela de ativos os exibe. Ver `docs/domain-model.md`, §Fonte de cotação, e `docs/testing.md`, §Adaptador Yahoo Finance.

### TD-016 — Ordem do razão entre transações com o mesmo `executedAt` e `createdAt`

- **Tipo:** domínio · **Prioridade:** média
- **Resolução:** depois de `executedAt`, o razão é desempatado por `Transaction.sequence`, `BIGINT` único atribuído pelo banco na gravação, no lugar de `createdAt` e `id`. A migration `20260913000000_transaction_sequence` numerou as linhas existentes na ordem `createdAt`, `id`, que o razão seguia, sem mudar nenhuma posição. `rebuildPosition`, em `backend/src/domain/PositionLedger.ts`, ordena o razão que recebe. O teste "replays entries executed and created at the same instant in recording order, not id order" de `backend/src/routes/Transactions.integration.ts` fixa o desempate. Ver `docs/domain-model.md`, §Razão e posição.

### TD-001 — Valores financeiros em ponto flutuante

- **Tipo:** domínio · **Prioridade:** alta
- **Resolução:** quantidade, preço unitário, taxas e impostos da transação e `quantity`, `averageCost` e `balance` da posição são `DECIMAL(38,18)`; a reconstrução usa `Prisma.Decimal`, e a API recebe e devolve esses valores como string decimal. A migração converteu os `double` existentes pela menor representação decimal de cada um. O teste "sells a fractional position down to exactly zero" de `backend/src/routes/Transactions.integration.ts` deixou de ser `todo`. Ver `docs/domain-model.md`, §Valores, moedas e datas.

### TD-009 — `amount` e `price` de transação sem limite superior

- **Tipo:** segurança · **Prioridade:** alta
- **Resolução:** `decimalSchema` e `positiveDecimalSchema` limitam a entrada ao que `DECIMAL(38,18)` guarda sem arredondar, e a reconstrução recusa com 400 `POSITION_OUT_OF_RANGE`, sem gravar, o razão que passa por posição fora da coluna. O teste `todo` de overflow deu lugar aos testes do teto da coluna em `backend/src/routes/Transactions.integration.ts`.

### TD-003 — Exclusão de ativo sem teste com o mesmo símbolo em outra carteira

- **Tipo:** teste · **Prioridade:** média
- **Resolução:** com o catálogo de instrumentos, duas carteiras podem ter o mesmo instrumento. O teste "keeps the asset and transactions another portfolio holds in the same instrument" de `backend/src/routes/Assets.integration.ts` exclui o ativo de uma carteira e confirma que o ativo e as transações da outra ficam intactos.
