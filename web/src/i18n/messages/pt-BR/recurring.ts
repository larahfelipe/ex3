export default {
  title: 'Recorrentes',
  description:
    'Despesas que se repetem toda semana, todo mês ou todo ano, e as contas que cada uma gera com antecedência',
  add: 'Adicionar despesa recorrente',
  list: 'Despesas recorrentes',
  status: 'Situação',
  allStatuses: 'Todas as situações',
  loading: 'Carregando despesas recorrentes',
  loadFailed: 'Não foi possível carregar as despesas recorrentes',
  emptyTitle: 'Nenhuma despesa recorrente ainda',
  empty:
    'Uma despesa que se repete, como aluguel ou assinatura, aparece aqui e gera cada conta no prazo.',
  noResults:
    '{status, select, ACTIVE {Nenhuma despesa recorrente ativa} ENDED {Nenhuma despesa recorrente encerrada} other {Nenhuma despesa recorrente interrompida}}',
  emptyPage: 'Nenhuma despesa recorrente na página {page, number}',
  goToPage: 'Ir para a página {page, number}',
  pages: 'Páginas de despesas recorrentes',
  count:
    '{count, plural, =0 {Nenhuma despesa recorrente} one {# despesa recorrente} other {# despesas recorrentes}}',
  row: {
    meta: '{category} · {frequency}',
    noMoreBills: 'Nenhuma conta futura',
    ended: 'Encerrada em <day></day>',
    noBillAhead: 'Nenhuma conta prevista',
    next: 'Próxima em <day></day>',
    nextWithDistance: 'Próxima em <day></day> · {distance}',
    amount: '<money></money><muted> {period}</muted>',
    estimatedAmount:
      '<muted>cerca de </muted><money></money><muted> {period}</muted>',
    monthlyEquivalent: 'cerca de {amount} por mês'
  },
  details: {
    title: 'Despesa recorrente',
    loadFailed: 'Não foi possível carregar esta despesa recorrente',
    loading: 'Carregando a despesa recorrente',
    summary: '{frequency} em {currency}',
    amount: 'Valor {period}',
    estimate: 'Estimativa {period}',
    monthly: 'Equivalente mensal',
    nextBill: 'Próxima conta',
    schedule: 'Período',
    scheduleOpen: 'A partir de <start></start>, sem data final',
    scheduleRange: 'De <start></start> a <end></end>',
    category: 'Categoria',
    paymentMethod: 'Forma de pagamento',
    account: 'Conta bancária ou cartão',
    notes: 'Observações',
    history: 'Histórico',
    stop: 'Interromper recorrência'
  },
  occurrences: {
    title: 'Contas',
    view: 'Mostrar contas',
    views: { upcoming: 'Próximas', earlier: 'Anteriores' },
    empty: {
      upcoming: 'Nenhuma conta futura',
      earlier: 'Nenhuma conta anterior'
    },
    loading: 'Carregando as contas',
    loadFailed: 'Não foi possível carregar as contas',
    table:
      '{view, select, upcoming {Próximas contas} other {Contas anteriores}}',
    pages:
      '{view, select, upcoming {Páginas das próximas contas} other {Páginas das contas anteriores}}',
    count: '{count, plural, =0 {Nenhuma conta} one {# conta} other {# contas}}',
    columns: {
      due: 'Vencimento',
      amount: 'Valor',
      status: 'Situação',
      actions: 'Ações'
    },
    customized: 'Editada individualmente',
    outstanding: '{amount} em aberto',
    pay: 'Pagar<hidden> a conta com vencimento em {day}</hidden>',
    bill: 'Conta<hidden> com vencimento em {day}</hidden>'
  },
  deletion: {
    title: 'Excluir esta despesa recorrente?',
    description:
      '{description}. A recorrência e as contas dela serão removidas com o histórico, e isso não pode ser desfeito. Uma recorrência com pagamentos não pode ser excluída: interrompa-a para manter o registro.',
    confirm: 'Excluir recorrência',
    failed: 'Não foi possível excluir a despesa recorrente'
  },
  form: {
    addTitle: 'Adicionar despesa recorrente',
    addDescription:
      'Cada ocorrência vira uma conta, que fica em aberto até você registrar o pagamento. As contas são geradas com até {months, plural, one {# mês} other {# meses}} de antecedência.',
    editTitle: 'Editar despesa recorrente',
    editDescription:
      '{frequency} a partir de {day}, em {currency}. Para mudar a frequência ou o início, interrompa esta recorrência e adicione uma nova.',
    editNote:
      'As alterações valem para as contas com vencimento a partir da data abaixo que não têm pagamento e não foram editadas individualmente. As contas anteriores mantêm os valores.',
    scheduleSection: 'Valor e cronograma',
    amount: 'Valor',
    amountKind: 'Tipo de valor',
    amountKinds: { fixed: 'Fixo', variable: 'Variável' },
    amountKindHints: {
      fixed: 'Todas as contas terão este valor',
      variable: 'Uma estimativa: corrija cada conta quando souber o valor'
    },
    frequency: 'Frequência',
    frequencyHint:
      'A frequência e a data de início não podem mudar depois que a recorrência é criada',
    startDate: 'Primeiro vencimento',
    startDateHint:
      'Nos últimos {months, plural, one {# mês} other {# meses}} ou depois',
    ends: 'Término',
    endModes: { never: 'Sem data final', date: 'Em uma data' },
    endDate: 'Data final',
    endDateHint: 'A última conta vence nesta data ou antes',
    effectiveFrom: 'Aplicar a partir de',
    submitAdd: 'Adicionar despesa recorrente',
    failed: 'Não foi possível salvar a despesa recorrente'
  },
  preview: {
    empty:
      'As primeiras contas aparecem aqui quando a data de início estiver preenchida.',
    first:
      '{count, plural, one {A primeira conta vence em {days}} other {As primeiras contas vencem em {days}}}',
    then: 'Depois, uma {period}, sem data final',
    thenUntil: 'Depois, uma {period}, até {day}'
  },
  stop: {
    title: 'Interromper {description}?',
    description:
      'A partir da data abaixo, as contas sem pagamento são removidas. As contas anteriores e as pagas em parte continuam em aberto. A recorrência e o histórico são mantidos, e uma recorrência interrompida não pode ser retomada.',
    effectiveFrom: 'Interromper a partir de',
    keep: 'Manter',
    submit: 'Interromper recorrência',
    failed: 'Não foi possível interromper a despesa recorrente'
  }
} as const;
