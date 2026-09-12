Plano de execução — EX3

## Objetivo do programa

Evoluir o `larahfelipe/ex3` de um portfolio tracker CRUD para uma plataforma moderna de gestão e análise de investimentos, preservando o máximo possível da implementação existente.

### Diretrizes permanentes

Todas as tasks devem obedecer às seguintes regras:

1. **Não reescrever por padrão.** Reutilizar componentes, serviços, hooks, primitives e abstrações existentes quando estiverem tecnicamente adequados.
2. **Alterar somente o necessário.** Refatorações estruturais devem ter uma justificativa funcional ou técnica.
3. **Não introduzir regressões.** Toda mudança deve preservar comportamento funcional já válido.
4. **Domínio financeiro é fonte de verdade.** Valores de carteira não podem depender de cálculos inconsistentes espalhados pelo frontend.
5. **Acessibilidade é requisito funcional.** Não deve ser tratada como etapa cosmética posterior.
6. **Responsividade é requisito funcional.** Desktop, tablet e mobile devem ser considerados durante a implementação.
7. **Toda feature deve possuir estados de loading, erro e vazio.**
8. **Toda mudança relevante deve ser testável.**
9. **Nenhuma task deve depender de conhecimento implícito que não esteja descrito neste plano.**
10. **Não introduzir dependências sem necessidade.** Antes de adicionar biblioteca, verificar se a capacidade já existe no stack atual.

---

# FASE 0 — Baseline e inventário

## TASK 0.1 — Registrar baseline técnico

**Dependências:** nenhuma.

**Objetivo:** estabelecer uma fotografia reproduzível do estado atual antes de qualquer alteração.

**Escopo:**

Registrar:

* versão do Node;
* versão do package manager;
* versões das dependências frontend;
* versões das dependências backend;
* versão do Prisma;
* versão do TypeScript;
* versão do Next.js;
* versão do React;
* comandos atualmente disponíveis;
* estrutura principal do repositório;
* branch de referência;
* commit de referência.

Executar:

```text
install
lint
typecheck
build
```

Separadamente para `web` e `backend`.

Registrar todas as falhas existentes.

**Resultado esperado:**

Existe um baseline documentado que permite distinguir falhas pré-existentes de regressões.

**Critérios de conclusão:**

* versão do runtime documentada;
* dependências documentadas;
* build documentado;
* lint documentado;
* typecheck documentado;
* falhas existentes listadas;
* nenhum arquivo de produção alterado pela task.

---

## TASK 0.2 — Inventariar rotas e contratos existentes

**Dependências:** TASK 0.1.

**Objetivo:** mapear a API existente antes de alterações estruturais.

**Escopo:**

Documentar todos os endpoints relacionados a:

* autenticação;
* usuários;
* portfolios;
* assets;
* transactions.

Para cada endpoint registrar:

* método;
* path;
* autenticação;
* payload;
* response;
* erros;
* paginação;
* filtros;
* efeitos colaterais.

**Resultado esperado:**

Existe um catálogo atual da API.

**Critérios de conclusão:**

* todos os endpoints são identificados;
* contratos atuais estão documentados;
* nenhuma rota existente ficou sem classificação.

---

## TASK 0.3 — Inventariar componentes reutilizáveis

**Dependências:** TASK 0.1.

**Objetivo:** identificar o que deve ser preservado.

**Escopo:**

Classificar componentes atuais em:

```text
UI primitives
Feature components
Layout components
Forms
Data fetching
State
Utilities
```

Identificar:

* componentes duplicados;
* componentes excessivamente específicos;
* componentes que podem virar primitives;
* componentes já adequados ao novo produto.

**Resultado esperado:**

Mapa de reutilização que será utilizado nas próximas fases.

**Critérios de conclusão:**

* componentes principais classificados;
* duplicações relevantes listadas;
* candidatos à reutilização identificados.

---

# FASE 1 — Tooling, CI e segurança

## TASK 1.1 — Padronizar package manager

**Dependências:** TASK 0.1.

**Objetivo:** alinhar desenvolvimento local, CI e lockfile.

**Escopo:**

* adotar pnpm;
* configurar `packageManager`;
* revisar scripts;
* atualizar CI;
* remover dependências de `package-lock.json`;
* garantir uso de `pnpm install --frozen-lockfile`.

**Resultado esperado:**

Local e CI utilizam exatamente a mesma estratégia de instalação.

**Critérios de conclusão:**

```text
pnpm install --frozen-lockfile
```

executa com sucesso em `web` e `backend`.

CI também utiliza pnpm e o lockfile correto.

---

## TASK 1.2 — Fixar versão do Node

**Dependências:** TASK 1.1.

**Objetivo:** eliminar diferenças de runtime entre ambientes.

**Escopo:**

* definir versão LTS suportada;
* adicionar `.nvmrc` ou `.node-version`;
* atualizar Docker;
* atualizar GitHub Actions.

**Resultado esperado:**

Todos os ambientes utilizam a mesma versão principal do Node.

**Critérios de conclusão:**

* local;
* Docker;
* CI

utilizam a mesma versão configurada.

---

## TASK 1.3 — Corrigir pipeline CI

**Dependências:** TASK 1.2.

**Objetivo:** transformar o CI atual em uma validação confiável do repositório.

**Escopo:**

Pipeline:

```text
install
→ lint
→ typecheck
→ unit tests
→ integration tests
→ build
→ e2e
```

Inicialmente, tests inexistentes podem ser marcados como etapa futura, mas a estrutura do pipeline deve existir.

**Resultado esperado:**

Uma única pipeline representa o contrato de qualidade do projeto.

**Critérios de conclusão:**

* install reproduzível;
* lint executado;
* typecheck executado;
* build executado;
* failures bloqueiam pipeline;
* cache utiliza lockfile correto.

---

