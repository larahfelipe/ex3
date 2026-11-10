export default {
  description:
    'Traga o histórico da B3 ou de outra corretora para {name}. Nada é registrado antes de você revisar a prévia.',
  back: 'Voltar para ativos',
  open: 'Importar',
  file: {
    title: 'Arquivo',
    description:
      'Extratos da Área do Investidor da B3 ou o modelo do EX3, em XLSX ou CSV, até {size}.',
    choose: 'Escolher arquivo',
    change: 'Escolher outro arquivo',
    drop: 'Solte o arquivo aqui',
    reading: 'Lendo {name}',
    chosen: '{name} · {size}',
    unsupported: 'Escolha uma planilha XLSX ou um arquivo CSV.',
    tooLarge: 'O arquivo tem {size}, e o limite é {limit}.',
    empty: 'O arquivo está vazio.',
    readFailed: 'Não foi possível abrir o arquivo neste navegador.',
    previewFailed: 'Não foi possível montar a prévia da importação',
    privacy:
      'O arquivo é lido no servidor apenas para montar a prévia e não é guardado. Ao importar, o EX3 guarda as transações e, com cada uma, a linha do arquivo de onde ela veio, para você conferir a origem e desfazer a importação. Nenhuma senha de corretora ou da B3 é pedida.'
  },
  sources: {
    title: 'De onde vem o arquivo',
    b3: {
      title: 'Área do Investidor da B3',
      steps:
        'Entre em investidor.b3.com.br e abra Extratos. Movimentação traz negociações e proventos num só arquivo; Negociação traz só as negociações, na data do pregão. Filtre o período e baixe o arquivo em Excel. Depois, importe-o aqui como foi baixado, sem mudar as colunas.',
      costs:
        'Os extratos da B3 não trazem corretagem, emolumentos nem impostos da operação. Inclua-os depois em cada transação, a partir das notas de corretagem, ou importe-os pelo modelo do EX3.',
      coverage:
        'Entram compras, vendas, dividendos, JCP, rendimentos, bonificações e desdobramentos. Grupamentos, subscrições, leilões de frações, incorporações e operações de opções ou a termo ficam de fora e são registrados à mão.'
    },
    template: {
      title: 'Modelo do EX3, para qualquer corretora',
      columns:
        'Uma transação por linha, com as colunas Data, Tipo, Ativo, Quantidade e Preço e, se quiser, Taxas, Impostos, Moeda, Corretora e Observações.',
      values:
        'Tipos: Compra, Venda, Dividendo, JCP, Juros ou Bonificação. Datas como 05/01/2026 ou 2026-01-05. Num CSV separado por ponto e vírgula, números como 1.234,56; separado por vírgula, como 1234.56. Em proventos, o preço é o valor bruto por unidade, e os impostos, o que foi retido.',
      download: 'Baixar modelo em CSV'
    }
  },
  formats: {
    'b3-trades': 'Extrato de negociação da B3',
    'b3-income': 'Proventos recebidos da B3',
    'b3-movements': 'Extrato de movimentação da B3',
    'ex3-template': 'Modelo do EX3'
  },
  summary: {
    title: 'Prévia',
    recognized: 'Reconhecido como {formats}',
    ready: 'Prontas',
    toReview: 'Para revisar',
    alreadyImported: 'Já importadas',
    notImportable: 'Não importáveis',
    ignored: 'Ignoradas',
    selected: 'Selecionadas',
    replanning: 'Atualizando a prévia',
    replanFailed: 'Não foi possível atualizar a prévia',
    settlementDates:
      'O extrato de movimentação data cada negociação no dia da liquidação, em geral dois dias úteis após o pregão. Para ter a data do pregão, importe antes o extrato de negociação ou corrija as datas depois de importar.'
  },
  assets: {
    title: 'Efeito nas posições',
    description:
      'Como cada posição fica com as linhas selecionadas, comparada a hoje.',
    label: 'Efeito da importação em cada posição',
    caption: 'Ativos do arquivo e o efeito das linhas selecionadas',
    columns: {
      asset: 'Ativo',
      rows: 'Linhas',
      quantity: 'Quantidade',
      averageCost: 'Preço médio',
      investedValue: 'Valor investido',
      realizedProfitLoss: 'Resultado realizado',
      income: 'Proventos'
    },
    rows: '{selected, number} de {total, number}',
    was: 'antes <value></value>',
    resolutions: {
      held: 'Na carteira',
      tracked: 'Novo na carteira',
      listed: 'Novo ativo',
      unresolved: 'Não encontrado'
    },
    refusals: {
      oversold:
        'A linha {row} venderia mais unidades do que haveria em carteira em {date}. Inclua a compra anterior ou desmarque a venda.',
      oversoldUndated:
        'Uma venda selecionada excede as unidades em carteira. Inclua a compra anterior ou desmarque a venda.',
      'currency-mismatch':
        'As transações desta posição estão em outra moeda. Nenhuma linha deste ativo será importada.',
      'out-of-range':
        'A posição resultante excede o tamanho que o EX3 registra. Nenhuma linha deste ativo será importada.'
    },
    rowReference: '{sheet} · linha {row, number}',
    rowReferenceWithoutSheet: 'linha {row, number}'
  },
  rows: {
    title: 'Linhas do arquivo',
    description:
      'Marque o que entra. As prontas já vêm marcadas; possíveis duplicatas e linhas para revisar, só se você marcar.',
    label: 'Linhas do arquivo',
    caption: 'Linhas do arquivo, na ordem em que aparecem',
    pages: 'Páginas das linhas',
    filters: {
      label: 'Mostrar',
      all: 'Todas',
      selected: 'Selecionadas',
      attention: 'Precisam de atenção',
      skipped: 'Fora da importação'
    },
    empty: 'Nenhuma linha neste filtro.',
    columns: {
      select: 'Importar',
      row: 'Linha',
      date: 'Data',
      type: 'Tipo',
      asset: 'Ativo',
      quantity: 'Quantidade',
      unitPrice: 'Preço',
      costs: 'Custos',
      status: 'Situação'
    },
    selectAll: 'Selecionar todas as linhas importáveis deste filtro',
    selectRow: 'Importar a linha {row}',
    showOriginal: 'Ver a linha {row} como está no arquivo',
    hideOriginal: 'Ocultar a linha {row} como está no arquivo',
    original: 'Linha original',
    emptyCell: 'vazio',
    statuses: {
      ready: 'Pronta',
      review: 'Revisar',
      'possible-duplicate': 'Possível duplicata',
      duplicate: 'Já importada',
      unresolved: 'Ativo não encontrado',
      refused: 'Recusada',
      ignored: 'Ignorada',
      rejected: 'Inválida'
    },
    reasons: {
      settlement:
        'Compra ou venda que o extrato também traz como transferência de liquidação, a linha que é importada.',
      'custody-transfer': 'Transferência de custódia: a posição não muda.',
      lending: 'Empréstimo de ativos: a posição não muda.',
      'listed-elsewhere': 'O arquivo já traz esta transação em outra linha.',
      split:
        'Desdobramento: as unidades creditadas entram como bonificação sem custo. Confira a quantidade antes de incluir.',
      'transferred-income':
        'Provento marcado pela B3 como transferido: confira se ele não está também em outra linha.',
      'not-listed': 'O provedor de cotações não lista este ativo na B3.',
      'not-found': 'Nenhum ativo do EX3 tem este código.',
      'market-data-unavailable':
        'O provedor de cotações não respondeu. Tente de novo em instantes.',
      'too-many-new-assets':
        'O arquivo tem ativos novos demais para uma importação. Importe primeiro uma parte deles.',
      'currency-unknown': 'Informe a moeda na coluna Moeda.',
      'currency-mismatch': 'A moeda da linha não é a do ativo.',
      oversold: 'Venderia mais unidades do que haveria em carteira.',
      'out-of-range': 'A posição resultante excede o tamanho registrado.'
    },
    matched:
      'Já existe uma transação igual nesta data, ou no dia do pregão ou da liquidação da negociação. Marque só se for outra operação.',
    warnings: {
      'value-mismatch':
        'O valor total da linha difere de quantidade × preço; foi usado o preço.',
      'withholding-derived':
        'O imposto retido foi calculado a partir do valor líquido.',
      'unit-price-derived':
        'O valor por unidade foi calculado a partir do valor total.',
      'bonus-cost-unknown':
        'A B3 não informa o custo atribuído à bonificação; ela entra sem custo.',
      'split-as-bonus': 'Desdobramento registrado como bonificação sem custo.',
      'transferred-income': 'Provento transferido.',
      'broker-truncated': 'O nome da corretora foi encurtado.',
      'notes-truncated': 'As observações foram encurtadas.'
    },
    problems: {
      'missing-value': '{field}: em branco.',
      'invalid-date': '{field}: data inválida.',
      'ambiguous-date':
        '{field}: com cabeçalhos em inglês, escreva a data como 2026-01-05, já que 05/01/2026 pode começar pelo mês.',
      'future-date': '{field}: data no futuro.',
      'invalid-number': '{field}: número inválido.',
      'not-positive': '{field}: deve ser maior que zero.',
      'invalid-symbol': '{field}: código de negociação inválido.',
      'invalid-currency': '{field}: não é uma moeda ISO 4217.',
      'unsupported-type': 'O tipo da linha não é aceito.',
      'unsupported-market':
        'Só o mercado à vista é importado; opções, termo e futuros ficam de fora.',
      'unsupported-event':
        'Este evento não é importado. Registre-o à mão se ele mudar a posição.',
      'unsupported-product':
        'Este produto não é importado, como renda fixa ou Tesouro Direto.',
      'income-debit': 'Débito de provento não é importado.'
    },
    fields: {
      date: 'Data',
      type: 'Tipo',
      market: 'Mercado',
      symbol: 'Ativo',
      quantity: 'Quantidade',
      unitPrice: 'Preço',
      value: 'Valor',
      fees: 'Taxas',
      taxes: 'Impostos',
      currency: 'Moeda',
      unknown: 'Linha'
    }
  },
  confirm: {
    submit:
      '{count, plural, =0 {Nenhuma linha selecionada} one {Importar # transação} other {Importar # transações}}',
    pending: 'Atualizando a prévia',
    importing: 'Importando',
    failed: 'Não foi possível importar as transações',
    note: 'A importação é registrada de uma vez: ou todas as linhas selecionadas entram, ou nenhuma.'
  },
  result: {
    title: 'Importação concluída',
    description:
      '{count, plural, one {# transação registrada} other {# transações registradas}} de {file}.',
    positions:
      '{count, plural, =0 {Nenhuma posição nova.} one {# posição nova na carteira.} other {# posições novas na carteira.}}',
    costsReminder:
      'Os extratos da B3 não trazem custos: inclua corretagem e emolumentos nas transações, se quiser o preço médio exato.',
    viewAssets: 'Ver ativos',
    importAnother: 'Importar outro arquivo'
  },
  history: {
    title: 'Importações',
    description:
      'Cada importação pode ser desfeita: as transações dela são excluídas e as posições, recalculadas.',
    label: 'Importações desta carteira',
    caption: 'Importações desta carteira, da mais recente',
    pages: 'Páginas das importações',
    loading: 'Carregando as importações',
    loadFailed: 'Não foi possível carregar as importações',
    empty: 'Nenhuma importação nesta carteira ainda.',
    emptyPage: 'A página {page, number} não tem importações.',
    goToPage: 'Ir para a página {page, number}',
    columns: {
      date: 'Data',
      file: 'Arquivo',
      transactions: 'Transações',
      status: 'Situação'
    },
    transactions: '{imported, number} de {rows, number} linhas',
    active: 'Ativa',
    undone: 'Desfeita em {date}',
    undo: 'Desfazer<hidden> a importação de {file}</hidden>',
    undoDialog: {
      title: 'Desfazer a importação de {file}?',
      description:
        '{count, plural, =0 {Nenhuma transação desta importação continua registrada} one {A transação registrada por esta importação será excluída} other {As # transações registradas por esta importação serão excluídas}}. As posições são recalculadas, e uma posição aberta por ela que ficar vazia é encerrada. O registro continua neste histórico.',
      confirm: 'Desfazer importação',
      cancel: 'Manter',
      failed: 'Não foi possível desfazer a importação'
    }
  },
  notifications: {
    imported:
      '{count, plural, one {# transação importada} other {# transações importadas}}',
    undone: 'Importação desfeita'
  }
} as const;
