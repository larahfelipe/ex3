import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';

import { graphQLMiddleware } from '@/middleware';

const app = new Koa();
const router = new Router();

router.all('/graphql', graphQLMiddleware);

app.use(cors());
app.use(router.routes());
app.use(router.allowedMethods());

export { app };