## TASK 1.4 — Remover fallback inseguro de JWT secret

**Dependências:** TASK 0.1.

**Objetivo:** impedir inicialização com segredo previsível.

**Escopo:**

Remover:

```text
JWT_SECRET || 'jwtSecret'
```

Adicionar validação de ambiente no startup.

**Resultado esperado:**

A aplicação falha explicitamente quando `JWT_SECRET` não existe.

**Critérios de conclusão:**

* nenhum fallback hard-coded;
* startup sem secret falha;
* startup com secret válido funciona;
* teste automatizado cobre esse comportamento.

---

## TASK 1.5 — Fortalecer configuração de ambiente

**Dependências:** TASK 1.4.

**Objetivo:** validar todas as configurações obrigatórias.

**Escopo:**

Criar schema de environment variables para:

* database;
* JWT;
* runtime;
* API URL;
* demais secrets obrigatórios.

Validar tipos e presença.

**Resultado esperado:**

Configuração inválida falha cedo e com mensagem clara.

**Critérios de conclusão:**

* env validado no startup;
* valores opcionais e obrigatórios claramente diferenciados;
* `.env.example` atualizado.

---

## TASK 1.6 — Hardening HTTP do backend

**Dependências:** TASK 1.5.

**Objetivo:** melhorar segurança da API.

**Escopo:**

* CORS restritivo;
* security headers;
* limite de payload;
* rate limiting em autenticação;
* respostas de erro sem stack trace;
* tratamento uniforme de exceções.

**Resultado esperado:**

API apresenta baseline de segurança adequado.

**Critérios de conclusão:**

* origem não autorizada é rejeitada;
* payload excessivo é rejeitado;
* auth rate-limited;
* erro interno não retorna stack trace;
* testes cobrem as políticas principais.

---

## TASK 1.7 — Revisar estratégia de sessão/autenticação

**Dependências:** TASK 1.6.

**Objetivo:** tornar autenticação adequada à evolução da aplicação.

**Escopo:**

Avaliar a implementação atual e definir uma estratégia explícita para:

* expiração de sessão;
* revogação;
* refresh;
* logout;
* sessão concorrente;
* token inválido.

A implementação deve ser compatível com a arquitetura existente.

**Resultado esperado:**

Existe uma estratégia de autenticação documentada e implementada sem depender apenas da existência física do cookie.

**Critérios de conclusão:**

* token expirado não autentica;
* token inválido não autentica;
* logout invalida sessão conforme a estratégia escolhida;
* middleware e backend possuem comportamento coerente.

---

# FASE 2 — Atualização do stack

## TASK 2.1 — Atualizar TypeScript e toolchain compartilhado

**Dependências:** FASE 1.

**Objetivo:** remover limitações do toolchain atual.

**Escopo:**

* TypeScript;
* typings;
* ESLint;
* Prettier;
* plugins relacionados.

**Resultado esperado:**

Toolchain atualizada sem alterar comportamento da aplicação.

**Critérios de conclusão:**

* lint passa;
* typecheck passa;
* build passa;
* nenhum workaround antigo permanece sem justificativa.

---

## TASK 2.2 — Migrar ESLint para configuração atual

**Dependências:** TASK 2.1.

**Objetivo:** eliminar dependências obsoletas de lint.

**Escopo:**

* flat config;
* TypeScript;
* React;
* React Hooks;
* accessibility rules;
* Next.js.

Atualizar scripts para usar ESLint CLI.

**Resultado esperado:**

Lint funciona independentemente de `next lint`.

**Critérios de conclusão:**

```text
pnpm lint
```

executa diretamente o ESLint e falha para violações configuradas.

---

## TASK 2.3 — Migrar Next.js

**Dependências:** TASK 2.2.

**Objetivo:** levar frontend para versão atual suportada.

**Escopo:**

* atualizar Next.js;
* adaptar breaking changes;
* revisar `cookies`;
* revisar `params`;
* revisar `searchParams`;
* revisar middleware/proxy;
* revisar `next.config`;
* revisar APIs depreciadas.

**Resultado esperado:**

Aplicação roda na versão alvo sem incompatibilidades conhecidas.

**Critérios de conclusão:**

* dev server funciona;
* build funciona;
* rotas públicas funcionam;
* rotas protegidas funcionam;
* login funciona;
* logout funciona;
* assets funcionam.

---

## TASK 2.4 — Migrar React

**Dependências:** TASK 2.3.

**Objetivo:** atualizar React e typings.

**Escopo:**

* React;
* React DOM;
* types;
* hooks;
* APIs incompatíveis.

**Resultado esperado:**

Aplicação funciona sobre a versão atual do React compatível com Next.js.

**Critérios de conclusão:**

* build;
* typecheck;
* lint;
* E2E básico

passam.

---

## TASK 2.5 — Atualizar dependências do frontend individualmente

**Dependências:** TASK 2.4.

**Objetivo:** eliminar dependências antigas restantes sem criar uma migração monolítica.

**Escopo:**

Atualizar individualmente:

* React Query;
* Radix;
* Sonner;
* React Hook Form;
* Zod;
* Axios;
* lucide;
* plugins Tailwind;
* demais bibliotecas.

**Regra:** cada grupo de atualização deve manter o projeto compilável.

**Resultado esperado:**

Dependências atuais e compatíveis.

**Critérios de conclusão:**

* lockfile atualizado;
* sem dependências vulneráveis críticas conhecidas;
* build e testes passam.

---

## TASK 2.6 — Atualizar Prisma e backend

**Dependências:** TASK 2.5.

**Objetivo:** atualizar ORM e toolchain backend.

**Escopo:**

* Prisma;
* Prisma Client;
* TypeScript;
* Express;
* Zod;
* ESLint;
* demais dependências backend.

**Resultado esperado:**

Backend moderno e compatível com o novo domínio.

