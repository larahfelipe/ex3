import type { Request, Response } from 'express';

/** Nothing a request carries is trusted before a schema parses it, so its body is `unknown`. */
export type ControllerRequest = Request<Request['params'], unknown, unknown>;

export interface Controller {
  handle: (request: ControllerRequest, response: Response) => Promise<Response>;
}
