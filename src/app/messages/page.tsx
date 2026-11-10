import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare, Scale } from "lucide-react";
import { sendMessage } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type ConversationRow = {
  id: string;
  matter_id: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (!isSupabaseConfigured) redirect("/login");

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversationData } = await db
    .from("conversations")
    .select("id,matter_id,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const conversations = (conversationData ?? []) as ConversationRow[];
  const selected = conversations.find((conversation) => conversation.id === params.conversation)
    ?? conversations[0];

  let messages: MessageRow[] = [];
  if (selected) {
    const { data } = await db
      .from("messages")
      .select("id,sender_user_id,body,created_at")
      .eq("conversation_id", selected.id)
      .is("deleted_at", null)
      .order("created_at")
      .limit(100);
    messages = (data ?? []) as MessageRow[];
  }

  return (
    <main className="workspace-page">
      <div className="wrap workspace-content">
        <Link href="/dashboard" className="text-link">← Workspace</Link>
        <div className="workspace-heading">
          <div>
            <div className="eyebrow dark">SECURE COMMUNICATIONS</div>
            <h1>Messages</h1>
            <p>Conversations are limited to their authorised participants.</p>
          </div>
        </div>
        {params.error && <p className="form-alert error">{params.error}</p>}

        <div className="workspace-grid">
          <aside className="dash-card">
            <h2>Conversations</h2>
            {conversations.length ? (
              conversations.map((conversation) => (
                <Link
                  className="quick-link"
                  href={`/messages?conversation=${conversation.id}`}
                  key={conversation.id}
                >
                  <MessageSquare size={16} />
                  {conversation.matter_id
                    ? `Matter ${conversation.matter_id.slice(0, 8)}`
                    : "General conversation"}
                </Link>
              ))
            ) : (
              <p>
                No conversations yet. Conversations open when a client invites a practitioner
                to contact.
              </p>
            )}
          </aside>

          <section className="dash-card">
            <h2>{selected ? "Conversation" : "No conversation selected"}</h2>
            {selected ? (
              <>
                <div className="message-thread">
                  {messages.map((message) => (
                    <div
                      className={`message-bubble ${message.sender_user_id === user.id ? "mine" : "theirs"}`}
                      key={message.id}
                    >
                      <p>{message.body}</p>
                      <small>{new Date(message.created_at).toLocaleString("en-ZA")}</small>
                    </div>
                  ))}
                  {!messages.length && (
                    <p className="empty-inline">
                      This conversation is ready. Keep communication professional and avoid
                      sharing information unrelated to the matter.
                    </p>
                  )}
                </div>
                <form action={sendMessage} className="message-form">
                  <input type="hidden" name="conversation_id" value={selected.id} />
                  <textarea
                    name="body"
                    rows={3}
                    maxLength={10000}
                    required
                    placeholder="Write a secure message…"
                  />
                  <button className="btn btn-navy">Send message</button>
                </form>
              </>
            ) : (
              <div className="empty-state">
                <Scale size={26} />
                <p>
                  When you accept or receive an invitation to contact, the secure conversation
                  will appear here.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
