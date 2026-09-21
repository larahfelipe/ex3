# ex3

Carteira de investimentos: registra transações, reconstrói a posição de cada ativo a partir do razão e reporta custo, valor de mercado, alocação e performance na moeda base da carteira.

Dois pacotes independentes, cada um com o seu `package.json` e o seu lockfile. Não há `package.json` na raiz nem workspace pnpm: todo comando roda dentro de `backend/` ou de `web/`.

| Pacote | Stack | Porta local |
| --- | --- | --- |
| `backend` | Node 24, Express 5, Prisma 7 sobre PostgreSQL 17 | 8080 |
| `web` | Next.js 16 (App Router), React 19, TanStack Query | 3000 |

## Arquitetura

```text
navegador ──▶ web                                ──▶ backend                      ──▶ PostgreSQL
              app/(public)   sign-in, sign-up        routes ──▶ middleware             (Prisma 7)
              app/(protected) overview, assets,             ──▶ controllers
                              account                       ──▶ services
              app/api/v1     proxy, cookie httpOnly         ──▶ domain (puro)      ──▶ YH Finance
```

O navegador nunca fala com o backend. Toda requisição passa pelos Route Handlers de `web/src/app/api/v1`, que leem o JWT do cookie `httpOnly` `ex3:token` e o repassam como `Authorization: Bearer`. O backend não conhece cookie nem sessão de browser.

No backend, cada camada só depende da de baixo: `routes` declara o contrato HTTP, `services` orquestra caso de uso e transação de banco, `domain` é cálculo puro e testável sem I/O (razão, valuation, performance, histórico de preços), e `infra` isola Prisma, provedor de cotações, criptografia e log estruturado. Erro nasce tipado em qualquer camada e vira envelope HTTP num único error boundary.

Ponto de entrada de cada assunto: [`docs/domain-model.md`](docs/domain-model.md) para o significado das entidades, [`docs/api-inventory.md`](docs/api-inventory.md) para as rotas e o formato das respostas, [`docs/authentication.md`](docs/authentication.md) para sessão e autorização, [`docs/security.md`](docs/security.md) para o checklist de segurança.

## Requisitos

| Ferramenta | Versão | Onde está fixada |
| --- | --- | --- |
| Node | 24.15 | `.node-version`, `.nvmrc`, `engines` dos dois `package.json` |
| pnpm | 11.18.0 | `packageManager`; habilite com `corepack enable` |
| Docker Engine + Compose v2 | — | necessário para o ambiente em container e para o banco dos testes de integração |
| PostgreSQL | 17.6 | imagem usada pelo `compose.yaml` |

## Setup

### Com containers

```sh
cp .env.example .env
# POSTGRES_PASSWORD: openssl rand -hex 24   (hex entra na URL de conexão sem escape)
# JWT_SECRET:        openssl rand -base64 48
docker compose up --build
```

Instala as dependências, aplica as migrations e sobe os dois pacotes em modo de desenvolvimento, com o código montado do host. O web fica em http://localhost:3000 e a API em http://localhost:8080, publicadas só em `127.0.0.1`. Detalhes de serviços, volumes e imagens em [`docs/containers.md`](docs/containers.md).

### Sem containers

Requer um PostgreSQL próprio. Em dois terminais:

```sh
corepack enable

cd backend
cp .env.example .env          # preencha DATABASE_URL e JWT_SECRET
pnpm install                  # o postinstall roda prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

```sh
cd web
cp .env.example .env          # API_URL=http://localhost:8080
pnpm install
pnpm dev
```

### Primeiro uso da aplicação

O sign-up cria o usuário e a sua carteira. Um banco novo, porém, não tem instrumentos no catálogo, e só um administrador os cadastra (`POST /v1/instrument`); sem instrumento não há ativo nem transação. O primeiro administrador é promovido por SQL:

```sh
docker compose exec postgres psql --username=ex3 --dbname=ex3 \
  --command="UPDATE users SET \"isAdmin\" = true WHERE email = 'voce@exemplo.com';"
