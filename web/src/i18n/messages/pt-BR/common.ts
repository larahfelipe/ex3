export default {
  actions: {
    back: 'Voltar',
    cancel: 'Cancelar',
    clearAll: 'Limpar tudo',
    clearRefinements: 'Limpar busca e filtros',
    close: 'Fechar',
    delete: 'Excluir',
    edit: 'Editar',
    refresh: 'Atualizar',
    retry: 'Tentar novamente',
    save: 'Salvar',
    saveChanges: 'Salvar alterações'
  },
  states: {
    loading: 'Carregando',
    notAvailable: 'Indisponível',
    stale:
      'Não foi possível atualizar estes dados, e eles podem estar desatualizados'
  },
  pagination: {
    previous: 'Página anterior',
    next: 'Próxima página',
    position: 'Página {page, number} de {totalPages, number}',
    positionWithDetail:
      'Página {page, number} de {totalPages, number} · {detail}'
  },
  form: {
    optionalLabel: '<label></label><muted> (opcional)</muted>',
    optionalSectionTitle: '<title></title><muted> · Opcional</muted>',
    datePlaceholder: 'Selecione uma data',
    currency: 'Moeda',
    showPassword: 'Mostrar senha',
    hidePassword: 'Ocultar senha',
    labelInCurrency: '{label}<hidden> em {currency}</hidden>'
  },
  personName: {
    firstName: 'Nome',
    lastName: 'Sobrenome'
  },
  searchableSelect: {
    search: 'Buscar',
    noResults: 'Nada encontrado para “{query}”',
    results:
      '{count, plural, =0 {Nenhuma opção encontrada} one {# opção encontrada} other {# opções encontradas}}'
  },
  confirmDeletion: {
    typeToConfirm: 'Digite <strong>{phrase}</strong> para confirmar',
    mismatch: 'O texto não corresponde ao nome acima'
  },
  metric: {
    about: 'Sobre: {label}'
  },
  calendar: {
    month: 'Mês',
    year: 'Ano',
    today: 'Hoje'
  },
  toasts: {
    region: 'Notificações',
    close: 'Fechar notificação'
  },
  fallback: {
    title: 'Algo deu errado',
    description:
      'Não foi possível exibir esta página. Tente novamente; se o problema continuar, volte mais tarde.',
    retry: 'Tentar novamente'
  },
  notFound: {
    title: 'Página não encontrada',
    description:
      'O endereço pode estar incorreto, ou a página pode não existir mais.',
    action: 'Ir para a visão geral'
  },
  language: {
    label: 'Idioma',
    failed: 'Não foi possível mudar o idioma. Tente novamente.'
  }
} as const;
