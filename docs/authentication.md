# Estratégia de autenticação — TASK 1.7

Decisão explícita adotada na FASE 1, implementada sobre a arquitetura existente (JWT + cookie `httpOnly` + proxy Next.js). Revisada depois da TASK 3.2, quando os testes de autenticação expuseram falhas de sessão, de política de senha e de exposição de dados; depois da TASK 3.3, que corrigiu o sign-up não atômico, a validação de `JWT_EXPIRATION` e o sign-out do interceptor do web; e na revisão dessas correções, que impôs teto a `JWT_EXPIRATION`, tornou atômica a exclusão de conta e trocou a CSP estática do web por uma com nonce.

## Modelo: sessão única, stateful, com token expirável

O JWT continua sendo o portador da credencial, mas não basta por si só. Um request é autenticado quando **todas** as condições valem:

1. o header é `Authorization: Bearer <token>`;
2. a assinatura confere com `JWT_SECRET` sob **HS256**. O algoritmo é fixado na emissão e na verificação (RFC 8725 §3.1), nunca escolhido pelo header do próprio token;
3. o token não expirou (`exp`);
4. as claims têm o formato esperado: `sub` (id do usuário) e `sessionVersion` (inteiro ≥ 0);
5. `sub` identifica um usuário existente (busca por chave primária);
6. a `sessionVersion` do token é igual a `users.sessionVersion`.

A condição 6 é o ponto de revogação. Sign-in, sign-out e troca de senha incrementam `users.sessionVersion` em um único `UPDATE`, e todo token emitido antes deixa de valer no mesmo instante, sem lista de bloqueio. O sign-up não incrementa: emite o primeiro token com a versão inicial da linha que acabou de criar.

**Invariante:** cada versão de um usuário é emitida para no máximo um token. Fora do sign-up, um token só é emitido logo após o incremento, com o valor que o incremento devolveu; o `UPDATE ... increment` serializa no lock de linha do Postgres, então requisições concorrentes recebem versões distintas. A versão inicial só é emitida pela chamada que criou a linha, e nenhum incremento volta a ela. Dois tokens nunca coincidem, mesmo quando emitidos no mesmo segundo.

**O banco não guarda credencial de sessão.** Um vazamento da tabela `users` expõe um contador, não tokens utilizáveis; forjar um token exige `JWT_SECRET`.

## Decisões por item

