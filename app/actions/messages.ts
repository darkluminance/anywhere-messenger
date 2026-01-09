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

// Get all messages for the current user
export async function getMessages(): Promise<Message[]> {
  const supabase = await createClient();
  
  // Clean up expired messages first
  await cleanupExpired();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

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

// Upload a file and create a message
export async function uploadFile(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const file = formData.get("file") as File;
  const isTemporary = formData.get("isTemporary") === "true";
  const description = (formData.get("description") as string) || file.name;

  if (!file) {
    return { success: false, error: "No file provided" };
  }

  // Determine message type
  const isImage = file.type.startsWith("image/");
  const type: MessageType = isImage ? "image" : "file";

  // Generate unique filename
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${user.id}/${timestamp}-${safeName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(filePath, file);

  if (uploadError) {
    console.error("Error uploading file:", uploadError);
    return { success: false, error: uploadError.message };
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("files").getPublicUrl(filePath);

  // For private buckets, we need to create a signed URL or use the path
  // Since our bucket is private, we'll store the path and generate signed URLs when needed
  const expiresAt = isTemporary
    ? new Date(Date.now() + TEMP_MESSAGE_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  const { error: insertError } = await supabase.from("messages").insert({
    user_id: user.id,
    type,
    content: description,
    file_url: filePath, // Store path, not URL
    file_name: file.name,
    file_size: file.size,
    is_temporary: isTemporary,
    expires_at: expiresAt,
  });

  if (insertError) {
    // Rollback: delete uploaded file
    await supabase.storage.from("files").remove([filePath]);
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
