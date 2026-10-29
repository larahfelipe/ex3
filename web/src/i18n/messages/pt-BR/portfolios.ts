export default {
  description: 'A carteira ativa é a que aparece na visão geral e nos ativos',
  newPortfolio: 'Nova carteira',
  listTitle: 'Suas carteiras',
  loadFailed: 'Não foi possível carregar suas carteiras',
  loading: 'Carregando suas carteiras',
  empty: 'Esta conta ainda não tem carteiras',
  createFirst: 'Criar uma carteira',
  emptyPage: 'Nenhuma carteira na página {page, number}',
  goToPage: 'Ir para a página {page, number}',
  active: 'Ativa',
  baseCurrency: 'Moeda-base {currency}',
  use: 'Usar',
  useNamed: 'Usar {name}',
  editNamed: 'Editar {name}',
  deleteNamed: 'Excluir {name}',
  soleNote:
    'Uma conta mantém pelo menos uma carteira, por isso a única não pode ser excluída.',
  pages: 'Páginas de carteiras',
  activated: '{name} agora é a carteira ativa',
  storageBlocked:
    'Seu navegador bloqueou o salvamento da carteira ativa. Permita os dados do site para este app e tente novamente.',
  deletion: {
    title: 'Excluir {name}?',
    description:
      'Todos os ativos e transações de {name} são excluídos junto com ela.',
    permanent: 'Esta ação é permanente e não pode ser desfeita.',
    activeFallback: 'Depois, o app mostra sua carteira mais antiga.',
    confirm: 'Excluir carteira',
    failed: 'Não foi possível excluir a carteira'
  },
  form: {
    editTitle: 'Editar {name}',
    newTitle: 'Nova carteira',
    description:
      'As posições e transações de uma carteira são avaliadas na moeda-base dela.',
    name: 'Nome',
    baseCurrency: 'Moeda-base',
    baseCurrencyLockedHint:
      'A moeda-base só pode mudar enquanto a carteira não tiver transações.',
    create: 'Criar carteira'
  },
  totalValue: {
    label: 'Valor total',
    loadFailed: 'Não foi possível carregar',
    retry: 'Tentar carregar novamente o valor de {name}',
    noHoldings: 'Sem posições',
    marketDataUnavailable: 'Cotações indisponíveis'
  },
  notifications: {
    created: 'Carteira criada',
    updated: 'Carteira atualizada',
    deleted: 'Carteira excluída'
  }
} as const;