**Critérios de conclusão:**

* migration funciona;
* Prisma Client gera;
* build funciona;
* testes passam.

---

## TASK 2.7 — Avaliar e migrar Tailwind

**Dependências:** TASK 2.5.

**Objetivo:** modernizar styling sem regressão visual.

**Escopo:**

* migrar Tailwind;
* revisar configuração;
* preservar tokens;
* adaptar utilities incompatíveis.

**Resultado esperado:**

Sistema de estilos atual e consistente.

**Critérios de conclusão:**

* build passa;
* páginas principais mantêm layout;
* nenhum CSS legado desnecessário permanece.

---

# FASE 3 — Qualidade e testes antes da mudança de domínio

## TASK 3.1 — Criar infraestrutura de testes

**Dependências:** FASE 2.

**Objetivo:** preparar base para refatorar o domínio com segurança.

**Escopo:**

Configurar:

* unit tests;
* integration tests;
* test database;
* test utilities;
* fixtures;
* mocks.

**Resultado esperado:**

Testes podem ser executados localmente e no CI.

**Critérios de conclusão:**

* comando único para testes;
* ambiente isolado;
* fixture mínima de usuário/carteira/ativo/transação.

---

## TASK 3.2 — Testar autenticação

**Dependências:** TASK 3.1.

**Escopo:**

Testar:

* signup;
* signin;
* senha inválida;
* token inválido;
* token expirado;
* logout;
* rota protegida.

**Critérios de conclusão:**

Todos cenários acima possuem testes automatizados.

---

## TASK 3.3 — Criar testes de regressão do fluxo atual de assets

**Dependências:** TASK 3.1.

**Objetivo:** preservar a funcionalidade existente durante a remodelagem.

**Escopo:**

Testar:

* adicionar asset;
* buscar asset;
* listar assets;
* excluir asset;
* paginação;
* busca.

**Critérios de conclusão:**

Fluxo atual está protegido por testes.

---

## TASK 3.4 — Criar testes de transações atuais

**Dependências:** TASK 3.1.

**Escopo:**

Testar:

* BUY;
* SELL;
* saldo insuficiente;
* criação;
* edição;
* exclusão.

**Critérios de conclusão:**

Os bugs de consistência conhecidos são reproduzidos por testes antes de serem corrigidos.

---

# FASE 4 — Reestruturação do domínio financeiro

## TASK 4.1 — Definir modelo conceitual de investimento

**Dependências:** FASE 3.

**Objetivo:** estabelecer contratos do novo domínio antes da migration.

**Modelo obrigatório:**

```text
User
 └── Portfolio
       ├── Position
             │    └── Instrument
                   └── Transaction
                   ```

                   **Conceitos obrigatórios:**

                   ```text
                   Instrument
                   Portfolio
                   Position
                   Transaction
                   MarketQuote
                   ```

                   **Resultado esperado:**

                   Modelo conceitual documentado.

                   **Critérios de conclusão:**

                   Cada entidade possui responsabilidade definida e não existe ambiguidade entre:

                   * ativo de mercado;
                   * posição;
                   * transação;
                   * valuation.

                   ---

## TASK 4.2 — Criar entidade Instrument

**Dependências:** TASK 4.1.

**Campos mínimos:**

```text
id
symbol
name
type
market
currency
sector
country
```

**Tipos mínimos:**

```text
STOCK
ETF
FUND
REIT
CRYPTO
BOND
TREASURY
CASH
OTHER
```

**Critérios de conclusão:**

* instrumentos existem independentemente de usuários;
* PETR4 pode existir uma única vez como instrumento;
* múltiplos usuários podem possuir o mesmo instrumento.

---

## TASK 4.3 — Corrigir Portfolio para suportar múltiplas carteiras

**Dependências:** TASK 4.2.

**Escopo:**

Alterar modelo para:

```text
User 1 → Portfolio A
User 1 → Portfolio B
User 2 → Portfolio A
```

**Campos mínimos:**

```text
id
userId
name
baseCurrency
createdAt
updatedAt
```

**Critérios de conclusão:**

* usuário pode possuir mais de uma carteira;
* carteira possui moeda base;
* nenhuma dependência indevida de uma única carteira por usuário permanece.

---

## TASK 4.4 — Criar Position

**Dependências:** TASK 4.3.

**Campos mínimos:**

```text
id
portfolioId
instrumentId
quantity
averageCost
```

**Constraints:**

```text
unique(portfolioId, instrumentId)
```

**Critérios de conclusão:**

* um instrumento possui no máximo uma posição por carteira;
* mesma posição pode existir em carteiras diferentes.

---

## TASK 4.5 — Remodelar Transaction

**Dependências:** TASK 4.4.

**Campos mínimos:**

```text
id
portfolioId
instrumentId
type
quantity
unitPrice
fees
taxes
currency
executedAt
broker
notes
createdAt
updatedAt
```

**Tipos mínimos:**

```text
BUY
SELL
DIVIDEND
INTEREST
DEPOSIT
WITHDRAWAL
SPLIT
BONUS
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT
```

**Critérios de conclusão:**

* transaction pertence explicitamente à carteira;
* transaction referencia instrumento;
* preço e quantidade são separados;
* taxas e impostos são armazenáveis;
* data de execução é independente de `createdAt`.

---

## TASK 4.6 — Criar serviço determinístico de reconstrução de posição

**Dependências:** TASK 4.5.

**Objetivo:** fazer da transação a fonte de verdade da movimentação.

**Regra:**

```text
transactions → position
```

Deve ser determinístico.

**Critérios de conclusão:**

Para uma mesma sequência de transações:

```text
quantity
averageCost
investedValue
```

sempre produzem o mesmo resultado.

---

## TASK 4.7 — Corrigir edição de transaction

**Dependências:** TASK 4.6.

**Objetivo:** eliminar dupla contabilização.

