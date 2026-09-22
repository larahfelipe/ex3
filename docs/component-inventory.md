# Inventário de componentes reutilizáveis — TASK 0.3

Classificação do frontend (`web/src`) no commit `8dc9edd`, para decidir o que preservar antes das FASES 8–13. 4.481 linhas de TS/TSX.

## UI primitives — `src/components/ui`

shadcn/ui sobre Radix, com `cn()` (`clsx` + `tailwind-merge`) e `class-variance-authority`. Base sólida, mantida.

| Componente | Base | Avaliação |
| --- | --- | --- |
| `button` | Radix Slot + CVA | **Preservar.** Variantes já cobrem o novo produto |
| `card` | — | **Preservar.** Base dos KPI cards da FASE 8. `CardTitle` e `CardDescription` saíram na auditoria de UX de 2026-09-22: todo título de seção vem de `SectionHeader`, com `<h2>` |
| `dialog`, `alert-dialog` | Radix | **Preservar.** Focus trap e `aria` vêm do Radix. Desde a TASK 15.4 o conteúdo é limitado a `max-h-dvh` e rola por dentro — abaixo de `sm` isso equivale à tela integral —, e o rodapé separa os botões empilhados com `gap-2` |
| `dropdown-menu`, `select` | Radix | **Preservar.** Reduzidos na auditoria de UX de 2026-09-22 às partes com consumidor: `DropdownMenu`, `Trigger`, `Content` e `Item`; `Select`, `Trigger`, `Value`, `Content` e `Item`, com os botões de rolagem que o próprio `SelectContent` usa |
| `input`, `label` | Radix | **Preservar.** `checkbox` foi removido com `@radix-ui/react-checkbox` na auditoria de dependências (TASK 20.3): estava sem consumidor desde que a tabela de ativos deixou de selecionar linhas |
| `segmented-control` | — | **Novo.** `SegmentedControl`/`SegmentedControlItem` estiliza um grupo de `input[type=radio]` nativo como um controle segmentado — nenhum papel ARIA próprio além do que o HTML já dá ao rádio. O item marcado usa `--primary`/`--primary-foreground`; o contêiner ganha `border-negative` quando o `ChoiceField` que o envolve está inválido (`in-data-invalid:`). Três consumidores: tipo da transação (`transaction-form-dialog.tsx`), moeda base da carteira (`portfolio-form-dialog.tsx`) e classe/mercado/moeda do cadastro de instrumento (`instrument-registration.tsx`), que antes eram rádio nativo sem estilo |
| `table` | HTML semântico | **Preservar como primitive**, mas não cobre ordenação, seleção ou estado vazio — o consumidor implementa tudo. Desde a TASK 15.3 o wrapper é um `section` que exige a prop `label`: enquanto transborda, vira região nomeada e focável; `regionClassName` ajusta a caixa que rola |
| `pagination` | — | **Removido** na auditoria de UX de 2026-09-22: nunca teve consumidor, e toda listagem pagina por botões, não por link |
| `skeleton` | — | **Preservar.** Vira base do `LoadingState` (TASK 12.4) |
| `separator`, `tooltip` | Radix | **Removidos** na TASK 20.3, com `@radix-ui/react-separator` e `@radix-ui/react-tooltip`: nenhuma tela os renderizava |
| `sonner` | Sonner | **Preservar** |

**Ausentes e necessários:** `tabs`, `sheet` (nav mobile, TASK 13.2), `badge`, `chart`. Nenhuma biblioteca de gráficos está instalada — decisão pendente para a TASK 8.3.

## Layout components

| Componente | Avaliação |
| --- | --- |
| `components/sidebar.tsx` | **Redesenhado.** `nav[aria-label="Main"]` único, que muda de barra inferior fixa (< `sm`) para trilha lateral fixa à esquerda (≥ `sm`), colapsável para ícone só a partir de `lg` — abaixo disso não há espaço horizontal para uma trilha estreita e o rótulo compacto junto do ícone. Duas seções: `PORTFOLIO_SECTIONS` (Overview, Assets, Portfolios, agrupadas sob o rótulo "Portfolio", `aria-labelledby`) e `ACCOUNT_SECTION` (Account, com o nome do usuário como `detail` quando expandida, e Sign out abaixo, fora da rota — some abaixo de `sm`, onde a barra é só navegação e a conta se alcança pelo próprio item Account). Item ativo por `usePathname`, também nas sub-rotas (`isCurrentPath`), com `aria-current="page"`, indicador lateral (`bg-primary`) e ícone destacado só quando expandida. Estado colapsado/expandido é lido do cookie `APP_STORAGE_KEYS.Navigation` no server component (`(protected)/layout.tsx`, via `cookies()`) e passado como `initialState`: a primeira renderização já sai no estado certo, sem flash. O toggle (`PanelLeftClose`/`PanelLeftOpen`, `aria-label` dinâmico) grava o cookie a cada troca (`max-age` de um ano) e só aparece em `lg`; a classe `navigation-expanded:` (variante de `data-navigation-state` em `globals.css`) condiciona rótulo, indicador e fundo do item ativo, sem duplicar o layout entre os dois modos. Toda cor vem de token (`--primary`, `--accent`, `--muted-foreground`, `--negative` no Sign out); nenhuma cor fixa |
| `app/(protected)/layout.tsx` | **Preservar** como shell |
| `app/(public)/layout.tsx` | **Preservar** |
| `app/layout.tsx` | **Preservar** — fontes, tema, providers |

