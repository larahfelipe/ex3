# TODO

Backlog de pendências técnicas e de produto encontradas durante a execução do [`PLAN.md`](PLAN.md). Entra aqui o que não é necessário para concluir a task em que foi encontrado. O que é crítico, bloqueante ou exigido pelos critérios da task corrente é corrigido na própria task.

## Convenções

- **Id** `TD-NNN`, sequencial e nunca reutilizado.
- **Origem:** task ou documento em que o item foi encontrado.
- **Encaminhamento:** task do `PLAN.md` que absorve o item, ou `avulso` quando nenhuma cobre.
- **Prioridade:** `alta` para risco de segurança ou de integridade de dados; `média` para comportamento incorreto ou contrato inconsistente; `baixa` para qualidade, tooling ou documentação.
- Detalhe já documentado em `docs/` é referenciado, não repetido.
- Item resolvido sai de **Abertos** e vai para **Resolvidos**, com a referência de onde foi tratado.

## Abertos

### TD-004 — Enumeração de e-mails no sign-up (risco aceito)

- **Origem:** revisão de segurança posterior à TASK 3.3 · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** avulso (risco reafirmado na TASK 20.4)
- **Contexto:** `POST /v1/user/create` responde `User already exists` para e-mail cadastrado. Mantido como risco aceito em 2026-09-11; detalhes em `docs/authentication.md`, limitação 2.
- **Impacto:** permite descobrir se um e-mail tem conta. Desde a TASK 20.4 o limite de autenticação é por conta, então cada e-mail sondado estreia o próprio balde e quem limita a vazão é o teto da API para tráfego sem sessão.
- **Proposta:** reavaliar quando o produto tiver confirmação de e-mail, que permite responder igual para e-mail novo e existente.

### TD-005 — Senha nova não é comparada a senhas vazadas nem normalizada

- **Origem:** `docs/authentication.md`, limitações 3 e 4 · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** avulso (auditado na TASK 20.4, mantido aberto)
- **Contexto:** o NIST SP 800-63B-4 pede recusar senhas presentes em listas de senhas comprometidas e normalizar Unicode antes do hash. Nenhum dos dois é feito.
- **Impacto:** senhas conhecidas de vazamentos são aceitas, e a mesma senha digitada com outra composição Unicode não confere.
- **Proposta:** tratar os dois juntos. Normalizar muda o valor verificado de contas existentes, então exige migração no login bem-sucedido (verificar com o valor bruto e regravar o hash normalizado). A checagem de vazamento depende de fonte externa, como a API de k-anonymity do Have I Been Pwned, ou de lista local.

### TD-006 — Contadores de rate limit na memória de cada processo

- **Origem:** `docs/authentication.md`, limitação 5 · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** avulso (metade resolvida na TASK 20.4)
- **Contexto:** os contadores do `express-rate-limit` ficam na memória de cada processo (`docs/testing.md`). A chave deixou de ser o endereço do chamador na TASK 20.4 — é a sessão na API e a conta nos endpoints de credencial (`docs/security.md`, §Rate limiting) —, mas o store continua local.
- **Impacto:** com mais de uma instância do backend, cada uma aplica o budget inteiro, e o limite efetivo é o budget vezes o número de instâncias.
- **Proposta:** store compartilhado entre instâncias, com o mesmo chaveamento por identidade.

### TD-007 — `style-src 'unsafe-inline'` na CSP do web

- **Origem:** correções posteriores à TASK 3.3 (CSP com nonce) · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** TASK 12.1
- **Contexto:** o HTML renderizado traz atributos `style`, que nonce não autoriza; detalhes em `docs/authentication.md`, limitação 7.
- **Impacto:** onde houver injeção de marcação, CSS injetado pode alterar a interface, sem executar script.
- **Proposta:** ao consolidar os tokens, trocar atributos `style` por classes, verificar os que chegam no HTML do servidor (inclusive os de dependências de UI) e remover `'unsafe-inline'` de `style-src` quando não restar nenhum.

### TD-008 — `web/src/app/globals.css` fora da formatação do Prettier

- **Origem:** validação das correções posteriores à TASK 3.3 · **Tipo:** tooling · **Prioridade:** baixa · **Encaminhamento:** TASK 12.1
- **Contexto:** `prettier --check src` no web aponta `src/app/globals.css`, mas o script `prettier` do projeto verifica só `src/**/*.{ts,tsx}`, então nem o script nem o CI detectam.
- **Impacto:** divergência de formatação em CSS passa despercebida.
- **Proposta:** formatar o arquivo e incluir `css` no glob do script.

### TD-010 — Catálogo de instrumentos sem cadastro pelo web

- **Origem:** catálogo de instrumentos, `docs/domain-model.md` · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** só admin escreve no catálogo, e só pela API (`POST /v1/instrument`, `PATCH /v1/instrument/:symbol`). A busca por símbolo ou nome em `GET /v1/instruments` e a escolha do instrumento no cadastro de ativo já existem (`docs/domain-model.md`, §Catálogo); o web segue sem tela de administração. A migração criou os instrumentos dos ativos existentes com `name` igual ao símbolo, tipo `OTHER` e sem `market` e `currency`.
- **Impacto:** instrumento fora do catálogo não aparece na escolha do cadastro de ativo, e o usuário depende de um admin chamar a API. Os instrumentos migrados não têm moeda de cotação, que valuation e consolidação por moeda exigem.
- **Proposta:** tela de administração do catálogo no web, com a permissão de admin verificada pela API; completar os instrumentos migrados antes de qualquer cálculo que dependa de `currency`.

### TD-011 — Criação de carteiras sem limite por usuário

- **Origem:** várias carteiras por usuário · **Tipo:** segurança · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `POST /v1/portfolio` exige só autenticação: não há teto de carteiras por usuário nem rate limit na rota. A listagem é paginada com `limit` até 100, então o custo de cada leitura não cresce com o total. A criação de transações tem a mesma ausência de teto, anterior às várias carteiras, e cada escrita de transação relê e percorre todas as transações da posição. O cadastro de instrumento privado (`POST /v1/assets/create` com `instrument`) tem a mesma forma: exige só autenticação, sem teto por usuário nem rate limit dedicado, e cada um grava uma linha em `instruments` com `ownerId` do chamador.
- **Impacto:** um usuário autenticado cria carteiras, transações e agora instrumentos privados sem limite, fazendo as tabelas correspondentes crescerem na vazão que a API aceitar (OWASP API4:2023). O custo de cada escrita de transação cresce linearmente com o razão da posição, sem alcançar posições de outras carteiras. O teto é decisão de produto e não foi fixado por conveniência da implementação.
- **Proposta:** definir com o produto o número máximo de carteiras, transações por posição e instrumentos privados por usuário, recusar a criação acima dele sem gravar e aplicar um rate limit às rotas de escrita, incluindo `assets/create` com `instrument`.

### TD-014 — Nome do usuário sem limite de tamanho

- **Origem:** revisão de segurança do sign-up com moeda base · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `name` é `z.string().optional()` em `CreateUserSchema` e `UpdateUserSchema`, sem `trim` nem máximo; o único teto é o limite do corpo JSON (`RequestLimits.JSON_BODY_SIZE`, 100 kB). O nome da carteira já usa `boundedTextSchema`.
- **Impacto:** cada conta grava um nome de até cerca de 100 kB, devolvido nas respostas que trazem o usuário, inclusive a listagem de admin (OWASP API4:2023). Nome só de espaços é aceito. Conta criada pela API sem nome recebe `name` `null`; o web o tipa assim desde a auditoria de UX/UI de 2026-09-22 e saúda essa conta pelo e-mail. O sign-up e a tela de conta do web limitam o nome a 6–255 caracteres sem espaço nas pontas, mas a API continua aceitando qualquer tamanho de outro cliente.
- **Proposta:** `boundedTextSchema` com máximo nomeado e documentado nos dois schemas. Decidir com o produto se o nome passa a ser obrigatório.

