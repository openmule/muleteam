// Shared TypeScript interfaces for MuleTeam

export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string;
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
  labels?: string[];
  participants: Participant[];
  channel_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  last_seen_at: string;
  created_at?: string;
}

export interface ChannelMeta {
  id: string;
  name: string;
  description?: string;
  members: Participant[];
  created_at: string;
  updated_at: string;
}