**Comportamento obrigatório:**

Ao editar:

```text
posição anterior
→ remover impacto antigo
→ aplicar impacto novo
```

ou reconstruir a posição integralmente.

**Critérios de conclusão:**

Teste:

```text
BUY 10 @ 10
EDIT → BUY 20 @ 15
```

produz exatamente a posição correspondente à nova sequência de transações.

---

## TASK 4.8 — Corrigir exclusão de transaction

**Dependências:** TASK 4.6.

**Objetivo:** manter consistência após delete.

**Escopo:**

* delete;
* reconstrução da posição;
* transação de banco;
* rollback em falha.

**Critérios de conclusão:**

Remover uma transação produz o mesmo resultado que recalcular a posição a partir das transações restantes.

---

## TASK 4.9 — Implementar transações de banco para operações financeiras

**Dependências:** TASK 4.7, TASK 4.8.

**Objetivo:** impedir estados parcialmente persistidos.

**Escopo:**

Operações financeiras envolvendo:

```text
transaction
position
```

devem ser atomicamente persistidas.

**Critérios de conclusão:**

Falha em qualquer etapa gera rollback completo.

---

## TASK 4.10 — Separar custo e valuation

**Dependências:** TASK 4.6.

**Objetivo:** eliminar semântica ambígua de `balance`.

**Remover conceito genérico de `balance` como fonte financeira principal.

**Resultados distintos:**

```text
quantity
averageCost
investedValue
marketPrice
marketValue
profitLoss
profitLossPercent
```

**Critérios de conclusão:**

Nenhum endpoint precisa interpretar `balance` de maneira ambígua.

---

# FASE 5 — Market data e valuation

## TASK 5.1 — Criar interface de Market Data Provider

**Dependências:** FASE 4.

**Objetivo:** desacoplar o domínio da fonte de cotação.

**Interface mínima:**

```text
getQuote(symbol)
getHistoricalPrices(symbol, range)
```

**Critérios de conclusão:**

* domínio não importa diretamente SDK de provider;
* provider pode ser substituído;
* testes utilizam provider fake.

---

## TASK 5.2 — Criar MarketQuote

**Dependências:** TASK 5.1.

**Campos mínimos:**

```text
instrumentId
timestamp
price
currency
source
```

**Critérios de conclusão:**

* preço possui timestamp;
* source é conhecido;
* moeda é explícita.

---

## TASK 5.3 — Criar valuation service

**Dependências:** TASK 5.2.

**Objetivo:** calcular valor de mercado.

**Regra base:**

```text
marketValue = quantity × marketPrice
```

**Resultado adicional:**

```text
profitLoss
profitLossPercent
```

conforme o método definido na camada de domínio.

**Critérios de conclusão:**

* valuation centralizado;
* frontend não implementa regra financeira;
* testes cobrem casos normais e extremos.

---

## TASK 5.4 — Criar histórico de preços

**Dependências:** TASK 5.2.

**Objetivo:** suportar gráficos e performance.

**Critérios de conclusão:**

* séries possuem timestamp;
* séries podem ser consultadas por intervalo;
* timezone é normalizado;
* fonte é identificável.

---

# FASE 6 — API orientada ao produto

## TASK 6.1 — Definir padrão de response

**Dependências:** FASE 5.

**Objetivo:** eliminar formatos inconsistentes.

**Paginação padrão:**

```text
items
page
pageSize
total
totalPages
```

**Erro padrão:**

```text
code
message
details
```

**Critérios de conclusão:**

Novos endpoints obedecem ao padrão.

---

## TASK 6.2 — Criar endpoint de Portfolio Overview

**Dependências:** TASK 6.1.

**Endpoint:**

```text
GET /v1/portfolio/overview
```

**Retornar no mínimo:**

```text
totalValue
investedValue
profitLoss
profitLossPercent
dayChange
dayChangePercent
```

**Critérios de conclusão:**

Uma única chamada fornece os KPIs necessários ao header do dashboard.

---

## TASK 6.3 — Criar endpoint de Positions

**Dependências:** TASK 6.2.

**Endpoint:**

```text
GET /v1/portfolio/positions
```

**Retornar:**

```text
symbol
name
quantity
averageCost
marketPrice
marketValue
allocation
profitLoss
profitLossPercent
```

**Critérios de conclusão:**

A tabela principal funciona sem consultar endpoint individual por ativo.

---

## TASK 6.4 — Criar endpoint de Transactions

**Dependências:** TASK 6.3.

**Filtros:**

```text
portfolio
instrument
type
dateFrom
dateTo
broker
```

**Critérios de conclusão:**

* filtros são server-side;
* paginação server-side;
* ordenação explícita.

---

## TASK 6.5 — Criar endpoint de performance

**Dependências:** TASK 5.4, TASK 6.2.

**Parâmetros:**

```text
range
portfolio
benchmark
```

**Retornar série temporal adequada para chart e tabela acessível.

**Critérios de conclusão:**

* períodos reproduzíveis;
* série da carteira;
* série do benchmark;
* timezone consistente.

---

## TASK 6.6 — Criar endpoint de allocation

**Dependências:** TASK 6.3.

**Retornar distribuição por:**

* ativo;
* classe;
* setor;
* moeda.

**Critérios de conclusão:**

Soma das alocações é consistente com o valuation total dentro da tolerância numérica definida.

---

# FASE 7 — Data fetching e estado frontend

## TASK 7.1 — Definir fronteira entre server state e UI state

**Dependências:** FASE 6.

**Objetivo:** reduzir estado local excessivo.

**Server state:**

* portfolio;
* positions;
* transactions;
* quotes;
* performance.

**UI state:**

* modal aberto;
* filtro temporário;
* seleção;
* tabs;
* menu.

**Critérios de conclusão:**

Nenhum dado de servidor é duplicado desnecessariamente em `useState`.

