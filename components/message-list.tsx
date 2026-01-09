"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageCard } from "@/components/message-card";
import type { Message } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { getMessages } from "@/app/actions/messages";
import { InboxIcon } from "lucide-react";

interface MessageListProps {
  initialMessages: Message[];
}

export function MessageList({ initialMessages }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isConnected, setIsConnected] = useState(false);

  const refreshMessages = useCallback(async () => {
    const updatedMessages = await getMessages();
    setMessages(updatedMessages);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Get current user for filtering
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to realtime changes for this user's messages
      const channel = supabase
        .channel(`messages-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refreshMessages();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refreshMessages();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refreshMessages();
          }
        )
        .subscribe((status) => {
          setIsConnected(status === "SUBSCRIBED");
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtime();
    
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [refreshMessages]);

  // Update messages when initialMessages changes (from server revalidation)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  if (messages.length === 0) {
    return (
      <div className="space-y-4">
        <ConnectionStatus isConnected={isConnected} />
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <InboxIcon className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No messages yet</p>
          <p className="text-sm">Send something to get started</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const formatDateHeader = (date: string) => {
    if (date === today) return "Today";
    if (date === yesterday) return "Yesterday";
    return date;
  };

  return (
    <div className="space-y-4">
      <ConnectionStatus isConnected={isConnected} />
      <div className="space-y-6">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground px-1">
              {formatDateHeader(date)}
            </h3>
            <div className="space-y-3">
              {dateMessages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      {isConnected ? (
        <>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live sync active</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Connecting...</span>
        </>
      )}
    </div>
  );
}
