export default {
  email: {
    required: 'Informe o e-mail',
    invalid: 'Informe um e-mail válido, como nome@exemplo.com'
  },
  name: {
    required: 'Informe o nome',
    tooLong: 'O nome deve ter no máximo {max, number} caracteres'
  },
  firstName: {
    required: 'Informe seu nome',
    tooLong: 'O nome deve ter no máximo {max, number} caracteres'
  },
  lastName: {
    tooLong: 'O sobrenome deve ter no máximo {max, number} caracteres'
  },
  password: {
    required: 'Informe a senha',
    currentRequired: 'Informe a senha atual',
    currentIncorrect: 'A senha atual está incorreta',
    tooShort: 'A senha deve ter pelo menos {min, number} caracteres',
    tooLong: 'A senha deve ter no máximo {max, number} bytes',
    blank: 'A senha não pode ter apenas espaços',
    repeated: 'A senha não pode repetir um único caractere',
    derivedFromEmail:
      'A senha não pode conter a parte do seu e-mail antes do @',
    confirmRequired: 'Confirme a senha',
    confirmNewRequired: 'Confirme a nova senha',
    mismatch: 'As senhas não coincidem'
  },
  portfolio: {
    nameTaken: 'Você já tem uma carteira com este nome'
  },
  currency: {
    required: 'Selecione a moeda',
    invalid: 'Selecione uma moeda-base válida'
  },
  text: {
    required: 'Preencha este campo',
    tooLong: 'Use no máximo {max, number} caracteres'
  },
  day: {
    required: 'Selecione uma data',
    invalid: 'Selecione um dia válido do calendário'
  },
  amount: {
    required: 'Informe um valor',
    invalid:
      'Use um número com até {integerDigits, number} dígitos inteiros e {decimals, number} casas decimais',
    notPositive: 'Informe um valor maior que zero',
    ambiguous:
      'Valor ambíguo: escreva {asDecimal} se houver casas decimais ou {asWhole} se for um número inteiro',
    pastedAmbiguous:
      'O valor colado pode ser {asDecimal} ou {asWhole}: digite os algarismos',
    pastedInvalid:
      'O valor colado não é um número com até {integerDigits, number} dígitos inteiros e {decimals, number} casas decimais',
    minorUnits:
      '{places, plural, =0 {Valores em {currency} não têm casas decimais} one {Valores em {currency} têm no máximo # casa decimal} other {Valores em {currency} têm no máximo # casas decimais}}'
  },
  installments: {
    countRequired: 'Informe o número de parcelas',
    countWhole: 'Informe um número inteiro de parcelas',
    countMin: 'Informe pelo menos 1 parcela',
    countMax: 'Informe no máximo {max, number} parcelas',
    tooSmallToSplit:
      'Valor pequeno demais para que cada uma das {count, number} parcelas tenha pelo menos {amount}',
    afterKept:
      'Escolha {day} ou uma data posterior, quando vence a parcela {number, number}'
  },
  recurring: {
    endBeforeStart:
      'Escolha uma data igual ou posterior ao primeiro vencimento',
    startTooEarly:
      'Escolha uma data nos últimos {months, plural, one {# mês} other {# meses}} ou depois',
    effectiveFromTooLate: 'Escolha {day} ou uma data anterior'
  },
  reminders: {
    daysRequired: 'Informe um número de dias',
    daysWhole: 'Informe um número inteiro de dias',
    daysMin: 'O número de dias não pode ser negativo',
    daysMax: 'Informe no máximo {max, number} dias'
  },
  quantity: {
    required: 'Informe a quantidade',
    notPositive: 'A quantidade deve ser maior que zero'
  }
} as const;
