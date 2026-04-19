import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { IngestionModule } from "./ingestion.module.js";

/**
 * Shared entry-point for the `pnpm fetch-corpus` / `pnpm ingest` CLIs.
 *
 * By wrapping the Nest bootstrap in a helper that lives INSIDE apps/api we
 * keep every bare-specifier import (`@nestjs/core`, `reflect-metadata`,
 * `weaviate-client`, …) inside a package that actually owns them — pnpm only
 * symlinks dependencies into the workspace that requested them, so top-level
 * scripts can't resolve these names directly. Scripts call this helper via a
 * relative path; Node then resolves everything through apps/api's
 * `node_modules`.
 */
export async function createIngestionContext(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(IngestionModule, {
    logger: ["log", "warn", "error"],
  });
}
