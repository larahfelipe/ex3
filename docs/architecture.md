# Arquitetura

Quem é responsável pelo quê, em que direção as dependências apontam e o que não pertence a cada camada. O significado das entidades está em [`domain-model.md`](domain-model.md), e os contratos de cada rota, em [`api-inventory.md`](api-inventory.md).

## Mapa

```text
                    ┌─────────────────────────────────────────────┐
navegador ─────────▶│ Frontend            web/src/app, components,│
                    │                     hooks, providers        │
                    ├─────────────────────────────────────────────┤
                    │ proxy Next          web/src/app/api/v1      │──┐
                    └─────────────────────────────────────────────┘  │ Bearer
                                                                     ▼
                    ┌─────────────────────────────────────────────┐
                    │ API        routes ▸ middleware ▸ controllers│
                    │            ▸ services                       │
                    ├──────────────────────┬──────────────────────┤
                    │ Domain               │ portas: MarketData-  │
                    │ cálculo puro         │ Provider             │
                    ├──────────────────────┼──────────────────────┤
                    │ Persistence          │ Market Data          │
                    │ infra/database       │ infra/market-data    │
                    └──────────┬───────────┴───────────┬──────────┘
                               ▼                       ▼
                          PostgreSQL              YH Finance

Authentication atravessa as camadas: cookie e redirecionamento no web,
Bearer no proxy, verificação no middleware da API, hash e assinatura na infra.
```

| Camada | Código | Pode importar | Nunca importa |
| --- | --- | --- | --- |
| Frontend | `web/src/app`, `components`, `hooks`, `providers`, `lib` | o próprio proxy, por HTTP | backend, driver de banco |
| API | `backend/src/routes`, `middleware`, `controllers`, `validation`, `services` | Domain, Persistence, Market Data | — |
| Domain | `backend/src/domain` | só a si mesmo | `@/infra`, `express` |
| Persistence | `backend/src/infra/database` | Domain | `express`, `@/services` |
| Market Data | `backend/src/infra/market-data` | Domain (a porta que implementa) | `express`, `@/services` |
| Authentication | `web/src/proxy.ts`, `web/src/lib`, `backend/src/middleware/AuthMiddleware.ts`, `backend/src/infra/cryptography` | a camada em que reside | — |

As três últimas colunas são verificáveis por busca, e as buscas correspondentes não devolvem nada hoje:

```sh
cd backend/src
grep -rl "from '@/infra" domain          # o domínio não alcança infraestrutura
grep -rl "from 'express'" domain services # nem domínio nem service conhecem HTTP
grep -rl '@prisma/client' controllers     # nenhum controller fala com o banco
```

A única dependência de `@prisma/client` fora de `infra/database` é `Prisma.Decimal`, o tipo numérico que o domínio usa para não calcular dinheiro em ponto flutuante — valor, não acesso a banco.

## Frontend

**Responsabilidade:** renderizar o estado que a API entrega e capturar a intenção do usuário. Não calcula número de domínio: preço médio, valor de mercado, alocação e retorno chegam prontos, na moeda base que a resposta informa.

`web/src/app` é o App Router, em dois grupos: `(public)` com sign-in e sign-up, `(protected)` com overview, ativos e conta. `web/src/proxy.ts` roda antes de cada requisição de página, decide sessão e emite a CSP com nonce. `components/ui` são primitivos sobre Radix e Tailwind; `components` são os compostos do produto. `providers/app-provider.tsx` monta o `QueryClient`, o error boundary com `Suspense` e o `Toaster`.

**Regra de leitura:** todo request do browser nasce de um hook de `web/src/hooks` sobre o TanStack Query — nenhuma tela chama `fetch` por conta própria, e cada request existente está inventariado em [`data-fetching.md`](data-fetching.md). Critérios de acessibilidade, layout e performance do frontend estão em [`accessibility.md`](accessibility.md), [`responsiveness.md`](responsiveness.md) e [`performance.md`](performance.md).

**Proxy.** Os Route Handlers de `web/src/app/api/v1` são a fronteira: leem o cookie `httpOnly` `ex3:token`, mandam `Authorization: Bearer` ao backend e devolvem o corpo da API. O navegador nunca recebe o token nem a URL do backend — `API_URL` só existe no servidor do Next.

## API

**Responsabilidade:** traduzir HTTP em caso de uso e caso de uso em HTTP. É a única camada que conhece `Request` e `Response`.

| Módulo | Faz | Não faz |
| --- | --- | --- |
| `routes` | declara caminho, método e a cadeia de middlewares | lógica |
| `middleware` | correlação e log, helmet, CORS, limite de corpo, rate limit, autenticação, 404 e o error boundary | regra de negócio |
| `controllers` | valida a entrada com zod e chama um service | acessar repositório ou provedor |
| `services` | orquestra o caso de uso: posse, repositórios, provedor, transação de banco | conhecer HTTP |
| `validation` | schemas zod e o `validate` que converte `ZodError` em `ValidationError` | — |
| `errors` | as classes que nomeiam cada categoria de falha | responder |

A ordem dos middlewares em `config/App.ts` é significativa: o log é o primeiro, para que toda requisição tenha id, inclusive a que morre no CORS ou no rate limit; o error boundary é o último. O envelope `{ code, message, details }` e as oito categorias estão em [`errors.md`](errors.md); o formato das linhas de log, em [`observability.md`](observability.md).

Controllers e services são singletons com `getInstance`, compostos à mão no `index.ts` de cada pasta de controller. O handler que a rota registra monta o grafo daquele caso de uso e delega; como cada peça é singleton, montar é barato e a árvore de dependências fica explícita num só arquivo por assunto.

