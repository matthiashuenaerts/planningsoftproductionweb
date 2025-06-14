export interface RushOrderTask {
  id: string;
  rush_order_id: string;
  standard_task_id: string;
  task_name?: string;
  task_number?: string;
  created_at: string;
}

export interface RushOrderAssignment {
  id: string;
  rush_order_id: string;
  employee_id: string;
  employee_name?: string;
  created_at: string;
}

export interface RushOrderMessage {
  id: string;
  rush_order_id: string;
  employee_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_role?: string;
  is_read?: boolean;
}

// Add interface for message read tracking
export interface RushOrderMessageRead {
  rush_order_id: string;
  employee_id: string;
  last_read_at: string;
}

export interface RushOrder {
  id: string;
  title: string;
  description: string;
  deadline: string;
  image_url?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "critical";
  created_by: string;
  created_at: string;
  updated_at: string;
  tasks?: RushOrderTask[];
  assignments?: RushOrderAssignment[];
  messages?: RushOrderMessage[];
  unread_messages_count?: number;
}

export interface RushOrderFormData {
  title: string;
  description: string;
  deadline: Date;
  attachment?: File;
  selectedTasks: string[];
  assignedUsers: string[];
}
