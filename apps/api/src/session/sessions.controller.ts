import { Controller, Delete, Get, Inject, Param } from "@nestjs/common";
import type { ChatMessage } from "@qa/schemas";
import type { SessionSummary } from "./stores/session-store.interface.js";
import { SessionService } from "./session.service.js";

/**
 * Session management endpoints for the web UI's sidebar.
 *   - GET    /sessions        — list summaries (id, title, updatedAt)
 *   - GET    /sessions/:id    — full history so the UI can replay a past chat
 *   - DELETE /sessions/:id    — clear a session from the store
 *
 * Lightweight on purpose; creation happens implicitly on the first POST /chat
 * for a given sessionId, so there's no POST /sessions to mint one.
 */
@Controller("sessions")
export class SessionsController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  @Get()
  async list(): Promise<{ sessions: SessionSummary[] }> {
    const sessions = await this.sessions.list();
    return { sessions };
  }

  @Get(":id")
  async history(@Param("id") id: string): Promise<{ messages: ChatMessage[] }> {
    const messages = await this.sessions.getFullHistory(id);
    return { messages };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.sessions.clear(id);
    return { ok: true };
  }
}
