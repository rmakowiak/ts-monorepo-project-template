import { IsString, Matches, IsBoolean, IsOptional } from "class-validator";
import { Transform } from "class-transformer";

export class DatabaseConfigSchema {
  @IsString()
  @Matches(/^postgresql:\/\//)
  readonly DATABASE_URL!: string;

  @IsString()
  @Matches(/^redis:\/\//)
  @IsOptional()
  readonly REDIS_URL?: string;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      return ["true", "1", "yes"].includes(value.toLowerCase());
    }
    return false;
  })
  readonly DATABASE_LOGGING!: boolean;
}
