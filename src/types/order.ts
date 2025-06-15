
export interface Order {
  id: string;
  project_id: string;
  supplier: string;
  order_date: string;
  expected_delivery: string;
  status: 'pending' | 'delivered' | 'canceled' | 'delayed';
  created_at: string;
  updated_at: string;
  order_type: 'standard' | 'semi-finished';
  notes?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  description: string;
  quantity: number;
  article_code: string;
  created_at: string;
  updated_at: string;
  accessory_id?: string | null;
  notes?: string | null;
}

export interface OrderAttachment {
  id:string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface OrderStep {
  id: string;
  order_id: string;
  step_number: number;
  name: string;
  supplier?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  start_date?: string | null;
  expected_duration_days?: number | null;
  end_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
