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
    loading: 'Carregando sua carteira',
    loadFailed: 'Não foi possível carregar sua carteira',
    noPortfolio: 'Nenhuma carteira encontrada nesta conta',
    createPortfolio: 'Criar uma carteira',
    value: {
      title: 'Valor da carteira',
      loadFailed: 'Não foi possível carregar o valor da carteira',
      loading: 'Carregando o valor da carteira',
      empty: 'Ainda não há posições para avaliar'
    },
    positions: {
      title: 'Posições',
      loadFailed: 'Não foi possível carregar as posições',
      loading: 'Carregando as posições',
      empty: 'Ainda não há posições',
      manage: 'Gerenciar ativos',
      table: 'Resumo das posições',
      caption: 'Posições avaliadas em {currency}',
      pages: 'Páginas de posições'
    },
    recentTransactions: {
      title: 'Transações recentes',
      loadFailed: 'Não foi possível carregar as transações recentes',
      loading: 'Carregando as transações recentes',
      empty: 'Ainda não há transações'
    }
  },
  positions: {
    title: 'Posições',
    loading: 'Carregando as posições',
    loadFailed: 'Não foi possível carregar as posições',
    empty: 'Ainda não há posições',
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
      empty: 'Ainda não há transações deste ativo',
      emptyPage: 'Não há transações na página {page, number}',
      goToPage: 'Ir para a página {page, number}',
      pages: 'Páginas de transações'
    }
  },
  allocation: {
    title: 'Alocação',
    loadFailed: 'Não foi possível carregar a alocação',
    loading: 'Carregando a alocação',
    empty: 'Não há alocação para exibir',
    groupBy: 'Agrupar alocação por',
    views: {
      type: 'Classe',
      asset: 'Ativo'
    },
    captions: {
      type: 'Alocação por classe',
      asset: 'Alocação por ativo'
    }
  },
  performance: {
    title: 'Desempenho',
    loadFailed: 'Não foi possível carregar o desempenho',
    loading: 'Carregando o desempenho',
    emptyPeriod: 'Não há desempenho para exibir neste período',
    empty: 'Ainda não há desempenho para exibir',
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
      return: 'Rentabilidade'
    }
  }
} as const;
