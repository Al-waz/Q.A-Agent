import { Body, Controller, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ChatRequestSchema } from "./dto/chat-request.dto.js";
import { ChatService } from "./chat.service.js";

@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async stream(@Body() body: unknown, @Res({ passthrough: false }) reply: FastifyReply): Promise<void> {
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      reply.status(400).send({ error: "Invalid request", issues: parsed.error.issues });
      return;
    }
    await this.chat.handle(parsed.data, reply);
  }
}
