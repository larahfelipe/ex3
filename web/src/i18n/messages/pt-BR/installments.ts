export default {
  title: 'Parcelamentos',
  description:
    'Compras parceladas: quanto falta em cada parcelamento e quando vence a próxima parcela',
  add: 'Adicionar parcelamento',
  plans: 'Parcelamentos',
  status: 'Situação',
  allStatuses: 'Todas as situações',
  loading: 'Carregando parcelamentos',
  loadFailed: 'Não foi possível carregar os parcelamentos',
  emptyTitle: 'Nenhum parcelamento ainda',
  empty:
    'Uma compra parcelada aparece aqui com o progresso, o que falta e o próximo vencimento, e as parcelas entram nas contas.',
  noResults:
    '{status, select, ACTIVE {Nenhum parcelamento ativo} COMPLETED {Nenhum parcelamento concluído} other {Nenhum parcelamento cancelado}}',
  emptyPage: 'Nenhum parcelamento na página {page, number}',
  goToPage: 'Ir para a página {page, number}',
  list: 'Parcelamentos',
  pages: 'Páginas de parcelamentos',
  count:
    '{count, plural, =0 {Nenhum parcelamento} one {# parcelamento} other {# parcelamentos}}',
  outstandingOf: 'em aberto de {total}',
  details: {
    title: 'Parcelamento',
    loadFailed: 'Não foi possível carregar este parcelamento',
    loading: 'Carregando o parcelamento',
    summary:
      '{count, plural, one {# parcela {frequency, select, WEEKLY {semanal} MONTHLY {mensal} other {anual}}} other {# parcelas {frequency, select, WEEKLY {semanais} MONTHLY {mensais} other {anuais}}}} em {currency}',
    total: 'Total',
    outstanding: 'Em aberto',
    settled: 'Quitado',
    nextInstallment: 'Próxima parcela',
    next: '{number, number} de {count, number}, <day></day>',
    cashPrice: 'Preço à vista',
    overCashPrice: 'Acima do preço à vista',
    financingNone: 'Nenhum',
    financingBelow: '{amount} abaixo do preço à vista',
    schedule: 'Período',
    scheduleRange: '<first></first> a <last></last>',
    category: 'Categoria',
    paymentMethod: 'Forma de pagamento',
    account: 'Conta bancária ou cartão',
    notes: 'Observações',
    installments: 'Parcelas',
    table: 'Tabela de parcelas',
    columns: {
      installment: 'Parcela',
      due: 'Vencimento',
      amount: 'Valor',
      status: 'Situação',
      actions: 'Ações'
    },
    history: 'Histórico',
    cancel: 'Cancelar parcelamento',
    reschedule: 'Reagendar'
  },
  installment: {
    position: '{number, number} de {count, number}',
    outstanding: '{amount} em aberto',
    pay: 'Pagar<hidden> a parcela {position}</hidden>',
    bill: 'Conta<hidden> da parcela {position}</hidden>'
  },
  cancellation: {
    title: 'Cancelar este parcelamento?',
    description:
      '{description}. As parcelas sem pagamento são canceladas e deixam de contar como devidas; uma parcela paga em parte continua em aberto. O parcelamento e o histórico são mantidos, e isso não pode ser desfeito.',
    confirm: 'Cancelar parcelamento',
    failed: 'Não foi possível cancelar o parcelamento'
  },
  deletion: {
    title: 'Excluir este parcelamento?',
    description:
      '{description}. O parcelamento e {count, plural, one {sua # parcela} other {suas # parcelas}} serão removidos com o histórico, e isso não pode ser desfeito. Para manter o registro, cancele-o.',
    confirm: 'Excluir parcelamento',
    failed: 'Não foi possível excluir o parcelamento'
  },
  form: {
    addTitle: 'Adicionar parcelamento',
    addDescription:
      'Cada parcela vira uma conta, que fica em aberto até você registrar o pagamento.',
    editTitle: 'Editar parcelamento',
    editDescription:
      'Valores em {currency}. Para mudar o que ainda está em aberto, reagende o parcelamento.',
    editNote:
      'A descrição vale para as parcelas em aberto, exceto as que você editou individualmente. As parcelas pagas mantêm a descrição delas.',
    scheduleSection: 'Valor e cronograma',
    amountMode: 'Valor informado como',
    amountModes: { total: 'Total', installment: 'Por parcela' },
    amounts: { total: 'Valor total', installment: 'Valor da parcela' },
    amountHints: {
      total:
        'Dividido igualmente; a primeira parcela fica com os centavos que sobram da divisão',
      installment: 'Cada parcela terá este valor'
    },
    cashPrice: 'Preço à vista',
    cashPriceHint: 'Quanto custaria pagar tudo de uma vez',
    cashPriceCompared: 'As parcelas somam {total}: {difference}',
    cashPriceSame: 'o mesmo valor',
    count: 'Parcelas',
    countHint: 'De 1 a {max, number}, uma {period}',
    frequency: 'Frequência',
    firstDueDate: 'Primeiro vencimento',
    submitAdd: 'Adicionar parcelamento',
    failed: 'Não foi possível salvar o parcelamento'
  },
  summary: {
    label: 'Resumo das parcelas',
    empty:
      'As parcelas, o total e as datas aparecem aqui quando o valor e o número de parcelas estiverem preenchidos.',
    installments: '{count, number} × {amount}',
    installmentsPerPeriod: '{count, number} × {amount}<muted> {period}</muted>',
    firstDiffers:
      'A primeira parcela é de {amount}, com os centavos que sobram da divisão',
    total: 'Total a pagar',
    dueOn: 'Vencimento',
    dueSpan: 'Primeiro e último vencimento',
    dueSpanValue: '{first} a {last}',
    comparedWithCashPrice: 'Em relação ao preço à vista',
    noDifference: 'Sem diferença',
    difference:
      '{amount} {direction, select, more {a mais} other {a menos}} ({percent})',
    notes: {
      lastDayOfMonth: 'Nos meses mais curtos, vence no último dia',
      february28: 'Fora dos anos bissextos, vence em 28 de fevereiro'
    }
  },
  reschedule: {
    title: 'Reagendar {description}',
    description:
      'Substitui o que falta pagar por novas parcelas {frequency, select, WEEKLY {semanais} MONTHLY {mensais} other {anuais}}. As parcelas pagas e o histórico são mantidos.',
    noneOwed:
      'Nenhuma parcela está em aberto: as novas serão tudo o que o parcelamento vai cobrar.',
    noPayments: 'Nenhuma parcela tem pagamento ainda, então {replaced}.',
    kept: '{number, plural, =1 {A parcela 1 tem pagamento e fica como está} other {As parcelas de 1 a # ficam como estão, até a última com pagamento}}',
    keptThenAdded: '{kept}; as novas parcelas entram depois.',
    keptThenReplaced: '{kept}. Depois, {replaced}.',
    replaced:
      '{count, plural, one {a parcela em aberto é substituída} other {as # parcelas em aberto são substituídas}}',
    amount: 'Valor restante',
    amountHint:
      'Dividido igualmente; a primeira nova parcela fica com os centavos que sobram da divisão',
    count: 'Parcelas',
    nextDueDate: 'Próximo vencimento',
    submit: 'Reagendar',
    failed: 'Não foi possível reagendar o parcelamento'
  },
  progress: {
    allPaid:
      '{count, plural, one {A única parcela foi paga} other {Todas as # parcelas pagas}}',
    cancelledOwing: 'Cancelado, {amount} ainda em aberto',
    cancelled: 'Cancelado',
    installments: '{count, plural, one {# parcela} other {# parcelas}}',
    next: 'Parcela {number, number} de {count, number}, <day></day>'
  }
} as const;