### TD-015 — Tamanho de página padrão repetido em cada repositório

- **Origem:** várias carteiras por usuário · **Tipo:** qualidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o `limit` padrão das listagens anteriores ao padrão de resposta (TD-021) é o literal `10` em `AssetRepository.getAll` e uma constante `DEFAULT_PAGE_LIMIT` local em `PortfolioRepository` e em `InstrumentRepository`. O teto de 100 e o `pageSize` padrão das listagens no padrão ficam em `PaginationQuerySchema`.
- **Impacto:** mudar o tamanho padrão exige tocar quatro arquivos, e o literal escapa de uma busca pela constante.
- **Proposta:** usar o padrão do schema nos três repositórios, junto com a migração de cada listagem em TD-021.

### TD-017 — API recusa desdobramento, transferências, aportes, retiradas e ajustes

- **Origem:** remodelagem da transação · **Tipo:** domínio · **Prioridade:** média · **Encaminhamento:** `avulso`, até a representação de cada tipo estar definida
- **Contexto:** o enum `TransactionType` guarda os 12 tipos de `docs/domain-model.md`, mas `TransactionTypeSchema` aceita só `RecordableTransactionTypes` (`BUY`, `SELL`, `DIVIDEND`, `JCP`, `INTEREST` e `BONUS`), e `rebuildPosition` (`backend/src/domain/PositionLedger.ts`) lança para `SPLIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `DEPOSIT`, `WITHDRAWAL` e `ADJUSTMENT`. O efeito de `DEPOSIT`, `WITHDRAWAL` e `ADJUSTMENT` está nas decisões em aberto do modelo de domínio, e `quantity` e `unitPrice` não descrevem os demais: um `SPLIT` tem fator, não preço, e uma transferência traz o custo de origem.
- **Impacto:** desdobramentos, grupamentos, transferências entre corretoras, aportes, retiradas e ajustes não são registráveis; enviar um deles responde 400 sem gravar.
- **Proposta:** implementar em `rebuildPosition` o efeito de cada tipo definido no modelo de domínio, com a validação de campos própria do tipo e testes, e só então incluí-lo em `RecordableTransactionTypes`; decidir com o produto os tipos em aberto antes de aceitá-los.

### TD-020 — Consumo da cota do provedor de cotação não medido

- **Origem:** integração com a YH Finance API · **Tipo:** integração · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a cota e o preço dos planos da YH Finance API não foram confirmados. O lote de 10 símbolos, o cache de 60 segundos, o timeout de 5 segundos e a pausa de 30 segundos depois de falha são assumidos, não medidos (`backend/src/infra/market-data/YahooFinanceProvider.ts`). Cache e pausa ficam na memória de cada processo, como o rate limit de TD-006. A visão geral da carteira consome a mesma cota com um par de câmbio por moeda estrangeira das posições, e a lista de posições cota, a cada página pedida, todas as posições com unidades, porque a alocação depende do total.
- **Impacto:** acima da cota, o provedor recusa as requisições e as cotações passam à última recebida ou a `unavailable` até a cota renovar. Com mais de uma instância do backend, cada uma consulta o provedor por conta própria e multiplica o consumo.
- **Proposta:** confirmar nos termos do plano contratado a cota, o limite por minuto e o máximo de símbolos por requisição; medir as requisições por carregamento da tela de ativos e ajustar as constantes; cache compartilhado quando houver mais de uma instância.

### TD-021 — Listagens anteriores ao padrão de resposta

- **Origem:** TASK 6.1 · **Tipo:** API · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `GET /v1/portfolios` e `GET /v1/instruments` recebem `limit` e respondem a lista sob o nome da entidade, com `pagination: { page, limit, total, totalPages }`, fora do padrão de listagem paginada de `docs/api-inventory.md` (Padrão de resposta). `GET /v1/assets`, a terceira delas, foi removido com TD-034; o web consome só `GET /v1/portfolios`.
- **Impacto:** o cliente trata dois formatos de paginação, e trocar uma listagem antiga para o padrão quebra a tela que a consome.
- **Proposta:** migrar cada listagem ao padrão junto com a tela que a consome, ou removê-la quando a tela passar ao endpoint que a substitui; tratar TD-015 na mesma mudança.

### TD-022 — Indicadores da carteira sem variação cambial

- **Origem:** TASK 6.2 · **Tipo:** domínio · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `GET /v1/portfolio/overview` e `GET /v1/portfolio/positions` convertem preço, valor de mercado, custo e fechamento anterior pela taxa de câmbio mais recente (`backend/src/domain/PortfolioValuation.ts`). A transação não guarda a taxa da data da operação, e o fechamento anterior do par de câmbio não é usado.
- **Impacto:** com posições em moeda diferente da base, `profitLoss`, da carteira e de cada posição, não inclui o ganho ou a perda cambial desde a compra, e `dayChange` não inclui a variação do câmbio no dia; o `totalValue` de ontem somado ao `dayChange` não reproduz o de hoje quando o câmbio mudou.
- **Proposta:** decidir com o produto se os indicadores refletem o câmbio; se sim, gravar a taxa na transação ou obtê-la do histórico de preços, e usar o fechamento anterior do par na variação do dia.

### TD-023 — `QueryClient` do web compartilhado entre requisições no servidor

- **Origem:** TASK 7.3 · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `web/src/lib/react-query.ts` cria o `QueryClient` no escopo do módulo, e o `AppProvider`, componente cliente, também renderiza no servidor. Os hooks de domínio usam só `useQuery` e `useMutation`, que não buscam na renderização do servidor, e o isolamento entre usuários depende de o cache do navegador ser descartado no sign-in, no sign-up, no sign-out e no recarregamento após 401, porque as query keys não levam o usuário.
- **Impacto:** nenhum hoje. Se uma tela passar a buscar no servidor (`prefetchQuery`, `useSuspenseQuery` ou hidratação), o mesmo cache atende requisições de usuários diferentes, e dado de um usuário pode ser servido a outro.
- **Proposta:** criar um `QueryClient` por requisição no servidor e um único no navegador, como a documentação do TanStack Query orienta para o App Router, antes de a primeira busca no servidor entrar.

### TD-025 — Cores do gráfico de alocação fora dos tokens e repetidas acima de 10 grupos

- **Origem:** TASK 8.4 · **Tipo:** UX · **Prioridade:** baixa · **Encaminhamento:** TASK 12.1
- **Contexto:** `AllocationChart` (`web/src/app/(protected)/(overview)/_components/allocation-chart.tsx`) pinta o anel e a legenda com uma paleta local de 10 classes do Tailwind, a primeira `primary`, atribuída pela posição do grupo na lista. O tema não tem tokens de gráfico, e a alocação por ativo lista todas as posições com unidades, sem agrupar as menores.
- **Impacto:** a partir do 11º grupo as cores se repetem, e dois ativos de mesma cor no anel só se distinguem pela ordem; a legenda em tabela continua exata.
- **Proposta:** criar tokens de gráfico na consolidação de tokens e decidir com o produto se a alocação por ativo agrupa as menores posições num grupo "Other", calculado no domínio para o web não somar alocações.

### TD-026 — Cotações gravadas sem política de retenção

- **Origem:** TASK 5.2 · **Tipo:** dados · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `market_quotes` guarda um fechamento por instrumento, dia de negociação e fonte (`backend/src/infra/database/MarketQuoteRepository.ts`), preenchido por backfill sob demanda. Nada apaga linha antiga, e o catálogo de instrumentos não tem teto.
- **Impacto:** medido em 2026-09-16 com 100 mil linhas, a tabela custa 309 bytes por linha — 13 MB de heap e 17 MB de índices —, ou 76 kB por instrumento por ano de pregões, cerca de 740 MB para mil instrumentos em dez anos. A série é compartilhada entre usuários, então não cresce com a base: cresce com os instrumentos acompanhados e os períodos consultados. Não pesa na escala atual.
- **Proposta:** decidir com o produto o alcance máximo do histórico exibido e, a partir dele, se as linhas mais antigas são descartadas ou agregadas em fechamentos mensais. Revisto em 2026-09-16 à luz da medição, o desenho foi mantido sem retenção, e a política fica para quando o volume justificar.

### TD-027 — Fechamento corrigido pelo provedor não substitui o gravado

- **Origem:** TASK 5.2 · **Tipo:** dados · **Prioridade:** baixa · **Encaminhamento:** TASK 5.4
- **Contexto:** `recordDailyCloses` grava com `skipDuplicates`, então o dia já gravado por uma fonte mantém o preço primeiro observado (`backend/src/infra/database/MarketQuoteRepository.ts`). O provedor pode revisar um fechamento depois de publicá-lo.
- **Impacto:** série já coberta nunca incorpora correção do provedor, e as métricas de performance seguem o valor da primeira observação. Não há caminho para reprocessar um intervalo.
- **Proposta:** na task que orquestra o backfill, decidir se um intervalo pode ser reprocessado explicitamente, substituindo os fechamentos daquele intervalo, e sob qual gatilho.

### TD-028 — Série de preços não distingue a fonte

- **Origem:** TASK 5.4 · **Tipo:** dados · **Prioridade:** baixa · **Encaminhamento:** backlog
- **Contexto:** `MarketQuoteRepository.getDailyCloses` devolve os fechamentos de todas as fontes no intervalo, e `GetPriceHistoryService` repassa a série como veio; `ExchangeRateRepository.getDailyRates` faz o mesmo com o câmbio. O service não sabe qual provedor está em uso — `source` chega dentro de cada preço que a porta devolve —, e filtrar por fonte nessa camada vazaria a identidade do provedor para o domínio. Hoje só `yahoo-finance` grava.
- **Impacto:** com uma segunda fonte gravando, cada dia aparece duas vezes na série. A série de performance indexa os fechamentos por dia e fica com o último que a consulta devolveu para aquele dia, sem critério declarado entre as fontes.
- **Proposta:** decidir a precedência entre fontes — uma preferida, ou a mais recente por dia — e aplicá-la na consulta das duas tabelas, mantendo `source` em cada ponto do resultado.

### TD-030 — Retorno do benchmark na moeda dele, sem conversão para a base

- **Origem:** TASK 6.5 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** backlog
- **Contexto:** `GET /v1/portfolio/performance` normaliza a série da carteira por retorno ponderado no tempo na `baseCurrency`, e a do `benchmark` pelo primeiro fechamento da janela, na moeda em que ele é cotado. A carteira já incorpora a variação do câmbio de cada dia; o benchmark, não.
- **Impacto:** benchmark cotado em moeda diferente da base — `IVV` em USD numa carteira em BRL — compara retorno em USD com retorno em BRL, e a distância entre as duas linhas inclui a variação cambial do período, que não é desempenho de nenhum dos dois. Benchmark na moeda base não é afetado.
- **Proposta:** o gráfico de performance do web não pede `benchmark`, então nenhuma tela compara as duas linhas hoje e a distorção não tem superfície. Quando a comparação for oferecida, decidir com o produto se o benchmark é convertido para a moeda base dia a dia, pela série de câmbio que o endpoint já busca, ou se fica restrita a benchmark cotado na moeda base.

### TD-031 — Série de performance reconstrói o razão inteiro a cada dia da janela

- **Origem:** TASK 6.5 · **Tipo:** desempenho · **Prioridade:** baixa · **Encaminhamento:** backlog
- **Contexto:** `trackPortfolioPerformance` reconstrói cada posição a partir do razão em cada dia da janela, para que a série siga as mesmas regras de `rebuildPosition` e transação retroativa mova a série inteira. O custo é dias × posições × tamanho do razão, em memória, sem consulta por dia.
- **Impacto:** nenhum nas carteiras de hoje. Razão longo com janela `MAX` cresce quadraticamente no tamanho do razão, dentro de uma requisição síncrona.
- **Proposta:** medir antes de mudar. Se aparecer, percorrer o razão uma vez por posição, avançando a reconstrução de um dia para o seguinte em vez de refazê-la, sem alterar as regras do replay.

### TD-032 — Gráfico de performance sem janela do dia corrente

- **Origem:** TASK 8.3 · **Tipo:** produto · **Prioridade:** baixa · **Encaminhamento:** backlog
- **Contexto:** a série de `GET /v1/portfolio/performance` é feita de fechamentos diários gravados em `market_quotes`, uma linha por instrumento, dia e fonte. A cotação corrente é buscada no provedor a cada requisição e não vira série, então a menor janela do seletor é `1W`.
- **Impacto:** o gráfico não oferece uma janela do dia corrente. O movimento do dia continua disponível como número, em `dayChange` de `GET /v1/portfolio/overview`, sem curva.
- **Proposta:** decidir com o produto se a janela do dia justifica gravar cotações intradiárias em série, com a coleta periódica e a granularidade que isso exige, em vez de derivá-la das cotações avulsas que cada requisição busca.

### TD-033 — Suíte de integração falha de forma intermitente

- **Origem:** TASK 8.3 · **Tipo:** teste · **Prioridade:** média · **Encaminhamento:** backlog
- **Contexto:** numa execução, dois testes de `Transactions.integration.ts` falharam — o sign-in do harness respondeu `404` e uma contagem de posição veio `0` em vez de `1` —, e a execução seguinte passou 231 de 231 sem nenhuma mudança no código. Noutra, o teste de valores pequenos sem expoente do mesmo arquivo recebeu a transação sem os campos; o arquivo sozinho passou 51 de 51, e a suíte inteira, 234 de 234, na execução seguinte. A suíte roda um arquivo por vez (`--test-concurrency=1`), então a causa não é concorrência entre arquivos; as três falhas são de dado que o teste acabou de gravar e não encontrou, e o harness esvazia todas as tabelas no reset.
- **Impacto:** vermelho sem regressão, que só se distingue de defeito real reexecutando a suíte. Na CI, vira falha aleatória num merge legítimo.
- **Proposta:** reproduzir a falha repetindo a suíte e registrando o status e o corpo da resposta no teste que falha, para saber se o dado some depois de gravado — reset ou escrita pendente de um teste anterior — ou nunca é gravado; corrigir a causa encontrada, sem novas tentativas automáticas que a escondam.

### TD-035 — Detalhe do ativo sem proventos

- **Origem:** TASK 9.2 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** TASK 10.3
- **Contexto:** o detalhe do ativo, em `/assets/[symbol]`, tem visão geral, posição, performance e transações. A seção de proventos ficou fora por decisão de produto até existir o modelo de proventos. O modelo existe, com `DIVIDEND`, `JCP` e `INTEREST` registráveis como transação, mas nenhum endpoint consolida os proventos de um ativo.
- **Impacto:** o usuário não vê no ativo os proventos recebidos nem o rendimento deles sobre o custo.
- **Proposta:** acrescentar a seção de proventos ao detalhe do ativo quando o modelo e a API de proventos existirem, com o recorte por ativo que a API oferecer.

### TD-039 — Configuração de containers sem validação num runtime

- **Origem:** configuração Docker Compose · **Tipo:** tooling · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a máquina em que `compose.yaml`, os Dockerfiles e os `.dockerignore` foram escritos não tem runtime de containers. A validação cobriu os gates do backend, o parse do `compose.yaml` com checagem de dependências, perfis, volumes, portas e estágios, a instalação `--prod` numa cópia dos manifests dos dois pacotes, a resolução de todo import externo do `dist/` contra ela e o local do store do pnpm 11. Nenhuma imagem foi construída e nenhum serviço subiu.
- **Impacto:** um erro de build ou de runtime aparece só no primeiro `docker compose up` ou no próximo build do Cloud Build, que publica as imagens do `runner`.
- **Proposta:** num ambiente com Docker, antes da próxima publicação: `docker compose config`; `docker compose up --build` com volumes vazios; cadastro e login no web; `down` e `up` preservando os dados; `run --rm backend-check` e `web-check`; `docker build` dos dois `runner` (web com `--build-arg API_URL`), conferindo usuário `node`, tamanho com `docker image ls` e `docker stop` abaixo de 10 s; um segundo `up` sem rebuild nem download.

### TD-041 — Backend encerra sem drenar requisições

- **Origem:** configuração Docker Compose · **Tipo:** qualidade · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `Server.ts` não trata `SIGTERM`. Com `tini` como PID 1 na imagem, o sinal chega ao Node, que termina na hora: não há `server.close()` nem `$disconnect` do Prisma.
- **Impacto:** num deploy ou numa redução de instâncias, requisições em andamento são cortadas e podem falhar para o cliente.
- **Proposta:** tratar `SIGTERM` parando de aceitar conexões, esperando as abertas por um prazo menor que o do orquestrador e fechando o pool antes de sair.

### TD-042 — Ambiente novo sem catálogo nem forma de criar o primeiro administrador

- **Origem:** configuração Docker Compose · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** o serviço `migrate` do `compose.yaml` roda `prisma db seed`, que grava de forma idempotente um catálogo de exemplo no banco de desenvolvimento (`docs/containers.md`, §Primeiro uso). Só administrador cadastra instrumento, e nenhum endpoint ou script promove um usuário: o caminho segue sendo SQL manual.
- **Impacto:** fora do catálogo de exemplo, e em qualquer banco sem o seed, cadastrar instrumento exige acessar o banco para promover o primeiro administrador.
- **Proposta:** comando administrativo que promova o primeiro usuário, sem rota HTTP, chamado a partir do `compose.yaml` em desenvolvimento.

### TD-043 — Imagem do web leva o `node_modules` de produção inteiro

- **Origem:** configuração Docker Compose · **Tipo:** desempenho · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o `runner` do web copia todas as dependências de produção e roda `next start`. O `output: 'standalone'` do Next copia só os arquivos rastreados pelo build e dispensa o resto, mas muda o comando de start e o que o script `start` do pacote executa.
- **Impacto:** imagem maior, com push, pull e cold start mais lentos no Cloud Run.
- **Proposta:** adotar `output: 'standalone'` junto com a validação do TD-039, conferindo o `distDir: 'build'`.

### TD-044 — `backend/.env.test` sem `PORT`, `DIRECT_URL` e `YAHOO_FINANCE_API_KEY`

- **Origem:** primeira execução de `--profile check` com runtime de containers · **Tipo:** teste · **Prioridade:** alta · **Encaminhamento:** TD-039
- **Contexto:** `pnpm test:unit` e `pnpm test:integration` carregam `--env-file=.env.test`, e o arquivo versionado só traz `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRATION`, `BCRYPT_SALT` e `CORS_ALLOWED_ORIGINS`. `backend-check` não define `environment`, então nada supre o resto.
- **Impacto:** `backend-check` falha com `PORT: Too small: expected number to be >0` em `Envs.test.ts`, e caem também `Jwt.test.ts`, `AuthMiddleware.test.ts` e `YahooFinanceProvider.test.ts` — quatro arquivos. A suíte só passa em máquina que já tenha essas variáveis exportadas no shell, o que mascarava a lacuna antes do Compose.
- **Proposta:** completar `.env.test` com as chaves que o `EnvsSchema` exige, e cobrir o caso com o próprio `Envs.test.ts`, que hoje depende do ambiente para o cenário "starts up with a valid environment".

### TD-045 — Toda navegação RSC paga um 307 extra por causa da reescrita de headers no proxy

- **Origem:** investigação do redirecionamento pós-login · **Tipo:** desempenho · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `proxy.ts` devolve `NextResponse.next({ request: { headers } })` para injetar a CSP com nonce no request. Toda requisição com o header `RSC: 1` e sem o parâmetro `_rsc` esperado responde 307 para a mesma rota com `?_rsc=<hash>`; o cliente segue e recebe 200. Medido no container para `/` autenticado e `/sign-in` anônimo, sem relação com os ramos de autenticação.
- **Impacto:** cada `router.push` e cada prefetch custa uma viagem a mais ao servidor. Não quebra navegação, porque o browser segue o redirect.
- **Proposta:** avaliar passar o nonce por um header próprio já presente na resposta, ou restringir a reescrita de request às navegações de documento, medindo antes o ganho real.

### TD-047 — `POST /v1/user/create` envelopa o usuário e `POST /v1/user` devolve flat

- **Origem:** causa raiz do redirecionamento pós-cadastro · **Tipo:** API · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** `CreateUserService.Result` é `{ user, message }`, enquanto `GetUserService.Result` é o usuário com `accessToken` no topo. O route handler do web tratava as duas como flat, e por isso o cadastro não gravava cookie de sessão nem lia o nome; corrigido do lado do web, o backend segue inconsistente.
- **Impacto:** dois formatos de sucesso para o mesmo recurso, e qualquer novo consumidor repete o erro.
- **Proposta:** decidir um envelope de sucesso único junto da convenção já documentada para erro e para listagem paginada, e registrar em `docs/api-inventory.md`.

### TD-048 — Paleta clara dos tokens semânticos sem cobertura em runtime

- **Origem:** TASK 12.1 · **Tipo:** qualidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `globals.css` define os dois temas, mas `<html>` fixa `className="dark"` e nada alterna. Desde a correção do TD-053, todo par de `:root` passa no contraste exigido por cálculo (ver `docs/accessibility.md`, §Contraste medido), mas nenhum ainda foi visto renderizado: a captura visual desta task (BiDi + axe) forçou a paleta clara removendo a classe `dark` do `<html>` no navegador, o que não é o mesmo caminho que um seletor de tema real exercitaria.
- **Impacto:** se o seletor de tema entrar depois, a paleta clara chega com o contraste já verificado por computação, mas ainda sem auditoria visual pelo caminho real (toggle, persistência, `color-scheme` refletido pelos controles nativos).
- **Proposta:** validar junto da TASK 14.7, ou remover o bloco `:root` se o produto assumir tema escuro único — decisão ligada ao TD-046.

### TD-049 — Arquitetura de navegação sem as seções de produto previstas

- **Origem:** TASK 13.1 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** avulso
- **Contexto:** a navegação desenhada prevê Portfolio, Income, Analytics, Performance, Allocation, Risk, Market, Watchlist e Settings, mas o app só expõe `/`, `/assets`, `/assets/[symbol]`, `/portfolios` e `/account`. O redesenho do menu lateral já agrupa as rotas existentes sob "Portfolio" e "Account", com hierarquia visual, ícone semântico, `aria-current` e recolhimento em `PORTFOLIO_SECTIONS`/`ACCOUNT_SECTION` (`sidebar.tsx`) — a estrutura de grupos que o item pedia está pronta. Income e as métricas de risco dependem de tasks ainda não implementadas, e Market, Watchlist e Settings não têm rota nem endpoint em lugar nenhum.
- **Impacto:** publicar os itens agora criaria links mortos e quebraria o critério de rotas acessíveis; manter a lista curta adia só a hierarquia de dois níveis entre grupos, não a existência dos grupos.
- **Proposta:** promover cada novo grupo conforme a rota nascer, adicionando a `PORTFOLIO_SECTIONS`/`ACCOUNT_SECTION` ou a um novo grupo irmão em `sidebar.tsx`, que já é a única fonte da estrutura.

### TD-054 — Lighthouse e acessibilidade não têm execução repetível

- **Origem:** TASK 14.7 · **Tipo:** acessibilidade · **Prioridade:** média · **Encaminhamento:** avulso (reduzido na TASK 20.6)
- **Contexto:** a varredura com axe foi executada na TASK 20.6 — seis páginas, dois viewports, dialog e busca sem resultado, com dados semeados — e o resultado está em `docs/accessibility.md`, §Auditoria automatizada. Ela rodou num arnês descartável, WebDriver BiDi direto sobre o `WebSocket` do Node, que não sobreviveu à task nem cobre o que depende de eventos de foco. Continuam sem execução o Lighthouse, cujo pacote não está instalado, e qualquer verificação de teclado que exija focus trap ou `:focus-visible` renderizado.
- **Impacto:** o critério "accessibility ≥ 95" da TASK 14.7 segue não verificado, e nada impede que uma regressão de acessibilidade entre sem ser notada — a varredura não roda em CI nem localmente por comando.
- **Proposta:** com o runner que TD-058 pede, fixar `@axe-core/playwright` e `lighthouse` por versão no `web` e transformar o procedimento documentado num comando; um navegador com janela ativa também fecha os limites do arnês registrados na mesma seção.

### TD-055 — Toda tela protegida espera a listagem de carteiras para começar

- **Origem:** TASK 16.1 · **Tipo:** performance · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** o cliente não conhece o id da carteira — não está na URL nem no cookie de sessão —, então `useActivePortfolio` busca `GET /v1/portfolio` da carteira escolhida no navegador, ou, sem escolha, `GET /v1/portfolios?page=1&limit=1`, e só depois as demais queries saem do `skipToken`. É um nível de waterfall em toda primeira tela da sessão, detalhado em `docs/data-fetching.md`, §Waterfall.
- **Impacto:** um round trip antes do primeiro dado da tela; as navegações seguintes são servidas do cache enquanto o `staleTime` de 60 s valer.
- **Proposta:** entregar a carteira mais antiga junto da sessão — em `GET /v1/user` ou no payload de sign-in — e semear o cache com ela, deixando a busca apenas para quem escolheu outra carteira.

### TD-056 — Arte do sign-in pesa mais que todo o JavaScript da aplicação

- **Origem:** TASK 16.5 · **Tipo:** performance · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `web/public/login-hero.jpeg` tem 1,93 MB, contra 1,46 MB de todos os chunks do cliente somados. A TASK 20.5 resolveu a metade do desperdício: a arte virou `background-image` da coluna, que é `max-lg:hidden`, e o browser não busca o fundo de um elemento que não gera caixa — abaixo de `lg` não há mais requisição. O arquivo em si continua como está.
- **Impacto:** em telas `≥ lg`, quase dois megabytes de decoração num sign-in que de resto tem um formulário. Não bloqueia o campo, mas ocupa a banda que o primeiro dado da sessão vai querer.
- **Proposta:** reencodar em WebP na largura que a coluna usa, o que deve render cerca de um décimo do tamanho. Exige codificador — `sharp`, `cwebp`, `magick` e PIL não existem no ambiente onde a task rodou.

### TD-058 — FASE 17 inteira sem execução: o web não tem runner de teste

- **Origem:** FASE 17 · **Tipo:** teste · **Prioridade:** média · **Encaminhamento:** TASK 20.7
- **Contexto:** os gates do `web` são `lint`, `typecheck` e `build`; não há runner de teste nem navegador no repositório. As cinco tasks da fase — fluxo principal, múltiplas carteiras, consistência de transações, responsive e acessibilidade — exigem um, e a fase foi adiada por decisão de produto para seguir com observabilidade.
- **Impacto:** nenhum fluxo de ponta a ponta é verificado automaticamente, e a integração entre o web e a API só é exercitada à mão. Soma-se a TD-054, que registra a auditoria automatizada de acessibilidade nunca executada.
- **Proposta:** instalar o Playwright no `web`, escrever os specs das cinco tasks e executá-los contra o `compose.yaml`, que já sobe postgres, backend e web. O checklist da TASK 20.7 exige `e2e`, `accessibility` e `responsive`, então a dívida vence lá.

### TD-060 — Nenhuma sonda de saúde na configuração de produção

- **Origem:** TASK 18.3 · **Tipo:** infraestrutura · **Prioridade:** média · **Encaminhamento:** TASK 20.7
- **Contexto:** o `cloudbuild.yaml` constrói e publica as imagens do backend e do web, sem passo de deploy; a configuração do serviço no Cloud Run, onde o startup probe e o liveness probe são declarados, vive fora do repositório. No desenvolvimento, o `compose.yaml` já sonda `/ready` (TD-040).
- **Impacto:** em produção, uma instância que sobe sem alcançar o banco recebe tráfego assim mesmo, e um processo travado não é distinguido de um saudável. A distinção entre processo vivo e dependência disponível existe no código e não chega ao ambiente onde importa.
- **Proposta:** declarar no serviço do Cloud Run o startup probe em `/ready` e o liveness probe em `/health`, e registrar essa configuração no repositório junto do `cloudbuild.yaml`, para que o deploy deixe de ser um estado só do console.


### TD-061 — Rotas registram handler com `as Application`

- **Origem:** TASK 19.2 · **Tipo:** tipagem · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** os `handle` dos controllers devolvem `Promise<Response>`, e o `RequestHandler` do Express 5 espera `void`. As rotas contornam a incompatibilidade com `as Application` em 26 pontos, um cast entre tipos sem relação. `HealthRoutes.ts` não precisa dele: os seus handlers respondem e retornam `void`.
- **Impacto:** o cast desliga a checagem da assinatura no único ponto onde ela valeria, e um handler com a forma errada passaria despercebido. Uma resposta devolvida em vez de enviada também não é erro para o compilador.
- **Proposta:** fazer os `handle` responderem e retornarem `void`, ajustar a interface `Controller` e remover os 26 casts.

### TD-062 — Nenhuma agregação de proventos

- **Origem:** TASK 19.3 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** TASK 20.7
- **Contexto:** `DIVIDEND`, `JCP` e `INTEREST` são gravados e entram no `netContribution` da performance, mas nenhuma rota soma a renda do mês, do ano ou de sempre, nem calcula `yield` e `yield on cost`. As TASKS 10.2 e 10.3 do plano, que definiriam essa API e a sua tela, não foram executadas.
- **Impacto:** quem registra provento não consegue ler quanto a carteira rendeu em renda, e a única visão é a listagem de transações, uma a uma.
- **Proposta:** somar por período a partir do razão, na moeda base, e expor os totais e os dois rendimentos, com as regras de ausência já usadas na visão geral. A definição de cada número entra em `docs/financial-rules.md` antes da implementação.

### TD-063 — Drawdown e métricas de risco não calculados

- **Origem:** TASK 19.3 · **Tipo:** produto · **Prioridade:** média · **Encaminhamento:** TASK 20.7
- **Contexto:** `maxDrawdown`, `currentDrawdown`, `recovery`, volatilidade, Sharpe, beta e correlação não existem no domínio nem em rota alguma; as TASKS 11.3 e 11.4 do plano não foram executadas. A série de `GET /v1/portfolio/performance` já é o insumo que eles exigiriam.
- **Impacto:** a carteira é descrita por retorno, sem nenhuma medida de risco, e a comparação com o benchmark fica restrita a retorno acumulado.
- **Proposta:** derivar as métricas da série existente, com o período explícito na resposta, estado controlado quando os pontos forem insuficientes e sem exibir precisão que a série não sustenta, conforme os critérios da TASK 11.4.

### TD-065 — Tráfego não autenticado contra o web não tem limite

- **Origem:** TASK 20.4 · **Tipo:** segurança · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** os dois limitadores vivem no backend. O servidor do Next atende página, proxy e redirecionamento de sessão sem budget próprio; o que chega à API é limitado, o que morre no proxy não.
- **Impacto:** uma inundação de requisições sem sessão consome CPU e conexões do web sem esbarrar em limite nenhum, e o custo do Cloud Run acompanha.
- **Proposta:** decidir entre limite na plataforma (Cloud Armor à frente do serviço) e um budget por endereço no próprio `proxy.ts`, lembrando que o contador seria por instância.

### TD-067 — Mesmo ticker em mercados diferentes não pode coexistir

- **Origem:** cadastro de instrumento privado · **Tipo:** produto · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** a identidade de um instrumento é `(ownerId, symbol)` (ver `docs/domain-model.md`, §Catálogo de instrumentos), sem o mercado. A opção escolhida para a task previa `(símbolo, mercado)` por escopo, o que permitiria o mesmo ticker em `NYSE` e `NASDAQ`, por exemplo, mas as rotas de ativo, posição e transação endereçam o instrumento só pelo símbolo, dentro da carteira do usuário — mudar isso é reescrever o endereçamento, não o cadastro.
- **Impacto:** um usuário não consegue ter dois instrumentos do mesmo ticker em mercados diferentes, nem no catálogo nem entre os privados; o cadastro do segundo recebe 409 sobre o primeiro.
- **Proposta:** se o produto precisar do caso, endereçar ativo, posição e transação por instrumento (`instrumentId`) em vez de símbolo, como a série de cotações e o histórico de preço já fazem internamente desde este cadastro (ver `docs/domain-model.md`, §Cotações gravadas), e mover a identidade para `(ownerId, symbol, market)`.

### TD-068 — Sem edição de instrumento privado pelo web

- **Origem:** cadastro de instrumento privado · **Tipo:** produto · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `PATCH /v1/instrument/:symbol` já aceita o dono de um instrumento privado corrigi-lo (ver `docs/api-inventory.md`), mas o web não expõe essa rota: `web/src/app/api/v1/instruments/` só faz proxy de `GET /v1/instruments` e `GET /v1/instruments/options`.
- **Impacto:** quem cadastra um instrumento privado com um campo errado — nome, setor, classe — não tem como corrigi-lo sem excluir o ativo e cadastrar de novo, o que também perde a série de cotações acumulada.
- **Proposta:** adicionar a rota de proxy e uma UI de edição no detalhe do ativo, visível só quando `scope === 'PRIVATE'` e o instrumento é do usuário.

### TD-069 — Instrumento privado com o mesmo símbolo de um catálogo cadastrado depois fica invisível ao próprio admin

- **Origem:** cadastro de instrumento privado · **Tipo:** produto · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `getVisibleBySymbol` resolve o privado do usuário antes do catálogo (ver `docs/domain-model.md`, §Catálogo de instrumentos, Instrumento privado e catálogo). Um admin que primeiro cadastra um instrumento privado próprio e depois o mesmo símbolo no catálogo continua vendo e operando o privado em toda rota por símbolo; o catálogo que ele mesmo cadastrou fica inacessível para a própria conta.
- **Impacto:** confunde só o admin que cadastrou os dois, sem afetar os demais usuários, que só veem o catálogo. Nenhum dado é perdido — os dois instrumentos continuam distintos no banco.
- **Proposta:** ao abrir `PATCH /v1/instrument/:symbol` como admin, avisar quando o símbolo resolvido é o privado do próprio chamador e não o catálogo que a escrita administrativa presume estar editando.

### TD-070 — `Toaster` fixo em `theme="dark"`

- **Origem:** redesenho de tema · **Tipo:** qualidade · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `app-provider.tsx` passa `theme="dark"` ao `Toaster` do `sonner`, independente da paleta ativa em `<html>`. Enquanto só a paleta escura tem consumidor (TD-048), o toast sempre combina com a página.
- **Impacto:** nenhum hoje; se um seletor de tema entrar, o toast destoaria da paleta clara.
- **Proposta:** ler o mesmo estado que decide a classe de `<html>` e passar `theme="light" | "dark"` ao `Toaster`, resolvido junto do TD-048.

### TD-072 — Tabela de posições nomeia as colunas com termos diferentes do resto do web

- **Origem:** auditoria de UX/UI e acessibilidade (2026-09-22) · **Tipo:** UX · **Prioridade:** baixa · **Encaminhamento:** avulso
- **Contexto:** `web/src/app/(protected)/assets/_components/positions-table.tsx` chama as colunas de "Average price", "Price", "Value", "P&L" e "P&L %"; a Overview, o cartão de valor e o detalhe do ativo usam "Average cost", "Market price", "Market value" e "Profit/Loss" para os mesmos campos da API.
- **Impacto:** o mesmo número aparece com dois nomes conforme a tela, e "P&L" só é lido como a sigla.
- **Proposta:** adotar os termos longos nos cabeçalhos ordenáveis depois de medir a tabela entre 640 e 1280 px, onde cada termo alarga uma coluna `whitespace-nowrap` e pode tornar rolável uma região que hoje cabe; a verificação visual ficou fora do alcance desta auditoria, que não teve navegador.

## Resolvidos

### TD-024 — Seções da Overview sem sinal de dado desatualizado

- **Tipo:** UX · **Prioridade:** baixa
- **Resolução:** `QuerySection` mostra `StaleState` com nova tentativa acima do conteúdo quando a nova busca falha com dado em cache (`isRefetchError`), em toda seção da Overview e do detalhe do ativo; o aviso próprio do `PortfolioValueCard` saiu. A tabela de posições, que não usa `QuerySection`, tem o mesmo aviso acima da tabela. A mensagem é `STALE_DATA_MESSAGE`, em `data-state.tsx`.

### TD-050 — Período do gráfico e página das transações continuam fora da URL

- **Tipo:** UX · **Prioridade:** baixa
- **Resolução:** `usePageParam` (`web/src/hooks/use-page-param.ts`) guarda a página em `transactionsPage` no detalhe do ativo, em `positionsPage` na Overview e em `page` nas carteiras, e `PerformanceChart` guarda o período em `range`, fora da URL quando é o padrão `1Y`. `/` e o detalhe do ativo não precisaram de `Suspense`: toda rota já renderiza por requisição.

### TD-037 — Tela de ativos aceita `action` desconhecido na URL

- **Tipo:** UX · **Prioridade:** baixa
- **Resolução:** `action` fora de `ASSET_DIALOG_ACTIONS` já era ignorado; `add-transaction` e `delete-asset` sem `symbol` também passaram a ser. Os parâmetros de diálogo são escritos com `replaceUrlQuery` (`history.replaceState`): fechar não cria entrada no histórico, e Voltar sai da tela em vez de reabrir o diálogo. A History API nativa é sincronizada com `useSearchParams` pelo App Router desde o Next 14.1, então a troca pelo router deixou de ser necessária.

### TD-064 — Diálogo de confirmação de exclusão montado duas vezes

- **Tipo:** UX · **Prioridade:** baixa
- **Resolução:** `components/confirm-deletion-dialog.tsx` (`ConfirmDeletionDialog`) é o diálogo das exclusões de ativo, carteira e transação, que concordaram sobre erro embutido: aberto até a exclusão terminar, confirmar `aria-disabled` enquanto ela corre e recusa num alerta no próprio diálogo. `delete-asset-dialog.tsx`, `delete-portfolio-dialog.tsx` e `delete-transaction-dialog.tsx` saíram, junto com o toast de erro de `useDeleteAsset` e `withSettledRejection`, que só servia ao diálogo de ativo.

### TD-038 — Verde de compra e de ganho abaixo do contraste AA

- **Tipo:** acessibilidade · **Prioridade:** média
- **Resolução:** `TRANSACTION_TYPE_TONES` e `signedValueTone` já usam o token `text-positive`, de 5.58:1 na paleta clara e 9.96:1 na escura (`docs/accessibility.md`, §Contraste medido); não resta `text-green-*` em `web/src`.

### TD-071 — `TransactionFormDialog` e `PortfolioFormDialog` não usam `FormField`/`ChoiceField`

- **Tipo:** qualidade · **Prioridade:** baixa
- **Resolução:** `transaction-form-dialog.tsx` e `portfolio-form-dialog.tsx` já usavam `FormField`/`ChoiceField`; a auditoria de UX/UI de 2026-09-22 levou o mesmo contrato ao sign-in, ao sign-up e à tela de conta, e o mapeamento do erro da API, copiado nos três diálogos, virou `presentSubmitError` em `lib/submit-error.ts`.

### TD-066 — Dialog aberto pelo menu da linha devolve o foco ao `body`

- **Tipo:** acessibilidade · **Prioridade:** baixa
- **Resolução:** `useFocusReturn` registra como origem o gatilho do menu quando o elemento ativo na abertura é um item de `role="menu"`, lendo o `aria-labelledby` que o Radix põe no conteúdo do menu com o id do gatilho. Sem depender de ordem de eventos de foco: o registro é feito no mesmo instante de antes, só com o destino certo. Ver `docs/accessibility.md`, §Auditoria de UX/UI e acessibilidade (2026-09-22).

### TD-052 — Excluir o último item de uma lista deixa o foco no `body`

- **Tipo:** acessibilidade · **Prioridade:** baixa
- **Resolução:** `QuerySection` devolve o foco ao próprio `<h2>`, agora com `tabIndex={-1}` em `SectionHeader`, quando o conteúdo exibido troca — outra página de dados ou o estado vazio — enquanto o foco estava na seção e caiu no `body`. "Na seção" inclui os diálogos que ela renderiza, porque o evento de foco sobe pela árvore do React através do portal. Cobre a última transação excluída da Overview e do detalhe do ativo e a página que esvazia no detalhe; a exclusão da última posição já levava o foco a "Add asset" e a da carteira, a "New portfolio". Ver `docs/accessibility.md`, §Auditoria de UX/UI e acessibilidade (2026-09-22).

### TD-053 — Seis pares de token reprovam no contraste exigido

- **Tipo:** acessibilidade · **Prioridade:** alta
- **Resolução:** ajuste só de token em `globals.css`, nas duas paletas: `--primary-foreground`, `--destructive`, `--destructive-foreground` e `--input` no escuro; `--muted-foreground`, `--warning`, `--input` e `--destructive` no claro. Os 62 pares medidos passam agora nas duas paletas; nenhuma classe de uso mudou. `--border` continua abaixo de 3:1 por decisão — é só separador decorativo, e todo controle interativo usa `--input`, que passa. Ver `docs/accessibility.md`, §Contraste medido.

### TD-013 — Web opera só a carteira mais antiga

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** a tela `/portfolios` escolhe a carteira ativa, guardada no `localStorage` do navegador e lida por `useActivePortfolio`, que escopa a Overview, a tela de ativos e o detalhe do ativo e cai para a mais antiga quando não há escolha ou a escolhida deixou de existir. O placeholder de página anterior de `usePortfolioScopedQuery` vale só dentro da mesma carteira. Ver `docs/domain-model.md`, §Carteira, e `docs/data-fetching.md`.

### TD-012 — Carteira não pode ser renomeada nem excluída

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** `PATCH /v1/portfolio` edita `name` e `baseCurrency`, e `DELETE /v1/portfolio` exclui a carteira com ativos e transações, ambos em `runSerializable` e resolvidos pela carteira do usuário autenticado. As duas decisões pendentes foram fixadas: a moeda base só muda sem transações, e a última carteira da conta não é excluída, as duas com 422. O web cria, edita e exclui pela tela `/portfolios`. Ver `docs/domain-model.md`, §Carteira, e `docs/api-inventory.md`.

### TD-059 — A suíte herda do `.env` do desenvolvedor tudo o que falta no `.env.test`

- **Tipo:** teste · **Prioridade:** alta
- **Resolução:** `src/config/Envs.ts` e `prisma.config.ts` só chamam `dotenv` fora de `NODE_ENV=test`, então a suíte enxerga exatamente o que `--env-file=.env.test` declara. As 230 asserções passam sem nenhuma variável herdada, o que também prova que o `.env.test` versionado basta: nada do ambiente do desenvolvedor alcança o banco, o provedor de cotação ou o segredo do token durante um teste.


### TD-057 — `next-pwa` parado em 2022 sobre o Next 16

- **Tipo:** qualidade · **Prioridade:** baixa
- **Resolução:** o produto decidiu não precisar de instalação nem de precache, e o PWA saiu por inteiro na TASK 20.3: `next-pwa`, `public/manifest.json`, o `<link rel="manifest">` do layout, o `withPWA` do `next.config.js` e as linhas de `.gitignore` do worker gerado. `dev` e `build` perderam o `--webpack` e rodam sob Turbopack, com o build verificado. Some junto a cadeia de 2022 que o plugin arrastava: os 46 avisos do `pnpm audit` do `web` vinham dela, e o pacote passou a auditar limpo sem um `overrides` sequer.

### TD-036 — Proxy do web responde a erro que não vem da API sem envelope

- **Tipo:** API · **Prioridade:** baixa
- **Resolução:** `forwardToApi`, em `web/src/lib/api-proxy.ts`, é o `try/catch` único dos proxies encaminhadores, e `jsonPayload` lê o corpo dentro dele: corpo que não é JSON vira `400 Bad Request` com o envelope `{ message, _error }`, em vez de escapar para o 500 sem corpo do Next. `sign-in` e `sign-up`, que mantêm handler próprio pelo efeito no cookie, leem o corpo pelo mesmo `jsonPayload`. Quem não tem cookie continua recebendo `401` antes de o corpo ser lido: requisição não autenticada não aprende nada sobre o que enviou. Verificado no ambiente de desenvolvimento nas cinco escritas.

### TD-034 — Listagem e avaliação de ativos sem consumidor no web

- **Tipo:** API · **Prioridade:** baixa
- **Resolução:** `GET /v1/asset/:symbol`, `GET /v1/assets` e `GET /v1/assets/valuations` saíram do backend, com os controllers, services e schemas próprios, o `getAll` e o `getById` de `AssetRepository` e os blocos de teste que os cobriam. O que cada um respondia está em `GET /v1/portfolio/positions/:symbol` e `GET /v1/portfolio/positions`, que a tela de ativos já consome. `POST`, `PATCH` e `DELETE /v1/asset` continuam: são a escrita da carteira, e o `PATCH`, que liga o ativo ao instrumento de outro símbolo, é a única forma de corrigir um símbolo sem apagar o razão — sem tela ainda. Ver `docs/api-inventory.md`, §Superado desde o snapshot.

### TD-040 — Backend e web sem health check de container

- **Tipo:** tooling · **Prioridade:** baixa
- **Resolução:** o backend expõe `GET /health`, que não toca dependência alguma, e `GET /ready`, que consulta o banco por chamada. No `compose.yaml`, o `healthcheck` do `backend` chama `/ready` e o do `web` abre uma conexão TCP na porta 3000, ambos por `node -e` dentro do container, e o `web` passou a depender do `backend` por `condition: service_healthy`. Verificado no ambiente de desenvolvimento: com o `postgres` parado, o `backend` vira `unhealthy` em 35s e `/health` continua respondendo `200`; religado o banco, volta a `healthy` em 10s. Os `HEALTHCHECK` nos Dockerfiles continuam fora: a sonda de produção é declarada no serviço do Cloud Run (TD-060). Ver `docs/containers.md` e `docs/observability.md`.

### TD-046 — `next-themes` sem consumidor

- **Tipo:** qualidade · **Prioridade:** baixa
- **Resolução:** o pacote saiu de `web/package.json` junto de `react-icons`, `@radix-ui/react-icons`, `lodash.isequal` e `@types/lodash.isequal` na auditoria de bundle, todos sem nenhum importador no código. O tema segue fixo em `dark` pela classe do `<html>`. Ver `docs/performance.md`, §Bundle.

### TD-051 — Rolagem horizontal das tabelas não alcança o teclado

- **Tipo:** acessibilidade · **Prioridade:** média
- **Resolução:** o `div` de `components/ui/table.tsx` virou um `section` que observa a própria caixa e a da tabela com `ResizeObserver`: enquanto transborda em qualquer eixo, recebe `tabIndex={0}` e o nome obrigatório da prop `label`; quando cabe, não é nome nem parada de teclado. Os cinco usos passaram a nomear a região, e o `section` manual da tabela de performance saiu, substituído pelo do primitive com `regionClassName`. A tabela de posições também deixou de depender só da rolagem: abaixo de `sm` ficam ativo, valor e ações, com o resultado repetido sob o símbolo, e as seis colunas secundárias seguem no detalhe do ativo. Ver `docs/responsiveness.md`, §Comportamento por largura.

### TD-018 — Formulário de transação do web sem taxas, impostos, corretora e notas

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** `TransactionFormDialog` cria e edita transação com tipo, quantidade, preço unitário, taxas, impostos, data de execução, corretora e notas, validados com os limites da API; taxas e impostos em branco valem zero, e corretora e notas em branco, `null`. A criação parte do detalhe do ativo e do menu da tabela de posições; a edição e a exclusão, do diálogo de detalhes da transação, no detalhe do ativo e na Overview, pelos proxies `PATCH` e `DELETE` de `/api/v1/transactions/[id]`. A exclusão pede confirmação, o backend reconstrói a posição, e o erro da API aparece no diálogo sem perder o que foi digitado. `executedAt` já aparecia na tabela e no diálogo de detalhes. Ver `docs/component-inventory.md`, §Componentes compartilhados, e `docs/api-inventory.md`, §Superado desde o snapshot.

### TD-029 — Custo e preço médio da tabela de ativos sem conversão de moeda

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** a tabela de posições substituiu a de ativos e lê `GET /v1/portfolio/positions`, que entrega preço médio, preço, valor, alocação e resultado convertidos para a `baseCurrency` da carteira, a moeda com que as colunas são formatadas. A coluna de valor investido e o total do rodapé saíram com a tabela antiga, então nenhuma linha é rotulada com moeda diferente da do valor. Ver `docs/domain-model.md`, §Posições da carteira, e `docs/component-inventory.md`, §Feature components.

### TD-002 — Listagem de transações ignora `page` e não segue a ordem das operações

- **Tipo:** API · **Prioridade:** média
- **Resolução:** `GET /v1/transactions` substitui `GET /v1/transactions/:assetSymbol` no padrão de listagem paginada: `page` e `pageSize` deslocam a consulta com `skip` e `take`, sempre limitados, e a ordem é a inversa do razão, `executedAt` e depois `sequence`, do mais recente ao mais antigo. `lastId` e o ramo sem `take` saíram com a listagem antiga. A coluna de transações da tela de ativos, único consumidor, passou a usar `GET /v1/transactions/:assetSymbol/count`, que conta todas as transações do ativo, e não só as da primeira página. Ver `docs/api-inventory.md`, §Superado desde o snapshot, e `docs/testing.md`, §Listagem de transações.

### TD-019 — Nenhum provedor de cotação real

- **Tipo:** produto · **Prioridade:** média
- **Resolução:** `YahooFinanceProvider`, em `backend/src/infra/market-data/YahooFinanceProvider.ts`, implementa `MarketDataProvider` sobre a YH Finance API, escolhida com o produto para B3, NYSE, NASDAQ e cripto, com histórico intradiário e diário. A chave fica em `YAHOO_FINANCE_API_KEY`, só no backend. O código do provedor é derivado de `market`, que o catálogo passou a restringir a esses mercados, e a resposta é validada antes de chegar ao domínio. `GET /v1/assets/valuations` expõe valor de mercado e lucro por ativo, e a tela de ativos os exibe. Ver `docs/domain-model.md`, §Fonte de cotação, e `docs/testing.md`, §Adaptador Yahoo Finance.

### TD-016 — Ordem do razão entre transações com o mesmo `executedAt` e `createdAt`

- **Tipo:** domínio · **Prioridade:** média
- **Resolução:** depois de `executedAt`, o razão é desempatado por `Transaction.sequence`, `BIGINT` único atribuído pelo banco na gravação, no lugar de `createdAt` e `id`. A migration `20260913000000_transaction_sequence` numerou as linhas existentes na ordem `createdAt`, `id`, que o razão seguia, sem mudar nenhuma posição. `rebuildPosition`, em `backend/src/domain/PositionLedger.ts`, ordena o razão que recebe. O teste "replays entries executed and created at the same instant in recording order, not id order" de `backend/src/routes/Transactions.integration.ts` fixa o desempate. Ver `docs/domain-model.md`, §Razão e posição.

### TD-001 — Valores financeiros em ponto flutuante

- **Tipo:** domínio · **Prioridade:** alta
- **Resolução:** quantidade, preço unitário, taxas e impostos da transação e `quantity`, `averageCost` e `balance` da posição são `DECIMAL(38,18)`; a reconstrução usa `Prisma.Decimal`, e a API recebe e devolve esses valores como string decimal. A migração converteu os `double` existentes pela menor representação decimal de cada um. O teste "sells a fractional position down to exactly zero" de `backend/src/routes/Transactions.integration.ts` deixou de ser `todo`. Ver `docs/domain-model.md`, §Valores, moedas e datas.

### TD-009 — `amount` e `price` de transação sem limite superior

- **Tipo:** segurança · **Prioridade:** alta
- **Resolução:** `decimalSchema` e `positiveDecimalSchema` limitam a entrada ao que `DECIMAL(38,18)` guarda sem arredondar, e a reconstrução recusa com 400 `POSITION_OUT_OF_RANGE`, sem gravar, o razão que passa por posição fora da coluna. O teste `todo` de overflow deu lugar aos testes do teto da coluna em `backend/src/routes/Transactions.integration.ts`.

### TD-003 — Exclusão de ativo sem teste com o mesmo símbolo em outra carteira

- **Tipo:** teste · **Prioridade:** média
- **Resolução:** com o catálogo de instrumentos, duas carteiras podem ter o mesmo instrumento. O teste "keeps the asset and transactions another portfolio holds in the same instrument" de `backend/src/routes/Assets.integration.ts` exclui o ativo de uma carteira e confirma que o ativo e as transações da outra ficam intactos.