**Ausentes:** `PageHeader`, `SectionHeader` (TASK 12.3), navegação mobile (TASK 13.2).

**Fronteira Server ↔ Client (TASK 16.2).** `'use client'` marca o que precisa de estado, efeito, contexto ou evento — e nada além disso. São client: os providers, a navegação (`usePathname`), as três telas que leem dados por hook, os dois formulários de autenticação e os primitives que embrulham Radix ou guardam estado, como `table.tsx` desde que a região rolável observa a própria caixa. São server: `app/layout.tsx`, os dois layouts de grupo, as páginas de sign-in e sign-up — que renderizam só a moldura estática em volta do formulário client — e todo Route Handler de `app/api/v1`. Um componente sem interação que só é usado dentro de um client component continua no grafo do cliente, e marcá-lo não muda nada: a fronteira é definida por quem o renderiza.

## Feature components — `app/(protected)/(overview)/_components`

A Overview é a página principal, em `/`. O redirect permanente de `/` para `/assets` saiu de `next.config.js`; sign-in, sign-up e o acesso autenticado a uma rota pública levam a `/`. Navegador que guardou o 308 antigo segue indo para `/assets` até limpar o cache. A página lê a carteira ativa e mostra o nome e a moeda base no cabeçalho, com estado de carregando, erro com nova tentativa e carteira ausente.

| Componente | Responsabilidade |
| --- | --- |
| `(overview)/page.tsx` | Cabeçalho e composição das seções: valor da carteira, performance, alocação ao lado das posições em telas largas, e transações recentes |
| `portfolio-value-card.tsx` | `PortfolioValueCard`, sobre `QuerySection`, com `GET /v1/portfolio/overview` numa lista de definição: valor total em destaque, variação do dia, valor investido e lucro ou prejuízo, com percentual, e o horário das cotações (`quotedAt`) em `<time>`. Vazio quando a carteira não tem posição com unidades: `totalValue` `0` sem `quotedAt`. Desatualizado quando a nova busca falha com valor em cache (`isRefetchError`): aviso `role="alert"` com nova tentativa acima dos últimos valores. Cotação de reserva do provedor aparece só pelo horário antigo |
| `allocation-chart.tsx` | `AllocationChart`, sobre `QuerySection`, com `GET /v1/portfolio/allocation`: seletor por classe (`byType`) ou por ativo (`byAsset`) em botões de rádio nativos no cabeçalho, anel em SVG decorativo (`aria-hidden`) e legenda em tabela, a alternativa textual, com cor, nome, percentual e valor na moeda base. Grupos na ordem da API; grupo sem `allocation` fica fora do anel e aparece como "Not available". Anel e legenda lado a lado quando o card tem ao menos 28rem (container query), empilhados abaixo disso. As cores vêm de uma paleta de 10 e se repetem a partir do 11º grupo (TD-025) |
| `positions-summary.tsx` | Posições em tabela, 10 por página, com a página em `positionsPage` na URL e a página anterior exibida enquanto a próxima carrega; o símbolo leva ao detalhe do ativo; sem posições, leva a `/assets?action=add-asset` |
| `recent-transactions.tsx` | As 5 transações mais recentes em `TransactionsTable`: a primeira página da listagem, que ordena por `executedAt` decrescente |

## Componentes compartilhados — `src/components`

