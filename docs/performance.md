# Performance do frontend — FASE 16

O que foi medido, o que foi mudado e o que foi deliberadamente deixado como está. A auditoria de requests tem documento próprio, em [`data-fetching.md`](data-fetching.md).

| Item | Valor |
| --- | --- |
| Commit de captura | `d359afd` |
| Data | 2026-09-19 |
| Método | Análise estática do código e contagem de trabalho por evento; sem profiler de navegador, pelo motivo em `accessibility.md`, §Auditoria automatizada |

## Gráficos — TASK 16.3

Nenhuma biblioteca de gráficos está instalada: os dois gráficos são SVG escrito à mão, o que já elimina a maior fonte de peso e de trabalho de layout do dashboard.

### Trabalho por evento de ponteiro

`performance-chart.tsx` refazia, a cada evento de `pointermove`, a projeção da série inteira e as duas strings de `path` — trabalho proporcional ao número de pontos, num evento que dispara na frequência do ponteiro. E, como o estado do ponto ativo morava no componente da seção, cada movimento também re-renderizava o seletor de período e a tabela de dias.

Correções:

| Mudança | Efeito |
| --- | --- |
| `PerformanceSeries` passou a ser componente próprio, dono do índice ativo | Mover o ponteiro re-renderiza a linha e o tooltip; o seletor de período e a tabela ficam fora |
| `useMemo` na série plotada, nos pontos e nos dois `path` | As strings são construídas uma vez por série, não uma vez por evento |
| `key={selectedRange}` no componente | Trocar de período zera o ponto ativo por remontagem, sem um `setState` cruzado entre componentes; a tabela, cujo estado vive na seção, continua aberta |

### Densidade de pontos

A caixa de desenho tem 600 unidades de largura, então dois pontos a menos de uma unidade de distância caem no mesmo pixel. `plottedSeriesOf` reduz a série ao passo necessário para no máximo `MAX_PLOTTED_POINTS` (600) pontos, preservando sempre o último — é ele que a manchete lê quando o ponteiro está fora. O período `MAX` de uma carteira antiga, que traria milhares de pontos diários, passa a desenhar no máximo 600.

A amostragem vale só para o desenho e para o tooltip. A tabela de `Performance as a table`, que é a alternativa acessível ao gráfico, continua listando todos os dias da resposta.

### Redimensionamento

Nenhum dos gráficos escuta `resize`. O de performance usa `viewBox` com `preserveAspectRatio="none"` e largura em CSS; o de alocação decide a orientação por container query (`@md`), e o anel é um SVG de tamanho fixo. O único `ResizeObserver` do projeto está em `components/ui/table.tsx` e só alterna um booleano.

### O que não foi feito, e por quê

| Item | Razão |
| --- | --- |
| Lazy loading dos gráficos | Os dois estão na primeira dobra do dashboard e não carregam biblioteca alguma: adiá-los trocaria bytes que não existem por um salto de layout |
| Memoização em `allocation-chart.tsx` | O componente não faz trabalho por evento de ponteiro: `selectAllocationGroups` e os arcos do anel só recalculam quando a resposta muda ou quando o usuário troca de visão, uma vez por clique |
| `React.memo` nos componentes financeiros | `Money`, `Percentage` e `Trend` formatam um valor e devolvem texto; o custo da comparação de props não se paga contra o da formatação |

## Tabelas — TASK 16.4

### Formatadores de número

`common/utils.ts` guardava as três instâncias de `Intl.DateTimeFormat` em constantes de módulo, mas `formatNumber` construía um `Intl.NumberFormat` **por chamada** — e `formatPrice` dois, porque `currencyFractionDigits` construía outro só para ler `resolvedOptions()`. Uma página de 50 posições chama os formatadores cerca de 450 vezes por renderização.

Medição com Node 24, o mesmo V8 do Chrome, em 450 formatações por rodada e 200 rodadas:

| Estratégia | Tempo por renderização |
| --- | --- |
| `new Intl.NumberFormat` por chamada | 12,6 ms |
| Formatador em cache | 0,32 ms |

Construir o formatador custava cerca de quarenta vezes o que formatar com ele custa, e sozinho consumia três quartos de um quadro de 16 ms a cada renderização da tabela. `numberFormatOf` passou a guardar as instâncias num `Map` chaveado pelas opções; as chaves distintas são limitadas pelos estilos, pelas moedas e pelas contagens de casas que os formatadores pedem, então o mapa não cresce com o volume de dados. A saída é idêntica: mesma locale, mesmas opções, só a instância é reaproveitada.

### Volume

| Item | Decisão |
| --- | --- |
| Paginação | Server-side em toda listagem: posições em 10, 25 ou 50 linhas, transações em 10 no detalhe do ativo e 5 na Overview. O número de linhas renderizadas não cresce com o tamanho da carteira |
| Virtualização | Não introduzida. Ela resolve listas cuja altura é imprevisível; aqui o teto é 50 linhas por página, e virtualizar custaria a semântica de `<table>`, a rolagem nativa da região e a busca do navegador dentro da página |
| `keepPreviousData` | Paginar, ordenar ou filtrar mantém a página anterior visível e esmaecida, sem desmontar e remontar o corpo da tabela a cada mudança |

### Renderização por tecla