## Domain

**Responsabilidade:** as regras que definem o produto, como funções puras sobre valores. Sem I/O, sem Prisma além do tipo decimal, sem `Request`.

| Módulo | Regra que guarda |
| --- | --- |
| `PositionLedger` | reconstrói a posição a partir do razão ordenado e recusa o razão impossível |
| `PositionValuation` | custo, valor de mercado e resultado de uma posição |
| `PortfolioValuation` | posições da carteira na moeda base, filtro, ordenação e alocação |
| `PortfolioPerformance` | série diária de valor, aporte líquido e retorno ponderado no tempo |
| `PriceHistory` | a janela de dias que falta buscar e o recorte por fechamento |
| `models` | os tipos do domínio, independentes das linhas do banco |
| `MarketDataProvider` | a **porta** por onde entra preço, definida aqui e implementada fora |

É a camada mais testada e a mais barata de testar: os testes unitários exercitam esses módulos sem banco, sem rede e sem relógio real.

## Persistence

**Responsabilidade:** guardar e recuperar o estado, e ser o único lugar do código que fala SQL ou Prisma.

`PrismaClient` é o singleton que carrega o adapter `@prisma/adapter-pg` e expõe `runSerializable`, que roda uma operação em transação serializável e a repete até três vezes quando o Postgres aborta por conflito de escrita. Cada repositório cobre um agregado (`User`, `Portfolio`, `Asset`, `Transaction`, `Instrument`, `MarketQuote`, `ExchangeRate`) e converte linha em modelo de domínio — decimal vira string, nunca `number`. Quando a operação abrange mais de uma tabela, ela roda em transação serializável: aberta pelo próprio repositório, como em `UserRepository.delete`, ou recebida como `TransactionClient` da operação maior, como em `TransactionRepository`.

O schema e as migrations vivem em `backend/prisma`. Nenhuma escrita de domínio acontece fora de uma transação quando toca mais de uma tabela: gravar transação, excluir ativo e excluir conta são atômicas.

## Market Data

**Responsabilidade:** obter preço e câmbio de fora, sem que isso vaze para o domínio.

`YahooFinanceProvider` implementa a porta `MarketDataProvider`: traduz símbolo do catálogo para o símbolo do provedor, envia a chave só no header do seu próprio origin, recusa redirecionamento e valida com zod tudo o que recebe — resposta de provedor é entrada não confiável. Guarda cotação por 60s, junta na mesma requisição um símbolo já em voo e, depois de uma falha, responde 30s com a última cotação observada em vez de insistir, registrando `quote_provider_unavailable`.

Falha do provedor nunca vira 500: a porta responde `not-found`, `unavailable` ou `range-not-served`, e o service omite do corpo o campo que dependia daquele preço, mantendo o 200. Fechamento diário é persistido (`MarketQuoteRepository`, `ExchangeRateRepository`) e só os dias que faltam são pedidos.

## Authentication

**Responsabilidade:** provar quem é o chamador em cada requisição e revogar sessão quando o usuário manda.

| Ponto | O que decide |
| --- | --- |
| `web/src/proxy.ts` | rota protegida sem token válido redireciona para o sign-in; token expirado é apagado |
| `web/src/lib/session.ts` | grava o cookie `httpOnly` com a própria expiração do token |
| `web/src/app/api/v1/**` | anexa `Authorization: Bearer`; sem cookie, responde 401 sem chamar o backend |
| `backend/src/middleware/AuthMiddleware.ts` | verifica assinatura e compara a claim `sessionVersion` com a linha do usuário |
| `backend/src/infra/cryptography` | `Jwt` assina e verifica; `Bcrypt` deriva e confere a senha |

A sessão é estatal de propósito: sign-in, sign-out e troca de senha incrementam `sessionVersion` e invalidam todo token emitido antes. As decisões e o que já foi corrigido estão em [`authentication.md`](authentication.md).

## Como um request atravessa

`GET /v1/portfolio/positions`, do clique ao corpo:

1. O hook `usePositions` pede `/api/v1/portfolio/positions` ao próprio Next.
2. O Route Handler lê o cookie, monta `Authorization: Bearer` e chama o backend.
3. `requestLogMiddleware` atribui o id da requisição e instala o listener de `finish`; helmet, CORS, limite de corpo e rate limit rodam em seguida.
4. `portfolioRouter` casa o caminho e roda `authMiddleware`, que resolve `req.user`.
5. O handler da rota compõe repositórios, service e controller, e delega.
6. O controller valida a query com zod e chama `execute` com o `userId` autenticado — nunca com um id vindo do corpo.
7. O service confirma a posse da carteira, lê ativos e razão, pede cotação e câmbio à porta e entrega os valores às funções do domínio.
8. O controller responde `200` com a página; erro tipado em qualquer ponto sobe até o error boundary e vira envelope.
9. Na finalização da resposta, sai uma linha de log com id, rota, status, duração e o código do erro, se houve.

## Limites conhecidos

* As rotas registram os handlers com `as Application` em 29 pontos: os controllers devolvem `Promise<Response>`, e a assinatura do Express 5 espera `void`. `HealthRoutes.ts` mostra o caminho sem cast — responder e retornar `void`.
* A composição por caso de uso é escrita à mão nos `index.ts` dos controllers. É explícita e sem contêiner de injeção, ao custo de repetição quando um service ganha uma dependência.
* O frontend não tem runner de teste; os seus gates são `lint`, `typecheck` e `build` (TD-058 em [`../TODO.md`](../TODO.md)).
