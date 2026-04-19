import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { EvaluationModule } from "./evaluation.module.js";

/**
 * Shared entry point for the `pnpm evaluate` CLI. Same rationale as the
 * ingestion bootstrap — keeping the Nest bootstrap inside `apps/api` lets
 * pnpm's workspace symlinks resolve bare specifiers (`@nestjs/core`,
 * `reflect-metadata`, etc.) that the root `scripts/` directory cannot see.
 */
export async function createEvaluationContext(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(EvaluationModule, {
    logger: ["log", "warn", "error"],
  });
}
