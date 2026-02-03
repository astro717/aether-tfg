import { useState } from "react";
import { ThreadsList } from "./ThreadsList";
import { ChatView } from "./ChatView";
import { mockThreads } from "../data/mockData";

export function MessagingLayout() {
  // Default to first thread selected
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    mockThreads[0]?.id || null
  );

  return (
    // Wrapper: h-full w-full p-6 flex gap-6 (Consistent padding with Dashboard)
    <div className="h-full w-full p-6 flex gap-6">
      {/* Threads Panel (Left) - w-80 shrink-0 */}
      <div
        className="
          w-80 shrink-0
          bg-white/50 backdrop-blur-xl
          rounded-[32px]
          border border-white/40
          shadow-xl
          overflow-hidden
        "
      >
        <ThreadsList
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
        />
      </div>

      {/* Chat Panel (Right) - flex-1 */}
      <div
        className="
          flex-1
          bg-white/50 backdrop-blur-xl
          rounded-[32px]
          border border-white/40
          shadow-xl
          overflow-hidden
        "
      >
        <ChatView threadId={selectedThreadId} />
      </div>
    </div>
  );
}
