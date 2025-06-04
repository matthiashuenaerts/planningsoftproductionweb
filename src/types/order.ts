
export interface Order {
  id: string;
  project_id: string;
  supplier: string;
  order_date: string;
  expected_delivery: string;
  status: 'pending' | 'delivered' | 'canceled' | 'delayed';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  description: string;
  quantity: number;
  article_code: string;
  created_at: string;
  updated_at: string;
}

export interface OrderAttachment {
  id: string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}
