import { Module } from "@nestjs/common";
import { SharedModule } from "~/shared/shared.module";
import { AuthModule } from "~/auth/auth.module";
import { ProductController } from "./inbound/product.controller";
import { ProductService } from "./application/product.service";
import { InMemoryProductRepository } from "./outbound/adapters/in-memory-product.repository";

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [ProductController],
  providers: [
    ProductService,
    {
      provide: "ProductRepository",
      useClass: InMemoryProductRepository,
    },
  ],
  exports: [ProductService],
})
export class ProductModule {}
