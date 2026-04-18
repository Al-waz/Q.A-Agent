import { Module } from "@nestjs/common";
import { SESSION_STORE } from "./stores/session-store.interface.js";
import { InMemorySessionStore } from "./stores/memory.store.js";
import { SessionService } from "./session.service.js";

@Module({
  providers: [
    InMemorySessionStore,
    {
      provide: SESSION_STORE,
      useExisting: InMemorySessionStore,
    },
    SessionService,
  ],
  exports: [SessionService],
})
export class SessionModule {}
