import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * DatabaseModule provides database access across the application
 *
 * @remarks
 * - Marked as @Global() so PrismaService is available everywhere without importing
 * - Exports PrismaService for dependency injection
 * - PrismaService manages connection lifecycle automatically
 *
 * @example
 * ```typescript
 * // Import in AppModule
 * @Module({
 *   imports: [DatabaseModule],
 * })
 * export class AppModule {}
 *
 * // Use in any service without additional imports
 * @Injectable()
 * export class ProductRepository {
 *   constructor(private readonly prisma: PrismaService) {}
 * }
 * ```
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
