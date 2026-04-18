import { Module } from "@nestjs/common";
import { ConfigModule } from "./common/config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { PromptsModule } from "./prompts/prompts.module.js";
import { EmbeddingsModule } from "./embeddings/embeddings.module.js";
import { RetrievalModule } from "./retrieval/retrieval.module.js";
import { GenerationModule } from "./generation/generation.module.js";
import { SessionModule } from "./session/session.module.js";
import { ToolsModule } from "./tools/tools.module.js";
import { ChatModule } from "./chat/chat.module.js";

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    PromptsModule,
    EmbeddingsModule,
    RetrievalModule,
    GenerationModule,
    SessionModule,
    ToolsModule,
    ChatModule,
  ],
})
export class AppModule {}
