export default {
  title: 'Contas',
  description:
    'Tudo o que você deve, pagou ou cancelou: contas avulsas, parcelas e despesas recorrentes',
  add: 'Adicionar conta',
  allBills: 'Todas as contas',
  filter: 'Filtrar contas',
  search: 'Buscar',
  searchPlaceholder: 'Buscar por descrição, observações ou conta bancária',
  loading: 'Carregando contas',
  loadFailed: 'Não foi possível carregar as contas',
  emptyTitle: 'Nenhuma conta ainda',
  empty:
    'Adicione aqui uma conta avulsa. Parcelamentos e despesas recorrentes geram as próprias contas.',
  noResults: 'Nenhuma conta corresponde à busca e aos filtros',
  emptyPage: 'Nenhuma conta na página {page, number}',
  goToPage: 'Ir para a página {page, number}',
  table: 'Tabela de contas',
  caption:
    'Contas ordenadas por {field}, em ordem {order, select, asc {crescente} other {decrescente}}',
  columns: {
    bill: 'Conta',
    due: 'Vencimento',
    amount: 'Valor',
    status: 'Situação',
    actions: 'Ações'
  },
  pages: 'Páginas de contas',
  count: '{total, plural, =0 {Nenhuma conta} one {# conta} other {# contas}}',
  range:
    '{first, number}–{last, number} de {total, plural, one {# conta} other {# contas}}',
  dueOn: 'Vence em <day></day>',
  meta: '{origin} · {category}',
  outstanding: '{amount} em aberto',
  pay: 'Pagar',
  payBill: 'Pagar {description}',
  sort: {
    label: 'Ordenar contas',
    by: 'Ordenar por',
    descending: 'Ordem decrescente',
    fields: {
      dueDate: 'Vencimento',
      amount: 'Valor',
      description: 'Descrição',
      createdAt: 'Data de cadastro'
    }
  },
  filters: {
    status: 'Situação',
    allStatuses: 'Todas as situações',
    more: 'Mais filtros',
    activeCount:
      '{count, number}<hidden> {count, plural, one {ativo} other {ativos}}</hidden>',
    kind: 'Tipo',
    allKinds: 'Todos os tipos',
    category: 'Categoria',
    allCategories: 'Todas as categorias',
    dueFrom: 'Vencimento a partir de',
    dueTo: 'Vencimento até',
    minAmount: 'Valor mínimo',
    maxAmount: 'Valor máximo',
    anyAmount: 'Qualquer',
    minAboveMax: 'O mínimo passa do máximo de {amount}',
    maxBelowMin: 'O máximo fica abaixo do mínimo de {amount}',
    clearDay: 'Limpar: {label}',
    inForce: 'Filtros aplicados',
    remove: ', remover este filtro',
    chips: {
      status: 'Situação: {value}',
      kind: 'Tipo: {value}',
      category: 'Categoria: {value}',
      currency: 'Somente {currency}',
      dueFrom: 'Vencimento a partir de {day}',
      dueTo: 'Vencimento até {day}',
      minAmount: 'A partir de {amount}',
      maxAmount: 'Até {amount}'
    }
  },
  form: {
    addTitle: 'Adicionar conta',
    editTitle: 'Editar conta',
    addDescription: 'Uma conta fica em aberto até você registrar o pagamento.',
    editDescription: 'Valores em {currency}.',
    amountSection: 'Valor e vencimento',
    amount: 'Valor',
    dueDate: 'Vencimento',
    submitAdd: 'Adicionar conta',
    failed: 'Não foi possível salvar a conta',
    originHints: {
      INSTALLMENT:
        'As alterações valem apenas para esta parcela. Para mudar o que falta do parcelamento, reagende-o na página de parcelamentos.',
      RECURRING:
        'As alterações valem apenas para esta ocorrência, e edições posteriores na despesa recorrente não a afetam.'
    }
  },
  paymentForm: {
    payTitle: 'Pagar {description}',
    correctTitle: 'Corrigir pagamento de {description}',
    description:
      '{outstanding} em aberto de {amount}. Um pagamento parcial deixa o restante em aberto.',
    section: 'Pagamento',
    amount: 'Valor pago',
    paidOn: 'Data do pagamento',
    paidOnHint: 'O dia em que o dinheiro saiu, no máximo hoje',
    discount: 'Desconto',
    discountHint: 'Quita parte da conta sem ser pago',
    fees: 'Juros e multas',
    feesHint: 'Pagos à parte: nunca quitam a conta',
    detailsSection: 'Detalhes',
    addDetails: 'Adicionar forma de pagamento ou observações',
    method: 'Forma de pagamento',
    notes: 'Observações',
    settlesInFull: 'Quita a conta inteira',
    leaves: 'Deixa {amount} em aberto',
    settlesMore: 'Quita mais do que a conta ainda deve',
    submitRecord: 'Registrar pagamento',
    submitCorrect: 'Salvar correção',
    failed: 'Não foi possível salvar o pagamento',
    issues: {
      empty: 'Informe o valor pago, um desconto ou ambos',
      exceeds:
        'O valor pago e o desconto quitam mais do que a conta ainda deve',
      future: 'A data do pagamento não pode estar no futuro'
    }
  },
  details: {
    title: 'Conta',
    loadFailed: 'Não foi possível carregar esta conta',
    loading: 'Carregando a conta',
    viewPlan: 'Ver parcelamento',
    viewSeries: 'Ver despesa recorrente',
    amount: 'Valor',
    outstanding: 'Em aberto',
    settled: 'Quitado',
    dueDate: 'Vencimento',
    paidInFullOn: 'Quitada em',
    category: 'Categoria',
    paymentMethod: 'Forma de pagamento',
    account: 'Conta bancária ou cartão',
    notes: 'Observações',
    payments: 'Pagamentos',
    noPayments: 'Nenhum pagamento registrado ainda',
    history: 'Histórico',
    cancel: 'Cancelar conta',
    restore: 'Restaurar conta',
    restoreFailed: 'Não foi possível restaurar a conta',
    recordPayment: 'Registrar pagamento'
  },
  payment: {
    paidOn: '<money></money><muted> em <day></day></muted>',
    voided: 'Estornado',
    discount: 'Desconto de {amount}',
    fees: 'Juros e multas de {amount}',
    noDetails: 'Sem detalhes',
    correct: 'Corrigir<hidden> o pagamento de {day}</hidden>',
    void: 'Estornar<hidden> o pagamento de {day}</hidden>'
  },
  voiding: {
    title: 'Estornar este pagamento?',
    description:
      '{amount} pago em {day}. O pagamento continua no histórico como estornado, e a conta volta a dever o valor que ele quitou.',
    confirm: 'Estornar pagamento',
    failed: 'Não foi possível estornar o pagamento'
  },
  cancellation: {
    title: 'Cancelar esta conta?',
    description:
      '{description}, com vencimento em {day}. Ela deixa de contar como devida e continua no histórico; você pode restaurá-la depois.',
    confirm: 'Cancelar conta',
    failed: 'Não foi possível cancelar a conta'
  },
  deletion: {
    title: 'Excluir esta conta?',
    description:
      '{description}, com vencimento em {day}. Ela será removida com o histórico, e isso não pode ser desfeito. Para manter o registro, cancele-a.',
    confirm: 'Excluir conta',
    failed: 'Não foi possível excluir a conta'
  },
  alerts: {
    overdue: '{count, plural, one {# conta vencida} other {# contas vencidas}}',
    dueSoon:
      '{count, plural, one {# conta vence} other {# contas vencem}} {days, plural, =0 {hoje} one {em até # dia} other {em até # dias}}'
  }
} as const;
