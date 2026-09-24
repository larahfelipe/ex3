# Taxonomia de erros — FASE 18

Toda falha que a API reporta cai em uma de oito categorias. O nome da categoria
é o `code` do envelope: estável entre versões, é por ele que um cliente decide
o que fazer e um log agrupa o que aconteceu.

## As categorias

| `code` | Status | Significa | Classe |
| --- | --- | --- | --- |
| `VALIDATION` | 400 | a entrada não é aceitável: forma, tipo, faixa ou formato | `ValidationError` |
| `VALIDATION` | 413 | corpo acima de `RequestLimits.JSON_BODY_SIZE` | — (`express.json`) |
| `AUTHENTICATION` | 401 | sem identidade utilizável: credencial ausente, malformada, expirada ou substituída | `AuthenticationError` |
| `AUTHORIZATION` | 403 | o chamador é conhecido e não pode fazer isso | `AuthorizationError` |
| `NOT_FOUND` | 404 | nada que o chamador possa ver responde por aquele endereço | `NotFoundError` |
| `CONFLICT` | 409 | a requisição é válida e colide com o que já está gravado | `ConflictError` |
| `DOMAIN` | 422 | todos os campos são válidos e uma regra do domínio recusa a operação | `DomainError` |
| `INFRASTRUCTURE` | 429 | limite de capacidade: o chamador excedeu o orçamento da janela | — (`RateLimitMiddleware`) |
| `INFRASTRUCTURE` | 503 | uma dependência não responde: readiness recusando a instância | — (`/ready`) |
| `INTERNAL` | 500 | falha não prevista, reportada sem detalhe interno | — (error boundary) |

Categoria e status são eixos independentes. É por isso que duas entradas do
catálogo compartilham `VALIDATION`: um corpo grande demais é recusa de entrada
respondida com 413, e não uma categoria própria. `ErrorCategories` define os
oito nomes; `Errors` associa cada entrada a `{ code, status, message }`, e o
`satisfies` impede que uma entrada nova invente um código fora da taxonomia.

## O que mudou de classificação

| Situação | Antes | Agora |
| --- | --- | --- |
| E-mail, símbolo ou instrumento já cadastrado | 400 `BAD_REQUEST` | 409 `CONFLICT` |
| Recusa do ledger: quantidade negativa, moeda divergente, posição fora da faixa | 400 `BAD_REQUEST` | 422 `DOMAIN` |
| Demais recusas de entrada | 400 `BAD_REQUEST` | 400 `VALIDATION` |
| Sessão ausente ou inválida | 401 `UNAUTHORIZED` | 401 `AUTHENTICATION` |
| Rota de admin para não-admin | 403 `FORBIDDEN` | 403 `AUTHORIZATION` |
| Excesso de requisições | 429 `TOO_MANY_REQUESTS` | 429 `INFRASTRUCTURE` |
| Falha não prevista | 500 `INTERNAL_SERVER_ERROR` | 500 `INTERNAL` |

`NOT_FOUND` é o único código que não mudou de nome, e é também o único que o
web compara (`isNotFoundError`, em `web/src/lib/axios/errors.ts`).

## Duas decisões que não são dedutíveis do código

**Senha atual errada em `PATCH`/`DELETE /v1/user` continua 400 `VALIDATION`.**
Semanticamente é uma reautenticação, mas o interceptor do web trata qualquer 401
fora de sign-in e sign-up como sessão rejeitada: apaga o token e
redireciona. Responder 401 a quem apenas digitou a senha errada deslogaria o
usuário no meio da operação. A recusa é de um campo do formulário, e é como um
campo que ela é reportada.

**Rate limit é `INFRASTRUCTURE`.** A taxonomia da TASK 18.2 não tem categoria de
throttling; o limite é de capacidade, não de entrada nem de permissão. O
limitador responde sem passar pelo error boundary, então o envelope e o
`req.errorCode` da linha de log são escritos no próprio `handler` — o que fecha
a lacuna registrada em `docs/observability.md` na TASK 18.1.

## Onde cada erro é produzido

* Serviços lançam a classe da categoria; nada fora de `src/errors` constrói um
  `ApplicationError` direto.
* `ErrorHandlerMiddleware` é a única fronteira que escreve o envelope
  `{ code, message, details }`, converte o que não é `ApplicationError` em
  `INTERNAL` e registra o código em `req.errorCode`.
* `details` só é preenchido pela validação, com um `{ path, message }` por campo
  recusado. Nas demais categorias é `[]`, sempre presente.
* Nenhuma resposta carrega stack, SQL ou mensagem de driver: `docs/api-inventory.md`,
  §Padrão de resposta.
