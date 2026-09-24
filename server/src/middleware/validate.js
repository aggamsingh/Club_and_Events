/**
 * Validates req.body / req.query / req.params against zod schemas and stores the
 * parsed (typed, coerced, stripped) result on req.valid. Handlers read only from
 * req.valid, so unknown fields can never reach the database (no mass assignment).
 *
 * Express 5 makes req.query a read-only getter, hence the separate req.valid object.
 */
export function validate(schemas) {
  return (req, res, next) => {
    req.valid ??= {};
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] ?? {});
    }
    next();
  };
}
