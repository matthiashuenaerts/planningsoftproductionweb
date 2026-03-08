import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { X, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeneralMessage {
  id: string;
  title: string;
  message: string;
  message_type: string;
}

const typeConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  info: {
    icon: <Info className="h-4 w-4 flex-shrink-0" />,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 flex-shrink-0" />,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
  },
  success: {
    icon: <CheckCircle className="h-4 w-4 flex-shrink-0" />,
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-800 dark:text-green-200",
  },
  error: {
    icon: <XCircle className="h-4 w-4 flex-shrink-0" />,
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
  },
};

const GeneralMessageBanner: React.FC = () => {
  const { currentEmployee } = useAuth();
  const qc = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ["general-messages-active", currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];

      // Fetch active messages
      const { data: allMessages, error: msgError } = await supabase
        .from("general_messages")
        .select("id, title, message, message_type")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (msgError || !allMessages?.length) return [];

      // Fetch dismissed message IDs for this user
      const { data: dismissed } = await supabase
        .from("dismissed_messages")
        .select("message_id")
        .eq("user_id", currentEmployee.id);

      const dismissedIds = new Set((dismissed ?? []).map((d) => d.message_id));

      // Return only undismissed messages
      return (allMessages as GeneralMessage[]).filter((m) => !dismissedIds.has(m.id));
    },
    enabled: !!currentEmployee?.id,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const handleDismiss = async (messageId: string) => {
    if (!currentEmployee?.id) return;

    // Optimistic update
    qc.setQueryData(
      ["general-messages-active", currentEmployee.id],
      (old: GeneralMessage[] | undefined) => (old ?? []).filter((m) => m.id !== messageId)
    );

    await supabase.from("dismissed_messages").insert({
      message_id: messageId,
      user_id: currentEmployee.id,
    });
  };

  if (!messages?.length) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
      <div className="pointer-events-auto">
        {messages.map((msg) => {
          const config = typeConfig[msg.message_type] || typeConfig.info;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2.5 px-4 py-2.5 border-b",
                config.bg,
                config.border,
                config.text
              )}
            >
              <div className="mt-0.5">{config.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{msg.title}</p>
                <p className="text-xs opacity-80 mt-0.5 break-words">{msg.message}</p>
              </div>
              <button
                onClick={() => handleDismiss(msg.id)}
                className="mt-0.5 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GeneralMessageBanner;
