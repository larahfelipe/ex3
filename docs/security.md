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
| `x-client-address` e `x-api-proxy-secret` | `clientAddressOf` (`RateLimitMiddleware.ts`): o endereço vale só com o segredo de `API_PROXY_SECRET` e se for um IP | cabeçalho ignorado em silêncio; a requisição conta pelo endereço de quem conectou | só o web, que prova pelo segredo |
| `X-Forwarded-For` no web | `clientAddressHeaders` (`web/src/lib/api-proxy.ts`) usa só a última entrada, a que a plataforma acrescenta | entradas anteriores ignoradas | nenhuma: o que o cliente envia fica antes da entrada da plataforma |
| Corpo dos route handlers do web | `jsonPayload` (`web/src/lib/api-proxy.ts`) | `400 Bad Request` com envelope `{ message, _error }` | nenhuma |
| Provedor de cotação (Yahoo Finance) | origem fixa e símbolo restrito a letras e dígitos, escapado na URL; resposta parseada por schema antes de virar preço ou atributo de instrumento, com nome e setor limitados em tamanho; do cliente, o registro só aceita símbolo, mercado e moeda | falha de infraestrutura; a posição é reportada pelo livro | resposta tratada como dado externo |

O corpo é limitado a `100kb` (`RequestLimits.JSON_BODY_SIZE`) antes de qualquer
parse, e o payload acima disso responde `413`.

## Segredos

