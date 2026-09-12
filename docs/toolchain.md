# Toolchain — FASE 2

Registro das versões fixadas e das decisões que não são dedutíveis do `package.json`.

## Versões

| Item | backend | web |
| --- | --- | --- |
| Node | 24.15 (`.nvmrc`, `.node-version`, `engines`, imagem base dos Dockerfiles) | idem |
| pnpm | 11.18.0 (`packageManager`) | idem |
| TypeScript | 5.9.3 | 5.9.3 |
| Prettier | 3.9.6 | 3.9.6 |
| ESLint | 10.10.0 | 10.10.0 |
| `typescript-eslint` | 8.70.0 | 8.70.0 |
| `eslint-config-prettier` | 10.1.8 | 10.1.8 |
| `eslint-plugin-prettier` | 5.5.6 | 5.5.6 |
| `eslint-plugin-import-helpers` | 2.0.2 | 2.0.2 |
| `@next/eslint-plugin-next` | — | 16.3.4 |
| `eslint-plugin-react` | — | 7.37.5 |
| `eslint-plugin-react-hooks` | — | 7.1.1 |
| `eslint-plugin-jsx-a11y` | — | 6.10.2 |

Tudo acima está na última estável, com uma exceção deliberada: `typescript`.

## Por que TypeScript 5.9 e não 7.0

`typescript@7.0.2` é a distribuição do compilador nativo e **não publica mais a API JavaScript do compilador**: o `exports` do pacote expõe apenas `./package.json`, `.` (que resolve para `lib/version.cjs`, um objeto com `version` e `versionMajorMinor`) e um conjunto `./unstable/*`. Não existe mais `typescript/lib/typescript.js`.

Toda a cadeia de ferramentas atual do repositório depende daquela API:

* `next@14` — `verifyTypeScriptSetup` faz `require(deps.resolved.get('typescript'))`; a resolução falha, o `require` recebe `undefined` e o processo morre com `TypeError: Cannot read properties of undefined (reading 'endsWith')`. Isso derruba `next lint`. No `next build` o efeito é pior porque é silencioso: o `tsconfig.json` não chega a ser lido, os `paths` somem e o webpack falha com `Can't resolve '@/common/constants'` — o build quebra por um motivo que não tem relação aparente com a causa;
* `@typescript-eslint@7` — `require('typescript')` devolve o objeto de versão e o plugin estoura ao carregar as regras. Com o alvo do lint corrigido (falha 29 do baseline), `pnpm lint` no backend passava a falhar com exit code 2.

Ambos os workspaces ficam, portanto, na última linha estável que mantém a API JS: **5.9.3**.

A migração para 7.x continua bloqueada depois da TASK 2.2: `typescript-eslint@8.70.0` declara `typescript >=4.8.4 <6.1.0` como peer. Reavaliar quando `typescript-eslint` e o Next.js declararem suporte ao pacote nativo. Nada no código-fonte depende de sintaxe específica de 7.x — a troca é de dependência, não de código.

## Ajustes decorrentes

* **Alvo do lint do backend.** `eslint --max-warnings=0` não passava alvo nenhum e o ESLint 8 não assume `.` por padrão: o comando saía com 0 sem analisar arquivo algum (falha 29 do baseline). No ESLint 10 o padrão é `.`, e o script passou a lintar de fato — 111 arquivos.
* **`eslint-plugin-prettier` 4 → 5 e `eslint-config-prettier` 8 → 10 no backend.** O par antigo usa `prettier.resolveConfig.sync`, removida no Prettier 3 (`TypeError: prettier.resolveConfig.sync is not a function`). O `web` já estava na linha 5.x.
* **`prettier:fix` do backend** executava `--check` junto de `--write`.
* **Cadeia de build do backend.** `tscpaths@0.0.9` (sem manutenção desde 2019, exige `baseUrl`) foi substituído por `tsc-alias`; `ts-node-dev` + `tsconfig-paths` por `tsx`. O `tsconfig.json` declara `paths` sem `baseUrl`, e `tsconfig.build.json` exclui os arquivos de teste do artefato publicado.

## ESLint: flat config (TASK 2.2)

Os dois workspaces passaram para `eslint.config.mjs` e os `\.eslintrc.json` foram removidos. `pnpm lint` chama o ESLint direto (`eslint --max-warnings=0`), sem `next lint`: o lint deixou de depender do ciclo de vida do Next e virou uma etapa independente do pipeline.

