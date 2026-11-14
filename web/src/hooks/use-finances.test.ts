import {
  QueryClient,
  QueryObserver,
  type QueryKey
} from '@tanstack/react-query';
import assert from 'node:assert/strict';
import { afterEach, describe, it, type TestContext } from 'node:test';
import { toast } from 'sonner';

import { queryKeys } from '@/lib/react-query';

import { refreshFinancesThenAnnounce } from './use-finances';

const TODAY = '2026-11-11';

const EXPENSE_ID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const clients: Array<QueryClient> = [];
const unsubscribers: Array<VoidFunction> = [];

const newQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  clients.push(queryClient);

  return queryClient;
};

const observe = async (
  queryClient: QueryClient,
  queryKey: QueryKey,
  queryFn: () => Promise<unknown>
) => {
  const observer = new QueryObserver(queryClient, { queryKey, queryFn });

  unsubscribers.push(observer.subscribe(() => undefined));
  await queryClient.getQueryCache().find({ queryKey })?.promise;
};

const dueOn = (dueDate: string) => ({ data: { id: EXPENSE_ID, dueDate } });

const toastsOf = (t: TestContext) =>
  t.mock.method(toast, 'success', () => EXPENSE_ID).mock;

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  clients.splice(0).forEach((queryClient) => queryClient.clear());
});

describe('announcing a finance write', () => {
  it('waits for the bill on screen to reload with the change before saying it was saved', async (t) => {
    const queryClient = newQueryClient();
    const queryKey = queryKeys.expense(EXPENSE_ID, TODAY);
    const toasts = toastsOf(t);
    let answerReload: VoidFunction = () => undefined;
    let reloads = 0;

    await observe(queryClient, queryKey, () => {
      reloads += 1;

      return reloads === 1
        ? Promise.resolve(dueOn('2026-11-20'))
        : new Promise((resolve) => {
            answerReload = () => resolve(dueOn('2026-11-25'));
          });
    });

    const announcement = refreshFinancesThenAnnounce(queryClient, {
      title: 'Conta atualizada'
    });

    await Promise.resolve();
    assert.equal(toasts.callCount(), 0);
    assert.deepEqual(queryClient.getQueryData(queryKey), dueOn('2026-11-20'));

    answerReload();
    await announcement;

    assert.deepEqual(queryClient.getQueryData(queryKey), dueOn('2026-11-25'));
    assert.deepEqual(
      toasts.calls.map(({ arguments: args }) => args),
      [['Conta atualizada', { description: undefined }]]
    );
  });

  it('still says a write was saved when a reload fails, which its query then shows', async (t) => {
    const queryClient = newQueryClient();
    const queryKey = queryKeys.expense(EXPENSE_ID, TODAY);
    const toasts = toastsOf(t);
    let reloads = 0;

    await observe(queryClient, queryKey, () => {
      reloads += 1;

      return reloads === 1
        ? Promise.resolve(dueOn('2026-11-20'))
        : Promise.reject(new Error('offline'));
    });

    await refreshFinancesThenAnnounce(queryClient, {
      title: 'Conta atualizada',
      description: 'Vence em 25/11/2026'
    });

    assert.equal(toasts.callCount(), 1);
    assert.equal(
      queryClient.getQueryCache().find({ queryKey })?.state.status,
      'error'
    );
  });

  it('reloads every finance query on screen and no portfolio one', async (t) => {
    const queryClient = newQueryClient();
    const requests = new Map<string, number>();
    const counting = (name: string) => () => {
      requests.set(name, (requests.get(name) ?? 0) + 1);

      return Promise.resolve({ data: name });
    };

    toastsOf(t);
    await observe(
      queryClient,
      queryKeys.expense(EXPENSE_ID, TODAY),
      counting('bill')
    );
    await observe(
      queryClient,
      queryKeys.financeAlerts(TODAY),
      counting('alerts')
    );
    await observe(
      queryClient,
      queryKeys.portfolioOverview(null),
      counting('portfolio')
    );

    await refreshFinancesThenAnnounce(queryClient, { title: 'Conta paga' });

    assert.deepEqual(Object.fromEntries(requests), {
      bill: 2,
      alerts: 2,
      portfolio: 1
    });
  });
});
