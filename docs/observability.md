# Observabilidade — FASE 18

Como o backend reporta o que aconteceu em produção: o que é escrito, com que
campos, e por que nada disso passa por `console`.

## Formato

Uma linha, um objeto JSON, sem quebra interna. `INFO` e `WARNING` vão para
`stdout`; `ERROR` vai para `stderr`. É o formato que o Cloud Run entrega ao
Cloud Logging sem agente nenhum: `severity` e `timestamp` são lidos do próprio
objeto, o resto vira `jsonPayload`.

```json
{"timestamp":"2026-09-19T14:32:07.123Z","severity":"INFO","event":"http_request","requestId":"b7c1d2e3-f4a5-4b6c-8d9e-0f1a2b3c4d5e","method":"GET","route":"/v1/portfolio/positions","status":200,"durationMs":37,"userId":"0f2f5a3c-2c1c-4f2a-9a1a-7c6f5d4e3b2a"}
```

| Campo | Origem |
| --- | --- |
| `timestamp` | ISO 8601 em UTC, gravado no momento da escrita |
| `severity` | `INFO`, `WARNING` ou `ERROR` |
| `event` | discriminador tipado; é por ele que se agrupa uma consulta |

`JSON.stringify` escapa `\n`, `\r` e demais caracteres de controle, então
nenhum dado vindo da requisição consegue forjar uma segunda linha de log.
`formatLogEntry` é uma função pura e o destino é injetável (`LogSink`), o que
deixa o conteúdo testável sem capturar `stdout`.

## Catálogo de eventos

| `event` | Severidade | Campos próprios | Onde |
| --- | --- | --- | --- |
| `server_started` | INFO | `port` | `Server.ts` |
| `database_connected` | INFO | — | `PrismaClient.ts` |
| `database_unreachable` | ERROR | `reason` | `Server.ts`, antes de `exit(1)` |
| `quote_provider_key_missing` | WARNING | — | `Server.ts` |
| `quote_provider_unavailable` | WARNING | `reason`, `retryInMs` | `YahooFinanceProvider.ts` |
| `http_request` | conforme o status | `requestId`, `method`, `route`, `status`, `durationMs`, `userId?`, `errorCode?` | `RequestLogMiddleware.ts` |
| `request_failed` | ERROR | `requestId?`, `errorName`, `errorMessage`, `stack?` | `ErrorHandlerMiddleware.ts` |

`LogEvent` é uma união discriminada: uma linha nova é um membro novo do tipo,
nunca uma mensagem livre. A severidade de `http_request` sai do status —
`< 400` é `INFO`, `4xx` é `WARNING`, `5xx` é `ERROR`.

## Os seis campos de uma requisição

* **request id** — `x-request-id`. Um id que chega na requisição é reaproveitado
  somente se estiver na forma que o próprio serviço gera (`[A-Za-z0-9-]{8,64}`);
  caso contrário é substituído por um `randomUUID`. Sempre devolvido no header
  de resposta, para o cliente correlacionar o que reportar.
* **user id** — apenas o id de quem está autenticado. Nunca e-mail, nunca token,
  nunca corpo da requisição: um log é lido por mais gente e vive mais tempo do
  que a sessão.
* **route** — o padrão registrado, não o caminho: `/v1/assets/:symbol` agrupa,
  `/v1/assets/AAPL` não agruparia. Requisição que não casou rota alguma é
  registrada como `unmatched`.
* **status** — o código com que a resposta foi finalizada.
* **duration** — `performance.now()` na entrada e na finalização da resposta,
  arredondado para milissegundos.
* **error code** — o `code` do envelope de erro, gravado em `req.errorCode` pelo
  error handler (e pelo 404) e lido depois pelo log da requisição.

O log é escrito no evento `finish` da resposta, isto é, depois do error
boundary. É o que garante que `status` e `errorCode` descrevam o que o cliente
de fato recebeu.

## Ordem dos middlewares

`RequestLogMiddleware` é o primeiro registrado em `App.ts`, antes do `helmet`.
Assim o id existe para qualquer requisição — inclusive as que morrem no CORS, no
limite de payload ou no rate limit — e o listener de `finish` já está instalado
quando qualquer camada responde.

## Limites conhecidos

* O rate limit responde sem passar pelo error boundary, então o `errorCode` da
  linha é escrito pelo `handler` do próprio limitador: uma requisição barrada
  sai com `status: 429` e `errorCode: INFRASTRUCTURE`. Ver `docs/errors.md`.
* Sob `NODE_ENV=test` nada é escrito: a saída de uma suíte é do runner de teste,
  e uma linha de servidor no meio dela não reporta nada. O que se verifica nos
  testes é a entrada entregue ao `LogSink`, não o que foi para o descritor.
* Não há tracing distribuído: o serviço é um processo só, e o `requestId` já
  costura as linhas de uma mesma requisição. Métricas nomeadas ficam por conta
  das do Cloud Run (latência, contagem, instâncias), sem instrumentação própria.

## Como evitar regressão

`no-console` é `error` no ESLint do backend, com exceção apenas para
`src/test/**`. Qualquer `console.log` de diagnóstico que escape para o código de
produção quebra o lint antes de virar linha não estruturada em produção.
