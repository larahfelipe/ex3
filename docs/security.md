# Segurança

Checklist da auditoria final (TASK 20.4). Cada item diz onde o controle mora, o
que foi verificado e o que segue como risco aceito. O que é específico de sessão
e senha está em [`authentication.md`](authentication.md); o envelope de erro, em
[`errors.md`](errors.md).

## Superfícies de entrada

| Superfície | Validação | Rejeição | Confiança no chamador |
| --- | --- | --- | --- |
| Corpo e query de toda rota `/v1` | schema zod em `backend/src/validation/schema`, aplicado por `validate()` no controller, antes do serviço | `400 VALIDATION` com um `{ path, message }` por campo recusado | nenhuma |
| Cabeçalho `Authorization` | `authMiddleware`: esquema `Bearer`, assinatura HS256, claims reparseadas, `sessionVersion` conferida na linha do usuário | `401 AUTHENTICATION` | nenhuma |
| `x-request-id` | `PROPAGATED_REQUEST_ID` aceita 8–64 caracteres de `[A-Za-z0-9-]`; fora disso o id é gerado | id descartado em silêncio, sem erro | nenhuma: o valor só volta no cabeçalho e no log |
| `Origin` | allowlist de `CORS_ALLOWED_ORIGINS`, obrigatória em produção | resposta sem `Access-Control-Allow-Origin` | nenhuma |
| Corpo dos route handlers do web | `jsonPayload` (`web/src/lib/api-proxy.ts`) | `400 Bad Request` com envelope `{ message, _error }` | nenhuma |
| Provedor de cotação (Yahoo Finance) | origem fixa e símbolo restrito a letras e dígitos, escapado na URL; resposta parseada por schema antes de virar preço | falha de infraestrutura; a posição é reportada pelo livro | resposta tratada como dado externo |

O corpo é limitado a `100kb` (`RequestLimits.JSON_BODY_SIZE`) antes de qualquer
parse, e o payload acima disso responde `413`.

## Segredos

* `EnvsSchema` recusa o processo no boot: `JWT_SECRET` com menos de 32
  caracteres, `BCRYPT_SALT` abaixo de 10 rounds, `JWT_EXPIRATION` sem unidade ou
  acima de `30d`, `CORS_ALLOWED_ORIGINS` ausente em produção. Não há default
  inseguro — o que falta derruba a inicialização, não degrada em silêncio.
* Nenhum segredo é registrado. A linha de requisição identifica o usuário por id
  e nada mais; o log de falha upstream do web é montado campo a campo justamente
  porque o `AxiosError` carrega o token do chamador na configuração.
* `.gitignore` ignora `.env*` na raiz e no backend, liberando apenas
  `.env.example` e o `.env.test` versionado, cujo `JWT_SECRET` só vale para a
  suíte e cujo banco é o local de teste.
* Sob `NODE_ENV=test`, `config/Envs.ts` e `prisma.config.ts` não carregam o
  `.env` do desenvolvedor: uma credencial que a suíte não declarou não alcança
  um banco que não é o de teste (TD-059).
* `API_URL` é lida pelo servidor em tempo de execução. Até a TASK 20.4 o
  `next.config.js` a exportava por `env`, que **inlina o valor no bundle do
  cliente**: o endereço da API viajava no JavaScript de todo visitante. O
  `Dockerfile` do web passou a declará-la no estágio `runner`, e o navegador
  deixou de recebê-la.

## Cookie de sessão

`COOKIE_OPTIONS` (`web/src/common/constants.ts`): `httpOnly`, `sameSite:
'strict'`, `secure` em produção, e `expires` igual ao `exp` do próprio token. O
browser nunca vê o token — quem o anexa é o proxy do Next, no servidor.

## JWT

Algoritmo fixado em HS256 na assinatura **e** na verificação (RFC 8725 §3.1), de
modo que o cabeçalho do token não escolhe como ele é checado. As claims são
reparseadas por schema depois da verificação, então um token legítimo com
formato antigo é recusado. A sessão é stateful: a `sessionVersion` do token tem
de ser a da linha do usuário, e sign-in, sign-out e troca de senha a incrementam.

## CORS

