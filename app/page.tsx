import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { MessageComposer } from "@/components/message-composer";
import { MessageList } from "@/components/message-list";
import { getMessages } from "@/app/actions/messages";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const messages = await getMessages();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header
        userEmail={user.email}
        userAvatar={user.user_metadata?.avatar_url}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <MessageComposer />
        <MessageList initialMessages={messages} />
      </main>
    </div>
  );
}
