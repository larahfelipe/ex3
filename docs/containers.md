# Containers

Ambiente de desenvolvimento em Docker Compose e imagens de produção. Registra como operar e as decisões que não são dedutíveis dos arquivos.

Requer Docker Engine com o plugin Compose v2 (`docker compose`).

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `compose.yaml` | Ambiente de desenvolvimento e serviços de verificação. Projeto `ex3`, qualquer que seja o diretório do clone. |
| `.env.example` → `.env` | Valores que o `compose.yaml` interpola. O `.env` fica fora do git. |
| `backend/Dockerfile`, `web/Dockerfile` | Estágios `base`, `deps`, `builder`, `prod-deps`, `dev` e `runner`. |
| `backend/.dockerignore`, `web/.dockerignore` | Tiram do contexto de build `.env*`, `node_modules` e artefatos de build. |

## Primeiro uso

```sh
cp .env.example .env
# POSTGRES_PASSWORD: openssl rand -hex 24   (hex: a senha entra na URL de conexão sem escape)
# JWT_SECRET:        openssl rand -base64 48
docker compose up --build
```

O web fica em http://localhost:3000, e a API, em http://localhost:8080. As duas portas são publicadas só em `127.0.0.1`. O Postgres de desenvolvimento não publica porta: o acesso é por `docker compose exec postgres psql --username=ex3 --dbname=ex3`.

Sem `POSTGRES_PASSWORD`, o Postgres recusa inicializar o cluster; sem `JWT_SECRET`, o `EnvsSchema` recusa o boot do backend. As variáveis não usam `${VAR:?}` porque o Compose interpola o arquivo inteiro a cada comando, e isso exigiria o `.env` até para `pnpm test:db:up`.

O serviço `migrate` carrega um catálogo de desenvolvimento, com ações, ETFs, FII e criptos de B3, NYSE, NASDAQ e CRYPTO, para que um banco novo já permita adicionar ativo e transação. A carga só insere símbolos ausentes, então rodar de novo não duplica nem sobrescreve o que um admin corrigiu. Outros instrumentos continuam exigindo um administrador (`POST /v1/instrument`), e o primeiro é promovido por SQL:

```sh
docker compose exec postgres psql --username=ex3 --dbname=ex3 \
  --command="UPDATE users SET \"isAdmin\" = true WHERE email = 'voce@exemplo.com';"
```

## Serviços

`docker compose up` sobe, nesta ordem:

1. `postgres` e `backend-deps` / `web-deps` em paralelo. Os `*-deps` rodam `pnpm install --frozen-lockfile` e terminam; num `node_modules` já em dia, é uma verificação de segundos.
2. `migrate`, quando o `postgres` está saudável e o `backend-deps` terminou: `prisma migrate deploy`, o mesmo caminho da produção e da suíte de testes, seguido de `prisma db seed`, que roda `src/infra/database/SeedDevelopmentCatalog.ts`. O seed fica fora do build e do workflow de produção.
3. `backend` (`pnpm dev`), quando o `migrate` terminou com sucesso.
4. `web` (`pnpm dev`), quando o `web-deps` terminou e o `backend` foi iniciado.

Os serviços de desenvolvimento usam o estágio `dev`: imagem com Node e pnpm, código montado do host, processo como `node`. O `node_modules` de cada pacote fica num volume, porque os binários nativos (`bcrypt`, Prisma, SWC) do host macOS não servem ao Linux do container. O store do pnpm é um volume compartilhado entre os dois pacotes, para que uma reinstalação não baixe de novo o que já foi baixado. O `build/` do `next dev` fica num volume próprio e não disputa o diretório com um `pnpm build` feito no host.

O `backend` tem health check em `GET /ready`, que responde pelo banco, e por isso o `web` espera por `service_healthy`, não pelo container iniciado. O `web` tem o seu em conexão TCP na porta 3000: o `next dev` compila a página pedida, então uma sonda por rota recompilaria a cada intervalo. As duas sondas rodam `node -e` dentro do próprio container, sem depender de `curl` na imagem, a cada 10s, com 60s de carência no start e três falhas seguidas para virar `unhealthy`. Ver `docs/observability.md`.

Em Linux, o usuário `node` do container (uid 1000) grava no código montado (`dist/`, `next-env.d.ts`, `build/`). Com outro uid no host, essas escritas falham. No Docker Desktop do macOS, o mapeamento de dono é transparente.

