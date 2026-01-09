"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage, uploadFile } from "@/app/actions/messages";
import { ImageIcon, FileIcon, SendIcon, Loader2Icon } from "lucide-react";

export function MessageComposer() {
  const [content, setContent] = useState("");
  const [isTemporary, setIsTemporary] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);
    const result = await sendMessage(content, isTemporary);
    setIsLoading(false);

    if (result.success) {
      setContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (file: File) => {
    if (isLoading) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("isTemporary", String(isTemporary));
    formData.append("description", file.name);

    await uploadFile(formData);
    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      e.target.value = "";
    }
  };

  // Handle paste for images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
          const namedFile = new File([file], `clipboard-${timestamp}.png`, {
            type: file.type,
          });
          await handleFileUpload(namedFile);
        }
        return;
      }
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="space-y-3">
        <Textarea
          placeholder="Type or paste anything... (Ctrl+V for images)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="min-h-[80px] resize-none bg-background/50 border-border/50 focus:border-primary/50"
          disabled={isLoading}
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading}
              className="gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Image</span>
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.zip,.rar,.7z"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="gap-2"
            >
              <FileIcon className="w-4 h-4" />
              <span className="hidden sm:inline">File</span>
            </Button>

            <div className="h-6 w-px bg-border mx-1" />

            <div className="flex items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setIsTemporary(true)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  isTemporary
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                24h
              </button>
              <button
                type="button"
                onClick={() => setIsTemporary(false)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  !isTemporary
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Keep
              </button>
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={!content.trim() || isLoading}
            size="sm"
            className="gap-2 px-4"
          >
            {isLoading ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <SendIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
