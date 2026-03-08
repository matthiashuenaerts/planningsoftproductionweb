import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Megaphone, Info, AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, Users, Pencil, X, Save,
} from "lucide-react";
import { format } from "date-fns";

interface GeneralMessage {
  id: string;
  title: string;
  message: string;
  message_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-blue-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  success: <CheckCircle className="h-4 w-4 text-green-400" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
};

const typeColors: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  warning: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  success: "bg-green-500/20 text-green-300 border-green-500/30",
  error: "bg-red-500/20 text-red-300 border-red-500/30",
};

const MessageForm: React.FC<{
  title: string;
  message: string;
  messageType: string;
  saving: boolean;
  heading: string;
  submitLabel: string;
  onTitleChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}> = ({ title, message, messageType, saving, heading, submitLabel, onTitleChange, onMessageChange, onTypeChange, onSubmit, onCancel }) => (
  <Card className="bg-white/5 border-white/10 text-white">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{heading}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Title</Label>
        <Input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="e.g. New Feature: Dark Mode" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Message</Label>
        <Textarea value={message} onChange={(e) => onMessageChange(e.target.value)} placeholder="Write the message that all users will see..." rows={4} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Type</Label>
        <Select value={messageType} onValueChange={onTypeChange}>
          <SelectTrigger className="bg-white/10 border-white/20 text-white w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">ℹ️ Info</SelectItem>
            <SelectItem value="warning">⚠️ Warning</SelectItem>
            <SelectItem value="success">✅ Success</SelectItem>
            <SelectItem value="error">❌ Error</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? "Saving..." : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white">
          Cancel
        </Button>
      </div>
    </CardContent>
  </Card>
);

const DevGeneralMessages: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editType, setEditType] = useState("info");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["dev", "general-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GeneralMessage[];
    },
  });

  const { data: dismissCounts } = useQuery({
    queryKey: ["dev", "general-messages-dismiss-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dismissed_messages")
        .select("message_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((d) => {
        counts[d.message_id] = (counts[d.message_id] || 0) + 1;
      });
      return counts;
    },
  });

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Missing fields", description: "Title and message are required", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.from("general_messages").insert({
        title: title.trim(),
        message: message.trim(),
        message_type: messageType,
        is_active: true,
      });
      if (error) throw error;
      setTitle("");
      setMessage("");
      setMessageType("info");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["dev", "general-messages"] });
      toast({ title: "Message created" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Error creating message", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (msg: GeneralMessage) => {
    setEditingId(msg.id);
    setEditTitle(msg.title);
    setEditMessage(msg.message);
    setEditType(msg.message_type);
    setShowForm(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editTitle.trim() || !editMessage.trim()) {
      toast({ title: "Missing fields", description: "Title and message are required", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from("general_messages")
        .update({ title: editTitle.trim(), message: editMessage.trim(), message_type: editType })
        .eq("id", editingId);
      if (error) throw error;
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["dev", "general-messages"] });
      toast({ title: "Message updated" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Error updating message", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("general_messages").update({ is_active: !currentActive }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["dev", "general-messages"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this message permanently?")) return;
    const { error } = await supabase.from("general_messages").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["dev", "general-messages"] });
    qc.invalidateQueries({ queryKey: ["dev", "general-messages-dismiss-counts"] });
    toast({ title: "Deleted" });
  };

  const handleResetDismissals = async (id: string) => {
    const { error } = await supabase.from("dismissed_messages").delete().eq("message_id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["dev", "general-messages-dismiss-counts"] });
    toast({ title: "Dismissals reset", description: "All users will see this message again." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold">General Messages</h2>
          <Badge variant="outline" className="text-slate-400 border-white/20">
            {messages?.length ?? 0} messages
          </Badge>
        </div>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" /> New Message
        </Button>
      </div>

      {showForm && !editingId && (
        <MessageForm
          title={title} message={message} messageType={messageType} saving={saving}
          heading="Create New Message" submitLabel="Create Message"
          onTitleChange={setTitle} onMessageChange={setMessage} onTypeChange={setMessageType}
          onSubmit={handleCreate} onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading messages...</p>
      ) : !messages?.length ? (
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="py-12 text-center">
            <Megaphone className="h-10 w-10 mx-auto text-slate-500 mb-3" />
            <p className="text-slate-400">No general messages yet</p>
            <p className="text-sm text-slate-500">Create a message to inform all users about updates or changes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) =>
            editingId === msg.id ? (
              <MessageForm
                key={msg.id}
                title={editTitle} message={editMessage} messageType={editType} saving={saving}
                heading="Edit Message" submitLabel="Save Changes"
                onTitleChange={setEditTitle} onMessageChange={setEditMessage} onTypeChange={setEditType}
                onSubmit={handleUpdate} onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={msg.id} className={`bg-white/5 border-white/10 text-white ${!msg.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {typeIcons[msg.message_type]}
                        <h3 className="font-semibold text-sm">{msg.title}</h3>
                        <Badge className={`text-[10px] ${typeColors[msg.message_type]}`}>{msg.message_type}</Badge>
                        {msg.is_active ? (
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">Active</Badge>
                        ) : (
                          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px]">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{msg.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>Created {format(new Date(msg.created_at), "dd MMM yyyy HH:mm")}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {dismissCounts?.[msg.id] ?? 0} dismissed
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(msg)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(msg.id, msg.is_active)} className="h-8 w-8 p-0 text-slate-400 hover:text-white" title={msg.is_active ? "Deactivate" : "Activate"}>
                        {msg.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleResetDismissals(msg.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-amber-400" title="Reset dismissals">
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(msg.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default DevGeneralMessages;
