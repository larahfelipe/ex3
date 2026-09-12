# Baseline técnico — TASK 0.1

Fotografia reproduzível do repositório antes de qualquer alteração do plano.

## Referência

| Item | Valor |
| --- | --- |
| Branch | `master` |
| Commit | `8dc9edd4d32e9a983fa4d6f626c78d5461e8de34` |
| Data de captura | 2026-09-10 |
| Plataforma de captura | darwin 24.6.0 (arm64) |

## Runtime e package manager

| Item | Valor |
| --- | --- |
| Node | v24.15.0 (local); nenhuma versão fixada no repositório |
| pnpm | 11.18.0 |
| npm | 11.12.1 |
| Lockfiles presentes | `web/pnpm-lock.yaml`, `backend/pnpm-lock.yaml` (`lockfileVersion: 9.0`) |
| `packageManager` em `package.json` | ausente em ambos os workspaces |
| `.nvmrc` / `.node-version` | ausentes |
| Docker | `web/Dockerfile`, `backend/Dockerfile` |

Não existe workspace raiz: `web` e `backend` são projetos independentes, cada um com o próprio lockfile.

## Versões instaladas (resolvidas do lockfile)

### backend

| Pacote | Versão |
| --- | --- |
| typescript | 5.4.5 |
| prisma / @prisma/client | 5.14.0 |
| express | 4.19.2 |
| zod | 3.23.8 |
| jsonwebtoken | 9.0.2 |
| bcrypt | 5.1.1 |
| cors | 2.8.5 |
| dotenv | 16.4.5 |
| eslint | 8.57.0 |
| prettier | 2.8.8 |
| @typescript-eslint/* | 7.9.0 |

### web

| Pacote | Versão |
| --- | --- |
| next | 14.2.24 |
| react / react-dom | 18.x |
| typescript | 5.8.2 |
| @tanstack/react-query | 5.x |
| tailwindcss | 3.4.17 |
| zod | 3.x |
| react-hook-form | 7.x |
| axios | 1.x |
| eslint | 8.x + `eslint-config-next@14.0.4` |
| prettier | 3.5.3 |

Observação: `eslint-config-next@14.0.4` está defasada em relação a `next@14.2.24`.

## Comandos disponíveis

### backend
`start`, `dev`, `build`, `lint`, `lint:fix`, `prettier`, `prettier:fix`, `typecheck`

### web
`dev`, `build`, `start`, `lint`, `lint:fix`, `prettier`, `prettier:fix`, `typecheck`

Não existe script de testes em nenhum dos workspaces.

## Estrutura principal

```
.
├── .github/workflows/{ci.yaml,migrate.yaml}
├── backend/            Express + Prisma (PostgreSQL)
│   ├── prisma/schema.prisma
│   └── src/{config,controllers,domain,errors,infra,interfaces,middleware,routes,services,types,validation}
├── web/                Next.js 14 App Router
│   └── src/{app,common,components,hooks,lib,providers,types}
├── cloudbuild.yaml
└── docs/               (criado por esta task)
```

## Resultado da execução

Executado separadamente em `web` e `backend`.

### backend

| Etapa | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | **FALHA parcial** — instala, mas pnpm 11 bloqueia os build scripts de `@prisma/client`, `@prisma/engines`, `prisma` e `bcrypt` (`ERR_PNPM_IGNORED_BUILDS`) |
| `pnpm lint` | **FALHA** — o pre-check de dependências do pnpm reexecuta `install`, que sai com código 1 pelo motivo acima. Executando o ESLint direto (`node_modules/.bin/eslint`): sai com código 0, mas **sem lintar arquivo nenhum** — o script não passa nenhum alvo e o ESLint 8 não assume `.` por padrão (ver falha 29) |
| `pnpm typecheck` | **FALHA** pelo mesmo motivo. Direto via `tsc`: **FALHA** com 25 erros enquanto o Prisma Client não é gerado; após `prisma generate` manual: **PASSA** |
| `pnpm build` | **FALHA** pelo mesmo motivo. Direto (`tsc` + `tscpaths`): **PASSA** — 116 paths reescritos em 56 arquivos |

### web

| Etapa | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | **PASSA** |
| `pnpm lint` (`next lint`) | **PASSA** — 0 erros/warnings |
| `pnpm typecheck` | **PASSA** |
| `pnpm build` | **PASSA** — 13 rotas, First Load JS compartilhado 87.2 kB, middleware 29.9 kB |

Build do web sem `API_URL` definida: compila, mas o header CSP é emitido com `connect-src 'self' undefined`.

## Falhas pré-existentes registradas

Toda falha listada aqui é anterior ao plano e não deve ser contada como regressão.

### Tooling

1. **`ERR_PNPM_IGNORED_BUILDS` no backend.** pnpm ≥ 10 exige allowlist explícita de build scripts. Sem ela o Prisma Client nunca é gerado, e todo script subsequente falha no pre-check de dependências. Bloqueia `lint`, `typecheck` e `build` do backend por `pnpm`. → TASK 1.1.
2. **CI usa `npm install` e faz cache por `package-lock.json`**, que não existe no repositório. O cache nunca acerta e a instalação ignora o `pnpm-lock.yaml` versionado. → TASK 1.1/1.3.
3. **`actions/setup-node@v3` sem `node-version`**, e nenhuma versão de Node fixada em lugar nenhum. → TASK 1.2.
4. **`actions/cache@v2` e `actions/checkout@v3`** estão desatualizadas. → TASK 1.3.
5. **Pipeline de CI sem etapa de testes** e com ordem `build → lint → typecheck` (falha cara antes das baratas). → TASK 1.3.
6. **`web/package.json` declara `eslint-plugin-next@0.0.0`**, pacote placeholder sem conteúdo. → TASK 2.2.
7. **`backend` roda `prisma generate` apenas dentro de `build`**, não em `postinstall`; `typecheck` isolado falha em clone limpo. → TASK 1.1.
8. **Nenhuma infraestrutura de testes** nos dois workspaces. → TASK 3.1.
29. **`backend` lintava zero arquivos.** O script era `eslint --max-warnings=0`, sem alvo; o ESLint 8 exige padrões explícitos e saía com código 0 sem analisar nada. O verde do lint do backend no baseline era falso. Descoberto na TASK 2.1 (numeração fora de ordem para não invalidar as referências existentes). → TASK 2.1.

### Segurança

9. **Fallback de `JWT_SECRET`**: `backend/src/config/Envs.ts` usa `process.env.JWT_SECRET || 'jwtSecret'`. → TASK 1.4.
10. **`envs` sem validação**: `dbAccessUrl` pode ser `undefined`, `port`/`bcryptSalt` são `string | number`. → TASK 1.5.
11. **CORS totalmente aberto** (`app.use(cors())`), sem security headers, sem limite de payload, sem rate limiting. → TASK 1.6.
12. **Sem error handler global no Express**: cada controller trata o próprio erro; exceções não capturadas vazam o handler padrão do Express (com stack trace fora de produção). → TASK 1.6.
13. **Sessão baseada em token persistido**: `users.accessToken` guarda o JWT corrente; `AuthMiddleware` valida a assinatura e depois exige que o token esteja gravado na linha do usuário. O middleware do Next apenas checa a *existência* do cookie, sem validar expiração. → TASK 1.7.
14. **`DIRECT_URL` usada em `schema.prisma` mas ausente de `backend/.env.example`.** → TASK 1.5.

### Domínio financeiro

15. **`UpdateTransactionService` contabiliza em dobro**: aplica o impacto da transação editada sem reverter o impacto anterior (`backend/src/services/transaction/UpdateTransactionService.ts`). → TASK 4.7.
16. **`DeleteTransactionService` não aguarda a checagem de portfolio** (`const portfolioExists = this.portfolioRepository.getByUserId(...)` sem `await`, sempre truthy) e reverte a posição por delta, sem recalcular a partir do ledger. → TASK 4.8.
17. **Nenhuma operação financeira é atômica**: `transaction.add` + `asset.updatePosition` são chamadas separadas, sem `$transaction`. → TASK 4.9.
18. **`Asset.balance` é ambíguo** — acumula custo por incremento/decremento e é usado como se fosse patrimônio. → TASK 4.10.
19. **`Asset.symbol` é `@unique` global**, então um símbolo só pode existir na carteira de um único usuário. → TASK 4.2.
20. **`User → Portfolio` é 1:1** (`Portfolio.userId @unique`). → TASK 4.3.
21. **`UpdateTransactionService` retorna `TransactionMessages.CREATED`** em vez de `UPDATED`. → TASK 4.7.
22. **Não existe entidade de instrumento, posição, cotação ou valuation.** → FASE 4/5.

### Frontend

23. **N+1 na tabela de ativos**: `AssetTransactionTableCell` dispara `GET /v1/transactions/:symbol` por linha renderizada. → TASK 7.4.
24. **Regra financeira no componente visual**: preço médio é calculado dentro de `asset-transaction-table-cell.tsx`. → TASK 5.3/7.4.
25. **Busca de ativos é client-side** sobre a página corrente apenas (`assets-table.tsx`), inconsistente com a paginação server-side. → TASK 9.1.
26. **Moeda é preferência de UI sem conversão**: `useUser().currency` troca apenas o símbolo formatado; os valores não são convertidos. → FASE 5.
27. **Rota `/` redireciona permanentemente para `/assets`** (`permanent: true`), o que será um obstáculo quando o Overview virar a home. → TASK 8.1.
28. **`next-pwa@5.6.0`** não é compatível com Next 15. → TASK 2.3.
