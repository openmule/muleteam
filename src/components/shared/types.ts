// Shared TypeScript interfaces for MuleTeam

export interface User {
  id: string;
  email: string;
  name: string;
  description?: string;
  avatar_url?: string | null;
  created_at?: string;
  invited_by?: { id: string; name: string };
  team_role?: "owner" | "member";
}

export interface Participant {
  id: string;
  type: "human" | "agent";
  name: string;
}

export interface ThreadMeta {
  id: string;
  title: string;
  description?: string;
  status: string;
  status_label?: string;
  status_detail?: string;
  labels?: string[];
  participants: Participant[];
  channel_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_message?: { from_name: string; body: string; ts: number };
}

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  last_seen_at: string;
  created_at?: string;
  created_by?: { id: string; name: string };
}

export interface ChannelMeta {
  id: string;
  name: string;
  description?: string;
  members: Participant[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  assignee_name?: string;
  status: "open" | "in_progress" | "done";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  source_message_id?: string;
}

export interface NotificationEvent {
  id: string;
  user_id: string;
  type: "mention" | "reply" | "join" | "status_change" | "task_assigned" | "task_done";
  thread_id: string;
  thread_title: string;
  message_id: string | null;
  actor_id: string;
  actor_name: string;
  body: string | null;
  read: boolean;
  created_at: string;
}
