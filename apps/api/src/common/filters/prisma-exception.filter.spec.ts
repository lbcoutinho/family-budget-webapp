import { type ArgumentsHost, HttpStatus } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';

import { PrismaExceptionFilter } from './prisma-exception.filter';

/** Minimal `ArgumentsHost` double that captures the status and JSON body the filter writes. */
const hostWithResponse = (): { host: ArgumentsHost; json: jest.Mock; status: jest.Mock } => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
};

const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`error ${code}`, { code, clientVersion: 'test' });

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it('maps P2002 (unique constraint) to 409 Conflict', () => {
    const { host, json, status } = hostWithResponse();

    filter.catch(prismaError('P2002'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({ statusCode: HttpStatus.CONFLICT, code: 'DUPLICATE_NAME', message: expect.any(String) as string });
  });

  it('maps P2003 (foreign key constraint) to 409 Conflict', () => {
    const { host, json, status } = hostWithResponse();

    filter.catch(prismaError('P2003'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RECORD_IN_USE', message: expect.stringContaining('Deactivate it') as string }));
  });

  it('maps P2025 (record not found) to 404 Not Found', () => {
    const { host, json, status } = hostWithResponse();

    filter.catch(prismaError('P2025'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: HttpStatus.NOT_FOUND, code: 'RECORD_NOT_FOUND' }));
  });

  it('falls through to 500 for an unmapped code', () => {
    const { host, json, status } = hostWithResponse();

    filter.catch(prismaError('P2010'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });
});
