import { Module } from "@nestjs/common";
import { SessionModule } from "../session/session.module.js";
import { RetrievalModule } from "../retrieval/retrieval.module.js";
import { GenerationModule } from "../generation/generation.module.js";
import { ToolsModule } from "../tools/tools.module.js";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";

@Module({
  imports: [SessionModule, RetrievalModule, GenerationModule, ToolsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
