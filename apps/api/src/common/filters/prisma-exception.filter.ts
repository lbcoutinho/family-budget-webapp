import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Response } from 'express';

/**
 * Translates the handful of Prisma error codes that map cleanly onto HTTP semantics into proper
 * responses, so a unique-constraint violation surfaces as 409 rather than a generic 500. Any code
 * not listed here falls through to 500 Internal Server Error — an unmapped Prisma error is a bug
 * we want to see, not one we want to paper over with a misleading status.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const { status, message } = this.map(exception);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unmapped Prisma error ${exception.code}: ${exception.message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    });
  }

  private map(exception: Prisma.PrismaClientKnownRequestError): { status: HttpStatus; message: string } {
    switch (exception.code) {
      // Unique constraint failed.
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: 'A record with the same unique value already exists.' };
      // Record required by the operation was not found.
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'The requested record was not found.' };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error.' };
    }
  }
}
