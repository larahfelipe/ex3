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

### TD-017 — API recusa desdobramento, transferências, aportes, retiradas e ajustes

- **Origem:** remodelagem da transação · **Tipo:** domínio · **Prioridade:** média · **Encaminhamento:** `avulso`, até a representação de cada tipo estar definida
- **Contexto:** o enum `TransactionType` guarda os 12 tipos de `docs/domain-model.md`, mas `TransactionTypeSchema` aceita só `RecordableTransactionTypes` (`BUY`, `SELL`, `DIVIDEND`, `JCP`, `INTEREST` e `BONUS`), e `rebuildPosition` (`backend/src/domain/PositionLedger.ts`) lança para `SPLIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `DEPOSIT`, `WITHDRAWAL` e `ADJUSTMENT`. O efeito de `DEPOSIT`, `WITHDRAWAL` e `ADJUSTMENT` está nas decisões em aberto do modelo de domínio, e `quantity` e `unitPrice` não descrevem os demais: um `SPLIT` tem fator, não preço, e uma transferência traz o custo de origem.
- **Impacto:** desdobramentos, grupamentos, transferências entre corretoras, aportes, retiradas e ajustes não são registráveis; enviar um deles responde 400 sem gravar.
- **Proposta:** implementar em `rebuildPosition` o efeito de cada tipo definido no modelo de domínio, com a validação de campos própria do tipo e testes, e só então incluí-lo em `RecordableTransactionTypes`; decidir com o produto os tipos em aberto antes de aceitá-los.

### TD-020 — Consumo da cota do provedor de cotação não medido

- **Origem:** integração com a YH Finance API · **Tipo:** integração · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a cota e o preço dos planos da YH Finance API não foram confirmados. O lote de 10 símbolos, o cache de 60 segundos, o timeout de 5 segundos e a pausa de 30 segundos depois de falha são assumidos, não medidos (`backend/src/infra/market-data/YahooFinanceProvider.ts`). Cache e pausa ficam na memória de cada processo, como o rate limit de TD-006. A visão geral da carteira consome a mesma cota com um par de câmbio por moeda estrangeira das posições, e a lista de posições cota, a cada página pedida, todas as posições com unidades, porque a alocação depende do total.
- **Impacto:** acima da cota, o provedor recusa as requisições e as cotações passam à última recebida ou a `unavailable` até a cota renovar. Com mais de uma instância do backend, cada uma consulta o provedor por conta própria e multiplica o consumo.
- **Proposta:** confirmar nos termos do plano contratado a cota, o limite por minuto e o máximo de símbolos por requisição; medir as requisições por carregamento da tela de ativos e ajustar as constantes; cache compartilhado quando houver mais de uma instância.

### TD-021 — Listagens anteriores ao padrão de resposta

- **Origem:** TASK 6.1 · **Tipo:** API · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `GET /v1/assets`, `GET /v1/portfolios` e `GET /v1/instruments` recebem `limit` e respondem a lista sob o nome da entidade, com `pagination: { page, limit, total, totalPages }`, fora do padrão de listagem paginada de `docs/api-inventory.md` (Padrão de resposta). O web consome só `GET /v1/portfolios` (ver TD-034).
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

### TD-024 — Seções da Overview sem sinal de dado desatualizado

- **Origem:** TASK 8.2 · **Tipo:** UX · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o `PortfolioValueCard` avisa quando a nova busca falha e o valor exibido é o do cache (`isRefetchError`). `QuerySection` mantém o dado em cache nesse caso também para as demais seções da Overview e para a performance e as transações do detalhe do ativo, mas essas seções não sinalizam (`web/src/components/query-section.tsx`).
- **Impacto:** depois de uma atualização que falha, ao voltar à Overview ou após registrar uma transação, o card aparece desatualizado e as demais seções mostram os valores anteriores como atuais.
- **Proposta:** levar o aviso de desatualizado, com a semântica do card, para `QuerySection` quando uma task dessas seções tratar os estados.

### TD-025 — Cores do gráfico de alocação fora dos tokens e repetidas acima de 10 grupos

- **Origem:** TASK 8.4 · **Tipo:** UX · **Prioridade:** baixa · **Encaminhamento:** TASK 12.1
- **Contexto:** `AllocationChart` (`web/src/app/(protected)/(overview)/_components/allocation-chart.tsx`) pinta o anel e a legenda com uma paleta local de 10 classes do Tailwind, a primeira `primary`, atribuída pela posição do grupo na lista. O tema não tem tokens de gráfico, e a alocação por ativo lista todas as posições com unidades, sem agrupar as menores.
- **Impacto:** a partir do 11º grupo as cores se repetem, e dois ativos de mesma cor no anel só se distinguem pela ordem; a legenda em tabela continua exata.
- **Proposta:** criar tokens de gráfico na consolidação de tokens e decidir com o produto se a alocação por ativo agrupa as menores posições num grupo "Other", calculado no domínio para o web não somar alocações.

### TD-026 — Cotações gravadas sem política de retenção

- **Origem:** TASK 5.2 · **Tipo:** dados · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `market_quotes` guarda um fechamento por instrumento, dia de negociação e fonte (`backend/src/infra/database/MarketQuoteRepository.ts`), preenchido por backfill sob demanda. Nada apaga linha antiga, e o catálogo de instrumentos não tem teto.
- **Impacto:** medido em 2026-09-16 com 100 mil linhas, a tabela custa 309 bytes por linha — 13 MB de heap e 17 MB de índices —, ou 76 kB por instrumento por ano de pregões, cerca de 740 MB para mil instrumentos em dez anos. A série é compartilhada entre usuários, então não cresce com a base: cresce com os instrumentos acompanhados e os períodos consultados. Não pesa na escala atual.
- **Proposta:** decidir com o produto o alcance máximo do histórico exibido e, a partir dele, se as linhas mais antigas são descartadas ou agregadas em fechamentos mensais. Revisto em 2026-09-16 à luz da medição, o desenho foi mantido sem retenção, e a política fica para quando o volume justificar.

### TD-027 — Fechamento corrigido pelo provedor não substitui o gravado

- **Origem:** TASK 5.2 · **Tipo:** dados · **Prioridade:** baixa · **Encaminhamento:** TASK 5.4
- **Contexto:** `recordDailyCloses` grava com `skipDuplicates`, então o dia já gravado por uma fonte mantém o preço primeiro observado (`backend/src/infra/database/MarketQuoteRepository.ts`). O provedor pode revisar um fechamento depois de publicá-lo.
- **Impacto:** série já coberta nunca incorpora correção do provedor, e as métricas de performance seguem o valor da primeira observação. Não há caminho para reprocessar um intervalo.
- **Proposta:** na task que orquestra o backfill, decidir se um intervalo pode ser reprocessado explicitamente, substituindo os fechamentos daquele intervalo, e sob qual gatilho.

### TD-028 — Série de preços não distingue a fonte

- **Origem:** TASK 5.4 · **Tipo:** dados · **Prioridade:** baixa · **Encaminhamento:** backlog
- **Contexto:** `MarketQuoteRepository.getDailyCloses` devolve os fechamentos de todas as fontes no intervalo, e `GetPriceHistoryService` repassa a série como veio; `ExchangeRateRepository.getDailyRates` faz o mesmo com o câmbio. O service não sabe qual provedor está em uso — `source` chega dentro de cada preço que a porta devolve —, e filtrar por fonte nessa camada vazaria a identidade do provedor para o domínio. Hoje só `yahoo-finance` grava.
- **Impacto:** com uma segunda fonte gravando, cada dia aparece duas vezes na série. A série de performance indexa os fechamentos por dia e fica com o último que a consulta devolveu para aquele dia, sem critério declarado entre as fontes.
- **Proposta:** decidir a precedência entre fontes — uma preferida, ou a mais recente por dia — e aplicá-la na consulta das duas tabelas, mantendo `source` em cada ponto do resultado.

### TD-030 — Retorno do benchmark na moeda dele, sem conversão para a base

- **Origem:** TASK 6.5 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** backlog
- **Contexto:** `GET /v1/portfolio/performance` normaliza a série da carteira por retorno ponderado no tempo na `baseCurrency`, e a do `benchmark` pelo primeiro fechamento da janela, na moeda em que ele é cotado. A carteira já incorpora a variação do câmbio de cada dia; o benchmark, não.
- **Impacto:** benchmark cotado em moeda diferente da base — `IVV` em USD numa carteira em BRL — compara retorno em USD com retorno em BRL, e a distância entre as duas linhas inclui a variação cambial do período, que não é desempenho de nenhum dos dois. Benchmark na moeda base não é afetado.
- **Proposta:** o gráfico de performance do web não pede `benchmark`, então nenhuma tela compara as duas linhas hoje e a distorção não tem superfície. Quando a comparação for oferecida, decidir com o produto se o benchmark é convertido para a moeda base dia a dia, pela série de câmbio que o endpoint já busca, ou se fica restrita a benchmark cotado na moeda base.

### TD-031 — Série de performance reconstrói o razão inteiro a cada dia da janela

- **Origem:** TASK 6.5 · **Tipo:** desempenho · **Prioridade:** baixa · **Encaminhamento:** backlog
- **Contexto:** `trackPortfolioPerformance` reconstrói cada posição a partir do razão em cada dia da janela, para que a série siga as mesmas regras de `rebuildPosition` e transação retroativa mova a série inteira. O custo é dias × posições × tamanho do razão, em memória, sem consulta por dia.
- **Impacto:** nenhum nas carteiras de hoje. Razão longo com janela `MAX` cresce quadraticamente no tamanho do razão, dentro de uma requisição síncrona.
- **Proposta:** medir antes de mudar. Se aparecer, percorrer o razão uma vez por posição, avançando a reconstrução de um dia para o seguinte em vez de refazê-la, sem alterar as regras do replay.

### TD-032 — Gráfico de performance sem janela do dia corrente

- **Origem:** TASK 8.3 · **Tipo:** produto · **Prioridade:** baixa · **Encaminhamento:** backlog
- **Contexto:** a série de `GET /v1/portfolio/performance` é feita de fechamentos diários gravados em `market_quotes`, uma linha por instrumento, dia e fonte. A cotação corrente é buscada no provedor a cada requisição e não vira série, então a menor janela do seletor é `1W`.
- **Impacto:** o gráfico não oferece uma janela do dia corrente. O movimento do dia continua disponível como número, em `dayChange` de `GET /v1/portfolio/overview`, sem curva.
- **Proposta:** decidir com o produto se a janela do dia justifica gravar cotações intradiárias em série, com a coleta periódica e a granularidade que isso exige, em vez de derivá-la das cotações avulsas que cada requisição busca.

### TD-033 — Suíte de integração falha de forma intermitente

- **Origem:** TASK 8.3 · **Tipo:** teste · **Prioridade:** média · **Encaminhamento:** backlog
- **Contexto:** numa execução, dois testes de `Transactions.integration.ts` falharam — o sign-in do harness respondeu `404` e uma contagem de posição veio `0` em vez de `1` —, e a execução seguinte passou 231 de 231 sem nenhuma mudança no código. Noutra, o teste de valores pequenos sem expoente do mesmo arquivo recebeu a transação sem os campos; o arquivo sozinho passou 51 de 51, e a suíte inteira, 234 de 234, na execução seguinte. A suíte roda um arquivo por vez (`--test-concurrency=1`), então a causa não é concorrência entre arquivos; as três falhas são de dado que o teste acabou de gravar e não encontrou, e o harness esvazia todas as tabelas no reset.
- **Impacto:** vermelho sem regressão, que só se distingue de defeito real reexecutando a suíte. Na CI, vira falha aleatória num merge legítimo.
- **Proposta:** reproduzir a falha repetindo a suíte e registrando o status e o corpo da resposta no teste que falha, para saber se o dado some depois de gravado — reset ou escrita pendente de um teste anterior — ou nunca é gravado; corrigir a causa encontrada, sem novas tentativas automáticas que a escondam.

### TD-034 — Listagem e avaliação de ativos sem consumidor no web

- **Origem:** TASK 9.1 · **Tipo:** API · **Prioridade:** baixa · **Encaminhamento:** TASK 20.1
- **Contexto:** a tabela de posições lê `GET /v1/portfolio/positions`, e os proxies `GET /api/v1/assets` e `/api/v1/assets/valuations` foram removidos com a tabela de ativos. `GET /v1/assets`, com a contagem de transações por ativo, e `GET /v1/assets/valuations` seguem no backend e nos testes de integração, sem consumidor no web. O detalhe do ativo também não os usa: lê `GET /v1/portfolio/positions/:symbol` e `GET /v1/transactions` com `symbol`. O mesmo vale para `GET /v1/asset/:symbol`, do qual o web só usa o `DELETE`.
- **Impacto:** superfície de API autenticada mantida, testada e documentada sem uso pelo produto; `GET /v1/assets` segue fora do padrão de listagem (TD-021).
- **Proposta:** remover do backend, com os testes e a documentação, os endpoints de leitura de ativo que nenhuma tela tiver passado a consumir, tratando TD-021 na mesma mudança.

### TD-035 — Detalhe do ativo sem proventos

- **Origem:** TASK 9.2 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** TASK 10.3
- **Contexto:** o detalhe do ativo, em `/assets/[symbol]`, tem visão geral, posição, performance e transações. A seção de proventos ficou fora por decisão de produto até existir o modelo de proventos. O modelo existe, com `DIVIDEND`, `JCP` e `INTEREST` registráveis como transação, mas nenhum endpoint consolida os proventos de um ativo.
- **Impacto:** o usuário não vê no ativo os proventos recebidos nem o rendimento deles sobre o custo.
- **Proposta:** acrescentar a seção de proventos ao detalhe do ativo quando o modelo e a API de proventos existirem, com o recorte por ativo que a API oferecer.

### TD-036 — Proxy do web responde 200 a erro que não vem da API

- **Origem:** gerenciador de transações · **Tipo:** API · **Prioridade:** baixa · **Encaminhamento:** backlog
- **Contexto:** os route handlers de `web/src/app/api/v1` tratam todo erro como `ApiProxyError` e repassam `status` e `statusText` dele. Um corpo que não é JSON faz `req.json()` lançar `SyntaxError`, sem esses campos, e o proxy responde `200` com `{}` sem chamar a API, em sign-in, sign-up, criação de ativo e criação e edição de transação.
- **Impacto:** nenhuma escrita acontece, mas quem chama o proxy fora do web recebe sucesso para uma requisição recusada. O web sempre envia JSON e não é afetado.
- **Proposta:** responder `400` quando o corpo não é JSON e `500` genérico a qualquer erro que não seja `ApiProxyError`, no ponto único que a consolidação do `try/catch` dos proxies criar.

### TD-037 — Tela de ativos aceita `action` desconhecido na URL

- **Origem:** gerenciador de transações · **Tipo:** UX · **Prioridade:** baixa · **Encaminhamento:** TASK 13.3
- **Contexto:** `web/src/app/(protected)/assets/page.tsx` lê `?action` sem validar o valor e marca um diálogo como aberto mesmo quando nenhum corresponde. Enquanto o parâmetro fica na URL, o efeito reabre esse estado a cada fechamento.
- **Impacto:** com um `action` desconhecido na URL, editado à mão, o botão "Add asset" alterna um estado sem diálogo e não abre o formulário até a URL ser limpa.
- **Proposta:** aceitar só os valores de `ASSET_DIALOG_ACTIONS`, e os que dependem de símbolo só com `symbol`, e limpar a URL do resto, junto com a troca de `replaceUrl` pelo router.

### TD-038 — Verde de compra e de ganho abaixo do contraste AA

- **Origem:** modelo de proventos · **Tipo:** acessibilidade · **Prioridade:** média · **Encaminhamento:** TASK 14.1
- **Contexto:** `text-green-600` do Tailwind 4 tem contraste de cerca de 3,2:1 sobre fundo branco, abaixo dos 4,5:1 que o WCAG 2.2 AA exige para texto no tamanho `text-sm`. Ele colore o tipo `BUY` em `TRANSACTION_TYPE_TONES` (`web/src/common/constants.ts`), na tabela e no diálogo de transações, e o valor positivo em `web/src/common/utils.ts`.
- **Impacto:** o tipo da compra e os ganhos ficam difíceis de ler com baixa visão ou tela sob luz forte.
- **Proposta:** trocar pelo tom verde que atinja 4,5:1 nos dois lugares, dentro da revisão de contraste dos tokens.

### TD-039 — Configuração de containers sem validação num runtime

- **Origem:** configuração Docker Compose · **Tipo:** tooling · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a máquina em que `compose.yaml`, os Dockerfiles e os `.dockerignore` foram escritos não tem runtime de containers. A validação cobriu os gates do backend, o parse do `compose.yaml` com checagem de dependências, perfis, volumes, portas e estágios, a instalação `--prod` numa cópia dos manifests dos dois pacotes, a resolução de todo import externo do `dist/` contra ela e o local do store do pnpm 11. Nenhuma imagem foi construída e nenhum serviço subiu.
- **Impacto:** um erro de build ou de runtime aparece só no primeiro `docker compose up` ou no próximo build do Cloud Build, que publica as imagens do `runner`.
- **Proposta:** num ambiente com Docker, antes da próxima publicação: `docker compose config`; `docker compose up --build` com volumes vazios; cadastro e login no web; `down` e `up` preservando os dados; `run --rm backend-check` e `web-check`; `docker build` dos dois `runner` (web com `--build-arg API_URL`), conferindo usuário `node`, tamanho com `docker image ls` e `docker stop` abaixo de 10 s; um segundo `up` sem rebuild nem download.

### TD-040 — Backend e web sem health check de container

- **Origem:** configuração Docker Compose · **Tipo:** tooling · **Prioridade:** baixa · **Encaminhamento:** TASK 18.3
- **Contexto:** nenhum dos dois expõe endpoint de saúde. No `compose.yaml`, o `web` espera o `backend` só iniciado, e os Dockerfiles não têm `HEALTHCHECK`.
- **Impacto:** a primeira requisição do web pode chegar antes de o backend ouvir, e um processo travado não é distinguido de um saudável.
- **Proposta:** com `/health` e `/ready`, declarar `healthcheck` nos serviços `backend` e `web` e trocar a dependência do `web` para `service_healthy`.

### TD-041 — Backend encerra sem drenar requisições

- **Origem:** configuração Docker Compose · **Tipo:** qualidade · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `Server.ts` não trata `SIGTERM`. Com `tini` como PID 1 na imagem, o sinal chega ao Node, que termina na hora: não há `server.close()` nem `$disconnect` do Prisma.
- **Impacto:** num deploy ou numa redução de instâncias, requisições em andamento são cortadas e podem falhar para o cliente.
- **Proposta:** tratar `SIGTERM` parando de aceitar conexões, esperando as abertas por um prazo menor que o do orquestrador e fechando o pool antes de sair.

### TD-042 — Ambiente novo sem catálogo nem forma de criar o primeiro administrador

- **Origem:** configuração Docker Compose · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** o catálogo de instrumentos começa vazio, só administrador cadastra instrumento, e nenhum endpoint ou script promove um usuário. Hoje o caminho é SQL manual (`docs/containers.md`, §Primeiro uso).
- **Impacto:** num banco novo não dá para adicionar ativo nem transação sem acessar o banco.
- **Proposta:** decidir entre um seed idempotente de desenvolvimento, com instrumentos de exemplo, e um comando administrativo que promova o primeiro usuário, e automatizar a escolha no `compose.yaml`.

### TD-043 — Imagem do web leva o `node_modules` de produção inteiro

- **Origem:** configuração Docker Compose · **Tipo:** desempenho · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o `runner` do web copia todas as dependências de produção e roda `next start`. O `output: 'standalone'` do Next copia só os arquivos rastreados pelo build e dispensa o resto, mas muda o comando de start e o que o script `start` do pacote executa.
- **Impacto:** imagem maior, com push, pull e cold start mais lentos no Cloud Run.
- **Proposta:** adotar `output: 'standalone'` junto com a validação do TD-039, conferindo o service worker do `next-pwa` e o `distDir: 'build'`.

### TD-044 — `backend/.env.test` sem `PORT`, `DIRECT_URL` e `YAHOO_FINANCE_API_KEY`

- **Origem:** primeira execução de `--profile check` com runtime de containers · **Tipo:** teste · **Prioridade:** alta · **Encaminhamento:** TD-039
- **Contexto:** `pnpm test:unit` e `pnpm test:integration` carregam `--env-file=.env.test`, e o arquivo versionado só traz `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRATION`, `BCRYPT_SALT` e `CORS_ALLOWED_ORIGINS`. `backend-check` não define `environment`, então nada supre o resto.
- **Impacto:** `backend-check` falha com `PORT: Too small: expected number to be >0` em `Envs.test.ts`, e caem também `Jwt.test.ts`, `AuthMiddleware.test.ts` e `YahooFinanceProvider.test.ts` — quatro arquivos. A suíte só passa em máquina que já tenha essas variáveis exportadas no shell, o que mascarava a lacuna antes do Compose.
- **Proposta:** completar `.env.test` com as chaves que o `EnvsSchema` exige, e cobrir o caso com o próprio `Envs.test.ts`, que hoje depende do ambiente para o cenário "starts up with a valid environment".

### TD-045 — Toda navegação RSC paga um 307 extra por causa da reescrita de headers no proxy

- **Origem:** investigação do redirecionamento pós-login · **Tipo:** desempenho · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `proxy.ts` devolve `NextResponse.next({ request: { headers } })` para injetar a CSP com nonce no request. Toda requisição com o header `RSC: 1` e sem o parâmetro `_rsc` esperado responde 307 para a mesma rota com `?_rsc=<hash>`; o cliente segue e recebe 200. Medido no container para `/` autenticado e `/sign-in` anônimo, sem relação com os ramos de autenticação.
- **Impacto:** cada `router.push` e cada prefetch custa uma viagem a mais ao servidor. Não quebra navegação, porque o browser segue o redirect.
- **Proposta:** avaliar passar o nonce por um header próprio já presente na resposta, ou restringir a reescrita de request às navegações de documento, medindo antes o ganho real.

### TD-046 — `next-themes` sem consumidor

- **Origem:** correção do contraste dos toasts · **Tipo:** qualidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o único importador era `web/src/components/ui/sonner.tsx`, um segundo `Toaster` que nunca foi montado e chamava `useTheme()` sem `ThemeProvider` na árvore. O arquivo saiu junto com a correção do contraste.
- **Impacto:** dependência paga no install e no lockfile sem nada que a use.
- **Proposta:** remover de `web/package.json` se o tema continuar fixo em `dark` pela classe do `<html>`.

### TD-047 — `POST /v1/user/create` envelopa o usuário e `POST /v1/user` devolve flat

- **Origem:** causa raiz do redirecionamento pós-cadastro · **Tipo:** API · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `CreateUserService.Result` é `{ user, message }`, enquanto `GetUserService.Result` é o usuário com `accessToken` no topo. O route handler do web tratava as duas como flat, e por isso o cadastro não gravava cookie de sessão nem lia o nome; corrigido do lado do web, o backend segue inconsistente.
- **Impacto:** dois formatos de sucesso para o mesmo recurso, e qualquer novo consumidor repete o erro.
- **Proposta:** decidir um envelope de sucesso único junto da convenção já documentada para erro e para listagem paginada, e registrar em `docs/api-inventory.md`.

### TD-048 — Paleta clara dos tokens semânticos sem cobertura em runtime

- **Origem:** TASK 12.1 · **Tipo:** qualidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `globals.css` define os dois temas, mas `<html>` fixa `className="dark"` e nada alterna. Os valores de `:root` para `surface`, `positive`, `negative`, `warning`, `info`, `focus` e `chart-1..10` foram escolhidos com contraste calculado sobre fundo branco, sem nunca terem sido renderizados.
- **Impacto:** se o seletor de tema entrar depois, a paleta clara chega sem validação visual e sem auditoria de contraste real.
- **Proposta:** validar junto da TASK 14.7, ou remover o bloco `:root` se o produto assumir tema escuro único — decisão ligada ao TD-046.

### TD-049 — Arquitetura de navegação sem as seções de produto previstas

- **Origem:** TASK 13.1 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a navegação desenhada prevê Portfolio, Income, Analytics, Performance, Allocation, Risk, Market, Watchlist e Settings, mas o app só expõe `/`, `/assets`, `/assets/[symbol]` e `/account`. Income e as métricas de risco dependem de tasks ainda não implementadas, e Market, Watchlist e Settings não têm rota nem endpoint em lugar nenhum.
- **Impacto:** publicar os itens agora criaria links mortos e quebraria o critério de rotas acessíveis; manter a lista curta adia a hierarquia de dois níveis.
- **Proposta:** promover o grupo Portfolio e os demais itens conforme cada rota nascer, reaproveitando `MAIN_SECTIONS` em `sidebar.tsx`, que já é a única fonte da estrutura.

### TD-050 — Período do gráfico e página das transações continuam fora da URL

- **Origem:** TASK 13.3 · **Tipo:** UX · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** a listagem de posições passou a derivar busca, filtros, ordenação e paginação da query string, mas o seletor de período de `performance-chart.tsx` e a página de `asset-transactions.tsx` seguem em `useState`, então um refresh ou um link compartilhado volta para `1Y` e para a primeira página.
- **Impacto:** é estado de visualização secundário — nenhum filtro de dados se perde —, mas quebra a expectativa de link profundo no detalhe do ativo e no overview.
- **Proposta:** reaproveitar `updateUrlQuery` com um parâmetro `range` por rota e um `transactionsPage`, checando antes se `/` precisa de `Suspense` ao passar a ler `useSearchParams`.

### TD-052 — Excluir o último item de uma lista deixa o foco no `body`

- **Origem:** TASK 14.4 · **Tipo:** acessibilidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** ao excluir uma transação, `transactions-table.tsx` devolve o foco para a primeira linha restante. Quando era a última, o pai troca a tabela inteira pelo `EmptyState` e o componente que devolveria o foco desmonta junto — o mesmo vale para a última posição excluída, já que o `EmptyState` não tem elemento focável.
- **Impacto:** o próximo `Tab` recomeça do topo do documento; nenhum conteúdo fica inacessível.
- **Proposta:** dar ao `EmptyState` um destino de foco — cabeçalho da seção com `tabIndex={-1}` ou a própria ação do estado vazio — e apontar os fluxos de exclusão para ele.

### TD-053 — Seis pares de token reprovam no contraste exigido

- **Origem:** TASK 14.5 · **Tipo:** acessibilidade · **Prioridade:** alta · **Encaminhamento:** avulso
- **Contexto:** a medição dos tokens de `globals.css` está em `docs/accessibility.md`, §Contraste medido. Na paleta escura, a única com consumidor em runtime, reprovam `--destructive` como texto (2,01:1), `--primary-foreground` sobre `--primary` (3,49:1, o rótulo de todo botão primário) e `--border`/`--input` sobre `--background` (1,33:1, única pista visual da borda do campo). Na paleta clara, latente até TD-048, reprovam ainda `--destructive-foreground` sobre `--destructive` (3,60:1), `--muted-foreground` sobre `--muted` (4,39:1) e `--warning` sobre `bg-warning/10` (4,40:1). As mensagens de erro já saíram de `--destructive` para `--negative`, medido em 4,80:1 e 7,31:1.
- **Impacto:** 1.4.3 e 1.4.11 falham no caminho principal — o rótulo do botão que confirma cada ação e a borda que identifica cada campo —, e a ação destrutiva é o texto menos legível da interface justamente onde o engano é irreversível.
- **Proposta:** escolher os novos valores no próprio `globals.css`, um token por par reprovado, e repetir a medição; trocar a classe em cada uso espalharia a decisão sem corrigir a origem.

### TD-054 — Auditoria automatizada de acessibilidade nunca foi executada

- **Origem:** TASK 14.7 · **Tipo:** acessibilidade · **Prioridade:** alta · **Encaminhamento:** avulso
- **Contexto:** o ambiente da implementação não tem navegador nem permissão de rede para instalar Playwright, `@axe-core/playwright` ou `lighthouse`, então a varredura com axe, a medição do Lighthouse e os testes E2E de teclado da TASK 14.7 ficaram sem executar. O procedimento — páginas, estados de runtime, limiares e o que a ferramenta não decide — está em `docs/accessibility.md`, §Auditoria automatizada.
- **Impacto:** os dois critérios numéricos da TASK 14.7, zero violação crítica e Lighthouse ≥ 95, seguem não verificados; o que garante a acessibilidade hoje é `jsx-a11y` no `lint`, a composição dos componentes de estado e o roteiro manual.
- **Proposta:** instalar as três dependências fixadas por versão no `web`, subir a stack de `compose.yaml` com um usuário semeado para as rotas protegidas e rodar o procedimento documentado; a FASE 17 reaproveita o mesmo harness para os E2E de produto.

## Resolvidos

### TD-051 — Rolagem horizontal das tabelas não alcança o teclado

- **Tipo:** acessibilidade · **Prioridade:** média
- **Resolução:** o `div` de `components/ui/table.tsx` virou um `section` que observa a própria caixa e a da tabela com `ResizeObserver`: enquanto transborda em qualquer eixo, recebe `tabIndex={0}` e o nome obrigatório da prop `label`; quando cabe, não é nome nem parada de teclado. Os cinco usos passaram a nomear a região, e o `section` manual da tabela de performance saiu, substituído pelo do primitive com `regionClassName`. A tabela de posições também deixou de depender só da rolagem: abaixo de `sm` ficam ativo, valor e ações, com o resultado repetido sob o símbolo, e as seis colunas secundárias seguem no detalhe do ativo. Ver `docs/responsiveness.md`, §Comportamento por largura.

### TD-018 — Formulário de transação do web sem taxas, impostos, corretora e notas

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** `TransactionFormDialog` cria e edita transação com tipo, quantidade, preço unitário, taxas, impostos, data de execução, corretora e notas, validados com os limites da API; taxas e impostos em branco valem zero, e corretora e notas em branco, `null`. A criação parte do detalhe do ativo e do menu da tabela de posições; a edição e a exclusão, do diálogo de detalhes da transação, no detalhe do ativo e na Overview, pelos proxies `PATCH` e `DELETE` de `/api/v1/transactions/[id]`. A exclusão pede confirmação, o backend reconstrói a posição, e o erro da API aparece no diálogo sem perder o que foi digitado. `executedAt` já aparecia na tabela e no diálogo de detalhes. Ver `docs/component-inventory.md`, §Componentes compartilhados, e `docs/api-inventory.md`, §Superado desde o snapshot.

### TD-029 — Custo e preço médio da tabela de ativos sem conversão de moeda

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** a tabela de posições substituiu a de ativos e lê `GET /v1/portfolio/positions`, que entrega preço médio, preço, valor, alocação e resultado convertidos para a `baseCurrency` da carteira, a moeda com que as colunas são formatadas. A coluna de valor investido e o total do rodapé saíram com a tabela antiga, então nenhuma linha é rotulada com moeda diferente da do valor. Ver `docs/domain-model.md`, §Posições da carteira, e `docs/component-inventory.md`, §Feature components.

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
