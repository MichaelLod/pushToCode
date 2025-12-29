"use client";

// TODO: Import Terminal component
// import { Terminal } from "@/components/Terminal";

// TODO: Import SessionList component
// import { SessionList } from "@/components/SessionList";

// TODO: Import Header component
// import { Header } from "@/components/Header";

// TODO: Import RepoManager component
// import { RepoManager } from "@/components/RepoManager";

// TODO: Import useWebSocket hook
// import { useWebSocket } from "@/hooks/useWebSocket";

// TODO: Import useSession hook
// import { useSession } from "@/hooks/useSession";

export default function Home() {
  // TODO: Initialize WebSocket connection
  // const { status, send, lastMessage } = useWebSocket();

  // TODO: Initialize session management
  // const { currentSession, sessions, createSession, selectSession } = useSession();

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* TODO: Header with connection status and settings */}
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <h1 className="text-lg font-semibold text-text-primary">pushToCode</h1>
        {/* TODO: Connection status indicator */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-sm text-text-secondary">Connected</span>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 overflow-hidden">
        {/* TODO: Sidebar with session list */}
        <aside className="hidden w-64 border-r border-border bg-bg-secondary md:block">
          {/* TODO: SessionList component */}
          <div className="p-4">
            <p className="text-text-secondary text-sm">Sessions will appear here</p>
          </div>
        </aside>

        {/* Terminal area */}
        <div className="flex flex-1 flex-col">
          {/* TODO: Terminal component */}
          <div className="flex-1 p-4">
            <div className="terminal-container h-full flex items-center justify-center">
              <p className="text-text-secondary">Terminal component will render here</p>
            </div>
          </div>

          {/* TODO: Input area for voice/text commands */}
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              {/* TODO: Voice input button */}
              <button
                className="rounded-lg bg-bg-secondary px-4 py-2 text-text-primary hover:bg-border transition-colors"
                disabled
              >
                Voice
              </button>
              {/* TODO: Text input */}
              <input
                type="text"
                placeholder="Enter command..."
                className="flex-1 rounded-lg bg-bg-secondary px-4 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                disabled
              />
              {/* TODO: Send button */}
              <button
                className="rounded-lg bg-accent px-4 py-2 text-bg-primary font-medium hover:opacity-90 transition-opacity"
                disabled
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
