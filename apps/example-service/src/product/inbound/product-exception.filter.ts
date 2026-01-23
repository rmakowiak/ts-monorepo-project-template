import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  ProductNotFoundError,
  ProductAlreadyExistsError,
} from "../domain/product.error";

@Catch(ProductNotFoundError, ProductAlreadyExistsError)
export class ProductExceptionFilter implements ExceptionFilter {
  catch(
    exception: ProductNotFoundError | ProductAlreadyExistsError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof ProductNotFoundError
        ? HttpStatus.NOT_FOUND
        : HttpStatus.CONFLICT;

    const error =
      exception instanceof ProductNotFoundError ? "Not Found" : "Conflict";

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error,
    });
  }
}