ESLint 9 foi descartado: a linha está em `maintenance` e o próprio pacote se declara `deprecated` ("This version is no longer supported"). A versão instalada é a 10.

### Decisões do `web`

* **Conjunto de regras composto explicitamente** a partir de `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` e `@next/eslint-plugin-next`, em vez de `eslint-config-next`. As regras que o projeto usava foram preservadas uma a uma. Saíram `eslint-config-next@14.0.4` (defasada em relação ao `next@14.2.24` instalado) e `eslint-plugin-next@0.0.0` (placeholder vazio, falha 6 do baseline).
* **`@next/eslint-plugin-next` na 16.3.4, e não na 14.2.24 do Next instalado.** A 14.x chama `context.getCwd()`, removido no ESLint 10, e o lint morre ao carregar `@next/next/no-html-link-for-pages`. O plugin é um conjunto de regras estáticas, independente do runtime; a TASK 2.3 alinha o Next a essa versão.
* **`settings.react.version` é lido de `react/package.json`** pelo próprio `eslint.config.mjs`. O valor `'detect'` faz o `eslint-plugin-react` chamar `context.getFilename()`, também removido no ESLint 10. Ler a versão instalada evita fixar um número que envelheceria na TASK 2.4.
* **`jsx-a11y/anchor-has-content` e `jsx-a11y/heading-has-content` desligadas em `src/components/ui/**`.** As primitivas repassam `children` via props; o conteúdo que as regras procuram só existe no call site. É limitação de análise estática, não ausência de conteúdo acessível.
* **Arquivos de configuração na raiz** (`next.config.js`, `postcss.config.js`, `tailwind.config.ts`, `eslint.config.mjs`) ganharam um bloco próprio com globais de Node e `@typescript-eslint/no-require-imports` desligada.

### Violações corrigidas

Os conjuntos `recommended` atuais são mais estritos que os de ESLint 8 / `@typescript-eslint` 6 e apontaram cinco problemas reais, todos corrigidos em vez de silenciados:

| Arquivo | Regra | Correção |
| --- | --- | --- |
| `web/src/app/api/v1/assets/types.ts` | `@typescript-eslint/no-empty-object-type` | `interface ... extends WithMessage {}` → `type ... = WithMessage` |
| `web/src/hooks/use-disclosure.ts` | `@typescript-eslint/no-unused-expressions` | ternário com efeito colateral → `if/else` |
| `web/src/app/(protected)/assets/_components/assets-table.tsx` | `no-useless-assignment` | `{++i}` → `{i + 1}` |
| `web/next.config.js` | diretiva `eslint-disable` obsoleta | `@typescript-eslint/no-var-requires` foi renomeada para `no-require-imports` |
| `backend/src/**` | — | reordenação de imports nos arquivos de teste (`import-helpers/order-imports`), que nunca haviam sido lintados |

## Migração de dependências (TASKS 2.3 a 2.7)

Todas as dependências de runtime dos dois workspaces foram levadas à última estável. As quebras que exigiram mudança de código estão abaixo; o que só trocou de número não está registrado.

| Dependência | De | Para |
| --- | --- | --- |
| `express` | 4.18.3 | 5.2.1 |
| `zod` | 3.22.4 | 4.6.2 |
| `prisma` / `@prisma/client` | 5.10.2 | 7.10.0 |
| `bcrypt` | 5.1.1 | 6.0.0 |
| `dotenv` | 16.4.5 | 17.4.2 |
| `next` | 14.2.24 | 16.3.4 |
| `react` / `react-dom` | 18.x | 19.3.0 |
| `tailwindcss` | 3.3 | 4.3.3 |
| `lucide-react` | 0.336 | 1.44.0 |

### Backend

