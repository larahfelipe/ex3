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

### TD-001 — Valores financeiros em ponto flutuante

- **Origem:** TASKs 3.3 e 3.4 · **Tipo:** domínio · **Prioridade:** alta · **Encaminhamento:** TASK 4.5, verificado nas TASKs 4.6–4.8
- **Contexto:** `amount`, `price` e `balance` são `Float` (`double precision`), e a posição acumula resíduo de arredondamento a cada escrita. O `PLAN.md` define os campos da remodelagem, mas não o tipo numérico.
- **Impacto:** vender a posição inteira pode ser recusado (`0.3 − 0.1 − 0.2` fica abaixo de zero), e editar ou excluir deixa a posição diferente de recalculá-la a partir do razão. Os casos estão reproduzidos pelos testes `todo` de `backend/src/routes/Transactions.integration.ts`, listados em `docs/testing.md`.
- **Proposta:** `Decimal` com precisão e escala explícitas (`@db.Decimal`) para quantidade, preço unitário, taxas e impostos; aritmética em `Prisma.Decimal`; valores serializados como string na API, para não voltarem a `number` no cliente. Ao concluir, remover a marcação `todo` dos testes correspondentes.

### TD-002 — Listagem de transações ignora `page` e não segue a ordem das operações

- **Origem:** TASK 3.4 · **Tipo:** API · **Prioridade:** média · **Encaminhamento:** TASK 6.4
- **Contexto:** `TransactionRepository.getAll` ordena por `id desc` e pagina pelo cursor `id < lastId`, mas o `id` é UUID v4 (`@default(uuid())`), aleatório. `page` é devolvido na resposta sem deslocar a consulta, e `lastId` só passa por `trim`, sem validação de formato. O ramo `limit === 0`, que omite o `take`, é inalcançável hoje porque `PaginationQuerySchema` exige `limit` positivo.
- **Impacto:** a ordem da listagem não corresponde à ordem das operações, e `page=2` sem `lastId` repete a primeira página. O ramo sem `take` volta a permitir listagem ilimitada (OWASP API4:2023) se o schema for relaxado.
- **Proposta:** ordenar pela data de execução (`executedAt`, TASK 4.5) com desempate por `id`; adotar um único mecanismo de paginação (cursor opaco validado, ou `page`/`limit` com `skip`); remover o ramo sem `take`.

### TD-003 — Exclusão de ativo sem teste com o mesmo símbolo em outra carteira

- **Origem:** TASK 3.3 · **Tipo:** teste · **Prioridade:** média · **Encaminhamento:** TASK 4.2
- **Contexto:** a exclusão de ativo remove as transações filtrando pela carteira, mas enquanto `Asset.symbol` for `@unique` global (baseline #19) não existem dois ativos com o mesmo símbolo, e o caso não é reproduzível.
- **Impacto:** o filtro por carteira da exclusão em lote fica sem teste que o proteja durante a remodelagem.
- **Proposta:** quando o `todo` "lets two portfolios hold the same symbol" de `backend/src/routes/Assets.integration.ts` passar, acrescentar o teste em que excluir o ativo de uma carteira preserva as transações do mesmo símbolo na outra.

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

### TD-009 — `amount` e `price` de transação sem limite superior

- **Origem:** TASK 3.4 · **Tipo:** segurança · **Prioridade:** alta · **Encaminhamento:** TASK 4.5
- **Contexto:** `CreateTransactionSchema` e `UpdateTransactionSchema` exigem só `positive()`. Um `BUY` com `amount` e `price` de `1e200` responde `201`: o produto estoura para `Infinity`, que o Postgres aceita em `double precision` e grava no `balance` do ativo. Reproduzido pelo teste `todo` "rejects an entry whose cost overflows a finite number and records nothing".
- **Impacto:** a posição do próprio usuário fica corrompida sem erro (`Infinity`, que o JSON devolve como `null`), e escritas seguintes sobre ela podem gravar `NaN` (`Infinity − Infinity`). Não alcança outras carteiras. Não foi corrigido na TASK 3.4 porque o critério da task é reproduzir antes de corrigir, e o limite correto depende da precisão das colunas definida na TASK 4.5; um teto escolhido agora seria substituído na remodelagem.
- **Proposta:** limites derivados da precisão e escala das colunas `Decimal` (TD-001), validados no schema, e checagem de que a posição resultante cabe na coluna antes de gravar.

## Resolvidos

Nenhum item até o momento.