| Item | Decisão | Onde |
| --- | --- | --- |
| **Expiração** | Todo token expira após `JWT_EXPIRATION` (padrão `1d`, teto `30d`). O valor é validado no boot: inteiro positivo seguido de `s`, `m`, `h` ou `d`, convertido em segundos e entregue ao `jsonwebtoken` como número. Número sem unidade é rejeitado, porque o `jsonwebtoken` lê `"3600"` como milissegundos e encurtaria a sessão mil vezes em silêncio. O teto vem do NIST SP 800-63B, que limita a 30 dias a sessão autenticada só por senha (AAL1) antes de exigir reautenticação; sem refresh, é a expiração que força essa reautenticação. Valor inválido impede a aplicação de subir. Antes desta task os tokens não expiravam nunca | `config/EnvsSchema.ts`, `infra/cryptography/Jwt.ts` |
| **Revogação** | Server-side, por incremento de `users.sessionVersion`. Aplica-se a sign-out, novo sign-in e troca de senha | `infra/database/UserRepository.ts` |
| **Refresh** | **Não há refresh token.** Expirada a sessão, o usuário reautentica. Um segundo token de longa duração ampliaria a superfície de ataque sem resolver um problema que o produto tenha hoje | — |
| **Logout** | `POST /v1/user/sign-out` incrementa `users.sessionVersion`; o proxy chama esse endpoint e só então apaga o cookie | `routes/UserRoutes.ts`, `web/src/app/api/v1/sign-out/route.ts` |
| **Sessão concorrente** | **Não suportada, por decisão.** Vale uma versão por usuário: entrar em um segundo dispositivo derruba o primeiro. Suportar N sessões exige uma tabela de sessões, mudança de modelo que não pertence a esta fase | `infra/database/UserRepository.ts` |
| **Sign-up** | O corpo exige `baseCurrency`, código ISO 4217, e aceita `portfolioName` opcional, com os limites do nome de `CreatePortfolioSchema` (aparado, de 1 a 60 caracteres, em branco recusado com `400`); a primeira carteira do usuário leva esse nome, ou `Main` sem ele, nessa moeda. O formulário do web pede o nome, preenchido com `Main`, e oferece BRL, USD e EUR. Usuário e carteira são uma única escrita aninhada do Prisma, executada em uma transação: nenhuma falha deixa usuário sem carteira. O índice único de `email` é a única autoridade sobre o endereço estar livre, sem consulta prévia sujeita a corrida; a violação (`P2002`) responde `400 User already exists`, e de sign-ups concorrentes para o mesmo e-mail exatamente um cria a conta. Qualquer outra falha de banco propaga como erro interno | `validation/schema/user/CreateUserSchema.ts`, `infra/database/UserRepository.ts`, `services/user/CreateUserService.ts` |
| **Token inválido** | `401 AuthenticationError`, com mensagem distinguindo token inválido, token expirado e sessão revogada | `middleware/AuthMiddleware.ts` |
| **Credenciais inválidas** | `POST /v1/user` responde `401 Invalid email or password` tanto para senha errada quanto para e-mail inexistente. No e-mail inexistente, o bcrypt verifica a senha contra um hash fictício de mesmo custo, então nem o tempo de resposta distingue os casos | `services/user/GetUserService.ts` |
| **Troca de senha** | `PATCH /v1/user` só aceita `newPassword` acompanhada da `oldPassword` correta. A nova senha e o incremento da versão vão no mesmo `UPDATE`, o que revoga a sessão atual. O proxy `PATCH /api/v1/user` apaga o cookie na mesma resposta, e o web volta ao sign-in para a entrada com a nova senha | `validation/schema/user/UpdateUserSchema.ts`, `infra/database/UserRepository.ts`, `web/src/app/api/v1/user/route.ts` |
| **Exclusão de conta** | `DELETE /v1/user` exige a senha atual e remove usuário, todas as suas carteiras, ativos e transações em uma única transação serializável, dependentes primeiro: nem falha nem escrita concorrente deixa dado sem dono, e o token da conta deixa de autenticar pela condição 5. Antes, conta com ativos respondia 500 | `infra/database/UserRepository.ts` |
| **Throttling** | Sign-in conta só falhas, em três camadas: 50 por endereço e 10 por conta e endereço a cada 15 min, 50 por conta a cada hora. Sign-up conta toda tentativa, 10 por endereço a cada hora. `PATCH` e `DELETE /v1/user` verificam a senha e contam 10 falhas por sessão a cada 15 min: uma sessão roubada não pode virar oráculo de adivinhação de senha. O endereço é o do cliente, que o web atesta com `API_PROXY_SECRET`; `429` traz só o envelope genérico e `Retry-After`. Detalhes em `security.md`, §Rate limiting | `routes/UserRoutes.ts`, `middleware/RateLimitMiddleware.ts` |
| **Exposição de dados** | `password` e `sessionVersion` nunca saem em respostas: o repositório os omite na própria consulta (`omit` do Prisma), inclusive em `GET /v1/users`, restrito a admin. `GET /v1/user` devolve só o perfil do próprio chamador e omite também `isAdmin`; conta que deixou de existir responde `401` | `infra/database/UserRepository.ts`, `services/user/GetCurrentUserService.ts` |

## Política de senha

Aplicada a senhas novas (sign-up e troca de senha) em `backend/src/validation/schema/user/PasswordSchema.ts` e, a regra do e-mail, em `backend/src/domain/PasswordPolicy.ts`:

