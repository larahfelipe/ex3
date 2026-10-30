export default {
  title: 'Finanças',
  headerDescription: '{month} · Valores em {currency}',
  add: 'Adicionar conta',
  loading: 'Carregando suas finanças',
  loadFailed: 'Não foi possível carregar suas finanças',
  emptyAllTitle: 'Suas finanças começam aqui',
  emptyAll:
    'Adicione uma conta, uma compra parcelada ou uma despesa recorrente para ver aqui o que está em aberto e o que vence.',
  emptyCurrency: 'Nenhuma conta em {currency}',
  metrics: {
    outstanding: 'Total em aberto',
    nothingOwed: 'Nada em aberto',
    outstandingDetail:
      '{count, plural, one {# conta} other {# contas}}, de qualquer vencimento; as recorrentes até este mês',
    owedThisMonth: 'Em aberto neste mês',
    bills: '{count, plural, =0 {Nenhuma conta} one {# conta} other {# contas}}',
    overdue: 'Vencido',
    nothingOverdue: 'Nada vencido',
    overdueDetail:
      '{count, plural, one {# conta vencida} other {# contas vencidas}}, de qualquer mês',
    paidThisMonth: 'Pago neste mês',
    plannedThisMonth: 'Previsto para este mês'
  },
  upcoming: {
    title: 'Próximas contas',
    allPending: 'Todas as pendentes',
    empty: 'Nada pendente em {currency}'
  },
  trend: {
    title: 'Previsto e pago',
    description:
      '{count, plural, one {O último mês} other {Os últimos # meses}}, em {currency}. O previsto é o que venceu; o pago é o dinheiro que saiu, pela data do pagamento.',
    chartTitle: 'Previsto e pago por mês',
    planned: 'Previsto',
    paid: 'Pago',
    link: 'Abre as contas que vencem nesse mês'
  },
  commitments: {
    title: 'Próximos meses',
    description:
      'O que vence a partir de {month}, por tipo. Nos meses com despesas recorrentes aparecem só as ocorrências já geradas.',
    chartTitle: 'Compromissos por mês',
    oneTime: 'Avulsas',
    installments: 'Parcelamentos',
    recurring: 'Recorrentes'
  },
  categories: {
    title: 'Por categoria',
    description: 'Previsto para {month}, em {currency}',
    empty: 'Nada previsto para este mês',
    paid: 'Pago: {amount}'
  },
  installments: {
    title: 'Parcelamentos',
    link: 'Ver parcelamentos',
    none: 'Nenhum parcelamento ativo',
    detail:
      'Falta pagar em {plans, plural, one {# parcelamento ativo} other {# parcelamentos ativos}}, em {installments, plural, one {# parcela} other {# parcelas}}'
  },
  recurring: {
    title: 'Recorrentes',
    link: 'Ver recorrências',
    none: 'Nenhuma recorrência ativa',
    detail:
      'Por mês, somando {count, plural, one {# recorrência ativa} other {# recorrências ativas}}'
  },
  reminders: {
    title: 'Lembretes',
    change: 'Alterar',
    off: 'Desativados',
    overdueOnly: 'Somente contas vencidas',
    onDueDay: 'No dia do vencimento',
    leadDays: '{days, plural, one {# dia} other {# dias}} antes do vencimento',
    nothingFlagged: 'Nada é sinalizado nesta página nem na navegação.',
    flagged: '{items} são sinalizadas nesta página e na navegação.',
    noExternal: 'Nenhum e-mail ou notificação push é enviado.',
    items: {
      overdue: 'contas vencidas',
      bills: 'contas que vencem em breve',
      installments: 'parcelas que vencem em breve'
    },
    settings: {
      description:
        'Escolha o que é sinalizado na visão geral e na navegação, e com quantos dias de antecedência. Os lembretes aparecem apenas no aplicativo.',
      remindOf: 'Lembrar de',
      switches: {
        remindOverdue: 'Contas vencidas',
        remindUpcomingBills: 'Contas que vencem em breve',
        remindUpcomingInstallments: 'Parcelas que vencem em breve'
      },
      leadDays: 'Dias antes do vencimento',
      leadDaysHint:
        'Para contas e parcelas que vencem em breve. Com 0, elas são sinalizadas no dia do vencimento; no máximo {max, number}',
      submit: 'Salvar lembretes',
      failed: 'Não foi possível salvar os lembretes'
    }
  }
} as const;
