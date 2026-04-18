import { Injectable, Logger } from "@nestjs/common";
import { EnvSchema, type Env } from "./env.schema.js";

@Injectable()
export class ConfigService {
  public readonly env: Env;
  private readonly logger = new Logger(ConfigService.name);

  constructor() {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      this.logger.error(`Invalid environment variables:\n${issues}`);
      throw new Error("Invalid environment. See log output above.");
    }
    this.env = parsed.data;
  }
}
