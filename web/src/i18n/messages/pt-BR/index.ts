import account from './account';
import auth from './auth';
import bills from './bills';
import calendar from './calendar';
import common from './common';
import errors from './errors';
import financeOverview from './financeOverview';
import finances from './finances';
import imports from './imports';
import installments from './installments';
import investments from './investments';
import navigation from './navigation';
import portfolios from './portfolios';
import recurring from './recurring';
import reports from './reports';
import transactions from './transactions';
import validation from './validation';

export default {
  common,
  navigation,
  auth,
  account,
  portfolios,
  investments,
  transactions,
  imports,
  finances,
  financeOverview,
  bills,
  installments,
  recurring,
  calendar,
  reports,
  validation,
  errors
} as const;