| Regra | Valor | Fundamento |
| --- | --- | --- |
| **Mínimo** | 8 caracteres, contados em code points Unicode | Decisão do produto (2026-09-23). O NIST SP 800-63B-4 §3.1.1.2 pede 15 para senha usada como único fator, caso do app, que não tem MFA, e 8 só ao lado de um segundo fator. 8 é o piso do perfil 800-63B-3, que compensa com as recusas abaixo e com o throttling do sign-in |
| **Máximo** | 72 bytes UTF-8 | O bcrypt só digere os primeiros 72 bytes e ignora o resto. Rejeitar evita gravar uma senha mais fraca do que parece (OWASP Password Storage Cheat Sheet) |
| **Em branco** | Rejeitada | Senha só de espaços, de qualquer tamanho |
| **Um caractere repetido** | Rejeitada | `aaaaaaaa` cumpre o mínimo e é das primeiras tentativas de um ataque de dicionário |
| **Senha comum** | Rejeitada, sem distinção de caixa | Lista curada das senhas que os rankings de vazamentos publicados põem no topo, só as que passam do mínimo (NIST SP 800-63B §3.1.1.2). Não é um corpus de vazamentos: ver limitação 3 |
| **Derivada do e-mail** | Rejeitada a senha que contém, sem distinção de caixa, a parte do e-mail antes do `@`, quando essa parte tem 4 caracteres ou mais | Palavra específica do contexto (NIST SP 800-63B §3.1.1.2): o e-mail nomeia a conta. Abaixo de 4 caracteres a parte é genérica demais e recusaria senhas sem relação com ela. O sign-up checa no schema; a troca de senha, no serviço, contra o e-mail da conta, e responde `400` com o detalhe em `newPassword` |
| **Normalização** | Nenhuma, nem `trim` | A senha é usada exatamente como recebida (OWASP ASVS): o valor validado é o valor gravado e, depois, o verificado |

Senhas submetidas para verificação (sign-in, exclusão de conta, `oldPassword`) só precisam não ser vazias e ter até 255 caracteres, o limite anterior; assim, contas criadas sob a política antiga continuam entrando. Os formulários de sign-up e de troca de senha do web espelham a política, menos a lista de senhas comuns, que só o backend tem, e marcam o mínimo e a regra do e-mail conforme a senha é digitada; a autoridade é o backend.

## Coerência entre o proxy do Next e o backend

Antes, o proxy do Next (`web/src/proxy.ts`, `middleware.ts` até o Next 16) autenticava por **presença** do cookie: um token expirado ou revogado deixava o usuário navegar até a primeira chamada de API falhar com 401.

Agora o proxy decodifica o payload do token e verifica `exp` antes de liberar a rota; se estiver expirado, redireciona para o sign-in **e apaga o cookie**. O redirecionamento leva o caminho pedido, com a query, em `next`, salvo quando é a Overview, e `reason=session-expired` quando havia token ou o marcador de sessão descrito abaixo. A URL sai de `signInRouteFor`, em `web/src/common/constants.ts`, a mesma do interceptor abaixo.

**O proxy não verifica a assinatura.** Ele é um portão de UX, não um limite de segurança. A autoridade continua sendo o backend, que valida assinatura, expiração e sessão ativa; um token forjado passa pelo proxy e é rejeitado na primeira chamada à API.

Complementarmente, o cookie de sessão recebe `expires` derivado do `exp` do próprio token (`web/src/lib/session.ts`), de modo que o browser descarta a credencial no mesmo instante em que a API deixa de aceitá-la.

**Expiração e sign-out se distinguem por um marcador.** Com o cookie descartado pelo browser na expiração, o proxy não tinha como distinguir uma sessão expirada de uma encerrada pelo usuário: a expiração real chegava ao sign-in sem aviso. E o sign-out manual mostrava o aviso de expiração: `useLeaveSession` removia o cache com as telas protegidas ainda montadas, o React Query refazia as queries observadas, o proxy do web respondia 401 por falta de token, e o interceptor tratava esse 401 como expiração. A troca de senha tinha o mesmo defeito. A correção tem três partes:

