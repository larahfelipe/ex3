# Regras financeiras

Definição matemática de cada número que a API reporta, com o ponto do código que a implementa. O que as entidades significam está em [`domain-model.md`](domain-model.md); aqui está como os valores são calculados a partir delas.

## Convenções

Toda aritmética usa decimal de base 10 (`Prisma.Decimal`), nunca ponto flutuante binário. As colunas monetárias são `DECIMAL(38,18)`: precisão de 38 dígitos, escala de 18 casas.

* **Truncamento.** Todo resultado exposto é truncado **em direção a zero** na escala da coluna (18 casas). Nunca se arredonda para cima: um valor exibido nunca é maior do que o calculado.
* **Precisão intermediária.** O replay do razão calcula com `2 × 38 + 1 = 77` dígitos e a valoração com `4 × 38 = 152`, o bastante para que nenhuma operação intermediária arredonde antes do truncamento final.
* **Percentuais são frações.** `profitLossPercent = 0.1` significa 10%. A formatação em percentual é do frontend.
* **Campo ausente ≠ zero.** Quando falta a cotação, o câmbio ou o divisor é zero, o campo **não vem no corpo** — a resposta continua `200`. Um zero afirmaria que o valor é zero; a ausência afirma que ele não é calculável agora.
* **Moedas.** Um razão vive em uma única moeda. Totais de carteira são convertidos para a `baseCurrency` da carteira pela cotação mais recente de cada moeda, não pela cotação do dia de cada transação.

Notação: `q` quantidade, `p` preço unitário, `f` taxas (fees), `t` impostos, `P` preço de mercado, `c` custo médio, `x` taxa de câmbio para a moeda base.

## Preço médio (`averageCost`)

Custo médio por unidade, reconstruído do razão inteiro a cada gravação — nunca incrementado sobre o valor anterior. Entradas são ordenadas por `executedAt` e, no empate, pela ordem de gravação (`sequence`).

Estado inicial `q₀ = 0`, `c₀ = 0`. Para cada entrada `i`:

```text
BUY, BONUS   qᵢ = qᵢ₋₁ + q
             custo total = qᵢ₋₁ · cᵢ₋₁ + q · p + f + t
             cᵢ = ⌊custo total · 10¹⁸ ÷ qᵢ⌋ ÷ 10¹⁸      (divisão inteira)
SELL         qᵢ = qᵢ₋₁ − q,  recusado se q > qᵢ₋₁
             cᵢ = cᵢ₋₁, e 0 quando qᵢ = 0
DIVIDEND, JCP, INTEREST
             qᵢ = qᵢ₋₁,  cᵢ = cᵢ₋₁
```

A venda **não** altera o preço médio: realizar resultado não muda o custo do que continua na carteira. Zerar a posição zera o custo, para que uma recompra posterior não herde o custo da posição anterior. O `BONUS` entra com o custo atribuído a cada unidade — bonificação com `p = 0` dilui o preço médio, que é o efeito correto.

Uma posição intermediária que não caiba em `DECIMAL(38,18)` é recusada com `422`, sem gravar: o razão não passa por um estado que a coluna não representa.

`backend/src/domain/PositionLedger.ts`

## Custo (`investedValue`)

```text
investedValue = ⌊q · c⌋₁₈
```

Quanto a posição custou, na moeda do razão, truncado na escala da coluna. É o denominador do resultado percentual e o `investedValue` da visão geral, convertido para a moeda base.

## Valuation

Valor de mercado de uma posição, na moeda da cotação:

```text
marketValue = ⌊q · P⌋₁₈
```

Na moeda base da carteira, cada parcela é convertida pela cotação mais recente da sua moeda:

```text
marketValueBase  = ⌊q · P · x_cotação⌋₁₈
investedValueBase = ⌊investedValue · x_razão⌋₁₈
totalValue = Σ marketValueBase, sobre as posições com unidades
```

`totalValue` só existe se **toda** posição com unidades tiver cotação e câmbio; uma parcial reportaria uma carteira menor como se tivesse perdido valor. `quotedAt` é o instante **mais antigo** entre as cotações e os câmbios usados: descreve a idade do total, não da última consulta.

`backend/src/domain/PositionValuation.ts`, `backend/src/domain/PortfolioValuation.ts`

## P&L

```text
profitLoss        = marketValue − investedValue
profitLossPercent = profitLoss ÷ investedValue          (ausente se investedValue = 0)
```

Na posição, o resultado só é dado quando a moeda do razão é a mesma da cotação — custos em moedas diferentes não somam sem câmbio. Na carteira, ambos já estão na moeda base, e o resultado é a diferença dos dois totais. Efeito conhecido: como as duas parcelas usam a taxa de hoje, o resultado **não separa** o que veio do preço do ativo do que veio do câmbio.

Variação do dia:

```text
dayChange        = totalValue − previousValue
dayChangePercent = dayChange ÷ previousValue            (ausente se previousValue = 0)
```

`previousValue` é a carteira avaliada pelo fechamento anterior de cada ativo, e só existe quando toda posição com unidades tem fechamento anterior.

## Alocação

```text
allocation(posição) = marketValueBase ÷ totalValue      (ausente se totalValue ausente ou 0)
allocation(grupo)   = Σ allocation das posições do grupo
marketValue(grupo)  = Σ marketValueBase das posições do grupo
```

