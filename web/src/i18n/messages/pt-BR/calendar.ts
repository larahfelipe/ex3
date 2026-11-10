export default {
  title: 'Calendário',
  description:
    'Contas pelo dia de vencimento: o que está vencido, a vencer e pago em cada dia do mês',
  months: 'Meses',
  thisMonth: 'Este mês',
  previousMonth: 'Mês anterior',
  nextMonth: 'Próximo mês',
  loading: 'Carregando o calendário',
  loadFailed: 'Não foi possível carregar o calendário',
  caption: 'Contas com vencimento em {month}',
  nothingDueInMonth: 'Nada vence em {month}.',
  chooseDay: 'Escolha um dia para ver as contas que vencem nele.',
  legend: {
    overdue: 'Vencidas',
    due: 'A vencer',
    paid: 'Pagas'
  },
  markers: {
    overdue: '{count, plural, one {vencida} other {vencidas}}',
    due: 'a vencer',
    paid: '{count, plural, one {paga} other {pagas}}'
  },
  dayLabel: '{day}: {summary}',
  daySummary: {
    none: 'nada vence',
    overdue: '{count, plural, one {# conta vencida} other {# contas vencidas}}',
    due: '{count, number} a vencer',
    paid: '{count, plural, one {# paga} other {# pagas}}'
  },
  day: {
    nothingDue: 'Nada vence',
    allPaid: 'Tudo pago',
    leftToPay: '{amounts} a pagar',
    loading: 'Carregando as contas do dia',
    loadFailed: 'Não foi possível carregar as contas do dia',
    empty: 'Nenhuma conta vence neste dia',
    list: 'Contas com vencimento em {day}',
    pages: 'Páginas de contas do dia',
    count: '{count, plural, =0 {Nenhuma conta} one {# conta} other {# contas}}',
    meta: '{origin} · {category}',
    outstanding: '{amount} em aberto'
  }
} as const;