| Componente | Responsabilidade |
| --- | --- |
| `amounts.tsx` | `Amount`, `SignedAmount` e `UnavailableValue`: valor ausente aparece como `-` e é lido como "Not available" |
| `load-error-alert.tsx` | `LoadErrorAlert`, o erro com nova tentativa (`role="alert"`), usado pelas seções e pelas páginas da Overview, da tela de ativos e do detalhe do ativo |
| `query-section.tsx` | `QuerySection` enquadra a seção num card com título `h2` e resolve, a partir da query, carregando (`aria-busy`), erro com nova tentativa, vazio e conteúdo; o dado em cache segue exibido se a nova busca falhar. O erro com nova tentativa é o `LoadErrorAlert` compartilhado. Quando o conteúdo exibido troca — outra página de dados ou o estado vazio — e o foco, que estava na seção ou num diálogo aberto a partir dela, cai no `body`, o foco vai para o `<h2>`, que `SectionHeader` deixa focável por script (`tabIndex={-1}`) |
| `page-navigation.tsx` | `PageNavigation`, o `nav` de "Previous", posição e "Next" das quatro listagens paginadas — posições na Overview e na tela de ativos, transações do ativo e carteiras —, com a posição em `aria-live="polite"` e um `detail` opcional, a contagem de posições na tela de ativos. Os botões dos extremos usam `aria-disabled`, não `disabled`, para que chegar à primeira ou à última página não tire o foco do botão |
| `submit-button.tsx` | `SubmitButton`, o submit de todo formulário, com spinner enquanto envia. Pendente, fica `aria-disabled` e cancela o próprio clique, o que cancela também a submissão implícita por Enter num campo; `disabled` tiraria o foco do botão e o deixaria no `body` quando o envio falha. `disabled` segue para indisponibilidade que não vem do envio, como edição sem alteração |
| `performance-chart.tsx` | `PerformanceChart`, sobre `QuerySection`, com `GET /v1/portfolio/performance`, da carteira inteira na Overview e de uma posição, por `symbol`, no detalhe do ativo: seletor de período em botões de rádio nativos no cabeçalho, de `1W` a `MAX`, guardado em `range` na URL, com o período anterior exibido enquanto o novo carrega; linha em SVG decorativo (`aria-hidden`), com área sob ela, e a série inteira em tabela dentro de um `<details>`, a alternativa textual, com dia, valor, investido, aporte líquido e retorno. O ponteiro move o marcador e a leitura de dia, valor e retorno, que se posiciona do lado oposto ao ponto para não sair do card; sem ponteiro, a leitura é a do último ponto. Nenhum valor é calculado no web: os números viram coordenadas apenas para desenhar, e todo valor exibido é formatado da string decimal da API. O dia da série é formatado em UTC, o fuso em que ele fecha. `1D` fica fora do seletor (TD-032) |
| `transactions-table.tsx` | `TransactionsTable` lista as transações recebidas, com a coluna de ativo opcional, omitida no detalhe do ativo. Data e hora no fuso do navegador, o mesmo em que o formulário registra a execução. Cada linha tem um botão "Details", cujo nome acessível inclui tipo, ativo e data, que abre `TransactionDetailsDialog`. Editar e excluir partem desse diálogo e abrem por cima dele `TransactionFormDialog` ou `ConfirmDeletionDialog`: cancelar volta ao detalhe, e concluir fecha os dois. A escrita invalida a carteira por `useRefreshPortfolio`, e transações, posição, indicadores e performance buscam de novo |
| `transaction-details-dialog.tsx` | `TransactionDetailsDialog` mostra a transação inteira num diálogo, enquanto o web não tem tela de detalhe: tipo e ativo no título, data de execução na descrição, e quantidade, preço unitário, taxas, impostos, corretora e notas numa lista de definição, com o rótulo do preço conforme o tipo. Corretora e notas ausentes aparecem como "Not available"; nenhum total é calculado no web. O rodapé tem "Delete", "Close" e "Edit" |
| `transaction-form-dialog.tsx` | `TransactionFormDialog` cria ou edita uma transação: a criação parte do detalhe do ativo e do menu da linha na tabela de posições, sempre no contexto de um ativo, e a edição, do diálogo de detalhes. O formulário é montado a cada abertura. Tipo em botões de rádio nativos, compra, venda, proventos e bonificação, em três colunas no celular; quantidade, preço unitário, taxas e impostos em texto com teclado decimal, com o rótulo do preço conforme o tipo (preço unitário, valor por unidade do provento ou custo atribuído da bonificação), com o código da moeda no rótulo e o símbolo dela dentro do campo de valor, a base da carteira na criação e a da transação na edição; data de execução no fuso do navegador, com segundos; corretora e notas opcionais. Valida com os limites da API: decimal com ponto, até 20 dígitos inteiros e 18 casas, quantidade e preço maiores que zero, preço zero aceito só em bonificação, taxas e impostos em branco como zero, corretora até 60 e notas até 500 caracteres, em branco como `null`. Na edição, a data que não foi alterada segue a gravada, com os milissegundos, para não mudar a ordem do razão. Enquanto envia, campos e botões ficam desabilitados e o diálogo não fecha; o erro da API aparece no campo que o `path` do detalhe indica ou, sem campo correspondente, num alerta, e o que foi digitado continua no formulário |
| `confirm-deletion-dialog.tsx` | `ConfirmDeletionDialog`, a confirmação de toda exclusão — ativo, carteira e transação — num `AlertDialog` com título, consequência, "Cancel" e o confirmar destrutivo com o nome da ação. Fica aberto até a exclusão terminar: enquanto ela corre, "Cancel", `Esc` e o clique fora não fecham, e o confirmar fica `aria-disabled` com spinner, sem perder o foco. A recusa da API, como a de excluir um `BUY` do qual um `SELL` depende ou a da última carteira, aparece num alerta no próprio diálogo, sem toast. Quem chama fecha o diálogo depois de excluir e leva o foco a um destino que continua na tela, já que a linha que o abriu saiu |
| `detail-item.tsx` | `DetailItem`, termo e valor de uma lista de definição, usado pelo diálogo de transação e pelo detalhe do ativo |