* **Express 5.** `@types/express@5` não reexporta mais os tipos de `express-serve-static-core`, que `src/types/express.d.ts` aumenta para declarar `Request.user`. O pacote passou a ser dependência direta (`@types/express-serve-static-core@^5`), senão a augmentação resolve contra outra cópia dos tipos e `req.user` volta a não existir. Com a tipagem correta, os `authMiddleware as Application` dos routers — cast que existia só para calar o erro — foram removidos. Handlers `async` que rejeitam agora propagam ao error middleware sem `try/catch`, mas `errorHandlerMiddleware` continua sendo a fronteira única de erro e não depende disso.
* **Zod 4.** Os validadores de formato saíram do namespace `z.string()` e viraram funções de topo (`z.email()` em lugar de `z.string().email()`); `ZodError.errors` virou `ZodError.issues`; `required_error`/`invalid_type_error` viraram a chave única `error`; `ctx.addIssue` exige `code: 'custom'` explícito. `validate` em `src/validation/Validator.ts` e `EnvsSchema` foram ajustados.
* **Prisma 7.** Mudança arquitetural, não só de versão:
  * o `datasource` do `schema.prisma` não lê mais `env("DATABASE_URL")`. A URL da CLI passou para `prisma.config.ts` (que carrega `dotenv` por conta própria) e a do runtime para o driver adapter;
  * `@prisma/adapter-pg` é agora obrigatório — `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`;
  * com adapter, `$connect()` apenas monta o pool e **resolve mesmo com o banco inacessível**. A verificação de conectividade no startup era um no-op silencioso; passou a executar `SELECT 1`. Esse era um defeito latente, não uma consequência do upgrade — a 5.x já se comportava assim sob adapter;
  * `prisma migrate`/`generate` leem `DIRECT_URL` quando presente, para não migrar através do pooler;
  * o critério "migration funciona" só foi fechado na TASK 3.1: `prisma/migrations` estava em `.gitignore`, então não havia migration alguma para aplicar. Ver `docs/testing.md`.
* **bcrypt 6.** Sem mudança de API; exige Node >= 18 e recompila o binding nativo, daí `bcrypt: true` em `allowBuilds`.
* **dotenv 17.** Passou a imprimir um banner promocional em todo `config()`. Silenciado com `config({ quiet: true })`, que também mantém a saída dos testes limpa.

### Web

* **Next 16.**
  * `middleware.ts` foi renomeado para `proxy.ts` e o export `middleware` para `proxy` (`ProxyConfig` no lugar de `MiddlewareConfig`). O arquivo antigo ainda funciona com aviso de depreciação; o novo nome foi adotado. `docs/authentication.md` acompanha;
  * Turbopack é o bundler padrão, e `next-pwa@5.6.0` (último estável) é um plugin de webpack: injeta `config.plugins` via `webpack()`, que o Turbopack ignora, e o service worker nunca é gerado. `dev` e `build` fixam `--webpack`. A alternativa moderna (`@serwist/next`) tem a mesma limitação — não suporta Turbopack —, então trocar de plugin não resolveria; remover o PWA está fora de escopo. Isso fecha a falha 28 do baseline: a incompatibilidade permanece, contida pela flag;
  * `cookies()` é assíncrona desde o Next 15 — os route handlers que a usam passaram a `await`.
* **React 19.** `@types/react@19` move `JSX` para dentro do namespace `React` e remove o global: referências a `JSX.Element` passaram a importar `type JSX` de `react` ou a qualificar como `React.JSX.Element`. A transformação de `ref` em prop comum não exigiu mudança — as primitivas já usam `React.forwardRef`, que continua suportado.
* **Tailwind 4.** Configuração em CSS, não em JS:
  * `tailwind.config.ts` foi removido. Tema, container e keyframes vivem em `src/app/globals.css` via `@theme`, `@utility` e `@custom-variant`;
  * `@tailwind base/components/utilities` viraram `@import 'tailwindcss'`;
  * o PostCSS plugin mudou de `tailwindcss` para `@tailwindcss/postcss`, que já aplica prefixos — `autoprefixer` saiu;
  * `tailwindcss-animate` não é compatível com a configuração em CSS; substituído por `tw-animate-css`;
  * a cor de borda padrão virou `currentcolor`. Um bloco de compatibilidade em `globals.css` preserva o visual da 3.x.

### Infraestrutura

* **`pnpm-workspace.yaml` nos dois Dockerfiles.** O pnpm 11 lê `allowBuilds` e `minimumReleaseAgeExclude` desse arquivo; sem copiá-lo para a imagem, o `pnpm install` do build falhava no backend (scripts de build do `bcrypt`/Prisma bloqueados). Outro defeito latente: o arquivo passou a existir na TASK 2.1 e os Dockerfiles nunca foram atualizados.
* **`minimumReleaseAgeExclude`.** A política de supply chain do pnpm rejeita versões publicadas há pouco tempo. As que o repositório precisa estão listadas explicitamente por versão exata (`zod@4.6.2`, `lucide-react@1.44.0`), nunca por pacote — um curinga por pacote aceitaria qualquer release futura.

### Defeito corrigido de passagem

`web/src/app/api/v1/assets/route.ts` montava a URL do backend descartando os query params recebidos: paginação e filtros nunca chegavam à API. A requisição agora repassa `req.nextUrl.searchParams`.
