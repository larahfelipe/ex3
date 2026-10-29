export default {
  alternative: '{question} <link>{label}</link>',
  fields: {
    name: 'Nome',
    email: 'E-mail',
    password: 'Senha',
    confirmPassword: 'Confirmar senha',
    portfolioName: 'Nome da carteira',
    baseCurrency: 'Moeda-base'
  },
  signIn: {
    title: 'Entre na sua conta',
    sessionExpired: 'Sua sessão expirou. Entre novamente para continuar.',
    submit: 'Entrar',
    noAccount: 'Ainda não tem conta?',
    createAccount: 'Criar conta',
    welcome: 'Você entrou como {name}'
  },
  signUp: {
    title: 'Crie sua conta',
    hasAccount: 'Já tem conta?',
    signInInstead: 'Entrar',
    steps: {
      details: 'Seus dados',
      security: 'Segurança',
      portfolio: 'Carteira'
    },
    progress: 'Etapa {step, number} de {count, number}',
    firstPortfolioName: 'Principal',
    portfolioNameHint: 'Você pode renomeá-la e criar outras carteiras depois.',
    baseCurrencyHint: 'A carteira mostra todos os valores nesta moeda.',
    emailTaken: 'Este e-mail já está cadastrado. Entre na sua conta.',
    continue: 'Continuar',
    submit: 'Criar conta',
    welcome: 'Conta criada. Você entrou como {name}'
  },
  passwordRequirements: {
    minLength: 'Pelo menos {min, number} caracteres',
    notEmail: 'Não contém seu e-mail',
    item: '<hidden>{status, select, met {Atendido:} other {Não atendido:}} </hidden>{requirement}'
  },
  signOut: {
    done: 'Você saiu da sua conta',
    failed: 'Não foi possível sair. Tente novamente.'
  }
} as const;
