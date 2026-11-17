export default {
  categories: {
    HOUSING: 'Moradia',
    UTILITIES: 'Contas de consumo',
    SUBSCRIPTIONS: 'Assinaturas',
    FOOD: 'Alimentação',
    TRANSPORTATION: 'Transporte',
    HEALTH: 'Saúde e bem-estar',
    EDUCATION: 'Educação',
    LEISURE: 'Lazer',
    SHOPPING: 'Compras',
    FINANCIAL: 'Financeiro',
    OTHER: 'Outros'
  },
  categoryExamples: {
    HOUSING: 'Aluguel, condomínio, IPTU, reformas e reparos',
    UTILITIES: 'Luz, água, gás, internet, celular',
    SUBSCRIPTIONS: 'Streaming, aplicativos, software, clubes de assinatura',
    FOOD: 'Mercado, restaurantes, delivery',
    TRANSPORTATION:
      'Combustível, IPVA, seguro do carro, estacionamento, transporte público',
    HEALTH: 'Plano de saúde, farmácia, consultas, academia, cuidados pessoais',
    EDUCATION: 'Escola, faculdade, cursos, livros, material escolar',
    LEISURE: 'Viagens, passeios, eventos, hobbies',
    SHOPPING: 'Roupas, eletrônicos, itens para a casa, presentes',
    FINANCIAL:
      'Empréstimos, fatura do cartão, impostos, seguros, tarifas bancárias',
    OTHER: 'O que não se encaixa nas demais'
  },
  retiredCategories: {
    INSURANCE: 'Seguros',
    TAXES: 'Impostos',
    DEBT: 'Dívidas',
    PERSONAL_CARE: 'Cuidados pessoais'
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
  cardBrands: {
    VISA: 'Visa',
    MASTERCARD: 'Mastercard'
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
    method: 'forma de pagamento',
    originalDueDate: 'vencimento da conta',
    creditCard: 'cartão'
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
    card: '{name} final {lastFour}',
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
    description: 'Descrição',
    descriptionPlaceholder: 'Ex.: conta de luz',
    category: 'Categoria',
    moreDetailsSection: 'Mais detalhes',
    addMoreDetails: 'Mais detalhes',
    moreDetailsHint: 'Subcategoria, forma de pagamento, conta e observações',
    moreDetailsHintWithCard:
      'Subcategoria, forma de pagamento e cartão, conta e observações',
    subcategory: 'Subcategoria',
    paymentMethod: 'Forma de pagamento',
    noPaymentMethod: 'Não informada',
    account: 'Conta bancária ou cartão',
    notes: 'Observações',
    card: 'Cartão',
    noCard: 'Nenhum cartão específico',
    newCard: 'Novo cartão',
    cardHint: 'Escolha um para que a conta vença com a fatura',
    cardHintInstallments: 'Escolha um para que as parcelas vençam com a fatura',
    cardSetByPlan:
      'Definido no parcelamento: para trocar, edite o parcelamento.',
    billDueDate: 'Vencimento da conta'
  },
  cardPreview: {
    due: 'Pagamento no cartão em {day}',
    statement:
      'Na fatura que fecha em {closing}. A conta mantém o próprio vencimento, {bill}.',
    firstDue: 'Primeiro pagamento no cartão em {day}',
    each: 'Cada conta vence com a fatura em que cai, que fecha no dia {closingDay, number} e vence no dia {dueDay, number}.',
    eachInstallment:
      'Cada parcela vence com a fatura em que cai, que fecha no dia {closingDay, number} e vence no dia {dueDay, number}.'
  },
  cards: {
    digits: '<mask>•••• </mask><hidden>final </hidden>{lastFour}',
    removed: 'Excluído',
    cycle: 'Fecha no dia {closingDay, number} · vence no dia {dueDay, number}',
    openBills:
      '{count, plural, =0 {Nenhuma conta em aberto} one {# conta em aberto} other {# contas em aberto}}',
    manage: {
      title: 'Cartões de crédito',
      description:
        'As contas lançadas em um cartão vencem na data de pagamento da fatura em que caem.',
      empty:
        'Nenhum cartão ainda. Adicione um para escolhê-lo nas suas contas.',
      add: 'Adicionar cartão',
      editNamed: 'Editar {name}',
      deleteNamed: 'Excluir {name}',
      loading: 'Carregando os cartões',
      loadFailed: 'Não foi possível carregar os cartões'
    },
    form: {
      addTitle: 'Adicionar cartão',
      editTitle: 'Editar cartão',
      description:
        'As contas lançadas nele vencem na data de pagamento da fatura.',
      privacy:
        'Nunca informe o número completo do cartão, o código de segurança nem a validade: os quatro últimos dígitos bastam para diferenciar seus cartões.',
      name: 'Nome',
      namePlaceholder: 'Ex.: Nubank',
      lastFourDigits: 'Últimos quatro dígitos',
      brand: 'Bandeira',
      closingDay: 'Dia de fechamento',
      closingDayHint: 'Compras a partir deste dia entram na fatura seguinte',
      dueDay: 'Dia de vencimento',
      dueDayHint: 'O dia em que cada fatura é paga',
      followsNewDays:
        '{count, plural, one {A conta em aberto neste cartão seguirá os novos dias.} other {As # contas em aberto neste cartão seguirão os novos dias.}} Contas com pagamentos mantêm suas datas.',
      submitAdd: 'Adicionar cartão',
      failed: 'Não foi possível salvar o cartão'
    },
    delete: {
      title: 'Excluir {name}?',
      description:
        'As contas e despesas recorrentes lançadas nele mantêm suas datas e mostram o cartão como excluído. Ele não poderá mais ser escolhido para uma conta.',
      confirm: 'Excluir cartão',
      failed: 'Não foi possível excluir o cartão'
    }
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
      'As contas são sinalizadas {days, plural, one {# dia} other {# dias}} antes do vencimento',
    cardAdded: 'Cartão adicionado',
    cardUpdated: 'Cartão atualizado',
    cardBillsMoved:
      '{count, plural, one {# conta em aberto passou para a nova data de pagamento} other {# contas em aberto passaram para as novas datas de pagamento}}',
    cardDeleted: 'Cartão excluído'
  }
} as const;