## Feature components — `app/(protected)/assets/[symbol]`

O detalhe do ativo, em `/assets/[symbol]`, abre pelo símbolo nas posições da Overview e na tabela de posições. Nenhum valor é calculado no web.

| Componente | Responsabilidade |
| --- | --- |
| `[symbol]/page.tsx` | Página de servidor que repassa o símbolo da rota a `AssetDetail` |
| `asset-detail.tsx` | `AssetDetail` lê a carteira ativa e `GET /v1/portfolio/positions/:symbol` por `usePosition`. Cabeçalho com retorno à tela de ativos, símbolo em `h1` e nome. Visão geral na moeda da cotação: preço, variação do dia, fechamento anterior, horário da cotação em `<time>`, classe, mercado, moeda e setor. Posição na moeda base: quantidade, preço médio, preço, valor, alocação e resultado com percentual. Em seguida, a performance da posição e as transações do ativo. Carregando, erro com nova tentativa para a carteira e para a posição, carteira ausente e ativo fora da carteira, com atalho para a tela de ativos; valor ausente aparece como "Not available". Visão geral e posição lado a lado em telas largas |
| `asset-transactions.tsx` | `AssetTransactions`, sobre `QuerySection`, lista as transações do ativo por `GET /v1/transactions` com `symbol`, 10 por página, com a página em `transactionsPage` na URL, em `TransactionsTable` sem a coluna de ativo, com a página anterior exibida enquanto a próxima carrega e navegação anterior e próxima com a página atual anunciada (`aria-live`). O botão "Add transaction" do cabeçalho abre `TransactionFormDialog` na moeda base da carteira, e a página que ficou além da última depois de uma exclusão oferece ir para a última |

## Feature components — `app/(protected)/assets/_components`

