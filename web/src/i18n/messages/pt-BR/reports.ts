export default {
  title: 'Relatórios',
  period: '{kind, select, range {{from} a {to}} other {{from}}}',
  span: '{kind, select, range {de {from} a {to}} other {em {from}}}',
  comparedTo: '{kind, select, range {entre {from} e {to}} other {em {from}}}',
  headerWithCurrency: '{period} · Valores em {currency}',
  periodGroup: 'Período do relatório',
  from: 'De',
  to: 'Até',
  loading: 'Carregando o relatório',
  loadFailed: 'Não foi possível carregar o relatório',
  empty: 'Nada venceu nem foi pago em {currency} {span}',
  metrics: {
    planned: 'Previsto',
    paid: 'Pago',
    owed: 'Em aberto',
    owedDetail:
      '{count, plural, =0 {Nenhuma conta} one {De # conta} other {De # contas}} com vencimento no período',
    overdue: 'Vencido',
    nothingOverdue: 'Nada vencido',
    overdueDetail:
      '{count, plural, one {# conta vencida} other {# contas vencidas}}'
  },
  adjustments: 'Os pagamentos incluem {items}.',
  adjustmentFees: '{amount} em juros e multas',
  adjustmentDiscounts: '{amount} em descontos',
  trend: {
    title: 'Previsto e pago por mês',
    description:
      'O previsto soma as contas que vencem em cada mês; o pago soma os pagamentos feitos no mês, qualquer que seja o vencimento da conta',
    planned: 'Previsto',
    paid: 'Pago',
    link: 'Abre as contas que vencem nesse mês'
  },
  categories: {
    title: 'Por categoria',
    description: 'Previsto no período e a participação no total',
    empty: 'Nada previsto no período'
  },
  kinds: {
    title: 'Por tipo',
    description: 'Contas avulsas, parcelamentos e despesas recorrentes'
  },
  paidDetail: 'Pago: {amount}',
  payments: {
    title: 'Pagamentos',
    description:
      'Todos os pagamentos feitos {span}, do mais recente ao mais antigo',
    loading: 'Carregando os pagamentos',
    loadFailed: 'Não foi possível carregar os pagamentos',
    empty: 'Nenhum pagamento {span}',
    table: 'Tabela de pagamentos',
    columns: {
      bill: 'Conta',
      paidOn: 'Pago em',
      method: 'Forma de pagamento',
      amount: 'Valor'
    },
    pages: 'Páginas de pagamentos',
    count:
      '{count, plural, =0 {Nenhum pagamento} one {# pagamento} other {# pagamentos}}',
    fees: 'mais {amount} de juros e multas',
    discount: 'menos {amount} de desconto'
  }
} as const;