## Variáveis de ambiente

O `.env` da raiz só é lido pelo Compose. O backend no container recebe `NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `API_PROXY_SECRET` e `YAHOO_FINANCE_API_KEY` do `compose.yaml`, e o web recebe `API_URL` e o mesmo `API_PROXY_SECRET`. Como o `dotenv` não sobrescreve variável já definida, esses valores prevalecem sobre um `backend/.env` presente no código montado. As demais chaves (`BCRYPT_SALT`, `JWT_EXPIRATION`, `CORS_ALLOWED_ORIGINS`) seguem o `backend/.env`, se ele existir, ou o default do `EnvsSchema`.

O web recebe `API_URL=http://backend:8080`, o nome do serviço na rede do Compose. O navegador só fala com o web.

## Verificações

Os serviços do perfil `check` repetem os gates do CI:

```sh
docker compose run --rm backend-check     # lint, typecheck, test:unit, test:integration, build
docker compose run --rm web-check         # lint, typecheck, build
docker compose run --rm backend-check pnpm test:unit   # um comando só
docker compose rm --stop --force postgres-test   # encerra o banco de teste
```

O `backend-check` compartilha o namespace de rede do `postgres-test`. Assim, o `localhost:5432` do `.env.test` continua válido dentro do container, e o `.env.test` segue como a única fonte da string de conexão da suíte. O serviço não define variável de ambiente nenhuma, porque o `node --env-file` não sobrescreve o que já está no ambiente.

**A suíte não roda no serviço `backend`.** Nele, `NODE_ENV=development` e o `DATABASE_URL` do banco de desenvolvimento prevaleceriam sobre o `.env.test`. O `resetDatabase` recusa truncar com `NODE_ENV` diferente de `test` (`NonTestDatabaseResetError`), então um `docker compose run backend pnpm test` falha sem apagar dados.

Para rodar a suíte no host, `pnpm test:db:up` e `pnpm test:db:down` no `backend/` sobem e removem só o `postgres-test`, publicado em `127.0.0.1:5432`.

## Dados e volumes

| Volume | Conteúdo |
| --- | --- |
| `postgres-data` | Banco de desenvolvimento |
| `backend-node-modules`, `web-node-modules` | Dependências instaladas no Linux do container |
| `web-dev-build` | Saída do `next dev` |
| `pnpm-store` | Store do pnpm (`PNPM_CONFIG_STORE_DIR`) |

`docker compose down` preserva os volumes. `docker compose down --volumes` apaga todos, inclusive o banco de desenvolvimento. Para refazer só as dependências de um pacote, remova o volume dele com `docker compose down` seguido de `docker volume rm ex3_web-node-modules`. O `postgres-test` usa `tmpfs` e começa vazio a cada subida (ver `docs/testing.md`).

Mudança em Dockerfile ou no `packageManager` do `package.json` exige `docker compose up --build`. Mudança de dependência não exige: o `*-deps` reinstala no próximo `up`.

## Imagens de produção

O alvo padrão, e o único que o `cloudbuild.yaml` constrói, é o último estágio, `runner`:

- parte de `node:24.15-alpine` sem pnpm e roda como `node`, com `tini` como PID 1: o Node não trata SIGTERM quando é o PID 1, e o Cloud Run não oferece `--init`;
- leva só as dependências de produção, instaladas num estágio limpo (`prod-deps`), e o artefato do `builder`: `dist/` e `prisma/` no backend; `build/` sem `build/cache`, `public/`, `next.config.js` e `package.json` no web;
- executa `node` direto, sem gerenciador de pacotes no processo. O web usa `node node_modules/next/dist/bin/next start`, o que evita que o corepack baixe o pnpm quando o container sobe.

O corepack baixa a versão do `packageManager` durante o build, em `COREPACK_HOME`, legível pelo usuário `node` do estágio `dev`. Os Dockerfiles não usam sintaxe exclusiva do BuildKit, como `RUN --mount`, porque o builder `gcr.io/cloud-builders/docker` do Cloud Build não a garante.

`API_URL` chega ao web por build-arg, como o `cloudbuild.yaml` já faz, e o estágio `runner` a declara como variável de ambiente do container. Ela é lida pelo servidor em tempo de execução, não mais inlinada no bundle pelo `next.config.js` — ver `security.md`, §Segredos.