| Componente | Linhas | Avaliação |
| --- | --- | --- |
| `positions-table.tsx` | 612 | Substituiu `assets-table.tsx`, que buscava só na página carregada. Lê `GET /v1/portfolio/positions` por `usePositions`, com busca, filtros, ordenação e paginação no servidor, sobre a carteira inteira: busca por símbolo ou nome enviada 300 ms depois da última tecla, filtros de classe e situação, ordenação por qualquer coluna em botões no cabeçalho com `aria-sort`, e 10, 25 ou 50 linhas por página, com a página anterior esmaecida enquanto a nova carrega. Colunas de ativo (símbolo, que leva ao detalhe do ativo, e nome), quantidade, preço médio, preço, valor, alocação, resultado e resultado percentual, na moeda base e sem cálculo no web; abaixo de `sm` só ativo, valor e ações permanecem, com o resultado repetido sob o símbolo e o restante disponível no detalhe do ativo. Carregando, erro com nova tentativa, vazio com atalho para adicionar ativo e sem resultado com atalho para limpar busca e filtros. Menu de ações por linha com nova transação e exclusão |
| `add-asset-dialog.tsx` | 449 | **Reescrito.** `AddAssetDialog` só troca entre duas visões pelo estado `view.kind` — `CatalogPicker` (padrão) e `InstrumentRegistration` — cada uma dona do próprio formulário `react-hook-form`, e monta o título e a descrição do diálogo pela visão ativa. Não guarda estado de negócio: repassa `onConfirm` às duas |
| `→ CatalogPicker` (em `add-asset-dialog.tsx`) | — | Escolhe o instrumento do catálogo, sem símbolo digitado: busca por símbolo ou nome em `GET /v1/instruments`, 300 ms depois da última tecla, com o termo validado pelo mesmo padrão da API, e até 20 resultados em botões de rádio nativos, cada um com o selo "Private" quando `scope === 'PRIVATE'`. O estado do catálogo é anunciado (`role="status"`): carregando, buscando, catálogo vazio, nenhum resultado, com atalho para limpar a busca, e mais resultados que os exibidos; qualquer um desses estados também oferece "Register" para abrir `InstrumentRegistration` com a busca levada adiante. Falha de carga mostra erro com nova tentativa, e falha do cadastro fica no diálogo (`role="alert"`), com o 409 traduzido para o ativo já existir na carteira, sem toast |
| `instrument-registration.tsx` | 517 | **Novo.** Cadastra um instrumento fora do catálogo e cria o ativo sobre ele na mesma escrita (`POST /v1/asset` com `instrument`, ver `docs/api-inventory.md`). Busca `GET /v1/instruments/options` para não fixar tipo e mercado no cliente; sem eles, mostra carregando ou erro com nova tentativa, com "Back to the catalog" disponível nos dois. O termo trazido da busca preenche símbolo ou nome, conforme parece um símbolo (`isSymbolLike`). Símbolo, nome, classe, mercado, moeda (só perguntada quando o mercado aceita mais de uma, como `CRYPTO`) e setor opcional; o schema Zod deriva a moeda do mercado quando ele só cota em uma. Erro do `details[].path` da API volta ao campo do formulário (prefixo `instrument.` removido); sem campo correspondente, cai num alerta. Conflito de símbolo (`409`) oferece "Search the catalog for {symbol}", que volta à `CatalogPicker` com a busca preenchida. `shouldFocusError: false` mais um handler próprio focam o primeiro campo inválido na ordem visual, não na ordem de registro do RHF, onde os `SegmentedControl` antecedem os campos de texto — ver `docs/accessibility.md`, §Auditoria automatizada — cadastro de instrumento e menu lateral |
| `add-asset-footer.tsx` | 60 | **Novo.** `AddAssetFooter`, rodapé comum às duas visões: Cancel, o botão de submit do formulário por `formId` com spinner enquanto envia, e, depois de um cadastro bem-sucedido, "Add a {symbol} transaction?" |
| `assets/page.tsx` | 205 | **Reescrita.** Cabeçalho com o nome e a moeda base da carteira e o botão de adicionar ativo; carregando, erro com nova tentativa e carteira ausente como na Overview. Orquestra adicionar ativo, nova transação, em `TransactionFormDialog`, e excluir ativo, em `ConfirmDeletionDialog`, abertos também por `?action` e `symbol`; `action` desconhecido é ignorado, assim como `add-transaction` e `delete` sem `symbol`. Depois de excluir, o foco vai para "Add asset". Abrir por URL e fechar um diálogo substituem a entrada do histórico, sem criar outra, então Voltar sai da tela em vez de reabrir o diálogo |

## Feature components — `app/(protected)/portfolios`

| Componente | Responsabilidade |
| --- | --- |
| `portfolios/page.tsx` | Tela de carteiras, sobre `QuerySection`, com `GET /v1/portfolios` 10 por página, com a página em `page` na URL: nome, moeda base e a marca da carteira ativa em cada linha, com "Use", "Edit" e "Delete", cujos nomes acessíveis incluem o da carteira. "Use" guarda a escolha da carteira ativa, e o bloqueio do armazenamento pelo navegador vira toast de erro. Com uma carteira só, "Delete" fica `aria-disabled`, focável e descrito pela explicação abaixo da lista. Carregando, erro com nova tentativa, vazio com atalho para criar e página além da última com atalho para ela. Depois de excluir, o foco vai para "New portfolio", porque a linha que abriu o diálogo saiu |
| `portfolio-form-dialog.tsx` | `PortfolioFormDialog` cria ou edita: nome de 1 a 60 caracteres, sem espaço nas pontas, e moeda base em botões de rádio nativos, com a atual incluída na edição mesmo fora das oferecidas. Na edição, avisa que a moeda só muda sem transações, e "Save changes" só habilita com alteração. Erro da API vai para o campo do `path` ou para um alerta no diálogo, como o 422 da moeda travada |

## Feature components — `app/(protected)/account`