---

## TASK 7.2 — Criar hooks de domínio

**Dependências:** TASK 7.1.

Criar abstrações:

```text
usePortfolioOverview
usePositions
useTransactions
usePerformance
useAllocation
```

**Critérios de conclusão:**

Componentes não conhecem detalhes de URL, Axios ou query key.

---

## TASK 7.3 — Normalizar query keys

**Dependências:** TASK 7.2.

**Critérios de conclusão:**

Query keys seguem padrão consistente e invalidations são previsíveis.

---

## TASK 7.4 — Eliminar N+1 da tela de posições

**Dependências:** TASK 6.3.

**Objetivo:** resolver o problema atual em que a tabela pode disparar consultas individuais de transações por ativo.

**Critérios de conclusão:**

Renderizar 50 posições não gera 50 requests adicionais para obter métricas da tabela.

---

# FASE 8 — Dashboard principal

## TASK 8.1 — Criar shell de Overview

**Dependências:** FASE 7.

**Objetivo:** criar nova página principal do produto.

**Seções:**

```text
Header
KPI cards
Portfolio chart
Allocation
Positions
Recent transactions
```

**Critérios de conclusão:**

Usuário consegue compreender o estado da carteira sem acessar outra seção.

---

## TASK 8.2 — Criar Portfolio Value Card

**Dependências:** TASK 8.1.

**Mostrar:**

* patrimônio;
* variação diária;
* variação percentual;
* timestamp/indicador de atualização.

**Estados:**

* loading;
* success;
* empty;
* error;
* stale.

**Critérios de conclusão:**

Todos os estados possuem representação visual e semântica.

---

## TASK 8.3 — Criar Performance Chart

**Dependências:** TASK 6.5, TASK 8.1.

**Períodos:**

```text
1D
1W
1M
3M
6M
1Y
YTD
ALL
```

**Critérios de conclusão:**

* período selecionável;
* responsivo;
* tooltip;
* dados acessíveis em alternativa textual/tabular;
* sem cálculo financeiro no componente visual.

---

## TASK 8.4 — Criar Allocation Chart

**Dependências:** TASK 6.6, TASK 8.1.

**Critérios de conclusão:**

* ativo/classe selecionável;
* legenda;
* percentual;
* valor;
* alternativa textual acessível;
* layout responsivo.

---

## TASK 8.5 — Criar Recent Transactions

**Dependências:** TASK 6.4.

**Critérios de conclusão:**

* lista ordenada;
* tipo;
* ativo;
* quantidade;
* preço;
* data;
* link para detalhe.

---

# FASE 9 — Posições

## TASK 9.1 — Redesenhar PositionsTable

**Dependências:** TASK 6.3, FASE 8.

**Colunas:**

```text
Ativo
Quantidade
Preço médio
Preço atual
Valor
Alocação
P&L
P&L %
```

**Critérios de conclusão:**

* ordenação;
* busca;
* filtros;
* paginação;
* loading;
* empty;
* error;
* keyboard navigation.

---

## TASK 9.2 — Criar Asset Detail

**Dependências:** TASK 9.1.

**Seções:**

```text
Overview
Position
Performance
Transactions
Income
```

**Critérios de conclusão:**

O usuário consegue sair da tabela para uma visão contextual do ativo.

---

## TASK 9.3 — Criar Transaction Manager

**Dependências:** TASK 6.4.

**Operações:**

* create;
* edit;
* delete.

**Critérios de conclusão:**

* formulário validado;
* confirmação antes de ações destrutivas;
* atualização consistente da posição;
* erros apresentados sem perder os dados digitados.

---

# FASE 10 — Proventos e renda

## TASK 10.1 — Implementar modelo de income

**Dependências:** TASK 4.5.

**Tipos:**

```text
DIVIDEND
JCP
INTEREST
BONUS
```

**Critérios de conclusão:**

Proventos não são representados como BUY/SELL.

---

## TASK 10.2 — Criar Income API

**Dependências:** TASK 10.1.

**Retornar:**

```text
currentMonth
currentYear
allTime
yield
yieldOnCost
```

**Critérios de conclusão:**

Valores podem ser filtrados por período e carteira.

---

## TASK 10.3 — Criar Income dashboard

**Dependências:** TASK 10.2.

**Critérios de conclusão:**

* visão mensal;
* anual;
* histórico;
* próximos eventos quando houver dados disponíveis;
* mobile;
* acessibilidade.

---

# FASE 11 — Performance e Analytics

## TASK 11.1 — Criar performance engine

**Dependências:** TASK 5.4.

**Calcular:**

* retorno absoluto;
* retorno percentual;
* aportes;
* retiradas;
* time-weighted return;
* money-weighted return.

**Critérios de conclusão:**

Cada métrica possui fórmula documentada e testes.

---

## TASK 11.2 — Adicionar benchmarks

**Dependências:** TASK 11.1.

**Benchmarks iniciais:**

```text
IBOV
CDI
USD/BRL
```

**Critérios de conclusão:**

* carteira e benchmark usam o mesmo período;
* comparação pode ser ativada/desativada;
* timezone e calendário são tratados explicitamente.

---

## TASK 11.3 — Implementar drawdown

**Dependências:** TASK 11.1.

**Retornar:**

```text
maxDrawdown
currentDrawdown
recovery
```

**Critérios de conclusão:**

Testes cobrem pico, queda e recuperação.

---

## TASK 11.4 — Implementar métricas de risco

**Dependências:** TASK 11.2, TASK 11.3.

**Métricas iniciais:**

```text
volatility
Sharpe
beta
correlation
```

**Critérios de conclusão:**

* fórmulas documentadas;
* período explícito;
* dados insuficientes produzem estado controlado;
* não mostrar precisão falsa.

---

# FASE 12 — Design system

## TASK 12.1 — Consolidar tokens