* sign-in e sign-up gravam, junto do token, o cookie `ex3:session` (`httpOnly`, mesmas opções), que dura o token mais 7 dias (`SESSION_EXPIRY_NOTICE_MS`, valor assumido). Só o sign-out e a troca de senha o apagam antes disso, por `clearSessionCookies`; o proxy nunca o apaga, porque um prefetch de rota protegida o consumiria antes da navegação;
* o proxy e o interceptor pedem o aviso quando há token ou marcador. Sem nenhum dos dois, quem encerrou a sessão foi o usuário, nesta aba ou em outra;
* o cache do React Query é descartado pelo layout público (`SessionCacheDisposal`), ao montar, quando as telas protegidas já desmontaram e nenhuma query tem observador.

No cliente, o interceptor do axios (`web/src/lib/axios/axios.ts`) trata 401 como sessão rejeitada: chama `POST /api/v1/session/expire`, que apaga o cookie do token, mantém o marcador e responde `{ hasSessionExpired }`, e recarrega no sign-in com a página atual em `next` e, se `hasSessionExpired`, `reason=session-expired`. Apagar o token é o que impede o proxy de mandar de volta à Overview um token revogado que ainda não expirou. O interceptor não chama mais `/v1/sign-out`: revogar um token que a API acabou de rejeitar não tem efeito, e o sign-out apagaria o marcador. As exceções são `/v1/sign-in` e `/v1/sign-up`, onde o 401 significa credencial recusada e precisa chegar ao formulário, e o próprio `/v1/session/expire`, para que a expiração não recorra. 401s concorrentes compartilham uma única expiração, com um só redirecionamento.

Com `reason=session-expired`, o sign-in mostra "Your session expired. Sign in again to continue." acima do formulário; o toast que o interceptor mostrava se perdia na recarga. Entrando, o web vai para `next` se ele for um caminho desta origem — começa com uma só `/`, sem `\` logo depois, sem espaço, tab ou quebra de linha, que o parser de URL descartaria para formar `//host` — e para a Overview no resto. `next` chega pela barra de endereço, então é validado na página do sign-in, no servidor, antes de chegar ao `router.push`.

O perfil exibido vem de `GET /api/v1/user`; o `localStorage` não guarda dados do usuário. Toda entrada na área pública descarta o cache do React Query, para que dados de uma conta não apareçam para a seguinte na mesma aba.

**Content-Security-Policy.** O cookie `httpOnly` não é legível por script, mas um script injetado ainda faria chamadas autenticadas pela origem do web. O proxy emite a CSP de cada página com um nonce novo por resposta: só roda script que o Next.js marcou com esse nonce ou que um script marcado carregou (`'strict-dynamic'`), e o browser só busca recursos na própria origem. Por isso toda rota renderiza por requisição (`await connection()` no layout raiz), já que página pré-renderizada no build não teria nonce. `'unsafe-eval'` só existe em desenvolvimento. A CSP estática anterior, em `next.config.js`, liberava `'unsafe-inline'` e `'unsafe-eval'` em `script-src`, o que a anulava contra XSS; saiu junto com o `X-XSS-Protection`, obsoleto.

## Cobertura de testes

Unitária, em `backend/src/infra/cryptography/Jwt.test.ts`, `backend/src/middleware/AuthMiddleware.test.ts` e `backend/src/config/EnvsSchema.test.ts`:

* token com a versão de sessão corrente → autentica;
* header ausente ou malformado → 401;
* token expirado → 401 com mensagem de expiração;
* token assinado com outro segredo, ou com o segredo certo sob outro algoritmo (HS512) → 401;
* token autêntico com claims de outro formato (payload legado `{ id }`, `sessionVersion` como string) → 401;
* versão de sessão superada, ou usuário inexistente → 401 de sessão revogada;
* `JWT_EXPIRATION`: cada unidade convertida em segundos; o teto aceito em `d`, `h` e `s`; vazio, número sem unidade, unidade desconhecida, fração, espaços nas pontas, zero, negativo, zero à esquerda e valor acima de `30d` em qualquer unidade → rejeitados.

