"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  XIcon,
  SmartphoneIcon,
  MonitorIcon,
  ArrowRightLeftIcon,
  ImageIcon,
  FileTextIcon,
  LinkIcon,
} from "lucide-react";

export function WelcomeBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("welcome-dismissed");
    setIsVisible(!dismissed);
    setIsLoaded(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("welcome-dismissed", "true");
    setIsVisible(false);
  };

  // Don't render anything until we've checked localStorage
  if (!isLoaded || !isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-5 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="absolute top-2 right-2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
      >
        <XIcon className="w-4 h-4" />
      </Button>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Your Personal Cross-Device Clipboard</h2>
          <p className="text-sm text-muted-foreground">
            Share anything between your devices instantly. No apps to install, works in any browser.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 py-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <SmartphoneIcon className="w-8 h-8" />
            <span className="text-xs">Phone</span>
          </div>
          <ArrowRightLeftIcon className="w-5 h-5 text-primary" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <MonitorIcon className="w-8 h-8" />
            <span className="text-xs">PC</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <FileTextIcon className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">Text & Notes</span>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <LinkIcon className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">Links</span>
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/50">
            <ImageIcon className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">Images & Files</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          <span className="text-amber-600 dark:text-amber-400 font-medium">24h</span> = auto-deletes after 24 hours  •  
          <span className="text-emerald-600 dark:text-emerald-400 font-medium"> Keep</span> = saved permanently
        </p>
      </div>
    </div>
  );
}
