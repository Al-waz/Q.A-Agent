import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "../common/config/config.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check(): { ok: true; env: string; model: string; collection: string } {
    return {
      ok: true,
      env: this.config.env.NODE_ENV,
      model: this.config.env.OPENROUTER_MODEL,
      collection: this.config.env.WEAVIATE_COLLECTION,
    };
  }
}