**Dependências:** FASE 8.

**Criar tokens semânticos para:**

```text
background
surface
surface-elevated
foreground
muted
border
primary
positive
negative
warning
info
focus
```

Além de:

* spacing;
* radius;
* typography;
* elevation.

**Critérios de conclusão:**

Novos componentes não dependem de valores arbitrários espalhados pelo código.

---

## TASK 12.2 — Criar primitives financeiras

**Dependências:** TASK 12.1.

Criar:

```text
Money
Percentage
Metric
Trend
MarketValue
ProfitLoss
Price
Quantity
```

**Critérios de conclusão:**

Formatação monetária e percentual é centralizada.

---

## TASK 12.3 — Criar PageHeader e SectionHeader

**Dependências:** TASK 12.1.

**Critérios de conclusão:**

As principais páginas usam hierarquia visual consistente.

---

## TASK 12.4 — Criar estados de dados reutilizáveis

**Dependências:** TASK 12.1.

Criar:

```text
LoadingState
EmptyState
ErrorState
StaleState
NoResultsState
```

**Critérios de conclusão:**

Features não implementam estados de dados inconsistentes individualmente.

---

# FASE 13 — Navegação e arquitetura visual

## TASK 13.1 — Redesenhar navegação desktop

**Dependências:** FASE 12.

**Estrutura:**

```text
Overview
Portfolio
  Positions
    Transactions
      Income
      Analytics
        Performance
          Allocation
            Risk
            Market
              Watchlist
              Settings
              ```

              **Critérios de conclusão:**

              * navegação por teclado;
              * item ativo semanticamente identificável;
              * labels claros;
              * conteúdo não fica escondido por sidebar.

              ---

## TASK 13.2 — Criar navegação mobile

**Dependências:** TASK 13.1.

**Estrutura mínima:**

```text
Overview
Portfolio
Market
Analytics
More
```

**Critérios de conclusão:**

* funcional em telas pequenas;
* área de toque adequada;
* foco correto;
* rotas acessíveis.

---

## TASK 13.3 — Preservar contexto de navegação

**Dependências:** TASK 13.1.

**Objetivo:** filtros importantes não devem desaparecer arbitrariamente.

**Critérios de conclusão:**

* filtros relevantes podem ser representados na URL;
* refresh não perde contexto essencial;
* deep links funcionam.

---

# FASE 14 — Acessibilidade

## TASK 14.1 — Definir baseline WCAG

**Dependências:** FASE 12.

**Objetivo:** estabelecer WCAG 2.2 AA como baseline.

**Critérios de conclusão:**

Checklist documentado para:

* teclado;
* foco;
* semântica;
* contraste;
* forms;
* dialogs;
* dynamic content.

---

## TASK 14.2 — Revisar semantic HTML

**Dependências:** TASK 14.1.

**Escopo:**

Corrigir:

* landmarks;
* heading hierarchy;
* buttons;
* links;
* nav;
* tables;
* lists.

**Critérios de conclusão:**

Nenhuma ação primária depende de `<div>` clicável.

---

## TASK 14.3 — Revisar keyboard navigation

**Dependências:** TASK 14.2.

**Testar:**

```text
Tab
Shift+Tab
Enter
Space
Esc
Arrow keys
```

onde aplicável.

**Critérios de conclusão:**

Todos os fluxos principais são executáveis apenas com teclado.

---

## TASK 14.4 — Revisar focus management

**Dependências:** TASK 14.3.

**Escopo:**

* dialogs;
* menus;
* sheets;
* dropdowns;
* filtros;
* navegação mobile.

**Critérios de conclusão:**

* foco entra corretamente;
* foco permanece preso quando necessário;
* foco retorna para elemento de origem;
* nenhum elemento fica sem foco lógico após fechar overlay.

---

## TASK 14.5 — Revisar labels e mensagens de erro

**Dependências:** TASK 14.4.

**Critérios de conclusão:**

* todos inputs têm nome acessível;
* erro associado ao input;
* required state identificado;
* mensagens de sucesso/erro anunciáveis.

---

## TASK 14.6 — Implementar suporte a reduced motion

**Dependências:** TASK 14.5.

**Critérios de conclusão:**

Com `prefers-reduced-motion` ativado:

* animações não essenciais são reduzidas/removidas;
* spinner continua funcional;
* nenhuma informação depende de animação.

---

## TASK 14.7 — Auditoria automatizada de acessibilidade

**Dependências:** TASK 14.6.

**Ferramentas:**

* axe;
* Lighthouse;
* testes E2E de teclado.

**Critérios de conclusão:**

* zero violações críticas;
* Lighthouse accessibility >= 95 nas páginas principais;
* problemas restantes documentados com justificativa explícita.

---

# FASE 15 — Responsividade

## TASK 15.1 — Definir breakpoints e regras de layout

**Dependências:** FASE 12.

**Breakpoints mínimos de validação:**

```text
320px
375px
768px
1024px
1440px
```

**Critérios de conclusão:**

Layout possui comportamento documentado em todos os breakpoints.

---

## TASK 15.2 — Adaptar dashboard

**Dependências:** FASE 8.

**Desktop:**

multi-column.

**Tablet:**

cards adaptativos.

**Mobile:**

cards empilhados.

**Critérios de conclusão:**

* nenhum overflow horizontal inesperado;
* gráficos utilizáveis;
* textos não truncados sem alternativa;
* ações principais continuam acessíveis.

---

## TASK 15.3 — Adaptar positions

**Dependências:** TASK 9.1.

**Objetivo:** evitar simplesmente aplicar scroll horizontal indiscriminadamente.

**Critérios de conclusão:**

Em mobile:

* informações prioritárias permanecem visíveis;
* secundárias possuem alternativa;
* ações continuam acessíveis.

---

## TASK 15.4 — Adaptar formulários e dialogs