Allowlist explícita, `credentials: true`, métodos enumerados. Origem ausente
passa — cliente não-browser não manda `Origin` —, e é por isso que
`CORS_ALLOWED_ORIGINS` é obrigatória em produção: sem lista, nenhuma origem de
browser é aceita, e a exceção só relaxa o desenvolvimento local.

## Cabeçalhos

| Onde | Cabeçalhos |
| --- | --- |
| API | `helmet()` com os defaults, mais `x-powered-by` desligado |
| Web, toda resposta | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security`, por `headers()` do `next.config.js` |
| Web, resposta de página | CSP com nonce por resposta e `strict-dynamic`, montada em `src/proxy.ts` |

A CSP não alcança `/api` — o matcher do proxy exclui essas rotas —, e é por isso
que os cinco cabeçalhos ficam no `next.config.js`, que se aplica a tudo: uma
resposta JSON do proxy sai com `nosniff` mesmo sem CSP. `worker-src` passou a
`'none'` com a remoção do PWA (TASK 20.3).

## Rate limiting

Dois budgets, ambos em `middleware/RateLimitMiddleware.ts`: 120 requisições por
minuto para a API e 10 por 15 minutos para os endpoints que verificam senha
(sign-in, sign-up, `PATCH` e `DELETE /v1/user`).

**A chave não é o endereço do chamador.** Em produção o navegador só fala com o
web, e o proxy encaminha à API apenas o `Authorization`: todo tráfego chega do
mesmo container, e uma chave por endereço daria um único balde para o produto
inteiro — um cliente esgotaria o limite de todos, e o throttling de senha
deixaria de ser por conta. Desde a TASK 20.4:

| Limite | Chave | Fallback |
| --- | --- | --- |
| API | digest da sessão apresentada | endereço do chamador, para o tráfego sem sessão |
| Autenticação | digest da sessão; sem ela, digest do e-mail submetido | endereço do chamador |

O contador guarda digest, nunca o token nem o e-mail: um store de rate limit não
é lugar de credencial. A contrapartida assumida é que um atacante consegue
consumir o balde de tentativas de uma conta alheia, bloqueando-a por 15 minutos
— preço menor que o de derrubar o produto inteiro. Os contadores continuam na
memória de cada processo (TD-006).

## Autorização

* Carteira: `requireOwnedPortfolio` (`services/PortfolioAccess.ts`) é a única
  chamada a `portfolioRepository.getById({ id, userId })` fora dos repositórios.
  Carteira de outro usuário responde como inexistente, então o chamador não
  descobre ids alheios.
* Transação e ativo: toda leitura e escrita leva o `userId` do token na cláusula
  `where`; nenhum serviço resolve recurso só por id.
* Administrador: `GET /v1/users` e as escritas do catálogo de instrumentos
  exigem `isAdmin`, verificado no serviço — não na rota.
* `isAdmin`, `password` e `sessionVersion` são omitidos na própria consulta, não
  filtrados depois.

## Logs

Uma linha por requisição concluída, em JSON, com severidade derivada do status,
`requestId`, rota como padrão (`/v1/portfolio/positions/:symbol`, nunca o
símbolo), duração, `userId` e o código de erro com que o cliente foi respondido.
Sem e-mail, sem token, sem corpo. Stack trace só na linha de erro 5xx, que fica
no servidor: o cliente recebe `{ code, message, details }` genérico.

## Riscos aceitos

| Risco | Por que segue aberto |
| --- | --- |
| Enumeração de e-mails no sign-up (TD-004) | Responder igual para e-mail novo e existente exige confirmação por e-mail, fluxo que o produto não tem |
| Senha nova sem checagem de vazamento e sem normalização Unicode (TD-005) | Depende de fonte externa e de migrar o hash de contas existentes no primeiro login bem-sucedido |
| Contadores de rate limit por processo (TD-006) | Limite efetivo é o budget vezes o número de instâncias; resolver exige store compartilhado |
| `style-src 'unsafe-inline'` (TD-007) | Componentes usam atributo `style`, que nonce não autoriza; CSS injetado altera aparência, não executa script |
| Tráfego não autenticado contra o web não é limitado (TD-065) | O teto da API protege o backend; o servidor do Next depende da plataforma |
