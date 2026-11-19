import { Prisma } from '@prisma/client';

import { classifyKnownError } from './http-exception.filter';

/** QA P2-4: caller mistakes that are not HttpExceptions get a 4xx, not a 500. */
describe('classifyKnownError', () => {
  const bodyParserError = (type: string, status: number) =>
    Object.assign(new Error('raw library text'), {
      type,
      status,
      statusCode: status,
      expose: true,
    });

  it('maps an oversized body to 413 with a fixed message', () => {
    expect(
      classifyKnownError(bodyParserError('entity.too.large', 413)),
    ).toEqual({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request body is too large.',
    });
  });

  it('maps other body-parser client errors to their own 4xx', () => {
    const result = classifyKnownError(
      bodyParserError('charset.unsupported', 415),
    );
    expect(result).toMatchObject({ status: 415, code: 'MALFORMED_REQUEST' });
    expect(result?.message).not.toContain('raw library text');
  });

  it('maps a Prisma unique violation to 409', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { target: ['email'] },
    });
    expect(classifyKnownError(err)).toMatchObject({
      status: 409,
      code: 'DUPLICATE',
    });
  });

  it('maps a Prisma record-not-found to 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('No record', {
      code: 'P2025',
      clientVersion: '6.0.0',
    });
    expect(classifyKnownError(err)).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('leaves everything else to the generic 500 path', () => {
    expect(classifyKnownError(new Error('boom'))).toBeNull();
    expect(
      classifyKnownError(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: '6.0.0',
        }),
      ),
    ).toBeNull();
    // A server-side 5xx http-errors object is not the caller's fault.
    expect(
      classifyKnownError(
        Object.assign(new Error('x'), {
          type: 'x',
          status: 500,
          expose: false,
        }),
      ),
    ).toBeNull();
  });
});