| Componente | Responsabilidade |
| --- | --- |
| `account/page.tsx` | Tela de conta: perfil e segurança, cada um numa seção com `h2`. O perfil carrega com `LoadingState` e falha com `ErrorState`; a segurança não depende do perfil. "Sign out" no cabeçalho só abaixo de `sm`, onde o menu lateral não o mostra |
| `profile-form.tsx` | `ProfileForm` edita o nome, com a regra do sign-up, e mostra o e-mail, que a API não altera, como texto numa lista de definição. Salvar revalida `GET /api/v1/user` e confirma com o toast da API |
| `password-form.tsx` | `PasswordForm` troca a senha: atual, nova com a dica da política e confirmação. Senha atual errada, o `400` sem `details` da API, vai para o campo dela com foco; o resto segue `presentSubmitError`. Aceita a troca, o proxy já apagou o cookie, e o web limpa o cache e volta ao sign-in |

## Forms

Padrão consistente e adequado: `react-hook-form` + `zodResolver`, schema Zod co-localizado com o diálogo. **Preservar o padrão.**

`TransactionFormDialog` é a referência: liga rótulo, `aria-invalid` e `aria-describedby` a cada campo, leva o erro da API ao campo do `path` do detalhe, ou a um alerta quando nenhum campo corresponde, e não limpa o que foi digitado.

`PortfolioFormDialog` segue a mesma referência, com a dica e o erro da moeda base ligados ao grupo de opções por `aria-describedby`.

**`components/form-field.tsx` — `FormField` e `ChoiceField`.** Extraem a fiação de rótulo/dica/erro que os dois formulários acima faziam à mão. `FormField` gera o `id` do controle, liga `Label`, `aria-invalid` e `aria-describedby` (dica e erro, cada um só quando presente) e repassa isso como `FieldControlProps` para o `children` renderizar o `input`; `isOptional` acrescenta "(optional)" ao rótulo. `ChoiceField` é o mesmo contrato para um grupo do `SegmentedControl`, sobre um `fieldset`/`legend`: marca `data-invalid` no `fieldset` quando há erro, o que o `SegmentedControl` lê para colorir a borda. Consumidos por todo formulário: transação, carteira, cadastro de instrumento, sign-in, sign-up, perfil e senha.

Lacuna fechada: erro de servidor sem campo correspondente, e `aria-invalid`/`aria-describedby` fora dos dois formulários de referência (TASK 14.5) — `instrument-registration.tsx` mapeia `details[].path` da API para o campo do formulário (com o prefixo `instrument.` removido) e cai num alerta quando não há campo correspondente, como os dois já faziam.

**`lib/submit-error.ts` — `presentSubmitError`.** O mapeamento de `details[].path` para o campo, com foco no primeiro, e o alerta `root.server` para o que não tem campo, antes copiado em três formulários. Cada formulário diz só como um `path` da API vira um campo seu, por `fieldOf`, e trata antes dele o erro que tem destino próprio, como o `409` do sign-up no e-mail ou a senha atual errada.

**`lib/account-schema.ts`.** Nome e política de nova senha, espelho da API, compartilhados pelo sign-up e pela tela de conta, com a dica exibida sob a nova senha.

Todo formulário valida em `onTouched`, não desabilita os campos durante o envio e mostra o erro da API no próprio formulário; toast só confirma sucesso.

## Data fetching

| Item | Avaliação |
| --- | --- |
| `lib/axios/axios.ts` | **Preservar.** Duas instâncias — `proxyApi` (browser, `/api`) e `serverApi` (server, `API_URL`) — resolvidas por `api.getInstance()`. Interceptor de 401 dispara sign-out e redireciona |
| `lib/axios/errors.ts` | **Preservar.** `ApiProxyError` normaliza o erro do backend, e `isNotFoundError` reconhece o 404 pelo `code` do corpo, que chega ao navegador pelo proxy |
| `lib/api-proxy.ts` | **Preservar.** `forwardToApi` encaminha ao backend com o `Bearer` do cookie, repassa status e corpo, e concentra o `try/catch` dos proxies; `jsonPayload` responde `400` a corpo que não é JSON |
| `lib/react-query.ts` | **Preservar.** Defaults auditados na TASK 16.1 e justificados em `docs/data-fetching.md`: dado fresco por 60 s, sem refetch ao focar a janela, e repetição até duas vezes que nunca alcança requisição rejeitada com 4xx. Mutation segue o padrão do TanStack Query e não repete, para que uma escrita cujo tempo esgotou não seja gravada de novo e o erro chegue ao formulário na primeira resposta |
| `app/api/v1/*/types.ts` | **Preservar o padrão** de tipos co-localizados por rota |