Digitar na busca de posições re-renderiza a tabela, porque o texto digitado e a listagem moram no mesmo componente. Com os formatadores em cache, o que resta por tecla é a reconciliação de no máximo 50 linhas, e a requisição só sai 300 ms depois da última tecla. Isolar esse estado num componente próprio, como foi feito com o ponto ativo do gráfico, só se justifica com um profiler apontando o custo — sem navegador, não se mede, e não se refatora no escuro.

## Bundle — TASK 16.5

Medida usada em todo este trecho: soma dos bytes de `build/static/chunks`, o JavaScript que o navegador baixa. O Next 16 não imprime mais o tamanho por rota no `build`, e `--webpack` não gera `app-build-manifest.json`, então a comparação é do total antes e depois de cada mudança.

| Momento | Bytes |
| --- | --- |
| Antes da auditoria (`f61b61f`) | 1.574.940 |
| Depois | 1.558.141 |

### Três bibliotecas de ícones

O projeto importava ícones de `react-icons` (cinco conjuntos: `io5`, `md`, `lu`, `pi`, `rx`), de `@radix-ui/react-icons` e de `lucide-react` — 11, 9 e 13 ícones. `react-icons/lu` é o próprio Lucide reempacotado, e os outros dois conjuntos entregavam o mesmo desenho com outro traço, o que tornava o mesmo conceito visualmente diferente conforme a tela.

Tudo passou para `lucide-react`, a mais usada das três. Equivalências que não são renomeações diretas:

| Saiu | Entrou | Nota |
| --- | --- | --- |
| `CaretSortIcon` | `ChevronsUpDown` | mesmo par de setas do gatilho do select |
| `DotFilledIcon` | `Circle` em `h-2 w-2 fill-current` | o Lucide não tem ponto cheio; o círculo reduzido é o que o shadcn usa |
| `RxDashboard` | `LayoutGrid` | mesma grade de quatro células |
| `PiEyeClosed` | `EyeClosed` | olho fechado, não o `EyeOff` cortado |

Os ícones do Radix desenham numa caixa de 15 px e os do Lucide, de 24. Todos os usos já fixavam `h-4 w-4` ou `size={n}`; as duas exceções eram os botões de rolagem do select, que ganharam `h-4 w-4` para não crescerem.

### Dependências removidas

| Pacote | Importadores | Instalado |
| --- | --- | --- |
| `react-icons` | consolidado em `lucide-react` | 85 MB |
| `@radix-ui/react-icons` | consolidado em `lucide-react` | 4,6 MB |
| `next-themes` | nenhum (TD-046) | 48 KB |
| `lodash.isequal` + `@types/lodash.isequal` | nenhum | 68 KB |

São cerca de 90 MB a menos por install — o que mais pesa é o tempo de instalação e a imagem de build, não o bundle: os dois conjuntos de ícones já entravam no cliente apenas nos ícones usados, e por isso o total dos chunks cai só 16.799 bytes.

### Service worker

`next-pwa` vinha com o `runtimeCaching` padrão, que registrava 15 rotas no worker — entre elas uma `NetworkFirst` para `/api/`, guardando até 16 respostas por 24 horas, e uma `NetworkFirst` genérica para toda navegação. As respostas de `/api/v1/*` carregam as posições e o patrimônio do usuário autenticado: ficavam no Cache Storage do dispositivo, sobreviviam ao sign-out, que só apaga o cookie, e podiam ser servidas como números atuais quando a rede demorasse mais de 10 s.

O worker passou a precachear a saída do build e nada mais: `runtimeCaching: []`, `cacheStartUrl: false` e `dynamicStartUrl: false`. Nenhuma resposta dinâmica é gravada, e a instalação continua válida porque o precache já instala um handler de `fetch`.

| Item | Antes | Depois |
| --- | --- | --- |
| `registerRoute` no `sw.js` | 15 | 0 |
| Entradas no precache | 73 | 66 |
| `login-hero.jpeg` (1,93 MB) no precache | sim | não |

### O que foi avaliado e mantido

| Item | Razão |
| --- | --- |
| `@tanstack/react-query-devtools` | Importado sem condição em `providers/app-provider.tsx`, mas o pacote exporta um componente que devolve `null` fora de `development`, e o painel é eliminado na build: nenhuma referência sobrou em `build/static/chunks` nem em `build/server`. O `Dockerfile` instala tudo no estágio de build e só o runtime roda com `--prod`, então a dependência de desenvolvimento não falta em lugar nenhum |
| `next-pwa` | Mantido porque instalabilidade é decisão de produto, não de auditoria; o risco de ser um plugin parado em 2022 está em TD-057 |
| `axios` | Usado nos route handlers e nos hooks, com interceptadores que centralizam sessão expirada e erro de API; trocar por `fetch` reescreveria essa camada sem ganho medido |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Base do `cn` e das variantes do `Button`; somados não chegam a 10 KB |

A arte do sign-in é hoje o maior arquivo servido — 1,93 MB contra 1,49 MB de todo o JavaScript do cliente — e continua sendo baixada em telefones, onde a coluna que a exibe é `hidden`. A correção mexe no `next/image` e no arquivo binário, fora do escopo desta task: está em TD-056, encaminhada para a TASK 20.5.
