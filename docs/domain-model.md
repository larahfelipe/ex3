# Modelo de domínio

Contrato conceitual do domínio de investimentos: o que cada entidade representa, quem é dono dela, de onde vêm os seus valores e o que ela não é. O schema Prisma, os services e a API seguem este documento; divergência entre eles e o documento é defeito de um dos lados e se resolve explicitamente.

## Entidades

```text
User
 └── Portfolio ─┬── Transaction ──► Instrument ◄── MarketQuote
                └── Position ─────► Instrument
```

| Entidade | Responsabilidade | Dono | Identidade |
| --- | --- | --- | --- |
| `User` | Identidade, credenciais e sessão. | — | `id`; `email` único |
| `Portfolio` | Agrupa o razão e as posições de um usuário sob uma moeda base. É a fronteira de acesso: todo recurso financeiro é resolvido pela carteira do usuário autenticado. | um `User`, que pode ter várias | `id` |
| `Instrument` | O ativo de mercado negociável: ação, ETF, fundo, FII, cripto, título, caixa. Catálogo global, compartilhado por todos os usuários. | — | `symbol`, único no catálogo |
| `Transaction` | Um evento financeiro de uma carteira sobre um instrumento. Fonte de verdade de toda movimentação. | um `Portfolio` | `id` |
| `Position` | Quanto uma carteira detém de um instrumento e a que custo. Projeção derivada das transações, nunca editada diretamente. | um `Portfolio` | `(portfolioId, instrumentId)` |
| `MarketQuote` | O fechamento de um dia de negociação de um instrumento, com moeda e fonte. | — | `(instrumentId, timestamp, source)`, com `timestamp` no início do dia em UTC |

## Catálogo de instrumentos

`Instrument` é compartilhado por todas as carteiras e não pertence a nenhum usuário: excluir a conta de quem detém um instrumento mantém o instrumento.

| Campo | Regra |
| --- | --- |
| `symbol` | identidade, única no catálogo e nunca alterada; símbolo novo aceita só letras e dígitos, até 6 caracteres |
| `name` | até 120 caracteres |
| `type` | `STOCK`, `ETF`, `FUND`, `REIT`, `CRYPTO`, `BOND`, `TREASURY`, `CASH` ou `OTHER` |
| `market` | mercado de negociação: `B3`, `NYSE`, `NASDAQ` ou `CRYPTO`, os que o provedor de cotação precifica |
| `currency` | moeda de cotação, código ISO 4217 |
| `sector` | opcional, até 60 caracteres |
| `country` | opcional, código de duas letras |

**Quem escreve.** Só admin cadastra e corrige instrumentos; os demais usuários escolhem do catálogo, e a escrita deles recebe 403. Qualquer usuário autenticado lista o catálogo. Abrir ou renomear um ativo para símbolo fora do catálogo responde 404 até um admin cadastrá-lo.

**Posição por instrumento.** Uma carteira tem no máximo uma posição por instrumento, e várias carteiras podem ter posição no mesmo instrumento. Transações referenciam a carteira e o instrumento.

**Dados anteriores ao catálogo.** A migração criou um instrumento por símbolo existente, com `name` igual ao símbolo, tipo `OTHER` e os demais campos vazios. Por isso `market` e `currency` são opcionais no banco, embora obrigatórios no cadastro, e cabe a um admin completar esses instrumentos antes de qualquer cálculo que dependa da moeda. Símbolos gravados antes da allowlist (ex.: `BRK.B`) continuam no catálogo e nas carteiras que os tinham, mas não podem ser abertos em outra carteira nem cadastrados de novo. A migração aborta sem alterar nada se existir transação sem o ativo correspondente.

## Transação

Toda transação pertence a uma carteira e referencia um instrumento; a posição que ela move é a de `(portfolioId, instrumentId)`.

