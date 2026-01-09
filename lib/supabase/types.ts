export type MessageType = "text" | "link" | "image" | "file";

export interface Message {
  id: string;
  user_id: string;
  type: MessageType;
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_temporary: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface CreateMessageInput {
  type: MessageType;
  content: string;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  is_temporary: boolean;
}
