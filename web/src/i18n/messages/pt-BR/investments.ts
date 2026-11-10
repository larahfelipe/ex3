export default {
  instrumentTypes: {
    STOCK: 'Ações',
    ETF: 'ETFs',
    FUND: 'Fundos',
    REIT: 'Fundos imobiliários',
    CRYPTO: 'Criptoativos',
    BOND: 'Renda fixa',
    TREASURY: 'Títulos públicos',
    CASH: 'Caixa',
    OTHER: 'Outros'
  },
  metrics: {
    asset: 'Ativo',
    quantity: 'Quantidade',
    marketValue: 'Valor de mercado',
    allocation: 'Alocação',
    profitLoss: 'Lucro/Prejuízo',
    totalValue: 'Valor total',
    dayChange: 'Variação do dia',
    invested: 'Investido',
    value: 'Valor',
    share: 'Participação',
    pricesAsOf: 'Cotações de <quoted>{time}</quoted>'
  },
  overview: {
    description: '{name} · Moeda-base {currency}',
    addAsset: 'Adicionar ativo',
    portfolio: 'Carteira',
    portfolioOption: '{name} · {currency}',
    allPortfolios: 'Todas as carteiras',
    gettingStarted: {
      title: 'Primeiros passos',
      description:
        'Esta carteira ainda não tem transações. Adicionar um ativo e registrar o que você comprou preenche esta página com o valor, o desempenho e a alocação dela.',
      complete:
        'Transação registrada. A visão geral agora mostra o valor, o desempenho e a alocação da carteira.',
      done: 'concluído',
      dismiss: 'Ocultar guia',
      portfolio: {
        title: 'Confira a carteira',
        description:
          '{name} mostra os valores em {currency}, a moeda-base, convertendo os ativos cotados em outras moedas. Você pode renomeá-la ou trocar a moeda na página Carteiras.',
        action: 'Gerenciar carteiras'
      },
      addAsset: {
        title: 'Adicione um ativo',
        description:
          'Busque pelo código de negociação, como PETR4 ou VOO, e escolha a listagem que você tem. Os resultados mostram o mercado e a moeda de cada listagem quando a fonte os informa.',
        action: 'Adicionar ativo'
      },
      recordTransaction: {
        title: 'Registre o que você comprou',
        description:
          'Informe a compra com data, quantidade e preço. Posições, custos e resultados são calculados a partir das transações registradas.',
        action: 'Registrar transação de {symbol}',
        recorded: 'Transação registrada',
        otherAssets: 'Outros ativos'
      },
      follow: {
        title: 'Acompanhe a carteira aqui',
        description:
          'Esta página passa a mostrar o valor a preços de mercado, a rentabilidade ao longo do tempo e como o dinheiro está alocado. O botão de informação de cada número explica como ele é calculado.'
      }
    },
    loading: 'Carregando sua carteira',
    loadFailed: 'Não foi possível carregar sua carteira',
    noPortfolioTitle: 'Nenhuma carteira ainda',
    noPortfolio:
      'Crie uma carteira para adicionar ativos e acompanhar o valor, o desempenho e a alocação.',
    createPortfolio: 'Criar uma carteira',
    value: {
      title: 'Valor da carteira',
      loadFailed: 'Não foi possível carregar o valor da carteira',
      loading: 'Carregando o valor da carteira',
      empty:
        'Nenhuma posição está aberta agora, então não há o que avaliar. O resultado das posições vendidas continua no desempenho.',
      pricesTip: 'Sobre estas cotações',
      pricesExplanation:
        'As cotações vêm de uma fonte de dados de mercado e podem ter atraso; não são em tempo real. O horário exibido é o da cotação ou do câmbio mais antigo usado no total.',
      definitions: {
        totalValue:
          'Quanto valem as unidades que você tem pelas cotações mais recentes, convertidas para {currency} pelo câmbio mais recente. Só aparece quando todas as posições têm cotação e câmbio.',
        dayChange:
          'Quanto o valor das unidades que você tem agora variou desde o fechamento anterior de cada ativo, pelo mesmo câmbio. Comprar ou vender hoje não conta como variação.',
        invested:
          'Quanto custaram as unidades que você tem: o custo médio, com taxas e impostos, convertido para {currency} pelo câmbio mais recente. Uma venda o reduz pelo custo das unidades vendidas.',
        profitLoss:
          'Valor total menos o investido: o resultado não realizado do que você ainda tem. Resultados de vendas e proventos registrados não entram nele. Os dois usam o câmbio mais recente, então ele não separa a variação do preço da variação do câmbio.'
      },
      marketData: {
        incomplete:
          'Só foi possível avaliar {valued, number} de {held, plural, one {# posição} other {# posições}} em {currency}, por isso os totais não podem ser calculados.',
        costUnconverted:
          'Todas as posições puderam ser avaliadas em {currency}, mas o investido e o lucro/prejuízo não podem ser calculados sem os câmbios abaixo.',
        missingQuotes: {
          unavailable:
            'A fonte de cotações não respondeu para <symbols></symbols>. Isso costuma ser temporário: atualize em alguns minutos.',
          'not-found':
            'A fonte de cotações não tem preço para <symbols></symbols>. Confira {count, plural, one {o código} other {os códigos}} na página do ativo.'
        },
        missingRates: {
          unavailable:
            'A fonte não respondeu para {count, plural, one {o câmbio} other {os câmbios}} de {currencies} para {currency}. Isso costuma ser temporário: atualize em alguns minutos.',
          'not-found':
            'A fonte não tem {count, plural, one {o câmbio} other {os câmbios}} de {currencies} para {currency}.'
        },
        fallback:
          'A fonte de cotações não respondeu, por isso alguns preços são os últimos recebidos.',
        stale: 'As cotações mais recentes têm mais de quatro dias.'
      }
    },
    positions: {
      title: 'Posições',
      loadFailed: 'Não foi possível carregar as posições',
      loading: 'Carregando as posições',
      empty:
        'Ainda não há ativos nesta carteira. Cada um que você adicionar aparece aqui com o valor, a participação na carteira e o resultado.',
      manage: 'Gerenciar ativos',
      table: 'Resumo das posições',
      caption: 'Posições avaliadas em {currency}',
      shareOfPortfolio: '<share></share> da carteira',
      pages: 'Páginas de posições'
    },
    recentTransactions: {
      title: 'Transações recentes',
      loadFailed: 'Não foi possível carregar as transações recentes',
      loading: 'Carregando as transações recentes',
      empty:
        'Ainda não há transações registradas. Registre a primeira em "Adicionar transação", na página do ativo; as compras, vendas e proventos aparecem aqui, das mais recentes às mais antigas.'
    },
    income: {
      title: 'Proventos registrados',
      loadFailed: 'Não foi possível carregar os proventos registrados',
      loading: 'Carregando os proventos registrados',
      empty:
        'Ainda não há proventos registrados. Registre dividendos, JCP e juros como transações do ativo que os pagou para acompanhá-los aqui.',
      trailingTotal: 'Últimos 12 meses',
      trailingExplanation:
        'Proventos com data a partir de {since}: a mesma janela dos proventos de 12 meses de cada ativo.',
      total: 'Desde o início',
      type: 'Tipo',
      table: 'Proventos registrados em {currency} por tipo',
      caption: 'Proventos em {currency} por tipo, líquidos de taxas e impostos',
      inCurrency: 'Em {name} ({currency})',
      note: '{currencyCount, plural, one {Líquidos de taxas e impostos, como registrados nas transações: o que foi pago, não uma projeção.} other {Líquidos de taxas e impostos, como registrados nas transações: o que foi pago, não uma projeção. Cada moeda aparece separada, sem conversão.}}'
    }
  },
  positions: {
    title: 'Posições',
    loading: 'Carregando as posições',
    loadFailed: 'Não foi possível carregar as posições',
    emptyTitle: 'Nenhum ativo nesta carteira',
    empty:
      'Adicione um para registrar as transações e acompanhar aqui o valor, o custo e o resultado.',
    addAsset: 'Adicionar ativo',
    noResults: 'Nenhuma posição corresponde à busca e aos filtros',
    emptyPage: 'Não há posições na página {page, number}',
    goToPage: 'Ir para a página {page, number}',
    filter: 'Filtrar posições',
    search: 'Buscar posições',
    searchPlaceholder: 'Buscar por ticker ou nome',
    type: 'Classe',
    allTypes: 'Todas as classes',
    status: 'Situação',
    allStatuses: 'Todas as posições',
    statuses: {
      open: 'Posições abertas',
      closed: 'Posições encerradas'
    },
    clear: 'Limpar',
    sort: 'Ordenar posições',
    sortBy: 'Ordenar por',
    descending: 'Ordem decrescente',
    sortFields: {
      symbol: 'Ticker',
      quantity: 'Quantidade',
      averageCost: 'Preço médio',
      marketPrice: 'Preço',
      marketValue: 'Valor',
      allocation: 'Alocação',
      profitLoss: 'Lucro/Prejuízo',
      profitLossPercent: 'Lucro/Prejuízo %'
    },
    columns: {
      symbol: 'Ativo',
      quantity: 'Qtd.',
      averageCost: 'Preço médio',
      marketPrice: 'Preço',
      marketValue: 'Valor',
      allocation: 'Alocação',
      profitLoss: 'Lucro/Prejuízo'
    },
    actions: 'Opções',
    table: 'Tabela de posições',
    caption:
      'Posições avaliadas em {currency}, ordenadas por {field} em ordem {order, select, asc {crescente} other {decrescente}}',
    averageCostOf: 'Preço médio <price></price>',
    held: '<quantity></quantity> em carteira',
    actionsFor: 'Opções de {symbol}',
    viewDetails: 'Ver detalhes',
    newTransaction: 'Nova transação',
    delete: 'Excluir',
    rowsPerPage: 'Linhas por página',
    pages: 'Páginas de posições',
    count:
      '{count, plural, =0 {nenhuma posição} one {# posição} other {# posições}}'
  },
  assets: {
    add: {
      title: 'Adicionar ativo',
      description:
        'Busque pelo ticker para adicionar qualquer instrumento listado, ou pelo nome entre os que você já acompanha.',
      search: 'Ticker ou nome',
      searchPlaceholder: 'PETR4, AAPL, BTC…',
      searchPattern:
        "A busca aceita apenas letras, algarismos, espaços e . & ' -",
      searching: 'Buscando…',
      found:
        '{count, plural, =0 {Nenhum instrumento encontrado} one {# instrumento encontrado} other {# instrumentos encontrados}}',
      noListing:
        'Nada está listado como “{search}”. Confira o ticker, como PETR4, AAPL ou BTC.',
      noTracked:
        'Nenhum instrumento que você acompanha corresponde a “{search}”. Para adicionar um novo, busque pelo ticker, como PETR4.',
      marketUnavailable:
        'Não foi possível buscar no mercado agora, então faltam instrumentos que você ainda não acompanha. <retry>Tentar novamente</retry>',
      results: 'Instrumentos encontrados',
      privateBadge: 'Privado',
      newBadge: 'Novo',
      newListingNote:
        'Instrumentos novos são adicionados com o nome, a classe e o setor que o mercado informa, e só você os vê.',
      choiceRequired: 'Escolha um dos instrumentos encontrados',
      alreadyHeld: '{symbol} já está nesta carteira',
      searchFailed: 'Não foi possível buscar os instrumentos',
      failed: 'Não foi possível adicionar o ativo',
      submit: 'Adicionar'
    },
    deletion: {
      title: 'Excluir {symbol}?',
      description:
        'Todas as transações de {symbol} em {portfolio} são excluídas junto, e isso não pode ser desfeito.',
      confirm: 'Excluir ativo',
      failed: 'Não foi possível excluir o ativo'
    },
    notifications: {
      added: 'Ativo adicionado',
      addedTo: '{symbol} agora está em {portfolio}',
      addTransaction: 'Adicionar transação',
      deleted: 'Ativo excluído'
    }
  },
  asset: {
    addTransaction: 'Adicionar transação',
    back: 'Voltar para os ativos',
    loading: 'Carregando este ativo',
    loadFailed: 'Não foi possível carregar este ativo',
    notHeld: '{symbol} não está na sua carteira',
    viewAssets: 'Ver seus ativos',
    market: {
      title: 'Mercado',
      price: 'Preço',
      dayChange: 'Variação do dia',
      previousClose: 'Fechamento anterior',
      priceAsOf: 'Cotação de <quoted>{time}</quoted>',
      type: 'Classe',
      market: 'Mercado',
      currency: 'Moeda',
      sector: 'Setor',
      historyLoadFailed: 'Não foi possível carregar o histórico de preços',
      historyLoading: 'Carregando o histórico de preços',
      priceChange: 'Variação do preço',
      yearRange: 'Intervalo de 52 semanas',
      yearLow: 'Mínima',
      yearHigh: 'Máxima',
      chartLabel: 'Fechamentos diários',
      closeOn: '{price} em {day}',
      closesBetween:
        'Fechamentos diários de {firstPrice} em {firstDay} a {lastPrice} em {lastDay}',
      changesSince:
        'Variações em relação ao último fechamento, <price></price>, de <closed>{day}</closed>'
    },
    position: {
      title: 'Posição',
      marketValue: 'Valor de mercado',
      unrealizedProfitLoss: 'Lucro/Prejuízo não realizado',
      quantity: 'Quantidade',
      averageCost: 'Preço médio',
      marketPrice: 'Preço de mercado',
      allocation: 'Alocação'
    },
    returns: {
      title: 'Resultados',
      loadFailed: 'Não foi possível carregar os resultados',
      loading: 'Carregando os resultados',
      empty: 'Os resultados começam com a primeira transação',
      realizedProfitLoss: 'Lucro/Prejuízo realizado',
      incomeReceived:
        '{kind, select, interest {Juros recebidos} other {Proventos recebidos}}',
      trailingIncome:
        '{kind, select, interest {Juros (12M)} other {Proventos (12M)}}',
      yieldOnCost: 'Rendimento sobre o custo (12M)',
      yieldOnCostExplanation:
        'Proventos recebidos nos últimos 12 meses divididos pelo custo da posição.',
      since: 'Primeira transação'
    },
    fundamentals: {
      title: 'Fundamentos',
      loadFailed: 'Não foi possível carregar os fundamentos',
      loading: 'Carregando os fundamentos',
      notApplicable:
        'Fundamentos de empresa não se aplicam à classe deste ativo',
      notFound: 'A fonte de dados de mercado não tem fundamentos deste ativo',
      unavailable:
        'Não foi possível acessar a fonte de dados de mercado para obter os fundamentos',
      notReported: 'Não informado',
      source:
        'Conforme informado por {source}; outras fontes podem calculá-los de outra forma. Só aparecem os indicadores que se aplicam à classe deste ativo.',
      metrics: {
        priceToEarnings: {
          label: 'P/L',
          explanation:
            'Preço dividido pelo lucro por ação dos últimos 12 meses: quanto o mercado paga por cada unidade de lucro anual. Um múltiplo menor pode indicar uma ação mais barata ou menor crescimento esperado, então compare dentro do mesmo setor. As fontes o omitem enquanto o lucro é negativo.'
        },
        dividendYield: {
          label: 'Dividend yield (12M)',
          explanation:
            'Dividendos ou distribuições pagos nos últimos 12 meses divididos pelo preço atual. Pagamentos passados não garantem pagamentos futuros.'
        },
        returnOnEquity: {
          label: 'ROE',
          explanation:
            'Lucro líquido dos últimos 12 meses dividido pelo patrimônio líquido: o lucro obtido sobre o capital dos acionistas. Quanto maior, melhor, a menos que uma dívida elevada o sustente.'
        },
        profitMargin: {
          label: 'Margem líquida',
          explanation:
            'Lucro líquido como parcela da receita dos últimos 12 meses: quanto de cada venda sobra como lucro. As margens variam muito entre setores.'
        },
        debtToEquity: {
          label: 'Dívida/Patrimônio',
          explanation:
            'Dívida total dividida pelo patrimônio líquido no último trimestre divulgado. Acima de 1× a empresa deve mais do que os acionistas aportaram; o nível prudente depende do setor.'
        },
        revenueGrowth: {
          label: 'Crescimento da receita',
          explanation:
            'Receita do último trimestre divulgado comparada à do mesmo trimestre do ano anterior.'
        },
        earningsGrowth: {
          label: 'Crescimento do lucro',
          explanation:
            'Lucro do último trimestre divulgado comparado ao do mesmo trimestre do ano anterior. Oscila muito quando o trimestre anterior lucrou pouco.'
        },
        freeCashFlow: {
          label: 'Fluxo de caixa livre (12M)',
          explanation:
            'Caixa gerado pelo negócio nos últimos 12 meses depois dos investimentos e dos juros, na moeda das demonstrações financeiras. Positivo significa que ele se financia sozinho.'
        }
      }
    },
    transactions: {
      title: 'Transações',
      loadFailed: 'Não foi possível carregar as transações',
      loading: 'Carregando as transações',
      empty:
        'Ainda não há transações deste ativo. Registre uma compra em "Adicionar transação" para abrir a posição; vendas e proventos são registrados da mesma forma.',
      emptyPage: 'Não há transações na página {page, number}',
      goToPage: 'Ir para a página {page, number}',
      pages: 'Páginas de transações'
    }
  },
  allocation: {
    title: 'Alocação',
    loadFailed: 'Não foi possível carregar a alocação',
    loading: 'Carregando a alocação',
    empty:
      'Nenhuma posição está aberta, então não há o que distribuir. A divisão por ativo, classe, setor e moeda aparece quando a carteira tiver um ativo.',
    groupBy: 'Agrupar alocação por',
    views: {
      type: 'Classe',
      asset: 'Ativo',
      sector: 'Setor',
      currency: 'Moeda'
    },
    captions: {
      type: 'Alocação por classe',
      asset: 'Alocação por ativo',
      sector: 'Alocação por setor',
      currency: 'Alocação por moeda'
    },
    noSector: 'Sem setor',
    noCurrency: 'Moeda desconhecida',
    concentration: {
      largest: 'A maior posição, {symbol}, é {share} da carteira.',
      largestAndTop:
        'A maior posição, {symbol}, é {share} da carteira; as {count, number} maiores somam {topShare}.'
    },
    unpriced:
      'As participações aparecem quando todas as posições têm preço; o valor da carteira mostra quais estão faltando.',
    unknownSector:
      'O setor é informado só para empresas, por isso ETFs, fundos, criptoativos e ativos parecidos não têm um.'
  },
  refresh: {
    done: 'Carteira recarregada',
    doneDescription:
      'Os preços são os últimos publicados pela fonte de dados de mercado, então podem não ter mudado.',
    degraded:
      'Carteira recarregada, mas os dados de mercado continuam incompletos ou desatualizados',
    degradedDescription:
      'O valor da carteira mostra o que falta e o que pode ser feito.',
    failed:
      'Parte da carteira não pôde ser recarregada. As seções afetadas mostram o que está desatualizado.'
  },
  performance: {
    title: 'Desempenho',
    loadFailed: 'Não foi possível carregar o desempenho',
    loading: 'Carregando o desempenho',
    emptyPeriod:
      'Nada a exibir neste período: nenhuma posição foi mantida nele, ou faltam os preços. Escolha outro período acima.',
    empty:
      'Ainda não há desempenho para exibir. A linha começa no primeiro dia em que um ativo mantido tem preço de mercado e câmbio, então fica vazia antes disso ou enquanto a fonte de preços não os tiver.',
    period: 'Período',
    ranges: {
      '1W': '1S',
      '1M': '1M',
      '3M': '3M',
      '6M': '6M',
      '1Y': '1A',
      YTD: 'No ano',
      MAX: 'Tudo'
    },
    periods: {
      '1W': 'na última semana',
      '1M': 'no último mês',
      '3M': 'nos últimos três meses',
      '6M': 'nos últimos seis meses',
      '1Y': 'no último ano',
      YTD: 'neste ano',
      MAX: 'desde a primeira transação'
    },
    metric: 'Visualização',
    metrics: {
      value: 'Valor',
      return: 'Rentabilidade'
    },
    compareWith: 'Comparar com',
    benchmarks: {
      none: 'Sem comparação',
      BOVA11: 'Ibovespa (BOVA11)',
      VOO: 'S&P 500 (VOO)'
    },
    portfolioSeries: 'Carteira',
    valueChart: 'Valor em cada pregão',
    returnChart: 'Rentabilidade em cada pregão',
    pointValue: '{day}: {value}, com {invested} investidos',
    pointReturn: '{day}: {return}',
    pointReturnAgainst: '{day}: {return}; {benchmark}: {benchmarkReturn}',
    investedOn: '{amount} investidos',
    noBenchmarkReturn: 'sem cotação',
    valueChangeTip: 'Sobre esta variação',
    valueChangeExplanation:
      'A variação do valor inclui o dinheiro que entrou e saiu da carteira. Para ver só o resultado dos investimentos, use a visualização de rentabilidade.',
    netContributionNote: 'Inclui {amount} em aportes líquidos',
    benchmarkCaveat:
      'A rentabilidade de {benchmark} considera só a variação do preço, convertida para {currency}, a partir do primeiro dia do período; proventos não entram.',
    benchmarkWithoutCloses:
      'Não é possível comparar com {benchmark} neste período: a fonte de dados de mercado não tem cotações ou câmbio para ele, ou não respondeu. Atualizar mais tarde pode resolver.',
    benchmarkNotFound:
      '{benchmark} não está disponível para comparação no momento.',
    gapsExplanation:
      'Um dia em que algum ativo da carteira não tem preço de fechamento ou câmbio, como um feriado em um dos mercados dele, fica de fora em vez de ser avaliado pela metade.',
    returnTip: 'Sobre esta rentabilidade',
    returnExplanation:
      'Rentabilidade ponderada pelo tempo: aportes e resgates não contam como ganho nem como perda, por isso ela pode diferir do lucro/prejuízo.',
    portfolioCaption:
      'Valor e rentabilidade da carteira em cada pregão {period}',
    assetCaption: 'Valor e rentabilidade de {symbol} em cada pregão {period}',
    showTable: 'Desempenho em tabela',
    table: 'Tabela de desempenho',
    columns: {
      day: 'Dia',
      value: 'Valor',
      invested: 'Investido',
      netContribution: 'Aporte líquido',
      return: 'Rentabilidade',
      benchmark: 'Rentabilidade de {symbol}'
    }
  }
} as const;