| Campo | Regra |
| --- | --- |
| `type` | um dos tipos de [Efeito de cada tipo](#efeito-de-cada-tipo) |
| `quantity`, `unitPrice` | decimais positivos, gravados separados |
| `fees`, `taxes` | decimais não negativos; zero quando não informados |
| `currency` | moeda da operação, código ISO 4217 |
| `executedAt` | quando a operação aconteceu, com fuso; obrigatório e independente de `createdAt` |
| `broker` | opcional, até 60 caracteres |
| `notes` | opcional, até 500 caracteres |

**Uma moeda por posição.** A moeda da transação não precisa ser a moeda base da carteira, mas todas as transações de uma posição usam a mesma, porque o custo médio só soma valores na mesma moeda. Transação em outra moeda é recusada sem gravar nada.

**Dados anteriores à transação.** A migração renomeou `amount` e `price` para `quantity` e `unitPrice` e converteu cada `double` pela menor representação decimal que o reproduz, que é o valor que a API devolvia. As linhas existentes receberam `fees` e `taxes` zero, `currency` igual à moeda base da carteira e `executedAt = createdAt`, e as posições foram reconstruídas em aritmética decimal. Ela aborta sem alterar nada se existir transação com tipo fora da lista, sem carteira, ou com `amount` ou `price` não positivo ou que `DECIMAL(38,18)` não guarda sem arredondar; ou se algum razão vende mais do que detém, contém tipo que a reconstrução não implementa ou passa por posição fora de `DECIMAL(38,18)`.

## Razão e posição

A posição é função das transações da carteira naquele instrumento, e só delas: a mesma sequência de transações produz sempre a mesma `quantity`, o mesmo `averageCost` e o mesmo `investedValue`. Criar, editar ou excluir uma transação reconstrói a posição e grava as duas numa única transação de banco.

A ordem do razão é `executedAt`, depois a ordem de gravação, o `sequence` que o banco atribui a cada transação. A transação ainda não gravada entra depois das gravadas com o mesmo `executedAt`. A reconstrução ordena o razão que recebe, então a ordem em que as transações chegam a ela não altera o resultado.

**Dados anteriores à posição.** A migração que renomeou `assets` para `positions` reconstruiu `quantity`, `averageCost` e `balance` de cada posição a partir das suas transações, na ordem `createdAt`, `id`, e substituiu o valor gravado quando divergia. Ela aborta sem alterar nada se o razão de alguma posição vende mais do que detém. A migração que criou `sequence` numerou as transações existentes na ordem `createdAt`, `id`, a mesma que o razão seguia até então, e nenhuma posição mudou. A migração que criou `investedValue` renomeou `balance` e gravou em cada posição `quantity × averageCost`, truncado em 18 casas; ela aborta sem alterar nada se algum desses produtos não cabe em `DECIMAL(38,18)`.

### Custo

* `investedValue = quantity × averageCost`, o custo das unidades detidas, gravado na posição pela reconstrução junto com `quantity` e `averageCost`. O valor recebido numa venda não entra nele.
* **Custo médio ponderado.** A compra soma à quantidade e ao custo total (`quantity × unitPrice + fees + taxes`). A venda reduz a quantidade e retira do custo total `quantity × averageCost`, sem alterar o custo médio; a diferença entre o líquido da venda e esse custo é lucro realizado.
* O método é o da apuração de ganho de capital em renda variável no Brasil e é o único compatível com uma posição que guarda quantidade e custo médio, sem lotes.
* Venda acima da quantidade detida é recusada sem gravar nada.

### Efeito de cada tipo

| Tipo | Quantidade | Custo total |
| --- | --- | --- |
| `BUY` | soma | soma `quantity × unitPrice + fees + taxes` |
| `SELL` | subtrai | subtrai `quantity × averageCost`; gera lucro realizado |
| `DIVIDEND`, `INTEREST` | não altera | não altera; é renda |
| `SPLIT` | altera pelo desdobramento ou grupamento | não altera; o custo médio se ajusta |
| `BONUS` | soma | soma o custo atribuído, quando houver |
| `TRANSFER_IN` | soma | soma o custo de origem informado |
| `TRANSFER_OUT` | subtrai | subtrai `quantity × averageCost`, sem lucro realizado |
| `DEPOSIT`, `WITHDRAWAL`, `ADJUSTMENT` | ver decisões em aberto | ver decisões em aberto |

A API só aceita um tipo depois que o seu efeito estiver definido aqui e implementado na reconstrução da posição. Hoje aceita `BUY` e `SELL`; os demais existem no schema e são recusados com 400.

## Valuation

Valuation não é entidade. É o resultado calculado de uma posição contra a cotação mais recente do instrumento, num instante:

| Resultado | Definição |
| --- | --- |
| `quote` | a cotação do provedor: `price`, `currency`, `timestamp` e `source` |
| `marketValue` | `quantity × price`, na moeda da cotação |
| `profitLoss` | `marketValue − investedValue`; ausente quando a moeda das transações da posição não é a da cotação, ou a posição não tem transações |
| `profitLossPercent` | `profitLoss ÷ investedValue`, em fração (`0.25` é 25%); ausente com `profitLoss` ausente ou `investedValue` zero |

* `marketValue` e `profitLossPercent` são truncados em direção a zero em 18 casas, e `profitLoss` é a diferença exata.
* `investedValue` está na moeda das transações da posição e `marketValue` na da cotação; em moedas diferentes, compará-los exigiria câmbio (ver [Valores, moedas e datas](#valores-moedas-e-datas)).
* Instrumento sem cotação e provedor indisponível chegam como `not-found` e `unavailable` no ativo, não como erro da requisição.

Nada disso é armazenado como fonte de verdade, e o cálculo fica no backend, em `backend/src/domain/PositionValuation.ts`: o frontend exibe, não calcula. `GET /v1/assets/valuations` avalia os ativos pedidos de uma carteira; o web não o consulta desde que a tabela de posições passou a ler `GET /v1/portfolio/positions` (TD-034).

### Visão geral da carteira

`GET /v1/portfolio/overview` consolida as posições de uma carteira na `baseCurrency` dela, em `backend/src/domain/PortfolioValuation.ts`:

| Indicador | Cálculo |
| --- | --- |
| `totalValue` | soma de `quantity × price × taxa` da moeda da cotação |
| `investedValue` | soma de `investedValue × taxa` da moeda das transações |
| `profitLoss` | `totalValue − investedValue` |
| `profitLossPercent` | `profitLoss ÷ investedValue`, como fração |
| `dayChange` | `totalValue` menos o valor no fechamento anterior, a soma de `quantity × previousClose × taxa` |
| `dayChangePercent` | `dayChange ÷` valor no fechamento anterior, como fração |
| `quotedAt` | o instante mais antigo entre as cotações das posições com unidades e as taxas das moedas dessas cotações |

* A taxa é a cotação de câmbio mais recente da moeda para a base, e 1 na própria base. Todos os indicadores usam a mesma taxa, então nem o resultado nem a variação do dia refletem o movimento do câmbio (TD-022).
* Um indicador só é devolvido quando todas as posições com unidades têm o que ele usa: cotação, taxa da moeda e, na variação do dia, `previousClose`. Faltando algo, ele e os que dependem dele ficam fora da resposta, sem erro; custo diferente de zero sem moeda conhecida deixa `investedValue` de fora.
* Posição sem unidades não entra na soma nem na consulta ao provedor.
* Percentual de base zero fica de fora. Totais e percentuais são truncados em direção a zero em 18 casas, e as diferenças são exatas.
* Carteira sem posições responde os totais `0`, sem percentuais.
* `quotedAt` acompanha `totalValue`: fica fora quando ele fica e quando a carteira não tem posição com unidades. A taxa usada só pelo custo, na moeda das transações, não entra. Cotação que o provedor repete depois de uma falha (ver Yahoo Finance) mantém o instante em que foi observada, então `quotedAt` pode ser anterior à consulta sem que a resposta indique a falha.

### Posições da carteira

`GET /v1/portfolio/positions` lista as posições de uma carteira em páginas, com os valores na `baseCurrency` dela, também em `backend/src/domain/PortfolioValuation.ts`:

| Campo | Cálculo |
| --- | --- |
| `averageCost` | `averageCost × taxa` da moeda das transações |
| `marketPrice` | `price × taxa` da moeda da cotação |
| `marketValue` | `quantity × price × taxa` da moeda da cotação |
| `allocation` | `marketValue ÷ totalValue` da visão geral, como fração |
| `profitLoss` | `marketValue − investedValue × taxa` da moeda das transações |
| `profitLossPercent` | `profitLoss ÷` o `investedValue` convertido, como fração |

* A taxa é a da visão geral, então nenhum campo reflete o movimento do câmbio (TD-022). Valor zero não precisa de taxa.
* Campo cujo insumo falta fica fora do item, sem erro: sem cotação ou sem taxa da moeda da cotação saem `marketPrice`, `marketValue`, `allocation` e o resultado; sem moeda conhecida ou sem taxa da moeda das transações saem `averageCost` e o resultado.
* `allocation` só sai quando o `totalValue` da visão geral existe e não é zero, então uma posição com unidades sem cotação tira a alocação de todos os itens.
* Posição sem unidades é listada, com `marketValue` e `allocation` zero. As posições com unidades são cotadas em toda página, porque a alocação depende do total; a sem unidades, só quando está na página pedida ou quando a ordem é por um valor.
* A ordem padrão é por `symbol`, crescente ou decrescente, e não depende de cotação, então a mudança de preço não move posição entre páginas. Por um valor, a página é cortada depois de avaliar todas as posições que atendem aos filtros: a posição sem o valor vai por último nos dois sentidos, o empate segue a ordem de `symbol`, e a mudança de preço pode mover posição entre páginas.
* `search` compara, sem diferenciar caixa, com `symbol` e `name`; `type`, com a classe do instrumento; e `status` separa as posições com unidades (`open`) das sem unidades (`closed`). `total` e `totalPages` contam só as posições filtradas, e a alocação continua sobre a carteira inteira.
* Valores e frações são truncados em direção a zero em 18 casas, e o resultado é a diferença exata.

### Alocação da carteira

`GET /v1/portfolio/allocation` distribui o valor de uma carteira, na `baseCurrency` dela, por ativo, tipo, setor e moeda, também em `backend/src/domain/PortfolioValuation.ts`:

| Distribuição | Chave de cada grupo |
| --- | --- |
| `byAsset` | `symbol` e `name` do instrumento, em ordem de `symbol` |
| `byType` | `Instrument.type` |
| `bySector` | `Instrument.sector`, `null` sem setor |
| `byCurrency` | a moeda da cotação, ou `Instrument.currency` sem cotação |

* Cada grupo traz `marketValue` e `allocation`, a soma exata dos valores que as suas posições têm em [Posições da carteira](#posições-da-carteira), e `totalValue` é o da visão geral. A diferença de truncamento não é redistribuída entre os grupos.
* Só entram posições com unidades. Grupo com posição sem `marketValue` ou sem `allocation` fica sem o campo, sem erro; sem `totalValue`, ou com ele zero, nenhum grupo tem `allocation`.
* Cada posição é truncada antes da soma, então toda distribuição soma os mesmos valores, abaixo do total por menos de uma unidade da escala por posição: com n posições, `0 ≤ totalValue − Σ marketValue < n × 10⁻¹⁸` e `0 ≤ 1 − Σ allocation < n × 10⁻¹⁸ × (1 + 1 ÷ totalValue)`.
* Os grupos seguem a ordem das chaves por unidade de código, com `null` por último. A distribuição não é paginada.
* Carteira sem posições com unidades responde `totalValue` `0` e distribuições vazias.

### Performance da carteira

`GET /v1/portfolio/performance` devolve a série histórica de uma carteira, na `baseCurrency` dela, em `backend/src/domain/PortfolioPerformance.ts`. As demais rotas de valuation usam a cotação corrente; esta usa o fechamento de cada dia (ver [Cotações gravadas](#cotações-gravadas)).

| Janela (`range`) | Começa em |
| --- | --- |
| `1W` | 7 dias antes do dia corrente |
| `1M`, `3M`, `6M`, `1Y` | 1, 3, 6 ou 12 meses antes do dia corrente |
| `YTD` | o primeiro dia do ano corrente |
| `MAX` | o dia da primeira transação do razão; sem transação, a janela é vazia |

* Toda janela termina no início do dia corrente em UTC, exclusivo, o primeiro dia que ainda não tem fechamento, e começa no início de um dia. A mesma janela pedida duas vezes no mesmo dia responde os mesmos dias, seja qual for o fuso de quem pede.
* Cada ponto traz `date`, `value`, `investedValue`, `netContribution` e `twr`. A posição de cada dia é reconstruída do razão até o fim daquele dia, pelas regras de [Razão e posição](#razão-e-posição), então transação gravada retroativamente move a série inteira a partir da data dela.
* Um dia só vira ponto quando toda posição detida nele, e toda transação executada nele, tem fechamento e câmbio para a moeda base. Dia parcial responderia uma carteira menor do que ela é, como se tivesse perdido valor, então fica fora da série.
* `netContribution` é o caixa do dia: `BUY` soma quantidade × preço mais taxas e impostos, `SELL` subtrai o líquido. `twr` é o retorno ponderado no tempo acumulado desde o primeiro ponto, encadeando `(value − netContribution) ÷ valor do dia anterior`, de modo que dinheiro que entrou ou saiu no dia não conta como ganho. Lacuna na série faz o retorno seguinte abranger a lacuna.
* `benchmark` é opcional e nomeia um símbolo do catálogo: o corpo ganha `{ symbol, currency, series }`, cada ponto com `close` e o `twr` sobre o primeiro fechamento da janela, comparável ao da carteira. O retorno do benchmark é o da moeda em que ele é cotado, sem conversão para a moeda base (TD-030).
* Índice de mercado não é cotável hoje, porque o padrão de símbolo do catálogo recusa `^BVSP`, então a comparação é com ETF que replica o índice, como `BOVA11` ou `IVV`.

## Fonte de cotação

O domínio obtém preços por `MarketDataProvider`, em `backend/src/domain/MarketDataProvider.ts`, sem depender do SDK ou da API de nenhum provedor. As implementações ficam em `backend/src/infra/market-data`, e trocá-las não altera o domínio.

| Operação | Resultado |
| --- | --- |
| `getQuotes(instruments)` | o preço mais recente de cada instrumento, uma entrada por símbolo pedido |
| `getExchangeRates(currencies, baseCurrency)` | o preço de uma unidade de cada moeda em `baseCurrency`, uma entrada por moeda pedida; moeda sem par com a base, inclusive a própria base, é `not-found` |
| `getHistoricalPrices(instrument, range, interval)` | o fechamento de cada `interval` (`5m`, `15m`, `30m`, `1h` ou `1d`) de `range.from`, inclusive, a `range.to`, exclusive, em ordem crescente de `timestamp`; `range-not-served` quando o provedor não guarda preços tão antigos nesse intervalo |
| `getHistoricalExchangeRate(currency, baseCurrency, range)` | o fechamento diário do par, uma taxa por dia negociado de `range`, nos termos que `getExchangeRates` define para o par e `getHistoricalPrices` para o intervalo |

* Cada preço traz `price` em string decimal, `currency` explícita, `timestamp` como instante UTC e `source`, o provedor que o observou. A cotação traz também `previousClose`, o fechamento anterior, quando o provedor o tem.
* O instrumento chega com `symbol`, `market` e `currency` do catálogo; traduzi-los para o código do provedor cabe à implementação, e instrumento que ela não traduz é `not-found`.
* A resposta do provedor é entrada externa, e a implementação a valida antes de devolvê-la.
* Instrumento sem preço no provedor (`not-found`) e provedor que não responde (`unavailable`) são resultados, não exceções.
* Quem chama o provedor é o backend: a CSP do web bloqueia chamada do navegador a outro domínio, e a credencial do provedor não sai do servidor.

### Yahoo Finance

`YahooFinanceProvider` consulta a YH Finance API (`https://yfapi.net`) com a chave de `YAHOO_FINANCE_API_KEY` só no header `x-api-key`, e recusa redirect, para que a chave não siga a outro destino. A variável é opcional: sem ela, o backend sobe, avisa no log e toda cotação responde `unavailable`, sem requisição.

| `market` | Código no provedor |
| --- | --- |
| `B3` | `{symbol}.SA` |
| `NYSE`, `NASDAQ` | `{symbol}` |
| `CRYPTO` | `{symbol}-{currency}` |

* Instrumento sem `market` ou `currency`, ou com símbolo fora de letras e dígitos, é `not-found` sem requisição, como os migrados antes do catálogo até serem completados.
* Cotação com moeda que não é código ISO 4217 exato, preço não positivo ou fora de `DECIMAL(38,18)`, ou sem horário não é aceita: o símbolo responde a última cotação recebida ou `unavailable`, sem afetar os demais da mesma requisição. Yahoo cota algumas listagens em unidade menor, como `GBp`, um centésimo de `GBP`.
* O preço é arredondado nas casas de `priceHint`, informado pelo provedor, o que descarta o ruído do ponto flutuante da resposta.
* Intervalos abaixo de uma hora alcançam os últimos 60 dias, `1h` os últimos 730, e `1d` não tem limite.
* Câmbio é o par `{currency}{baseCurrency}=X`, como `USDBRL=X`, com o mesmo cache, lote e pausa das cotações. Código fora de três letras maiúsculas, ou igual à moeda base, é `not-found` sem requisição, e taxa cotada em moeda diferente da base é `unavailable`.
* `previousClose` vem de `regularMarketPreviousClose`, arredondado como o preço; valor inválido é descartado sem recusar a cotação.
* Cotações ficam em cache na memória do processo por 60 segundos, inclusive `not-found`. Um símbolo já em consulta aproveita a requisição em curso, e os demais vão em lotes de 10 por requisição.
* Cada requisição expira em 5 segundos. Status de erro, timeout, falha de rede ou resposta fora do formato suspendem as chamadas ao provedor por 30 segundos; na falha e durante a pausa, cada símbolo responde a última cotação recebida, com o `timestamp` em que foi observada, ou `unavailable` sem cotação anterior. O histórico não usa o cache.
* A cotação corrente não é gravada; o que a tabela guarda é o fechamento diário (ver [Cotações gravadas](#cotações-gravadas)).

Os valores de timeout, cache, pausa e lote são assumidos, não medidos, e a cota e o preço dos planos do provedor não foram verificados (TD-020).

### Cotações gravadas

`MarketQuote` guarda o fechamento de cada dia de negociação de um instrumento, na tabela `market_quotes`. A série é preenchida por backfill sob demanda a partir de `getHistoricalPrices`: nenhuma leitura de carteira grava cotação, e a cotação corrente continua vindo do provedor a cada requisição, com o cache dele.

| Campo | Regra |
| --- | --- |
| `instrumentId` | o instrumento do catálogo; só instrumento catalogado tem série |
| `timestamp` | o início do dia de negociação em UTC, não o instante do fechamento |
| `price` | decimal na escala das colunas monetárias, como o provedor o devolveu |
| `currency` | moeda da cotação, código ISO 4217 |
| `source` | o provedor que observou o preço, como `yahoo-finance` |

* Um instrumento tem no máximo uma linha por dia e fonte, e o índice único `(instrumentId, timestamp, source)` é a única autoridade sobre isso: gravar de novo um dia já gravado mantém o preço primeiro observado, e duas gravações simultâneas do mesmo dia produzem uma linha só.
* Correção de fechamento publicada pelo provedor não substitui o valor gravado (TD-027), e nada descarta linha antiga (TD-026).
* O preço gravado é o que o adaptador já validou (ver [Yahoo Finance](#yahoo-finance)); a escrita não revalida.
* A tabela cobre o catálogo de instrumentos, e o benchmark da série de performance é um símbolo dele, com a mesma série. O par de câmbio tem tabela própria.

A série é consultada por intervalo, de `from` inclusive a `to` exclusivo, em ordem crescente de dia. O que o intervalo pedido não encontra gravado é pedido ao provedor no intervalo diário e gravado antes da resposta:

* Só as bordas faltantes são pedidas: o trecho anterior ao fechamento mais antigo e o posterior ao mais novo. Dia sem fechamento entre os extremos é dia em que o mercado não negociou, e não é pedido de novo.
* O dia corrente em UTC nunca é pedido, porque ainda não tem fechamento; pedi-lo gastaria uma requisição ao provedor a cada leitura da série.
* Provedor que não responde, ou que não guarda preço tão antigo naquele intervalo, deixa a série com o que está gravado: histórico incompleto não é requisição falha.
* A consulta devolve todas as fontes, então um dia observado por duas fontes são duas entradas. Consumir a série sem distinguir a fonte é o TD-028.

`ExchangeRate` guarda o fechamento diário de um par de moedas, na tabela `exchange_rates`, pelas mesmas regras: uma linha por par, dia e fonte, `timestamp` no início do dia em UTC, `rate` na escala das colunas monetárias, e o mesmo backfill de bordas, a partir de `getHistoricalExchangeRate`. O par vem de quem grava, não do preço: uma taxa é cotada na moeda base, então a moeda que o preço carrega é a base. É essa série que leva posição em moeda estrangeira para a moeda base em [Performance da carteira](#performance-da-carteira); o câmbio corrente das demais rotas continua vindo do provedor a cada requisição, sem gravação.

## Valores, moedas e datas

* Quantidades e valores monetários são decimais exatos, nunca ponto flutuante: `DECIMAL(38,18)`, até 20 dígitos inteiros e 18 casas, em transação, posição e cotação gravada. A API os recebe e devolve como string decimal, e valor que a coluna arredondaria é recusado, não arredondado.
* O custo médio é truncado em 18 casas a cada `BUY`, e `investedValue` uma vez, ao fim da reconstrução. Razão que passa por posição fora de `DECIMAL(38,18)`, `investedValue` incluído, é recusado, mesmo que a posição final caiba.
* Todo valor monetário tem moeda explícita. `Instrument.currency` é a moeda de cotação, `Transaction.currency` a da operação e `Portfolio.baseCurrency` a de consolidação.
* Valores em moedas diferentes só se somam por conversão com cotação de câmbio explícita; sem cotação, o total não é calculado. A cotação de câmbio vem do provedor de cotação, pela taxa mais recente (ver [Visão geral da carteira](#visão-geral-da-carteira)).
* Instantes são gravados em UTC. `executedAt` é quando a operação aconteceu, informado por quem registra; `createdAt` e `updatedAt` são quando o registro foi gravado e alterado.

## Termos

| Termo | Significa | Não significa |
| --- | --- | --- |
| ativo | `Instrument` | a posição de alguém nele |
| posição | `Position` | o instrumento, nem o seu valor de mercado |
| transação | `Transaction`, o evento do razão | transação de banco de dados, que é sempre chamada assim |
| custo, valor investido | `investedValue` | valor de mercado |
| valor de mercado | `marketValue`, calculado | um valor gravado |

## Correspondência com o modelo anterior

| Modelo anterior | Modelo de domínio |
| --- | --- |
| `Asset` (posição de um símbolo numa carteira) | `Position`, com o símbolo extraído para `Instrument` |
| `Asset.symbol` único no banco inteiro | `Instrument` único; posição única por carteira e instrumento |
| `Portfolio.userId` único | várias carteiras por usuário, cada uma com moeda base |
| `Transaction.assetSymbol` | `portfolioId` e `instrumentId` |
| `amount`, `price` | `quantity`, `unitPrice` |
| `createdAt` como data da operação | `executedAt`; na migração, as linhas existentes recebem `executedAt = createdAt`, a única data que conhecem |
| `balance` (`±amount × price` acumulado) | `investedValue`, o custo das unidades detidas; na migração, `quantity × averageCost` de cada posição. O valor atual é `marketValue` |
| `amount`, `price` e a posição em `Float` | `DECIMAL(38,18)`, em string decimal na API |
| `type` texto, `BUY` ou `SELL` | enum `TransactionType`, com os tipos de [Efeito de cada tipo](#efeito-de-cada-tipo) |
| moeda implícita | `Transaction.currency`; na migração, a moeda base da carteira |

## Decisões em aberto

* **Caixa.** Se compra e venda movimentam um saldo em dinheiro da carteira, o que torna `DEPOSIT` e `WITHDRAWAL` pré-requisito de uma compra, ou se aportes e retiradas são só registro de fluxo.
* **`ADJUSTMENT`.** O que pode ser ajustado e com qual efeito sobre quantidade e custo.