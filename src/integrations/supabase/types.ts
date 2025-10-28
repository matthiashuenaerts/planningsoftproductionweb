export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      accessories: {
        Row: {
          article_code: string | null
          article_description: string | null
          article_name: string
          created_at: string
          id: string
          order_id: string | null
          project_id: string
          qr_code_text: string | null
          quantity: number
          status: string
          stock_location: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          article_code?: string | null
          article_description?: string | null
          article_name: string
          created_at?: string
          id?: string
          order_id?: string | null
          project_id: string
          qr_code_text?: string | null
          quantity?: number
          status?: string
          stock_location?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          article_code?: string | null
          article_description?: string | null
          article_name?: string
          created_at?: string
          id?: string
          order_id?: string | null
          project_id?: string
          qr_code_text?: string | null
          quantity?: number
          status?: string
          stock_location?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessories_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      broken_parts: {
        Row: {
          created_at: string
          description: string
          id: string
          image_path: string | null
          project_id: string | null
          reported_by: string
          updated_at: string
          workstation_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_path?: string | null
          project_id?: string | null
          reported_by: string
          updated_at?: string
          workstation_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          project_id?: string | null
          reported_by?: string
          updated_at?: string
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broken_parts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broken_parts_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broken_parts_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_task_relationships: {
        Row: {
          base_duration_minutes: number
          created_at: string
          formula: string | null
          id: string
          multiplier: number
          standard_task_id: string
          updated_at: string
          variable_name: string
        }
        Insert: {
          base_duration_minutes?: number
          created_at?: string
          formula?: string | null
          id?: string
          multiplier?: number
          standard_task_id: string
          updated_at?: string
          variable_name: string
        }
        Update: {
          base_duration_minutes?: number
          created_at?: string
          formula?: string | null
          id?: string
          multiplier?: number
          standard_task_id?: string
          updated_at?: string
          variable_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_task_relationships_standard_task_id_fkey"
            columns: ["standard_task_id"]
            isOneToOne: false
            referencedRelation: "standard_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          chat_room_id: string
          created_at: string
          employee_id: string
          id: string
          message: string
          updated_at: string
        }
        Insert: {
          chat_room_id: string
          created_at?: string
          employee_id: string
          id?: string
          message: string
          updated_at?: string
        }
        Update: {
          chat_room_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_team_assignments: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          is_available: boolean
          notes: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          id?: string
          is_available?: boolean
          notes?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_available?: boolean
          notes?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_team_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "placement_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_configurations: {
        Row: {
          created_at: string
          description: string | null
          function_name: string
          id: string
          recipient_emails: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          function_name: string
          id?: string
          recipient_emails?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          function_name?: string
          id?: string
          recipient_emails?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      email_schedule_configs: {
        Row: {
          created_at: string
          forecast_weeks: number
          function_name: string
          id: string
          is_active: boolean
          language: string
          schedule_day: string
          schedule_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          forecast_weeks?: number
          function_name: string
          id?: string
          is_active?: boolean
          language?: string
          schedule_day?: string
          schedule_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          forecast_weeks?: number
          function_name?: string
          id?: string
          is_active?: boolean
          language?: string
          schedule_day?: string
          schedule_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_workstation_links: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          workstation_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          workstation_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_workstation_links_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_workstation_links_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          id: string
          logistics: boolean | null
          name: string
          password: string
          role: string
          workstation: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          logistics?: boolean | null
          name: string
          password: string
          role: string
          workstation?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          logistics?: boolean | null
          name?: string
          password?: string
          role?: string
          workstation?: string | null
        }
        Relationships: []
      }
      help_articles: {
        Row: {
          category_id: string
          content: string
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          image_url: string | null
          is_published: boolean
          tags: string[] | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      holiday_requests: {
        Row: {
          admin_notes: string | null
          approved_by: string | null
          created_at: string
          employee_name: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["holiday_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_by?: string | null
          created_at?: string
          employee_name: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["holiday_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_by?: string | null
          created_at?: string
          employee_name?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["holiday_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          team: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          team: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          team?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          rush_order_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          rush_order_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          rush_order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_rush_order_id_fkey"
            columns: ["rush_order_id"]
            isOneToOne: false
            referencedRelation: "rush_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          accessory_id: string | null
          article_code: string | null
          created_at: string
          delivered_quantity: number
          description: string
          ean: string | null
          id: string
          notes: string | null
          order_id: string
          quantity: number
          stock_location: string | null
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          accessory_id?: string | null
          article_code?: string | null
          created_at?: string
          delivered_quantity?: number
          description: string
          ean?: string | null
          id?: string
          notes?: string | null
          order_id: string
          quantity: number
          stock_location?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          accessory_id?: string | null
          article_code?: string | null
          created_at?: string
          delivered_quantity?: number
          description?: string
          ean?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          stock_location?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_steps: {
        Row: {
          created_at: string
          end_date: string | null
          expected_duration_days: number | null
          id: string
          name: string
          notes: string | null
          order_id: string
          start_date: string | null
          status: string
          step_number: number
          supplier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          expected_duration_days?: number | null
          id?: string
          name: string
          notes?: string | null
          order_id: string
          start_date?: string | null
          status?: string
          step_number: number
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          expected_duration_days?: number | null
          id?: string
          name?: string
          notes?: string | null
          order_id?: string
          start_date?: string | null
          status?: string
          step_number?: number
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_steps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          expected_delivery: string
          external_order_number: string | null
          id: string
          notes: string | null
          order_date: string
          order_type: string
          project_id: string | null
          source: string | null
          status: string
          supplier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_delivery: string
          external_order_number?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_type?: string
          project_id?: string | null
          source?: string | null
          status: string
          supplier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_delivery?: string
          external_order_number?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_type?: string
          project_id?: string | null
          source?: string | null
          status?: string
          supplier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          error_count: number | null
          id: string
          sync_timestamp: string | null
          synced_count: number | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_count?: number | null
          id?: string
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_count?: number | null
          id?: string
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Relationships: []
      }
      parts: {
        Row: {
          aantal: number | null
          abd: string | null
          afbeelding: string | null
          afplak_boven: string | null
          afplak_links: string | null
          afplak_onder: string | null
          afplak_rechts: string | null
          breedte: string | null
          cnc_pos: string | null
          cncprg1: string | null
          cncprg2: string | null
          color_status: string | null
          commentaar: string | null
          commentaar_2: string | null
          created_at: string
          dikte: string | null
          doorlopende_nerf: string | null
          id: string
          lengte: string | null
          materiaal: string | null
          nerf: string | null
          parts_list_id: string
          updated_at: string
          wand_naam: string | null
          workstation_name_status: string | null
        }
        Insert: {
          aantal?: number | null
          abd?: string | null
          afbeelding?: string | null
          afplak_boven?: string | null
          afplak_links?: string | null
          afplak_onder?: string | null
          afplak_rechts?: string | null
          breedte?: string | null
          cnc_pos?: string | null
          cncprg1?: string | null
          cncprg2?: string | null
          color_status?: string | null
          commentaar?: string | null
          commentaar_2?: string | null
          created_at?: string
          dikte?: string | null
          doorlopende_nerf?: string | null
          id?: string
          lengte?: string | null
          materiaal?: string | null
          nerf?: string | null
          parts_list_id: string
          updated_at?: string
          wand_naam?: string | null
          workstation_name_status?: string | null
        }
        Update: {
          aantal?: number | null
          abd?: string | null
          afbeelding?: string | null
          afplak_boven?: string | null
          afplak_links?: string | null
          afplak_onder?: string | null
          afplak_rechts?: string | null
          breedte?: string | null
          cnc_pos?: string | null
          cncprg1?: string | null
          cncprg2?: string | null
          color_status?: string | null
          commentaar?: string | null
          commentaar_2?: string | null
          created_at?: string
          dikte?: string | null
          doorlopende_nerf?: string | null
          id?: string
          lengte?: string | null
          materiaal?: string | null
          nerf?: string | null
          parts_list_id?: string
          updated_at?: string
          wand_naam?: string | null
          workstation_name_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_parts_list_id_fkey"
            columns: ["parts_list_id"]
            isOneToOne: false
            referencedRelation: "parts_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_lists: {
        Row: {
          created_at: string
          file_name: string
          id: string
          imported_at: string
          imported_by: string | null
          order_id: string | null
          project_id: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          order_id?: string | null
          project_id: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          order_id?: string | null
          project_id?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_lists_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_lists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_item_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          personal_item_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          personal_item_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          personal_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_item_attachments_personal_item_id_fkey"
            columns: ["personal_item_id"]
            isOneToOne: false
            referencedRelation: "personal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_item_shares: {
        Row: {
          can_edit: boolean | null
          created_at: string
          id: string
          personal_item_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          created_at?: string
          id?: string
          personal_item_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          can_edit?: boolean | null
          created_at?: string
          id?: string
          personal_item_id?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_item_shares_personal_item_id_fkey"
            columns: ["personal_item_id"]
            isOneToOne: false
            referencedRelation: "personal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_item_shares_shared_by_user_id_fkey"
            columns: ["shared_by_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_item_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_items: {
        Row: {
          content: string | null
          created_at: string
          due_date: string | null
          id: string
          is_shared: boolean | null
          priority: string | null
          status: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_shared?: boolean | null
          priority?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_shared?: boolean | null
          priority?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_offsets: {
        Row: {
          created_at: string
          days_before_installation: number
          id: string
          phase_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_before_installation?: number
          id?: string
          phase_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_before_installation?: number
          id?: string
          phase_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_offsets_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          progress: number | null
          project_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          progress?: number | null
          project_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          progress?: number | null
          project_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_team_members: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_default: boolean
          team_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_default?: boolean
          team_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_default?: boolean
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "placement_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_teams: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_flow_lines: {
        Row: {
          color: string
          created_at: string
          end_x: number
          end_y: number
          id: string
          is_active: boolean
          name: string
          start_x: number
          start_y: number
          stroke_width: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          end_x: number
          end_y: number
          id?: string
          is_active?: boolean
          name: string
          start_x: number
          start_y: number
          stroke_width?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          end_x?: number
          end_y?: number
          id?: string
          is_active?: boolean
          name?: string
          start_x?: number
          start_y?: number
          stroke_width?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          article_code: string | null
          barcode: string | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          location: string | null
          name: string
          qr_code: string | null
          standard_order_quantity: number | null
          storage_code: string | null
          supplier: string | null
          updated_at: string
          website_link: string | null
        }
        Insert: {
          article_code?: string | null
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          location?: string | null
          name: string
          qr_code?: string | null
          standard_order_quantity?: number | null
          storage_code?: string | null
          supplier?: string | null
          updated_at?: string
          website_link?: string | null
        }
        Update: {
          article_code?: string | null
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          location?: string | null
          name?: string
          qr_code?: string | null
          standard_order_quantity?: number | null
          storage_code?: string | null
          supplier?: string | null
          updated_at?: string
          website_link?: string | null
        }
        Relationships: []
      }
      project_calculation_variables: {
        Row: {
          aantal_boringen: number | null
          aantal_cnc_programmas: number | null
          aantal_drevel_programmas: number | null
          aantal_kasten: number | null
          aantal_kasten_te_monteren: number | null
          aantal_lopende_meter_kantenbanden: number | null
          aantal_lopende_meters_zaagsnede: number | null
          aantal_manueel_te_monteren_kasten: number | null
          aantal_manueel_te_monteren_objecten: number | null
          aantal_objecten: number | null
          aantal_platen: number | null
          aantal_stuks: number | null
          aantal_verschillende_kantenbanden: number | null
          aantal_zaagsnedes: number | null
          created_at: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          aantal_boringen?: number | null
          aantal_cnc_programmas?: number | null
          aantal_drevel_programmas?: number | null
          aantal_kasten?: number | null
          aantal_kasten_te_monteren?: number | null
          aantal_lopende_meter_kantenbanden?: number | null
          aantal_lopende_meters_zaagsnede?: number | null
          aantal_manueel_te_monteren_kasten?: number | null
          aantal_manueel_te_monteren_objecten?: number | null
          aantal_objecten?: number | null
          aantal_platen?: number | null
          aantal_stuks?: number | null
          aantal_verschillende_kantenbanden?: number | null
          aantal_zaagsnedes?: number | null
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          aantal_boringen?: number | null
          aantal_cnc_programmas?: number | null
          aantal_drevel_programmas?: number | null
          aantal_kasten?: number | null
          aantal_kasten_te_monteren?: number | null
          aantal_lopende_meter_kantenbanden?: number | null
          aantal_lopende_meters_zaagsnede?: number | null
          aantal_manueel_te_monteren_kasten?: number | null
          aantal_manueel_te_monteren_objecten?: number | null
          aantal_objecten?: number | null
          aantal_platen?: number | null
          aantal_stuks?: number | null
          aantal_verschillende_kantenbanden?: number | null
          aantal_zaagsnedes?: number | null
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_calculation_variables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_loading_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          original_loading_date: string
          override_loading_date: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          original_loading_date: string
          override_loading_date: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          original_loading_date?: string
          override_loading_date?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_message_reads: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          last_read_at: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          last_read_at?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          last_read_at?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_messages: {
        Row: {
          created_at: string
          employee_id: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_image: boolean | null
          message: string
          project_id: string
          reply_to_message_id: string | null
          target_user_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_image?: boolean | null
          message: string
          project_id: string
          reply_to_message_id?: string | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_image?: boolean | null
          message?: string
          project_id?: string
          reply_to_message_id?: string | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "project_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_onedrive_configs: {
        Row: {
          access_token: string | null
          created_at: string
          folder_id: string
          folder_name: string
          folder_url: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          folder_id: string
          folder_name: string
          folder_url: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          folder_id?: string
          folder_name?: string
          folder_url?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_onedrive_configs_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          error_count: number | null
          id: string
          sync_timestamp: string | null
          synced_count: number | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_count?: number | null
          id?: string
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_count?: number | null
          id?: string
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Relationships: []
      }
      project_team_assignments: {
        Row: {
          created_at: string
          duration: number
          id: string
          project_id: string
          start_date: string
          team: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration?: number
          id?: string
          project_id: string
          start_date: string
          team: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: number
          id?: string
          project_id?: string
          start_date?: string
          team?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_truck_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          installation_date: string
          loading_date: string
          notes: string | null
          project_id: string
          truck_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          installation_date: string
          loading_date: string
          notes?: string | null
          project_id: string
          truck_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          installation_date?: string
          loading_date?: string
          notes?: string | null
          project_id?: string
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_truck_assignments_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_truck_assignments_truck"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string
          created_at: string
          description: string | null
          efficiency_percentage: number | null
          id: string
          installation_date: string
          name: string
          progress: number | null
          project_link_id: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client: string
          created_at?: string
          description?: string | null
          efficiency_percentage?: number | null
          id?: string
          installation_date: string
          name: string
          progress?: number | null
          project_link_id?: string | null
          start_date: string
          status: string
          updated_at?: string
        }
        Update: {
          client?: string
          created_at?: string
          description?: string | null
          efficiency_percentage?: number | null
          id?: string
          installation_date?: string
          name?: string
          progress?: number | null
          project_link_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          navbar_item: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          navbar_item: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          navbar_item?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rush_order_assignments: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          rush_order_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          rush_order_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          rush_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rush_order_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rush_order_assignments_rush_order_id_fkey"
            columns: ["rush_order_id"]
            isOneToOne: false
            referencedRelation: "rush_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      rush_order_messages: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          message: string
          rush_order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          message: string
          rush_order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          message?: string
          rush_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rush_order_messages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rush_order_messages_rush_order_id_fkey"
            columns: ["rush_order_id"]
            isOneToOne: false
            referencedRelation: "rush_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      rush_order_task_links: {
        Row: {
          created_at: string
          id: string
          rush_order_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rush_order_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rush_order_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rush_order_task_links_rush_order_id_fkey"
            columns: ["rush_order_id"]
            isOneToOne: false
            referencedRelation: "rush_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rush_order_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rush_order_tasks: {
        Row: {
          created_at: string
          id: string
          rush_order_id: string
          standard_task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rush_order_id: string
          standard_task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rush_order_id?: string
          standard_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rush_order_tasks_rush_order_id_fkey"
            columns: ["rush_order_id"]
            isOneToOne: false
            referencedRelation: "rush_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rush_order_tasks_standard_task_id_fkey"
            columns: ["standard_task_id"]
            isOneToOne: false
            referencedRelation: "standard_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rush_orders: {
        Row: {
          created_at: string
          created_by: string
          deadline: string
          description: string
          id: string
          image_url: string | null
          priority: string
          project_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deadline: string
          description: string
          id?: string
          image_url?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deadline?: string
          description?: string
          id?: string
          image_url?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rush_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          description: string | null
          employee_id: string
          end_time: string
          id: string
          is_auto_generated: boolean
          phase_id: string | null
          start_time: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          employee_id: string
          end_time: string
          id?: string
          is_auto_generated?: boolean
          phase_id?: string | null
          start_time: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          employee_id?: string
          end_time?: string
          id?: string
          is_auto_generated?: boolean
          phase_id?: string | null
          start_time?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_task_checklists: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_required: boolean
          item_text: string
          standard_task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          item_text: string
          standard_task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          item_text?: string
          standard_task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      standard_task_limit_phases: {
        Row: {
          created_at: string
          id: string
          limit_standard_task_id: string
          standard_task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_standard_task_id: string
          standard_task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_standard_task_id?: string
          standard_task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standard_task_limit_phases_limit_standard_task_id_fkey"
            columns: ["limit_standard_task_id"]
            isOneToOne: false
            referencedRelation: "standard_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_task_limit_phases_standard_task_id_fkey"
            columns: ["standard_task_id"]
            isOneToOne: false
            referencedRelation: "standard_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_task_workstation_links: {
        Row: {
          created_at: string
          id: string
          standard_task_id: string | null
          workstation_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          standard_task_id?: string | null
          workstation_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          standard_task_id?: string | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standard_task_workstation_links_standard_task_id_fkey"
            columns: ["standard_task_id"]
            isOneToOne: false
            referencedRelation: "standard_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_task_workstation_links_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_tasks: {
        Row: {
          color: string | null
          created_at: string
          day_counter: number
          hourly_cost: number
          id: string
          task_name: string
          task_number: string
          time_coefficient: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          day_counter?: number
          hourly_cost?: number
          id?: string
          task_name: string
          task_number: string
          time_coefficient?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          day_counter?: number
          hourly_cost?: number
          id?: string
          task_name?: string
          task_number?: string
          time_coefficient?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_locations: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      storage_system: {
        Row: {
          article_number: string | null
          compartment: string | null
          container: string | null
          created_at: string
          depth_compartment: string | null
          discription: string | null
          ean_code: string | null
          fifo: string | null
          id: number
          lift: string | null
          minimum_storage: string | null
          product_name: string | null
          product_number: string | null
          storage: string | null
          tray: string | null
        }
        Insert: {
          article_number?: string | null
          compartment?: string | null
          container?: string | null
          created_at?: string
          depth_compartment?: string | null
          discription?: string | null
          ean_code?: string | null
          fifo?: string | null
          id?: number
          lift?: string | null
          minimum_storage?: string | null
          product_name?: string | null
          product_number?: string | null
          storage?: string | null
          tray?: string | null
        }
        Update: {
          article_number?: string | null
          compartment?: string | null
          container?: string | null
          created_at?: string
          depth_compartment?: string | null
          discription?: string | null
          ean_code?: string | null
          fifo?: string | null
          id?: number
          lift?: string | null
          minimum_storage?: string | null
          product_name?: string | null
          product_number?: string | null
          storage?: string | null
          tray?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      task_completion_checklists: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          checklist_item_id: string
          created_at: string
          id: string
          is_checked: boolean
          task_id: string
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          checklist_item_id: string
          created_at?: string
          id?: string
          is_checked?: boolean
          task_id: string
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          checklist_item_id?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_workstation_links: {
        Row: {
          created_at: string
          id: string
          task_id: string | null
          workstation_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          task_id?: string | null
          workstation_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_workstation_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_workstation_links_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_duration_minutes: number | null
          assignee_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string
          duration: number | null
          efficiency_percentage: number | null
          id: string
          phase_id: string
          priority: string
          standard_task_id: string | null
          status: string
          status_changed_at: string | null
          title: string
          total_duration: number | null
          updated_at: string
          workstation: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          duration?: number | null
          efficiency_percentage?: number | null
          id?: string
          phase_id: string
          priority: string
          standard_task_id?: string | null
          status: string
          status_changed_at?: string | null
          title: string
          total_duration?: number | null
          updated_at?: string
          workstation: string
        }
        Update: {
          actual_duration_minutes?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          duration?: number | null
          efficiency_percentage?: number | null
          id?: string
          phase_id?: string
          priority?: string
          standard_task_id?: string | null
          status?: string
          status_changed_at?: string | null
          title?: string
          total_duration?: number | null
          updated_at?: string
          workstation?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_standard_task_id_fkey"
            columns: ["standard_task_id"]
            isOneToOne: false
            referencedRelation: "standard_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_registrations: {
        Row: {
          created_at: string
          duration_minutes: number | null
          employee_id: string
          end_time: string | null
          id: string
          is_active: boolean
          project_name: string | null
          rush_order_id: string | null
          start_time: string
          task_id: string | null
          updated_at: string
          workstation_task_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          employee_id: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          project_name?: string | null
          rush_order_id?: string | null
          start_time: string
          task_id?: string | null
          updated_at?: string
          workstation_task_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          employee_id?: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          project_name?: string | null
          rush_order_id?: string | null
          start_time?: string
          task_id?: string | null
          updated_at?: string
          workstation_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_registrations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_registrations_rush_order_id_fkey"
            columns: ["rush_order_id"]
            isOneToOne: false
            referencedRelation: "rush_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_registrations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_registrations_workstation_task_id_fkey"
            columns: ["workstation_task_id"]
            isOneToOne: false
            referencedRelation: "workstation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          truck_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          truck_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          truck_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      work_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          segment_name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          segment_name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          segment_name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          break_minutes: number
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          team: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          team: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          team?: string
          updated_at?: string
        }
        Relationships: []
      }
      working_hours_breaks: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          updated_at: string
          working_hours_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
          working_hours_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          working_hours_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_breaks_working_hours_id_fkey"
            columns: ["working_hours_id"]
            isOneToOne: false
            referencedRelation: "working_hours"
            referencedColumns: ["id"]
          },
        ]
      }
      workstation_errors: {
        Row: {
          created_at: string
          error_message: string
          error_type: string
          id: string
          is_active: boolean
          notes: string | null
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          workstation_id: string
        }
        Insert: {
          created_at?: string
          error_message: string
          error_type?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          workstation_id: string
        }
        Update: {
          created_at?: string
          error_message?: string
          error_type?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstation_errors_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstation_errors_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstation_errors_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstation_positions: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          workstation_id: string
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          workstation_id: string
          x_position?: number
          y_position?: number
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          workstation_id?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "workstation_positions_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstation_schedules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          task_id: string | null
          task_title: string
          updated_at: string
          user_name: string
          workstation_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          task_id?: string | null
          task_title: string
          updated_at?: string
          user_name: string
          workstation_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          task_id?: string | null
          task_title?: string
          updated_at?: string
          user_name?: string
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstation_schedules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstation_schedules_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstation_tasks: {
        Row: {
          created_at: string
          description: string | null
          duration: number | null
          id: string
          priority: string
          task_name: string
          updated_at: string
          workstation_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          priority?: string
          task_name: string
          updated_at?: string
          workstation_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          priority?: string
          task_name?: string
          updated_at?: string
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstation_tasks_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstations: {
        Row: {
          active_task_time: string | null
          active_workers: number
          created_at: string
          description: string | null
          icon_path: string | null
          id: string
          image_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active_task_time?: string | null
          active_workers?: number
          created_at?: string
          description?: string | null
          icon_path?: string | null
          id?: string
          image_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active_task_time?: string | null
          active_workers?: number
          created_at?: string
          description?: string | null
          icon_path?: string | null
          id?: string
          image_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_employee: {
        Args: { employee_name: string; employee_password: string }
        Returns: {
          avatar_url: string
          email: string
          hourly_rate: number
          id: string
          logistics: boolean
          name: string
          phone: string
          role: string
          skills: string[]
          workstation: string
        }[]
      }
      calculate_loading_date: {
        Args: { installation_date: string }
        Returns: string
      }
      check_employee_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      check_employee_roles: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      create_storage_policy: {
        Args: {
          bucket_name: string
          definition: string
          operation: string
          policy_name: string
        }
        Returns: undefined
      }
      get_phase_offsets: {
        Args: never
        Returns: {
          created_at: string
          days_before_installation: number
          id: string
          phase_id: string
          phase_name: string
          updated_at: string
        }[]
      }
      is_employee_on_holiday: {
        Args: { check_date: string; emp_id: string }
        Returns: boolean
      }
      setup_phase_offsets_table: { Args: never; Returns: boolean }
      table_exists: { Args: { table_name: string }; Returns: boolean }
      trigger_project_forecast_email: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "worker"
        | "workstation"
        | "installation_team"
        | "preparater"
      holiday_request_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "worker",
        "workstation",
        "installation_team",
        "preparater",
      ],
      holiday_request_status: ["pending", "approved", "rejected"],
    },
  },
} as const
