export default {
  types: {
    BUY: 'Compra',
    SELL: 'Venda',
    DIVIDEND: 'Dividendo',
    JCP: 'JCP',
    INTEREST: 'Juros',
    BONUS: 'Bonificação'
  },
  unitPrice: {
    BUY: 'Preço unitário',
    SELL: 'Preço unitário',
    DIVIDEND: 'Valor por unidade',
    JCP: 'Valor por unidade',
    INTEREST: 'Valor por unidade',
    BONUS: 'Custo atribuído por unidade'
  },
  fields: {
    type: 'Tipo',
    date: 'Data',
    asset: 'Ativo',
    quantity: 'Quantidade',
    unitPrice: 'Preço unitário',
    fees: 'Taxas',
    taxes: 'Impostos',
    broker: 'Corretora',
    notes: 'Observações'
  },
  table: {
    label: 'Tabela de transações',
    caption: 'Transações, da mais recente para a mais antiga',
    details: 'Detalhes',
    detailsOf: 'Detalhes<hidden>: {type} de {symbol} em {date}</hidden>'
  },
  details: {
    title: '<tone>{type}</tone> {symbol}',
    executedOn: 'Executada em <executed>{date}</executed>'
  },
  deletion: {
    title: 'Excluir esta transação?',
    description:
      '{type} de {quantity} {symbol} em {date}. A posição é recalculada sem ela, e isso não pode ser desfeito.',
    confirm: 'Excluir transação',
    failed: 'Não foi possível excluir a transação'
  },
  form: {
    newTitle: 'Adicionar transação de {symbol}',
    editTitle: 'Editar transação de {symbol}',
    description:
      'Valores em {currency}. Taxas e impostos não informados são registrados como zero.',
    loading: 'Carregando {symbol}',
    typeHints: {
      BUY: 'Adiciona unidades à posição. Preço, taxas e impostos entram no preço médio.',
      SELL: 'Retira unidades da posição e realiza o lucro em relação ao preço médio.',
      DIVIDEND:
        'Provento sobre as unidades em carteira: informe-as e o valor bruto por unidade. A posição não muda.',
      JCP: 'Juros sobre capital próprio das unidades em carteira: informe-as, o valor bruto por unidade e o imposto retido. A posição não muda.',
      INTEREST:
        'Juros sobre as unidades em carteira: informe-as e o valor bruto por unidade. A posição não muda.',
      BONUS:
        'Unidades recebidas em bonificação, ao custo por unidade que a empresa atribuiu, que pode ser zero.'
    },
    marketPrice: 'Preço de mercado',
    marketPriceAsOf: 'Preço de mercado de {time}',
    useHeld: 'Usar {quantity} em carteira',
    effect: {
      BUY: 'Custo total',
      SELL: 'Valor líquido da venda',
      DIVIDEND: 'Rendimento líquido',
      JCP: 'Rendimento líquido',
      INTEREST: 'Rendimento líquido',
      BONUS: 'Custo adicionado'
    },
    effectOf: {
      units: '{quantity} × {unitPrice}',
      unitsPlusCharges:
        '{quantity} × {unitPrice} + {charges} em taxas e impostos',
      unitsLessCharges:
        '{quantity} × {unitPrice} − {charges} em taxas e impostos'
    },
    decrease: 'Diminuir a quantidade em {step, number}',
    increase: 'Aumentar a quantidade em {step, number}',
    optionalDetails: 'Detalhes opcionais',
    addDetail: {
      fees: '<hidden>Adicionar </hidden>Taxas',
      taxes: '<hidden>Adicionar </hidden>Impostos',
      broker: '<hidden>Adicionar </hidden>Corretora',
      notes: '<hidden>Adicionar </hidden>Observações'
    },
    removeDetail: {
      fees: 'Remover<hidden> taxas</hidden>',
      taxes: 'Remover<hidden> impostos</hidden>',
      broker: 'Remover<hidden> corretora</hidden>',
      notes: 'Remover<hidden> observações</hidden>'
    },
    submit: {
      BUY: 'Adicionar compra',
      SELL: 'Adicionar venda',
      DIVIDEND: 'Adicionar dividendo',
      JCP: 'Adicionar JCP',
      INTEREST: 'Adicionar juros',
      BONUS: 'Adicionar bonificação'
    },
    failed: 'Não foi possível salvar a transação'
  },
  notifications: {
    recorded:
      '{type, select, BUY {Compra registrada} SELL {Venda registrada} DIVIDEND {Dividendo registrado} JCP {JCP registrado} INTEREST {Juros registrados} other {Bonificação registrada}}',
    recordedDetail: '{quantity} {symbol} a {price} em {date}',
    updated: 'Transação atualizada',
    deleted: 'Transação excluída'
  }
} as const;
