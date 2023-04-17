import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';

import { graphQlMiddleware } from '@/middlewares';

const app = new Koa();
const router = new Router();

router.all('/graphql', graphQlMiddleware);

app.use(cors());
app.use(router.routes());
app.use(router.allowedMethods());

export { app };