**Dependências:** TASK 9.3.

**Critérios de conclusão:**

* dialogs podem ocupar tela integral quando necessário;
* nenhum input fica escondido pelo teclado virtual;
* CTA permanece acessível.

---

# FASE 16 — Performance

## TASK 16.1 — Auditar requests

**Dependências:** FASE 9.

**Objetivo:** reduzir overfetching e requests redundantes.

**Escopo:**

Auditar:

* waterfall;
* duplicidade;
* N+1;
* refetch excessivo;
* stale time;
* invalidation.

**Critérios de conclusão:**

Cada request adicional possui justificativa explícita.

---

## TASK 16.2 — Separar Server Components e Client Components

**Dependências:** FASE 8.

**Objetivo:** reduzir JavaScript enviado ao cliente.

**Critério:**

Converter para Server Component tudo que não exige interação, sem forçar client-side state onde não necessário.

**Critérios de conclusão:**

* componentes interativos permanecem client;
* componentes estáticos são server;
* build funciona;
* UX não sofre regressão.

---

## TASK 16.3 — Otimizar charts

**Dependências:** FASE 8.

**Escopo:**

* lazy loading quando adequado;
* reduzir pontos desnecessários;
* evitar rerenders;
* memoização baseada em profiling;
* resize eficiente.

**Critérios de conclusão:**

Gráficos não causam bloqueio perceptível do dashboard.

---

## TASK 16.4 — Otimizar tabelas

**Dependências:** TASK 9.1.

**Escopo:**

* paginação;
* virtualização apenas quando necessária;
* evitar renderizações redundantes;
* memoização baseada em evidência.

**Critérios de conclusão:**

Tabela permanece responsiva com volume grande de posições/transações.

---

## TASK 16.5 — Auditar bundle

**Dependências:** FASE 16.

**Objetivo:** identificar dependências e módulos excessivamente pesados.

**Critérios de conclusão:**

* dependências grandes identificadas;
* imports desnecessários removidos;
* bibliotecas redundantes avaliadas.

---

# FASE 17 — Testes de produto

## TASK 17.1 — E2E do fluxo principal

**Dependências:** FASE 16.

**Fluxo:**

```text
Sign up
→ Login
→ Create portfolio
→ Add instrument
→ Buy
→ Dashboard
→ Position
→ Sell
→ Verify P&L
→ Logout
```

**Critérios de conclusão:**

Fluxo executa sem intervenção manual.

---

## TASK 17.2 — E2E de múltiplas carteiras

**Dependências:** TASK 17.1.

**Critérios de conclusão:**

* criar duas carteiras;
* adicionar mesmo instrumento nas duas;
* valores permanecem isolados.

---

## TASK 17.3 — E2E de consistência de transações

**Dependências:** TASK 17.1.

Testar:

```text
create
edit
delete
recalculate
```

**Critérios de conclusão:**

Resultado final coincide com cálculo esperado a partir do ledger.

---

## TASK 17.4 — E2E responsive

**Dependências:** FASE 15.

Executar em:

```text
mobile
tablet
desktop
```

**Critérios de conclusão:**

Principais fluxos funcionam em todos os breakpoints definidos.

---

## TASK 17.5 — E2E accessibility

**Dependências:** FASE 14.

**Critérios de conclusão:**

Fluxos principais executam sem mouse e sem violações críticas detectadas por ferramenta automatizada.

---

# FASE 18 — Observabilidade e confiabilidade

## TASK 18.1 — Logs estruturados

**Dependências:** FASE 1.

**Objetivo:** facilitar diagnóstico de produção.

**Escopo:**

* request id;
* user id quando seguro;
* route;
* status;
* duration;
* error code.

**Critérios de conclusão:**

Logs não dependem de `console.log` arbitrário.

---

## TASK 18.2 — Error taxonomy

**Dependências:** TASK 18.1.

**Criar categorias:**

```text
VALIDATION
AUTHENTICATION
AUTHORIZATION
NOT_FOUND
CONFLICT
DOMAIN
INFRASTRUCTURE
INTERNAL
```

**Critérios de conclusão:**

Erros de API possuem códigos estáveis e classificáveis.

---

## TASK 18.3 — Health checks

**Dependências:** TASK 18.1.

Criar:

```text
/health
/ready
```

quando compatível com o deployment.

**Critérios de conclusão:**

Health e readiness distinguem processo vivo de dependências disponíveis.

---

# FASE 19 — Documentação e governança

## TASK 19.1 — Atualizar README

**Dependências:** FASE 2.

**Documentar:**

* arquitetura;
* setup;
* env;
* database;
* scripts;
* testes;
* deploy.

**Critérios de conclusão:**

Novo desenvolvedor consegue iniciar o projeto seguindo apenas o README.

---

## TASK 19.2 — Documentar arquitetura

**Dependências:** FASE 4.

**Documentar:**

```text
Frontend
API
Domain
Persistence
Market Data
Authentication
```

**Critérios de conclusão:**

Cada camada possui responsabilidade documentada.

---

## TASK 19.3 — Documentar regras financeiras

**Dependências:** FASE 11.

Documentar:

* preço médio;
* custo;
* P&L;
* valuation;
* performance;
* dividendos;
* benchmarks;
* drawdown.

**Critérios de conclusão:**

Cada métrica possui definição matemática explícita.

---

# FASE 20 — Finalização e hardening

## TASK 20.1 — Remover código morto

**Dependências:** todas as features.

**Escopo:**

* imports;
* componentes;
* endpoints;
* types;
* utilities;
* flags;
* TODOs obsoletos.

**Critérios de conclusão:**

Nenhum código morto conhecido permanece sem justificativa.

---

## TASK 20.2 — Remover duplicações

**Dependências:** TASK 20.1.

**Escopo:**

Identificar duplicações em:

