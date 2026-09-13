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
| `MarketQuote` | Um preço observado de um instrumento num instante, com moeda e fonte. | — | `(instrumentId, timestamp, source)` |

## Catálogo de instrumentos

`Instrument` é compartilhado por todas as carteiras e não pertence a nenhum usuário: excluir a conta de quem detém um instrumento mantém o instrumento.

| Campo | Regra |
| --- | --- |
| `symbol` | identidade, única no catálogo e nunca alterada; símbolo novo aceita só letras e dígitos, até 6 caracteres |
| `name` | até 120 caracteres |
| `type` | `STOCK`, `ETF`, `FUND`, `REIT`, `CRYPTO`, `BOND`, `TREASURY`, `CASH` ou `OTHER` |
| `market` | mercado de negociação, até 20 caracteres |
| `currency` | moeda de cotação, código ISO 4217 |
| `sector` | opcional, até 60 caracteres |
| `country` | opcional, código de duas letras |

**Quem escreve.** Só admin cadastra e corrige instrumentos; os demais usuários escolhem do catálogo, e a escrita deles recebe 403. Qualquer usuário autenticado lista o catálogo. Abrir ou renomear um ativo para símbolo fora do catálogo responde 404 até um admin cadastrá-lo.

**Posição por instrumento.** Uma carteira tem no máximo uma posição por instrumento, e várias carteiras podem ter posição no mesmo instrumento. Transações referenciam a carteira e o instrumento.

**Dados anteriores ao catálogo.** A migração criou um instrumento por símbolo existente, com `name` igual ao símbolo, tipo `OTHER` e os demais campos vazios. Por isso `market` e `currency` são opcionais no banco, embora obrigatórios no cadastro, e cabe a um admin completar esses instrumentos antes de qualquer cálculo que dependa da moeda. Símbolos gravados antes da allowlist (ex.: `BRK.B`) continuam no catálogo e nas carteiras que os tinham, mas não podem ser abertos em outra carteira nem cadastrados de novo. A migração aborta sem alterar nada se existir transação sem o ativo correspondente.

## Razão e posição

A posição é função das transações da carteira naquele instrumento, e só delas: a mesma sequência de transações produz sempre a mesma `quantity`, o mesmo `averageCost` e o mesmo `investedValue`. Criar, editar ou excluir uma transação reconstrói a posição e grava as duas numa única transação de banco.

A ordem do razão é `executedAt`, depois `createdAt`, depois `id`.

**Dados anteriores à posição.** A migração que renomeou `assets` para `positions` reconstruiu `quantity`, `averageCost` e `balance` de cada posição a partir das suas transações, na ordem `createdAt`, `id`, e substituiu o valor gravado quando divergia. Ela aborta sem alterar nada se o razão de alguma posição vende mais do que detém.

### Custo

* `investedValue = quantity × averageCost`.
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

A API só aceita um tipo depois que o seu efeito estiver definido aqui.

## Valuation

Valuation não é entidade. É o resultado calculado de uma posição contra uma cotação, num instante:

| Resultado | Definição |
| --- | --- |
| `marketPrice` | preço da `MarketQuote` mais recente do instrumento |
| `marketValue` | `quantity × marketPrice` |
| `profitLoss` | `marketValue − investedValue` |
| `profitLossPercent` | `profitLoss ÷ investedValue`; ausente quando `investedValue` é zero |

Nada disso é armazenado como fonte de verdade, e o cálculo fica no backend: o frontend exibe, não calcula.

## Valores, moedas e datas

* Quantidades e valores monetários são decimais exatos, nunca ponto flutuante. Precisão e escala são definidas no schema, e os limites de entrada derivam delas.
* Todo valor monetário tem moeda explícita. `Instrument.currency` é a moeda de cotação, `Transaction.currency` a da operação e `Portfolio.baseCurrency` a de consolidação.
* Valores em moedas diferentes só se somam por conversão com cotação de câmbio explícita; sem cotação, o total não é calculado.
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
| `balance` (`±amount × price` acumulado) | removido; custo é `investedValue` e valor atual é `marketValue` |

## Decisões em aberto

* **Caixa.** Se compra e venda movimentam um saldo em dinheiro da carteira, o que torna `DEPOSIT` e `WITHDRAWAL` pré-requisito de uma compra, ou se aportes e retiradas são só registro de fluxo.
* **`ADJUSTMENT`.** O que pode ser ajustado e com qual efeito sobre quantidade e custo.
* **Câmbio.** De onde vêm as cotações usadas para consolidar moedas diferentes.
