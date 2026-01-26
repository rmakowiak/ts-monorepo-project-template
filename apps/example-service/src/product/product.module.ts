import { Module } from "@nestjs/common";
import { SharedModule } from "~/shared/shared.module";
import { AuthModule } from "~/auth/auth.module";
import { ProductController } from "./inbound/product.controller";
import { ProductService } from "./application/product.service";
import { PrismaProductRepository } from "./outbound/adapters/prisma-product.repository";

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [ProductController],
  providers: [
    ProductService,
    {
      provide: "ProductRepository",
      useClass: PrismaProductRepository,
    },
  ],
  exports: [ProductService],
})
export class ProductModule {}
