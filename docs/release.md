# Release candidate

Consolidação da versão candidata: o checklist obrigatório da TASK 20.7, o comando que produziu cada resultado e a lista fechada de exceções. Nenhum item é declarado atendido por leitura de código — o que não foi executado está em Exceções, com a dívida que o rastreia.

## Referência

| Item | Valor |
| --- | --- |
| Commit de captura | `69ca10c` |
| Data | 2026-09-20 |
| Pacotes | `backend` e `web`, independentes, sem `package.json` na raiz |
| Runtime | Node 24.15, pnpm 11.18.0, TypeScript 5.9.3, PostgreSQL 17.6 |
| Ambiente | stack de `compose.yaml` em desenvolvimento; `web` servido por `next start` a partir do build de produção |

## Checklist

| Check | Comando | Resultado |
| --- | --- | --- |
| lint | `pnpm lint` nos dois pacotes, com `--max-warnings=0` | passa |
| typecheck | `pnpm typecheck` nos dois pacotes | passa |
| unit tests | `pnpm test:unit` no `backend` | 168 testes, 30 suítes, 0 falhas |
| integration tests | `pnpm test:integration` no `backend` | 230 testes, 50 suítes, 0 falhas, 117 s |
| build | `pnpm build` nos dois pacotes | passa |
| e2e | — | **não executado**, exceção 1 |
| accessibility | axe-core 4.10.3 em navegador, na TASK 20.6 | sem violação crítica; uma violação séria remanescente, exceções 2 e 3 |
| responsive | varredura de 320 a 1536 px em navegador | passa |
| security | `pnpm audit` nos dois pacotes e verificação dos cabeçalhos na resposta | passa |
| performance | métricas de navegação medidas em navegador, na TASK 20.7 | passa; CLS e INP sem número, exceção 4 |

Formatação (`pnpm prettier`) passa nos dois pacotes, embora não esteja no checklist obrigatório.

## Evidência

### Testes

As duas suítes rodam com `--env-file=.env.test` e não herdam nada do ambiente do desenvolvedor (TD-059). A de integração roda com `--test-concurrency=1` contra o `postgres-test` do Compose, preparado pelo próprio script. O `web` não tem suíte — é a exceção 1.

### Build

`backend` compila com `tsc` e resolve os aliases com `tsc-alias`, produzindo `dist/Server.js`. `web` compila com Turbopack, sem `--webpack` desde a TASK 20.3, e serve 1.528.472 bytes de JavaScript em `build/static`. Toda rota é `ƒ` (renderizada sob demanda): o nonce da CSP é por resposta, então nenhuma página pode ser pré-renderizada no build — a razão está em `app/layout.tsx`.

### Acessibilidade

Detalhe em [`accessibility.md`](accessibility.md), §Auditoria automatizada: seis rotas, dois viewports, com e sem sessão, mais dialog aberto e listagem sem resultado, com dados semeados. Zero violação de impacto `critical`; a única regra reprovada é `color-contrast`, sempre no mesmo par de tokens.

### Responsividade

Varredura própria no mesmo arnês, em 320, 390, 640, 768, 1024, 1280 e 1536 px, sobre `/sign-in`, `/sign-up`, `/`, `/assets`, `/assets/PETR4` e `/account`:

| Regra | Resultado |
| --- | --- |
| R1 — nenhuma rolagem horizontal do documento a partir de 320 px | `scrollWidth` igual a `clientWidth` em toda rota e toda largura |
| R2 — transbordo confinado a região declarada | os únicos elementos que ultrapassam a largura da janela são `thead`/`tr`/`th` dentro da região rolável de `components/ui/table.tsx`, e o documento não rola junto |
| R3 — alvo de toque | nenhum controle abaixo de 24 px nas duas dimensões; os de 20 px de altura são links de texto e botões de ordenação de coluna, cujos vizinhos ficam a mais de 24 px de distância — a exceção de espaçamento do 2.5.8 |

### Segurança

| Verificação | Resultado |
| --- | --- |
| `pnpm audit` e `pnpm audit --prod` | sem vulnerabilidade conhecida nos dois pacotes |
| Cabeçalhos do `web` | CSP com nonce por resposta e `strict-dynamic`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; `x-powered-by` passou a sair desligado nesta task |
| Cabeçalhos da API | `helmet()` com os defaults, mais `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy` em `same-origin` e `x-powered-by` desligado |
| Rate limiting | observado na resposta: `ratelimit-policy: "120-in-1min"` na API, e o balde de autenticação devolveu `429` ao estourar as 10 tentativas de uma conta sem afetar as demais — a chave é a identidade, não o endereço |

O inventário completo, com os riscos aceitos, está em [`security.md`](security.md).

### Performance

Detalhe em [`performance.md`](performance.md), §Medição em navegador. LCP entre 39 ms e 255 ms nas seis rotas, contra um orçamento de 2,5 s; TTFB entre 7 ms e 36 ms. Tudo em `localhost`, sem latência de rede: é o piso do que o código consegue, não a experiência de campo.

## Exceções

Toda exceção tem dívida aberta em [`TODO.md`](../TODO.md).

| # | Exceção | Por quê | Dívida |
| --- | --- | --- | --- |
| 1 | Nenhum teste de ponta a ponta, e nenhum teste automatizado no `web` | o pacote não tem runner; a FASE 17 não foi executada | TD-058 |
| 2 | Lighthouse não executado, e a varredura de acessibilidade não é repetível por comando | o pacote não está instalado; o arnês da TASK 20.6 foi descartável | TD-054 |
| 3 | Uma violação `serious` de contraste permanece: `--primary-foreground` sobre `--primary`, 3,48:1 contra 4,5:1 | escolher o novo valor do token é decisão de design, não de implementação | TD-053 |
| 4 | CLS e INP sem número | o Firefox não implementa `layout-shift`, e o INP exige interação numa janela ativa, que o arnês headless não tem | TD-054 |
| 5 | Foco vai para o `body` ao fechar o dialog aberto pelo menu da linha e ao excluir o último item de uma lista | desmontagem do elemento que devolveria o foco; nenhum conteúdo fica inacessível | TD-066, TD-052 |
| 6 | Proventos agregados e métricas de risco não existem no produto | as tasks 10.2, 10.3, 11.3 e 11.4 do plano não foram implementadas | TD-062, TD-063 |

Nenhuma exceção bloqueia a candidata: as seis são lacunas de verificação ou de escopo declarado, não defeito conhecido em caminho de uso.
