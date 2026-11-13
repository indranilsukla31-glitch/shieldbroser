import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { UpstreamError } from "../sources/types.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (msg: string) => new HttpError(404, "not_found", msg);

/** Every error leaves the API as `{ error: { code, message } }`. */
export function installErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: { code: "bad_request", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      });
    }
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof UpstreamError) {
      req.log.warn({ err }, "upstream error");
      return reply.code(err.status).send({ error: { code: "upstream_unavailable", message: err.message } });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, "unhandled error");
    return reply.code(status).send({
      error: { code: status === 429 ? "rate_limited" : "internal", message: status >= 500 ? "Something went wrong" : err.message },
    });
  });

  if (process.env.NODE_ENV !== "production") {
    app.setNotFoundHandler((req, reply) => {
      reply.code(404).send({ error: { code: "not_found", message: `No route ${req.method} ${req.url}` } });
    });
  }
}