```

Sem `YAHOO_FINANCE_API_KEY`, a aplicação funciona: toda cotação é reportada como indisponível, e as telas mostram quantidade e custo, sem valor de mercado.

## Variáveis de ambiente

| Arquivo | Lido por | Obrigatórias |
| --- | --- | --- |
| `.env` | apenas o Compose, que as interpola no `compose.yaml` | `POSTGRES_PASSWORD`, `JWT_SECRET` |
| `backend/.env` | o processo do backend, via `dotenv` | `DATABASE_URL`, `JWT_SECRET` |
| `backend/.env.test` | a suíte de testes, via `--env-file`; está no git e aponta para o banco de teste | — |
| `web/.env` | o build do Next, que fixa `API_URL` na aplicação | `API_URL` |

As demais chaves do backend têm default: `NODE_ENV=development`, `PORT=8080`, `BCRYPT_SALT=12` (mínimo 10), `JWT_EXPIRATION=1d` (inteiro positivo seguido de `s`, `m`, `h` ou `d`, no máximo `30d`) e `DIRECT_URL`, que só a CLI do Prisma usa. `CORS_ALLOWED_ORIGINS` é obrigatória quando `NODE_ENV=production`.

`src/config/EnvsSchema.ts` valida tudo isso na subida e recusa o boot com a lista de problemas; chave em branco, como o `.env.example` a distribui, conta como ausente e recebe o default.

## Banco de dados

O Prisma 7 não lê connection string do `schema.prisma`: o runtime a recebe pelo driver adapter (`DATABASE_URL`) e a CLI a lê de `prisma.config.ts`, que prefere `DIRECT_URL` — a conexão direta, sem pooler, que as migrations exigem.

| Comando | Quando |
| --- | --- |
| `pnpm exec prisma migrate dev --name <nome>` | criar uma migration a partir de uma mudança no schema |
| `pnpm exec prisma migrate deploy` | aplicar as pendentes; é o que o Compose, o CI e a produção rodam |
| `pnpm exec prisma generate` | regenerar o client; o `postinstall` já roda |
| `docker compose exec postgres psql --username=ex3 --dbname=ex3` | abrir o banco de desenvolvimento, que não publica porta |

As migrations ficam em `backend/prisma/migrations` e são aplicadas em produção pelo workflow `.github/workflows/migrate.yaml`, a cada push em `master`.

## Scripts

Backend (`cd backend`):

| Script | O que faz |
| --- | --- |
| `pnpm dev` | servidor com recarga (`tsx watch`) |
| `pnpm build` / `pnpm start` | compila para `dist/` e executa o compilado |
| `pnpm lint` / `pnpm typecheck` | ESLint sem tolerar warning; `tsc --noEmit` |
| `pnpm test` | `test:unit` e depois `test:integration` |
| `pnpm test:db:up` / `pnpm test:db:down` | sobe e remove o PostgreSQL dos testes |
| `pnpm prettier` / `pnpm prettier:fix` | formatação |

Web (`cd web`): `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, `pnpm prettier`.

## Testes

```sh
cd backend
pnpm test:db:up   # postgres-test em 127.0.0.1:5432, dados em tmpfs
pnpm test
```

O runner é o `node:test`, sem framework adicional. Os testes unitários (`src/**/*.test.ts`) não tocam I/O. Os de integração (`src/**/*.integration.ts`) aplicam as migrations no banco de teste e exercitam a API por HTTP, com `supertest`, um de cada vez. Convenções e limites em [`docs/testing.md`](docs/testing.md).

`docker compose --profile check up` roda os mesmos gates dos dois pacotes em container, como o CI. O web ainda não tem runner de teste, e os seus gates são `lint`, `typecheck` e `build` (TD-058 em [`TODO.md`](TODO.md)).

## Deploy

| Etapa | Onde |
| --- | --- |
| Gates de cada push e PR para `master` e `develop` | `.github/workflows/ci.yaml` |
| Migrations em produção | `.github/workflows/migrate.yaml`, em push para `master` |
| Build e publicação das imagens | `cloudbuild.yaml` → `gcr.io/$PROJECT_ID/{backend,web}:$COMMIT_SHA` |
| Runtime | Cloud Run, a partir do estágio `runner` de cada `Dockerfile` |

`API_URL` do web entra por build-arg e fica fixada na imagem, não no ambiente do container. O `cloudbuild.yaml` não tem passo de deploy: a configuração do serviço no Cloud Run — variáveis, probes `GET /ready` e `GET /health` — vive fora do repositório (TD-060).

## Documentação

| Documento | Assunto |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | camadas, responsabilidades e direção das dependências |
| [`docs/domain-model.md`](docs/domain-model.md) | entidades, posse, valores, moedas e datas |
| [`docs/financial-rules.md`](docs/financial-rules.md) | definição matemática de preço médio, P&L, alocação e performance |
| [`docs/api-inventory.md`](docs/api-inventory.md) | rotas, contratos e o que mudou desde a linha de base |
| [`docs/authentication.md`](docs/authentication.md) | sessão, token, cookie e autorização |
| [`docs/errors.md`](docs/errors.md) | as oito categorias de erro e o envelope da API |
| [`docs/security.md`](docs/security.md) | checklist de segurança: entradas, segredos, cabeçalhos, rate limiting e riscos aceitos |
| [`docs/observability.md`](docs/observability.md) | log estruturado, correlação de requisição, health e readiness |
| [`docs/testing.md`](docs/testing.md) | infraestrutura e convenções de teste |
| [`docs/containers.md`](docs/containers.md) | Compose, volumes e imagens de produção |
| [`docs/data-fetching.md`](docs/data-fetching.md) | todo request do browser, hook a hook |
| [`docs/accessibility.md`](docs/accessibility.md), [`docs/responsiveness.md`](docs/responsiveness.md), [`docs/performance.md`](docs/performance.md) | critérios normativos do frontend |
| [`docs/toolchain.md`](docs/toolchain.md) | versões fixadas e por quê |
| [`docs/release.md`](docs/release.md) | checklist da versão candidata, evidência por check e exceções |
| [`TODO.md`](TODO.md) | dívidas técnicas abertas (`TD-NNN`) e resolvidas |

## Licença

MIT. Ver [`LICENSE`](LICENSE).