* `EnvsSchema` recusa o processo no boot: `JWT_SECRET` com menos de 32
  caracteres, `BCRYPT_SALT` abaixo de 10 rounds, `JWT_EXPIRATION` sem unidade ou
  acima de `30d`, `CORS_ALLOWED_ORIGINS` ausente em produção, `API_PROXY_SECRET`
  com menos de 32 caracteres ou ausente em produção. Não há default
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
| Web, toda resposta | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security`, por `headers()` do `next.config.js`, mais `x-powered-by` desligado por `poweredByHeader: false` |
| Web, resposta de página | CSP com nonce por resposta e `strict-dynamic`, montada em `src/proxy.ts` |

A CSP não alcança `/api` — o matcher do proxy exclui essas rotas —, e é por isso
que os cinco cabeçalhos ficam no `next.config.js`, que se aplica a tudo: uma
resposta JSON do proxy sai com `nosniff` mesmo sem CSP. `worker-src` passou a
`'none'` com a remoção do PWA (TASK 20.3).

## Rate limiting

Os budgets estão em `RateLimits` (`backend/src/config/Constants.ts`) e são
aplicados por `middleware/RateLimitMiddleware.ts`. Os números são assumidos, não
medidos.

| Budget | Rotas | Janela | Limite | Chave | Conta |
| --- | --- | --- | --- | --- | --- |
| `SIGN_IN_PER_ADDRESS` | sign-in | 15 min | 50 | endereço do cliente | só falhas |
| `SIGN_IN_PER_ACCOUNT_AND_ADDRESS` | sign-in | 15 min | 10 | digest do e-mail + endereço do cliente | só falhas |
| `SIGN_IN_PER_ACCOUNT` | sign-in | 1 h | 50 | digest do e-mail | só falhas |
| `SIGN_UP_PER_ADDRESS` | sign-up | 1 h | 10 | endereço do cliente | toda tentativa |
| `ACCOUNT_CHANGE` | `PATCH` e `DELETE /v1/user` | 15 min | 10 | digest da sessão; sem ela, endereço | só falhas |
| `API` | todas | 1 min | 120 | digest da sessão; sem ela, endereço | toda requisição |
| `INSTRUMENT_SEARCH` | busca de instrumentos | 1 min | 30 | id do usuário | toda requisição |

"Só falhas" é o `skipSuccessfulRequests`: resposta abaixo de 400 devolve a
tentativa, então quem acerta a senha não gasta nada. E-mail ausente ou vazio cai
na chave do endereço. IPv6 conta pelo prefixo /56 (`ipKeyGenerator`), que um
assinante recebe inteiro.

**Camadas do sign-in.** Rodam na ordem da tabela, e a requisição que uma recusa
não é contada pelas seguintes:

* por endereço: um host tentando muitas contas (password spraying, credential
  stuffing);
* por conta e endereço: quem esqueceu a senha. É o único limite que um usuário
  legítimo encontra, e bloqueia a conta só para aquele endereço;
* por conta: tentativas contra uma conta distribuídas por muitos endereços. É
  também o custo de manter a conta de outra pessoa bloqueada: 50 falhas por
  hora, vindas de endereços distintos, já que cada endereço para em 10.

O sign-up conta toda tentativa porque cada uma custa um hash bcrypt e uma
transação, e é o ponto de criação automatizada de contas.

**Endereço do cliente.** Em produção o navegador só fala com o web, e todo
tráfego chega à API vindo do mesmo serviço: contado pelo socket, o endereço
seria um balde único para o produto inteiro. As rotas sem sessão (sign-in e
sign-up) recebem do web dois cabeçalhos: `x-client-address`, a última entrada do
`X-Forwarded-For` — a que a plataforma acrescenta, o mesmo salto único que o
`trust proxy` da API conta —, e `x-api-proxy-secret`. A API só acredita no
endereço quando o segredo confere com `API_PROXY_SECRET` e o valor é um IP; do
contrário conta pelo endereço de quem conectou, que um cabeçalho não muda. Os
segredos são comparados como digests SHA-256 por `timingSafeEqual`, então o
tempo não depende do valor apresentado. `API_PROXY_SECRET` é obrigatória na API
em produção, e o web recusa encaminhar sign-in e sign-up em produção sem ela,
registrando `api.proxy_secret_missing`: sem o segredo, os dois voltariam a um
balde único.

**O que o cliente recebe.** `429` com o envelope genérico de `THROTTLED` e
`Retry-After` em segundos, que o web mostra como "Too many requests. Try again
in N minutes.". Nada diz qual budget se esgotou nem se a conta existe: e-mail
desconhecido e senha errada respondem igual e são contados igual. Os limitadores
de sign-in e sign-up não enviam `RateLimit` nem `RateLimit-Policy` — o que resta
do budget de uma conta conta as falhas de todos os endereços, e contaria a um
chamador as tentativas dos outros; só o budget geral da API, que é do próprio
chamador, aparece nessas rotas.

**Backoff.** A janela sobe de 15 minutos, por conta e endereço, para 1 hora, por
conta, e o `Retry-After` diz quanto falta. Um contador que cresce enquanto a
conta segue sob ataque exige estado fora da janela (TD-077).

**Impacto em usuários legítimos.** Acertar a senha não consome budget, então o
limite só aparece depois de 10 falhas em 15 minutos no mesmo endereço, e a
mensagem diz quando tentar de novo. Uma rede atrás de um único NAT — escritório,
universidade, operadora com CGNAT — compartilha 50 falhas de sign-in por 15
minutos e 10 cadastros por hora; é o ponto a medir antes de apertar os números.
Um ataque distribuído contra uma conta a bloqueia também para o dono, pelo resto
da janela de 1 hora aberta pela primeira falha.

**Outras superfícies de autenticação.**

| Superfície | Tratamento |
| --- | --- |
| Custo do bcrypt como amplificação de DoS | Toda verificação de senha passa por um limitador antes do serviço; o sign-in com e-mail desconhecido compara contra um hash fictício, então o custo é igual e a contagem também |
| Enumeração de e-mails (TD-004) | A vazão cai para 10 sondagens por hora por endereço, pelo budget de sign-up |
| Bloqueio de conta alheia | Limitado a quem controla muitos endereços; o dono em outro endereço só é afetado pela camada por conta |
| Falsificação do endereço | Cabeçalho sem o segredo, com segredo errado ou com valor que não é IP é ignorado; o `X-Forwarded-For` enviado pelo cliente fica antes da entrada que o web usa |
| Automação sem limite de volume | Não há desafio a bots; dentro dos budgets, um script é indistinguível de uma pessoa (TD-076) |
| Várias instâncias | Os contadores são por processo; o limite efetivo é o budget vezes o número de instâncias (TD-006) |
| Desenvolvimento local | Sem `API_PROXY_SECRET`, o web não atesta endereço e todo navegador conta como o container do web |

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
| Sem desafio a bots no sign-in e no sign-up (TD-076) | Os budgets limitam o volume, não distinguem script de pessoa; um desafio depende de serviço externo |
| Sem teto absoluto de falhas consecutivas por conta (TD-077) | A janela por conta renova a cada hora; um contador que só zera no sucesso exige estado persistente |
| `style-src 'unsafe-inline'` (TD-007) | Componentes usam atributo `style`, que nonce não autoriza; CSS injetado altera aparência, não executa script |
| Tráfego não autenticado contra o web não é limitado (TD-065) | O teto da API protege o backend; o servidor do Next depende da plataforma |
