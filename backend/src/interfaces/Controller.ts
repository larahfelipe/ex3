import type { Request, Response } from 'express';

export type ControllerRequest = Request<Request['params'], unknown, unknown>;

export interface Controller {
  handle: (request: ControllerRequest, response: Response) => Promise<Response>;
}