* API clients;
* formatters;
* query hooks;
* states;
* dialogs;
* validation schemas;
* domain logic.

**Critérios de conclusão:**

Duplicações relevantes possuem uma única implementação compartilhada.

---

## TASK 20.3 — Auditoria final de dependências

**Dependências:** TASK 20.2.

**Critérios de conclusão:**

* dependências desnecessárias removidas;
* vulnerabilidades críticas conhecidas resolvidas;
* lockfile atualizado;
* versões principais documentadas.

---

## TASK 20.4 — Auditoria final de segurança

**Dependências:** TASK 20.3.

Verificar:

* secrets;
* cookies;
* JWT;
* CORS;
* headers;
* rate limiting;
* input validation;
* authorization;
* logs.

**Critérios de conclusão:**

Checklist de segurança aprovado.

---

## TASK 20.5 — Auditoria final de performance

**Dependências:** TASK 20.4.

Verificar:

* bundle;
* requests;
* TTFB;
* LCP;
* CLS;
* INP;
* charts;
* tables.

**Critérios de conclusão:**

Métricas possuem baseline, resultado atual e eventuais gaps documentados.

---

## TASK 20.6 — Auditoria final de acessibilidade

**Dependências:** TASK 20.5.

**Critérios de conclusão:**

* WCAG 2.2 AA;
* axe sem critical violations;
* keyboard flows;
* screen reader smoke test;
* focus behavior.

---

## TASK 20.7 — Release candidate

**Dependências:** TASK 20.6.

**Objetivo:** consolidar a versão candidata.

**Checklist obrigatório:**

```text
lint
typecheck
unit tests
integration tests
build
e2e
accessibility
responsive
security
performance
```

**Critérios de conclusão:**

Todos os checks passam e qualquer exceção está explicitamente documentada.

---

# Dependências macro

A ordem geral deve ser preservada:

```text
FASE 0
  ↓
  FASE 1
    ↓
    FASE 2
      ↓
      FASE 3
        ↓
        FASE 4
          ↓
          FASE 5
            ↓
            FASE 6
              ↓
              FASE 7
                ↓
                FASE 8
                  ↓
                  FASE 9
                    ↓
                    FASE 10
                      ↓
                      FASE 11
                        ↓
                        FASE 12
                          ↓
                          FASE 13
                            ↓
                            FASE 14 + FASE 15
                              ↓
                              FASE 16
                                ↓
                                FASE 17
                                  ↓
                                  FASE 18
                                    ↓
                                    FASE 19
                                      ↓
                                      FASE 20
                                      ```

                                      As fases 14 e 15 podem ocorrer parcialmente em paralelo com 12 e 13, mas sua validação final deve ocorrer depois que as telas principais estiverem implementadas.

                                      ---

# Marcos de entrega

## MILESTONE 1 — Plataforma estabilizada

Inclui:

```text
Baseline
Tooling
CI
Security
Node
Next
React
Prisma
Tests foundation
```

**Resultado:**

Projeto tecnicamente atualizado e confiável para mudanças estruturais.

---

## MILESTONE 2 — Domínio financeiro confiável

Inclui:

```text
Instrument
Portfolio
Position
Transaction
MarketQuote
Valuation
```

**Resultado:**

Dados financeiros passam a ter fonte de verdade consistente.

---

## MILESTONE 3 — Portfolio API

Inclui:

```text
Overview
Positions
Transactions
Performance
Allocation
```

**Resultado:**

Frontend possui contratos orientados ao produto.

---

## MILESTONE 4 — Dashboard MVP

Inclui:

```text
Overview
Portfolio Value
Performance
Allocation
Positions
Recent Transactions
```

**Resultado:**

Primeira versão comparável, em experiência, a um produto moderno de portfolio management.

---

## MILESTONE 5 — Analytics

Inclui:

```text
Performance
Benchmarks
Income
Drawdown
Risk
```

**Resultado:**

Aplicação passa de acompanhamento para análise.

---

## MILESTONE 6 — Product polish

Inclui:

```text
Design system
Responsive
Accessibility
Performance
E2E
Security
Observability
```

**Resultado:**

Produto consistente, acessível, responsivo, performático e pronto para evolução contínua.

---

# Definition of Done global

Uma task só deve ser considerada concluída quando:

```text
[ ] objetivo implementado
[ ] escopo respeitado
[ ] comportamento esperado validado
[ ] testes relevantes adicionados/atualizados
[ ] lint passando
[ ] typecheck passando
[ ] build passando quando aplicável
[ ] accessibility considerada
[ ] responsive considerado quando aplicável
[ ] nenhuma regressão conhecida
[ ] documentação atualizada quando necessário
```

Uma feature só deve ser considerada pronta quando também possui:

```text
[ ] loading
[ ] empty state
[ ] error state
[ ] success state
[ ] keyboard support
[ ] responsive behavior
[ ] semantic HTML
[ ] observability adequada
```

# Ordem recomendada para o agent

O agent deve executar **uma task por vez**, respeitando as dependências.

Não deve antecipar tarefas de UI sofisticada enquanto as tasks de domínio correspondentes não estiverem concluídas.

Especialmente:

```text
NÃO:
Dashboard → corrigir domínio depois

SIM:
Domínio → API → dados → dashboard
```

O objetivo da primeira metade do programa é garantir que o produto esteja **correto por baixo**. A segunda metade deve tornar essa fundação **excelente por cima**.

O resultado final deve preservar a maior parte do investimento existente no EX3, mas mudar progressivamente seu modelo mental de:

```text
CRUD de Assets
```

para:

```text
Investment Platform
    ↓
    Portfolio
        ↓
        Positions
            ↓
            Transactions
                ↓
                Market Data
                    ↓
                    Valuation
                        ↓
                        Performance
                            ↓
                            Analytics
                                ↓
                                Decision Support
                                ```