Os grupos (`byAsset`, `byType`, `bySector`, `byCurrency`) somam exatamente as parcelas das posições, sem recalcular a partir do total: as quatro distribuições fecham no mesmo valor. Um grupo em que alguma posição não tem o valor deixa o campo de fora. Só posições com unidades entram. Para `n` posições, a soma fica abaixo de `totalValue` por menos de `n · 10⁻¹⁸`, e abaixo de 1 por menos de `n · 10⁻¹⁸ · (1 + 1 ÷ totalValue)` — resíduo do truncamento, não erro de arredondamento.

`allocatePortfolio`, em `backend/src/domain/PortfolioValuation.ts`

## Performance

Série diária do valor da carteira na moeda base. A janela termina no início do dia corrente em UTC, exclusivo, e começa em:

| `range` | Início |
| --- | --- |
| `1W`, `1M`, `3M`, `6M`, `1Y` | o mesmo instante, 7 dias / 1, 3, 6, 12 meses atrás |
| `YTD` | 1º de janeiro do ano corrente, em UTC |
| `MAX` | o dia da primeira transação do razão |

Um dia vira ponto da série só quando toda posição detida nele, e toda transação executada nele, tem fechamento e câmbio. A posição de cada dia é reconstruída do razão até o fechamento daquele dia, então uma transação lançada retroativamente move toda a série anterior a ela.

Fluxo de caixa de cada entrada, na moeda base do dia:

```text
BUY                        +(q · p + f + t)        aporte
BONUS                      +(f + t)
SELL                       −(q · p − f − t)        retirada
DIVIDEND, JCP, INTEREST    −(q · p − f − t)        distribuição
netContribution(dia) = Σ dos fluxos das entradas executadas naquele dia
```

Retorno ponderado no tempo, encadeado a partir do primeiro ponto:

```text
growth₁ = 1
growthᵢ = growthᵢ₋₁ · (valueᵢ − netContributionᵢ) ÷ valueᵢ₋₁      (valueᵢ₋₁ ≠ 0)
twrᵢ    = growthᵢ − 1
```

Subtrair o aporte do dia antes de dividir é o que impede que dinheiro colocado ou retirado conte como ganho. Um intervalo sem pontos faz o retorno seguinte abranger o intervalo inteiro. `twr` é fração: `0.1` é 10%.

`trackPortfolioPerformance`, em `backend/src/domain/PortfolioPerformance.ts`

## Dividendos

`DIVIDEND`, `JCP` e `INTEREST` são registrados no razão como qualquer transação: `q` é o número de unidades que gerou a renda, `p` o valor bruto por unidade, e o líquido recebido é `q · p − f − t`. O provento não exige unidades detidas na data, porque quem vende depois da data com direito ainda recebe. Duas regras:

1. **Não alteram a posição.** Quantidade e preço médio ficam como estavam — renda não é custo, e não pode diluir nem inflar o custo de quem a recebeu.
2. **Contam como distribuição na performance.** Entram no `netContribution` do dia com o líquido de sinal negativo, como uma retirada — não há saldo em caixa na carteira, então o provento sai dela como sai o líquido de uma venda. Como o preço do ativo cai no dia ex, o `twr` daquele dia é `(value + provento) ÷ value anterior`: o provento não aparece como perda.

Não há agregação de proventos: nenhuma rota devolve total do mês, do ano, `yield` ou `yield on cost` (TD-062 em [`../TODO.md`](../TODO.md)). O que existe hoje é a transação individual, que a listagem de transações devolve.

## Benchmarks

Uma série de comparação opcional em `GET /v1/portfolio/performance`, por símbolo do catálogo:

```text
twr(dia) = close(dia) ÷ close(primeiro dia da janela) − 1
```

É retorno de preço puro: não reinveste provento do índice, não converte moeda — a série vem com a `currency` em que o benchmark é cotado, e cabe a quem lê não comparar moedas diferentes sem ressalva. Vazia quando o primeiro fechamento é zero ou a janela não tem fechamento.

`returnsOf`, em `backend/src/domain/PortfolioPerformance.ts`

## Drawdown e métricas de risco

**Não implementados.** Nenhuma rota devolve `maxDrawdown`, `currentDrawdown`, `recovery`, volatilidade, Sharpe, beta ou correlação, e não há função de domínio que os calcule (TD-063 em [`../TODO.md`](../TODO.md)). A série de `GET /v1/portfolio/performance` é o insumo de que esses números precisariam, e nenhuma tela do web exibe medida de risco.

## O que estas definições não fazem

* **Não há custo por lote.** O custo médio é ponderado sobre a posição inteira; FIFO, LIFO e custo específico não são opções.
* **Não há resultado realizado.** A venda sai do valor da posição sem registrar o ganho que realizou; o P&L reportado é sempre o não realizado do que ainda se detém.
* **Não há efeito de câmbio separado.** Ver P&L, acima.
* **Não há imposto apurado.** `taxes` é o valor lançado na transação, somado ao custo; não há regra fiscal, alíquota nem apuração de período.
* **Não há preço intradiário na série.** A performance usa fechamento diário; a visão geral e as posições usam a última cotação do provedor, com 60s de cache.
