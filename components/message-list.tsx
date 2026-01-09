"use client";

import { useEffect, useState } from "react";
import { MessageCard } from "@/components/message-card";
import type { Message } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { getMessages } from "@/app/actions/messages";
import { InboxIcon, Loader2Icon } from "lucide-react";

interface MessageListProps {
  initialMessages: Message[];
}

export function MessageList({ initialMessages }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async () => {
          // Refetch messages when any change occurs
          const updatedMessages = await getMessages();
          setMessages(updatedMessages);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update messages when initialMessages changes (from server revalidation)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <InboxIcon className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No messages yet</p>
        <p className="text-sm">Send something to get started</p>
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
  );
}
