export default {
  categories: {
    HOUSING: 'Moradia',
    UTILITIES: 'Contas de consumo',
    FOOD: 'Alimentação',
    TRANSPORTATION: 'Transporte',
    HEALTH: 'Saúde',
    EDUCATION: 'Educação',
    LEISURE: 'Lazer',
    SUBSCRIPTIONS: 'Assinaturas',
    INSURANCE: 'Seguros',
    TAXES: 'Impostos',
    DEBT: 'Dívidas',
    SHOPPING: 'Compras',
    PERSONAL_CARE: 'Cuidados pessoais',
    OTHER: 'Outros'
  },
  paymentMethods: {
    CASH: 'Dinheiro',
    DEBIT_CARD: 'Cartão de débito',
    CREDIT_CARD: 'Cartão de crédito',
    BANK_TRANSFER: 'Transferência bancária',
    PIX: 'Pix',
    BOLETO: 'Boleto',
    DIRECT_DEBIT: 'Débito automático',
    OTHER: 'Outra'
  },
  frequencies: {
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensal',
    YEARLY: 'Anual'
  },
  perPeriod: {
    WEEKLY: 'por semana',
    MONTHLY: 'por mês',
    YEARLY: 'por ano'
  },
  kinds: {
    ONE_TIME: 'Avulsa',
    INSTALLMENT: 'Parcelada',
    RECURRING: 'Recorrente'
  },
  statuses: {
    PENDING: 'Pendente',
    OVERDUE: 'Vencida',
    PAID: 'Paga',
    CANCELLED: 'Cancelada'
  },
  statusFilters: {
    OPEN: 'Em aberto',
    PENDING: 'Pendentes',
    OVERDUE: 'Vencidas',
    PAID: 'Pagas',
    CANCELLED: 'Canceladas'
  },
  planStatuses: {
    ACTIVE: 'Ativo',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado'
  },
  seriesStatuses: {
    ACTIVE: 'Ativa',
    ENDED: 'Encerrada',
    CANCELLED: 'Interrompida'
  },
  events: {
    CREATED: 'Criação',
    UPDATED: 'Edição',
    CANCELLED: 'Cancelamento',
    RESTORED: 'Restauração',
    PAYMENT_RECORDED: 'Pagamento registrado',
    PAYMENT_CORRECTED: 'Pagamento corrigido',
    PAYMENT_VOIDED: 'Pagamento estornado',
    RESCHEDULED: 'Reagendamento'
  },
  changedFields: {
    description: 'descrição',
    category: 'categoria',
    subcategory: 'subcategoria',
    paymentMethod: 'forma de pagamento',
    account: 'conta bancária ou cartão',
    notes: 'observações',
    amount: 'valor',
    dueDate: 'vencimento',
    effectiveFrom: 'início da vigência',
    entryDate: 'data da compra',
    principalAmount: 'preço à vista',
    isVariable: 'valor variável',
    endDate: 'data final',
    discount: 'desconto',
    fees: 'juros e multas',
    paidOn: 'data do pagamento',
    method: 'forma de pagamento'
  },
  display: {
    installmentsPaid: 'Parcelas pagas',
    progress: '{paid, number} de {count, number} pagas',
    installmentOf: 'Parcela {number, number} de {count, number}',
    dueIn:
      '{days, plural, =0 {Vence hoje} =1 {Vence amanhã} other {Vence em # dias}}',
    overdueBy: '{days, plural, =1 {Venceu ontem} other {Venceu há # dias}}'
  },
  history: {
    empty: 'Nenhuma alteração registrada',
    none: 'nenhum',
    yes: 'sim',
    no: 'não',
    change: '{field}: {from} → {to}',
    changesFrom: '{changes}, a partir de {day}',
    paid: '{amount} pago',
    paidOn: '{amount} pago em {day}',
    rescheduled:
      '{replaced, plural, =0 {Nenhuma parcela em aberto substituída} one {# parcela em aberto substituída} other {# parcelas em aberto substituídas}} por {scheduled, number}',
    stopped:
      'Interrompida a partir de {day}; {dropped, plural, =0 {nenhuma ocorrência não paga removida} one {# ocorrência não paga removida} other {# ocorrências não pagas removidas}}'
  },
  summary: {
    withPercent: '{amount} ({percent})',
    same: '{period, select, lastMonth {Igual ao mês passado} other {Mesmo valor que {period}}}',
    more: '{amount} a mais que {period, select, lastMonth {no mês passado} other {{period}}}',
    less: '{amount} a menos que {period, select, lastMonth {no mês passado} other {{period}}}'
  },
  charts: {
    table: 'Tabela: {title}',
    caption: '{title}, em {currency}',
    month: 'Mês',
    showTable: 'Mostrar tabela',
    hideTable: 'Ocultar tabela',
    column: '{month}: {values}',
    columnValue: '{label} {amount}',
    columnWithLink: '{description}. {link}'
  },
  navigation: {
    label: 'Seções de finanças',
    overview: 'Visão geral',
    bills: 'Contas',
    installments: 'Parcelamentos',
    recurring: 'Recorrentes',
    calendar: 'Calendário',
    reports: 'Relatórios'
  },
  form: {
    descriptionSection: 'Descrição',
    description: 'Descrição',
    category: 'Categoria',
    subcategory: 'Subcategoria',
    paymentSection: 'Pagamento',
    paymentMethod: 'Forma de pagamento',
    noPaymentMethod: 'Não informada',
    account: 'Conta bancária ou cartão',
    notes: 'Observações'
  },
  notifications: {
    billAdded: 'Conta adicionada',
    billUpdated: 'Conta atualizada',
    billCancelled: 'Conta cancelada',
    billRestored: 'Conta restaurada',
    billDeleted: 'Conta excluída',
    paymentRecorded: 'Pagamento registrado',
    paymentUpdated: 'Pagamento atualizado',
    paymentVoided: 'Pagamento estornado',
    planAdded: 'Parcelamento adicionado',
    planAddedDetail:
      '{description} em {count, plural, one {# parcela} other {# parcelas}}',
    planUpdated: 'Parcelamento atualizado',
    planRescheduled: 'Parcelamento reagendado',
    planCancelled: 'Parcelamento cancelado',
    planDeleted: 'Parcelamento excluído',
    seriesAdded: 'Despesa recorrente adicionada',
    seriesUpdated: 'Despesa recorrente atualizada',
    seriesStopped: 'Recorrência interrompida',
    seriesDeleted: 'Despesa recorrente excluída',
    remindersUpdated: 'Lembretes atualizados',
    remindersOff: 'Nenhuma conta é sinalizada',
    remindersOverdueOnly: 'Somente as contas vencidas são sinalizadas',
    remindersOnDueDay: 'As contas são sinalizadas no dia do vencimento',
    remindersLeadDays:
      'As contas são sinalizadas {days, plural, one {# dia} other {# dias}} antes do vencimento'
  }
} as const;
