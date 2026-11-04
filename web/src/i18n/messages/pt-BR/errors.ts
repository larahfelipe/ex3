export default {
  unexpected: 'Algo deu errado. Tente novamente mais tarde.',
  network:
    'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  timeout: 'O servidor demorou demais para responder. Tente novamente.',
  throttled:
    'Muitas tentativas. Tente novamente em {minutes, plural, one {# minuto} other {# minutos}}.',
  throttledLater: 'Muitas tentativas. Tente novamente mais tarde.',
  invalidValue: 'Valor inválido',
  categories: {
    VALIDATION: 'Alguns dados não são válidos. Revise-os e tente novamente.',
    AUTHENTICATION: 'Sua sessão não é mais válida. Entre novamente.',
    AUTHORIZATION: 'Você não tem acesso a este recurso.',
    NOT_FOUND: 'Não encontramos o que você procurava.',
    CONFLICT:
      'Este registro mudou ou já existe. Atualize a página e tente novamente.',
    DOMAIN: 'Esta operação não é permitida.',
    INFRASTRUCTURE:
      'O serviço está indisponível no momento. Tente novamente mais tarde.',
    INTERNAL: 'Algo deu errado. Tente novamente mais tarde.'
  },
  api: {
    payloadTooLarge: 'Os dados enviados excedem o tamanho máximo permitido.',
    assetNotFound: 'Este ativo não está na carteira.',
    assetAlreadyExists: 'Este ativo já está na carteira.',
    portfolioEmpty: 'Esta carteira ainda não tem ativos.',
    instrumentNotFound: 'Este ativo não está no catálogo.',
    instrumentNotListed: 'Este ativo não é listado pelo provedor de cotações.',
    instrumentAlreadyExists: 'Este ativo já está no catálogo.',
    privateInstrumentAlreadyExists:
      'Você já cadastrou um ativo próprio com este código.',
    instrumentCurrencyMismatch:
      'A moeda deve ser aquela em que o mercado do ativo o cota.',
    marketDataUnavailable:
      'As cotações estão indisponíveis no momento. Tente novamente mais tarde.',
    portfolioNotFound: 'Carteira não encontrada.',
    portfolioNameTaken: 'Você já tem uma carteira com este nome.',
    lastPortfolio: 'A última carteira da conta não pode ser excluída.',
    baseCurrencyLocked:
      'A moeda-base não pode mudar depois que a carteira tem transações.',
    transactionNotFound: 'Transação não encontrada para este ativo.',
    saleExceedsHolding:
      'A venda excederia a quantidade em carteira na data da transação.',
    transactionCurrencyMismatch:
      'Todas as transações de uma posição devem usar a mesma moeda.',
    positionOutOfRange: 'A posição resultante excede o limite suportado.',
    unitPriceNotPositive: 'O preço unitário deve ser maior que zero.',
    userAlreadyExists: 'Este e-mail já está cadastrado.',
    invalidPassword: 'A senha está incorreta.',
    invalidCredentials: 'E-mail ou senha incorretos.',
    invalidEmail: 'Informe um e-mail válido.',
    passwordDerivedFromEmail:
      'A senha não pode conter a parte do e-mail antes do @.',
    challengeFailed:
      'Não conseguimos confirmar que você é uma pessoa. Tente novamente.',
    challengeUnavailable:
      'A verificação está indisponível no momento. Tente novamente mais tarde.',
    expenseNotFound: 'Conta não encontrada.',
    paymentNotFound: 'Pagamento não encontrado para esta conta.',
    installmentPlanNotFound: 'Parcelamento não encontrado.',
    recurringExpenseNotFound: 'Despesa recorrente não encontrada.',
    amountPrecision: 'O valor tem mais casas decimais do que a moeda permite.',
    amountBelowSettled: 'O valor não pode ser menor do que o que já foi pago.',
    paymentExceedsOutstanding:
      'O pagamento quita mais do que a conta ainda deve.',
    alreadySettled: 'Esta conta já está totalmente paga.',
    expenseCancelled: 'Esta conta está cancelada.',
    expenseHasPayments:
      'Uma conta com pagamentos não pode ser cancelada nem excluída. Estorne os pagamentos primeiro.',
    expenseManagedByOrigin:
      'Parcelas e ocorrências de despesas recorrentes são excluídas pelo parcelamento ou pela despesa recorrente. Cancele esta conta em vez de excluí-la.',
    expenseOriginCancelled:
      'O parcelamento ou a despesa recorrente desta conta foi cancelado.',
    planHasPayments:
      'Um parcelamento com pagamentos não pode ser excluído. Cancele-o para manter o histórico.',
    planCancelled: 'Este parcelamento está cancelado.',
    paymentEmpty:
      'O pagamento precisa quitar um valor ou um desconto maior que zero.',
    paymentInFuture: 'A data do pagamento não pode estar no futuro.',
    endBeforeStart: 'A data final não pode ser anterior à data inicial.',
    installmentSplitTooSmall:
      'O valor é pequeno demais para ser dividido em tantas parcelas.',
    seriesHasPayments:
      'Uma despesa recorrente com pagamentos não pode ser excluída. Interrompa-a para manter o histórico.',
    seriesCancelled: 'Esta despesa recorrente foi interrompida.',
    endBeforePaidOccurrence:
      'A data final removeria uma ocorrência que já tem pagamentos.',
    referenceDayOutOfRange:
      'A data deste dispositivo difere demais da data do servidor. Confira a data e a hora do dispositivo.',
    rangeReversed: 'A data final não pode ser anterior à data inicial.'
  },
  limits: {
    startOutsideHorizon:
      'A data inicial deve estar dentro dos últimos {months, number} meses.',
    reportTooLong: 'Um relatório abrange no máximo {months, number} meses.'
  },
  dated: {
    effectiveFromAfterHorizon:
      'A alteração deve valer a partir de, no máximo, {date, date, ::ddMMyyyy}.',
    rescheduleBeforeKept:
      'O próximo vencimento não pode ser anterior a {date, date, ::ddMMyyyy}, vencimento da última parcela com pagamentos.'
  }
} as const;