**Hooks de domínio:** componente não conhece URL, Axios nem query key. `hooks/use-portfolio.ts` (carteira ativa, lista, criação, edição e exclusão de carteira, visão geral, posições, posição por símbolo, alocação e performance; as posições mantêm a página anterior enquanto a pedida, com outra ordenação, busca ou filtro, carrega, e nenhuma repete a busca que respondeu 404, pela regra geral de `retry`), `hooks/use-assets.ts` (criação e remoção de ativo), `hooks/use-transactions.ts` (listagem, que mantém a página anterior enquanto a pedida carrega, criação, edição e exclusão) e `hooks/use-user.ts` (perfil, sign-in, sign-up e sign-out) montam a query ou a mutation sobre os proxies de `app/api/v1`. Hook escopado por carteira recebe a carteira e não dispara a requisição sem ela (`skipToken`) por `usePortfolioScopedQuery`, e toda mutação de escrita anuncia o sucesso e invalida o escopo por `useAnnouncePortfolioChange`, ambos em `hooks/use-portfolio.ts`; mutation sem carteira falha, com toast nas de ativo e no diálogo que a disparou nas de transação, que não abrem toast de erro.

**Query keys e invalidação:** toda query key sai de `queryKeys`, em `lib/react-query.ts`, no formato `[raiz, ...escopo, recurso, parâmetros]`: `['user']` para o perfil, `['portfolios', 'page', página]` para a lista de carteiras, `['portfolios', 'details', portfolioId]` para a carteira escolhida e `['portfolio', portfolioId, recurso, parâmetros]` para o que pertence a uma carteira — `overview`, `positions`, `position`, `allocation`, `performance` e `transactions`. Os parâmetros são os da requisição, nunca um valor derivado, como o horário de atualização de outra query. Toda escrita bem-sucedida numa carteira, e o botão de atualizar da tela de ativos, invalidam `['portfolio', portfolioId]` por `useRefreshPortfolio`: as queries ativas do escopo buscam de novo, as inativas ficam obsoletas, e as desativadas por `skipToken` ficam de fora. Sign-in, sign-up e sign-out removem todo o cache, e um 401 de sessão recarrega a página em `/sign-in`; por isso as keys não levam o usuário (ver TD-023 sobre o `QueryClient` no servidor).

## State

| Item | Avaliação |
| --- | --- |
| `providers/app-provider.tsx` | **Preservar** — QueryClient, tema, toaster, progress bar, error boundary |
| `hooks/use-user.ts` | **Preservar.** Perfil do chamador por `GET /api/v1/user` e mutations de sign-in, sign-up e sign-out, que descartam o cache de queries da sessão anterior |
| `hooks/use-disclosure.ts` | **Preservar** — bom primitive de UI state |
| `hooks/use-page-param.ts` | `usePageParam`, a página de uma listagem num parâmetro da URL, com o nome dado por quem chama: `page` nas carteiras, `positionsPage` na Overview e `transactionsPage` no detalhe do ativo. Valor que não é página mostra a primeira, e a primeira sai da URL |

**Fronteira servidor↔UI:** dado de servidor — carteira, visão geral, posições, alocação, performance, transações e perfil — vem só do React Query. A URL guarda o que um refresh ou um link precisa reproduzir: busca, filtros, ordenação, tamanho e página da tabela de posições, a página das outras listagens e o período do gráfico, com `updateUrlQuery`, que empilha, para Voltar desfazer a mudança; e o diálogo pedido por `action` e `symbol` na tela de ativos, com `replaceUrlQuery`, que substitui. `useState` guarda o resto do estado de interface: diálogo aberto, símbolo selecionado, a transação selecionada e a ação sobre ela e o texto digitado na busca. As tabelas exibem a paginação canônica da resposta e formatam os valores na moeda que a resposta informa.

## Utilities

