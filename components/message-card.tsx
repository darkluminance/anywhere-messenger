"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Message } from "@/lib/supabase/types";
import { deleteMessage, getFileUrl, toggleTemporary } from "@/app/actions/messages";
import {
  CopyIcon,
  TrashIcon,
  ExternalLinkIcon,
  DownloadIcon,
  CheckIcon,
  ImageIcon,
  FileIcon,
  LinkIcon,
  ClockIcon,
  Loader2Icon,
} from "lucide-react";

interface MessageCardProps {
  message: Message;
}

export function MessageCard({ message }: MessageCardProps) {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    await deleteMessage(message.id);
  };

  const handleToggleTemp = async () => {
    if (isToggling) return;
    setIsToggling(true);
    await toggleTemporary(message.id, !message.is_temporary);
    setIsToggling(false);
  };

  const handleOpenLink = () => {
    window.open(message.content, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    if (!message.file_url) return;

    const { url } = await getFileUrl(message.file_url);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = message.file_name || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Load image on mount for image messages
  useEffect(() => {
    if (message.type !== "image" || !message.file_url) return;
    
    let cancelled = false;
    
    const loadImage = async () => {
      setImageLoading(true);
      const { url } = await getFileUrl(message.file_url!);
      if (!cancelled) {
        setImageUrl(url);
        setImageLoading(false);
      }
    };
    
    loadImage();
    
    return () => {
      cancelled = true;
    };
  }, [message.type, message.file_url]);

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getExpiryText = () => {
    if (!message.is_temporary || !message.expires_at) return null;
    const expiresAt = new Date(message.expires_at);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    if (hoursLeft === 0) {
      const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)));
      return `${minutesLeft}m left`;
    }
    return `${hoursLeft}h left`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = () => {
    switch (message.type) {
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "file":
        return <FileIcon className="w-4 h-4" />;
      case "link":
        return <LinkIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="group bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-colors">
      <div className="space-y-3">
        {/* Content */}
        <div className="space-y-2">
          {message.type === "image" && (
            <div className="relative rounded-lg overflow-hidden bg-muted/30 aspect-video max-w-sm">
              {imageLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={message.content}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {message.type === "link" ? (
            <a
              href={message.content}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all line-clamp-2"
            >
              {message.content}
            </a>
          ) : message.type === "file" ? (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{message.file_name}</p>
                {message.file_size && (
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(message.file_size)}
                  </p>
                )}
              </div>
            </div>
          ) : message.type === "text" ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {getIcon()}
            <span>{getTimeAgo(message.created_at)}</span>
            <button
              onClick={handleToggleTemp}
              disabled={isToggling}
              className="transition-opacity hover:opacity-80"
            >
              {message.is_temporary ? (
                <Badge variant="secondary" className="gap-1 font-normal bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  <ClockIcon className="w-3 h-3" />
                  {getExpiryText()}
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  Permanent
                </Badge>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {message.type === "text" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-9 w-9 p-0 bg-muted/50"
              >
                {copied ? (
                  <CheckIcon className="w-4.5 h-4.5 text-emerald-500" />
                ) : (
                  <CopyIcon className="w-4.5 h-4.5" />
                )}
              </Button>
            )}

            {message.type === "link" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenLink}
                className="h-9 w-9 p-0 bg-muted/50"
              >
                <ExternalLinkIcon className="w-4.5 h-4.5" />
              </Button>
            )}

            {(message.type === "image" || message.type === "file") && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-9 w-9 p-0 bg-muted/50"
              >
                <DownloadIcon className="w-4.5 h-4.5" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-9 w-9 p-0 bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2Icon className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <TrashIcon className="w-4.5 h-4.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
