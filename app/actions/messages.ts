"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Message, MessageType } from "@/lib/supabase/types";

const TEMP_MESSAGE_HOURS = 24;

// Helper to detect if content is a URL
function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

// Clean up expired temporary messages
export async function cleanupExpired(): Promise<void> {
  const supabase = await createClient();
  
  // Get expired messages that have files to delete
  const { data: expiredWithFiles } = await supabase
    .from("messages")
    .select("id, file_url")
    .lt("expires_at", new Date().toISOString())
    .not("file_url", "is", null);

  // Delete files from storage
  if (expiredWithFiles && expiredWithFiles.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (user) {
      const filePaths = expiredWithFiles
        .map((m) => {
          if (!m.file_url) return null;
          // Extract path from URL: .../files/user_id/filename
          const match = m.file_url.match(/files\/([^?]+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];

      if (filePaths.length > 0) {
        await supabase.storage.from("files").remove(filePaths);
      }
    }
  }

  // Delete expired messages from database
  await supabase
    .from("messages")
    .delete()
    .lt("expires_at", new Date().toISOString());
}

const MESSAGE_COLUMNS =
  "id, user_id, type, content, file_url, file_name, file_size, is_temporary, expires_at, created_at";
const MESSAGE_PAGE_SIZE = 50;

// Get messages for the current user (most recent first).
// This is a pure read on the request critical path — no cleanup here.
// Expired messages are filtered out in the query so they never render,
// even before they are physically deleted by cleanupExpired().
export async function getMessages(): Promise<Message[]> {
  const supabase = await createClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  return data as Message[];
}

// Send a text or link message
export async function sendMessage(
  content: string,
  isTemporary: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const type: MessageType = isUrl(content.trim()) ? "link" : "text";
  const expiresAt = isTemporary
    ? new Date(Date.now() + TEMP_MESSAGE_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from("messages").insert({
    user_id: user.id,
    type,
    content: content.trim(),
    is_temporary: isTemporary,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Error sending message:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Create a message row for a file that was already uploaded to storage
// directly from the browser. The file itself never passes through this
// Server Action, so it is not subject to the ~1MB Server Action body limit.
export async function createFileMessage(input: {
  filePath: string;
  fileName: string;
  fileSize: number;
  type: MessageType;
  description: string;
  isTemporary: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Defense in depth: the uploaded path must live under the user's folder.
  if (!input.filePath.startsWith(`${user.id}/`)) {
    // Attempt to clean up the stray upload, then reject.
    await supabase.storage.from("files").remove([input.filePath]);
    return { success: false, error: "Invalid file path" };
  }

  const expiresAt = input.isTemporary
    ? new Date(Date.now() + TEMP_MESSAGE_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  const { error: insertError } = await supabase.from("messages").insert({
    user_id: user.id,
    type: input.type,
    content: input.description,
    file_url: input.filePath, // Store path, not URL (private bucket)
    file_name: input.fileName,
    file_size: input.fileSize,
    is_temporary: input.isTemporary,
    expires_at: expiresAt,
  });

  if (insertError) {
    // Rollback: delete the uploaded file so we don't orphan storage.
    await supabase.storage.from("files").remove([input.filePath]);
    console.error("Error creating message:", insertError);
    return { success: false, error: insertError.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Delete a message
export async function deleteMessage(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get message to check for file
  const { data: message } = await supabase
    .from("messages")
    .select("file_url")
    .eq("id", id)
    .single();

  // Delete file from storage if exists
  if (message?.file_url) {
    await supabase.storage.from("files").remove([message.file_url]);
  }

  // Delete message
  const { error } = await supabase.from("messages").delete().eq("id", id);

  if (error) {
    console.error("Error deleting message:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Get a signed URL for a file (since bucket is private)
export async function getFileUrl(
  filePath: string
): Promise<{ url: string | null; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

  if (error) {
    console.error("Error creating signed URL:", error);
    return { url: null, error: error.message };
  }

  return { url: data.signedUrl };
}

// Toggle message temporary status
export async function toggleTemporary(
  id: string,
  isTemporary: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const expiresAt = isTemporary
    ? new Date(Date.now() + TEMP_MESSAGE_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("messages")
    .update({ is_temporary: isTemporary, expires_at: expiresAt })
    .eq("id", id);

  if (error) {
    console.error("Error updating message:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
