export default {
  label: 'Notificações',
  unreadCount:
    '{count, plural, =0 {} one {, # não lida} other {, # não lidas}}',
  unread: 'Não lida',
  markRead: 'Marcar como lida',
  markReadNamed: 'Marcar como lida: {description}',
  markAllRead: 'Marcar todas como lidas',
  dismiss: 'Dispensar notificação',
  dismissNamed: 'Dispensar notificação: {description}',
  clearAll: 'Limpar notificações',
  viewBills: 'Ver contas',
  notifiedOn: '{days, plural, =0 {Hoje} =1 {Ontem} other {Há # dias}}',
  empty:
    'Nenhuma notificação por enquanto. Contas vencidas ou perto do vencimento aparecem aqui.',
  loadFailed: 'Não foi possível carregar as notificações',
  markFailed: 'Não foi possível atualizar as notificações',
  partial: 'As {shown, number} mais recentes de {total, number}'
} as const;