| Item | Avaliação |
| --- | --- |
| `lib/utils.ts` → `cn()` | **Preservar** |
| `common/utils.ts` → `formatNumber`, `formatMoney`, `formatPrice`, `formatUnitAmount`, `formatQuantity`, `formatPercent`, `formatQuoteTime`, `formatExecutionTime`, `signedValueTone` | **Promover a primitive.** Formatadores centrais, compartilhados pela tela de ativos, pelo detalhe do ativo e pela Overview: preço e quantidade com as casas decimais do valor recebido, valor de uma unidade com ao menos 4 algarismos significativos, para que o preço abaixo de um centavo não vire zero, percentual com duas casas, dia e hora da cotação no fuso do navegador e a cor pelo sinal; viram base de `Money`/`Percentage` (TASK 12.2) |
| `common/utils.ts` → `truncateText`, `sanitizeInputValue` | **Preservar** |
| `common/utils.ts` → `updateUrlQuery`, `replaceUrlQuery` | **Preservar.** Escrevem a query pela History API nativa, `pushState` e `replaceState`, que o App Router sincroniza com `useSearchParams` desde o Next 14.1; substituíram `replaceUrl`, cujo conflito com o router a TASK 13.3 previa |
| `common/constants.ts` | **Preservar e expandir** — rotas, com a do detalhe do ativo por símbolo, cookies, moedas, fontes, rótulos e tons dos tipos de transação e o rótulo do preço de cada tipo |
| `types/index.ts` | **Preservar** utilitários (`Maybe`, `WithId`, `Pagination`); **remover** `TailwindColors*`, acoplamento à paleta do Tailwind sem uso justificado |

## Duplicações relevantes

1. **Cálculo financeiro em três lugares** — `dominance`/`totalInvestedValue` no proxy (`api/v1/assets/route.ts`), preço médio em `asset-transaction-table-cell.tsx`, `investedValue` no backend. Uma única fonte de verdade na FASE 5. **Resolvido:** o componente de transação saiu junto com a listagem por símbolo, o proxy foi removido, e o web exibe os valores que o backend calcula, como a alocação e o resultado por posição de `GET /v1/portfolio/positions`.
2. **Bloco `try/catch` idêntico em todas as 9 rotas de proxy** — mesmas 4 linhas de leitura do cookie + mesmo `catch`. Candidato a um wrapper único.
3. **Bloco `catch` idêntico nos 16 controllers do backend** — resolvido por error handler global (TASK 1.6).
4. **Dois pacotes de ícones**: `react-icons` e `lucide-react`, ambos em uso nos mesmos arquivos (`add-asset-dialog.tsx`, `sidebar.tsx`, `app-provider.tsx`). **Resolvido:** a auditoria de bundle encontrou ainda um terceiro, `@radix-ui/react-icons`, nos primitives. Todos passaram para `lucide-react`, e os outros dois saíram de `package.json`. Ver `docs/performance.md`, §Bundle.
5. **Schema Zod duplicado entre front e back** — `AddAssetSchema` (web) e `CreateAssetSchema` (backend) repetem as mesmas regras sem contrato compartilhado; `registrationSchemaOf` em `instrument-registration.tsx` repete do mesmo jeito os limites de `InstrumentAttributesSchema` (tamanho de símbolo, nome e setor, padrão do símbolo).

## Componentes excessivamente específicos

* `assets-table.tsx` — acoplado a `LimitPerPageOptions` e ao tipo `PageRequest` importados de `../page`, dependência circular de fato entre página e componente. **Resolvido:** a tabela de posições que o substituiu define as próprias opções e não importa nada da página.

## Candidatos a virar primitive

| Origem | Primitive de destino | Task |
| --- | --- | --- |
| `formatNumber` + `CURRENCIES` | `Money`, `Percentage` | 12.2 |
| cor pelo sinal em `signedValueTone` e `SignedAmount` de `components/amounts.tsx` | `ProfitLoss`, `Trend` | 12.1 / 12.2 |
| `Skeleton` em uso ad-hoc | `LoadingState` | 12.4 |
| `QuerySection` e `LoadErrorAlert` | `EmptyState`, `ErrorState`, `NoResultsState`, `StaleState` | 12.4 |
| cabeçalho repetido em `assets/page.tsx`, `account/page.tsx` e `(overview)/page.tsx` | `PageHeader`, `SectionHeader` | 12.3 |

## Resumo

**Preservar sem alteração relevante:** os primitives de `components/ui` que sobraram à TASK 20.3, camada axios, providers de app, `use-disclosure`, padrão de formulários, padrão de tipos por rota.

**Refatorar:** `common/utils`. `sidebar` foi redesenhado — ver a entrada acima.

**Reescrever:** `assets-table` e `assets/page`, já reescritos; a tabela deu lugar a `positions-table`. `add-asset-dialog` também, dividido em `CatalogPicker`, `InstrumentRegistration` e `AddAssetFooter`.

**Criar:** primitives financeiras, componentes de estado de dados, camada de gráficos. Navegação mobile já existe, na mesma `nav` do `sidebar` — barra inferior abaixo de `sm`.