Ponta a ponta, contra banco e pela API HTTP, em `backend/src/routes/Authentication.integration.ts`:

* **sign-up:** token que autentica de imediato e carteira criada na moeda escolhida, moeda base ausente ou desconhecida recusada sem criar conta, e-mail já cadastrado em qualquer caixa, sign-ups concorrentes para o mesmo e-mail (exatamente um cria conta e carteira), fronteiras de 15 code points e 72 bytes, senha em branco, espaços preservados como parte da senha;
* **sign-in:** 401 genérico, resposta idêntica para e-mail inexistente, verificação bcrypt também nesse caso, token distinto a cada sign-in com revogação do anterior;
* **tokens:** inválido (outro segredo, `alg: none`, payload legado, valor não-JWT) e expirado;
* **sign-out.**
* **exclusão de conta:** remove a conta com todas as carteiras, ativos e transações, sem tocar em outra conta, e encerra a sessão; senha errada não remove nada;
* **troca de senha:** revoga a sessão, exige a senha atual, aplica a política e é limitada pelo throttling de mudança de conta;
* **perfil:** o chamador recebe o próprio perfil, e não o de outra conta, sem colunas de credencial nem `isAdmin`;
* **listagem de usuários:** admin recebe a lista sem colunas de credencial; não admin recebe 403;
* **rotas protegidas:** rejeição anônima em todas.

## Migração

`backend/prisma/migrations/20260911000000_session_version` remove `users.accessToken` e adiciona `users.sessionVersion INTEGER NOT NULL DEFAULT 0`. Efeitos no deploy:

* tokens emitidos antes (payload `{ id }`) falham na validação das claims, então todo usuário reautentica uma vez;
* senhas cadastradas com espaços nas pontas foram gravadas sem eles, porque backend e web aplicavam `trim`. Como a comparação agora é exata, esses usuários entram digitando a senha sem os espaços.

Um `JWT_EXPIRATION` sem unidade que antes subia (e expirava em milissegundos) agora impede o boot, e precisa ganhar a unidade no ambiente antes do deploy. O mesmo vale para um valor acima de `30d`, que precisa ser reduzido.

## Limitações conhecidas e riscos aceitos

1. **Sem refresh, `JWT_EXPIRATION` alto demais enfraquece a revogação por expiração e baixo demais degrada a UX.** O padrão `1d` é o meio-termo assumido; é configurável por ambiente até o teto de `30d`.
2. **Enumeração de e-mails no sign-up.** `POST /v1/user/create` responde `User already exists` para e-mail já cadastrado. Eliminar isso exige confirmação por e-mail, fluxo que o produto não tem. A vazão é de 10 sondagens por hora por endereço, o budget do sign-up, que conta toda tentativa.
3. **A lista de senhas comuns não é um corpus de vazamentos.** O NIST SP 800-63B-4 pede comparar senhas novas com senhas comprometidas; a lista curada cobre só as mais frequentes, e uma senha vazada fora dela é aceita. Com o mínimo em 8, essa comparação pesa mais; está em TD-005.
4. **Sem normalização Unicode.** A mesma senha digitada com composições diferentes (`é` pré-composto vs. `e` + acento combinante) não confere. Normalizar altera o valor verificado de contas existentes; avaliar junto do item 3.
5. **Contadores na memória do processo.** Com mais de uma instância do backend, cada uma aplica o budget inteiro, e o limite efetivo é o budget multiplicado pelo número de instâncias. Um store compartilhado resolve; está em TD-006. As chaves estão em `security.md`, §Rate limiting.
6. **Diferença residual de tempo se `BCRYPT_SALT` mudar.** Hashes antigos mantêm o custo antigo, enquanto o hash fictício usa o atual.
7. **`style-src 'unsafe-inline'` na CSP.** Componentes usam atributos `style`, que nonce não autoriza. Onde houver injeção de marcação, CSS injetado pode alterar a interface, mas não executa script nem carrega recurso de outra origem.
