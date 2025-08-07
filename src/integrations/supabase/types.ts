export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
          id: string
          multiplier: number
          standard_task_id: string
          updated_at: string
          variable_name: string
        }
        Insert: {
          base_duration_minutes?: number
          created_at?: string
          id?: string
          multiplier?: number
          standard_task_id: string
          updated_at?: string
          variable_name: string
        }
        Update: {
          base_duration_minutes?: number
          created_at?: string
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
          name: string
          password: string
          role: string
          workstation: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          password: string
          role: string
          workstation?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          password?: string
          role?: string
          workstation?: string | null
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
          description: string
          id: string
          notes: string | null
          order_id: string
          quantity: number
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          accessory_id?: string | null
          article_code?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          order_id: string
          quantity: number
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          accessory_id?: string | null
          article_code?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
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
          id: string
          notes: string | null
          order_date: string
          order_type: string
          project_id: string | null
          status: string
          supplier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_delivery: string
          id?: string
          notes?: string | null
          order_date?: string
          order_type?: string
          project_id?: string | null
          status: string
          supplier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_delivery?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_type?: string
          project_id?: string | null
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
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
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
      calculate_loading_date: {
        Args: { installation_date: string }
        Returns: string
      }
      create_storage_policy: {
        Args: {
          bucket_name: string
          policy_name: string
          definition: string
          operation: string
        }
        Returns: undefined
      }
      get_phase_offsets: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          phase_id: string
          phase_name: string
          days_before_installation: number
          created_at: string
          updated_at: string
        }[]
      }
      is_employee_on_holiday: {
        Args: { emp_id: string; check_date: string }
        Returns: boolean
      }
      setup_phase_offsets_table: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      table_exists: {
        Args: { table_name: string }
        Returns: boolean
      }
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
