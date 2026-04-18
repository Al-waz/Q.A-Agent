import { Chat } from "@/components/chat/Chat";

export default function Home(): JSX.Element {
  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl flex-col py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Q&A Agent</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about manned spaceflight history. Answers are grounded in Wikipedia sources and cite their
          origin inline.
        </p>
      </header>
      <Chat />
    </main>
  );
}
