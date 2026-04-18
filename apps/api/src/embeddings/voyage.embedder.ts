import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../common/config/config.service.js";
import type { IEmbedder } from "./interfaces/embedder.interface.js";

/**
 * Voyage AI embedder using the `voyage-4` model by default.
 * Phase 2 will implement batched requests with retry/backoff against the
 * free-tier rate limit (~300 req/min). Keeping the stub here so DI wiring and
 * interface contracts are in place from Phase 1.
 */
@Injectable()
export class VoyageEmbedder implements IEmbedder {
  private readonly logger = new Logger(VoyageEmbedder.name);

  constructor(private readonly config: ConfigService) {}

  embedQuery(_text: string): Promise<number[]> {
    throw new Error("VoyageEmbedder.embedQuery not implemented (Phase 2)");
  }

  embedDocuments(_texts: string[]): Promise<number[][]> {
    throw new Error("VoyageEmbedder.embedDocuments not implemented (Phase 2)");
  }
}
