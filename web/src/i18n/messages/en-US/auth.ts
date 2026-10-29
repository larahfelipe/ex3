import type { LocaleMessages, Messages } from '../catalog';

export default {
  alternative: '{question} <link>{label}</link>',
  fields: {
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    portfolioName: 'Portfolio name',
    baseCurrency: 'Base currency'
  },
  signIn: {
    title: 'Sign in to your account',
    sessionExpired: 'Your session expired. Sign in again to continue.',
    submit: 'Sign in',
    noAccount: "Don't have an account yet?",
    createAccount: 'Create account',
    welcome: 'Signed in as {name}'
  },
  signUp: {
    title: 'Create your account',
    hasAccount: 'Already have an account?',
    signInInstead: 'Sign in',
    steps: {
      details: 'Your details',
      security: 'Security',
      portfolio: 'Portfolio'
    },
    progress: 'Step {step, number} of {count, number}',
    firstPortfolioName: 'Main',
    portfolioNameHint: 'You can rename it and create more portfolios later.',
    baseCurrencyHint: 'The portfolio shows every amount in this currency.',
    emailTaken: 'This email is already registered. Sign in to your account.',
    continue: 'Continue',
    submit: 'Create account',
    welcome: 'Account created. Signed in as {name}'
  },
  passwordRequirements: {
    minLength: 'At least {min, number} characters',
    notEmail: "Doesn't contain your email",
    item: '<hidden>{status, select, met {Met:} other {Not met:}} </hidden>{requirement}'
  },
  signOut: {
    done: 'You signed out',
    failed: "Couldn't sign out. Try again."
  }
} as const satisfies LocaleMessages<Messages['auth']>;
