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
