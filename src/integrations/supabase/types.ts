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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_chats: {
        Row: {
          created_at: string
          id: string
          message: string
          original_language: string | null
          response: string | null
          session_id: string | null
          title: string | null
          translated_message: string | null
          translated_response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          original_language?: string | null
          response?: string | null
          session_id?: string | null
          title?: string | null
          translated_message?: string | null
          translated_response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          original_language?: string | null
          response?: string | null
          session_id?: string | null
          title?: string | null
          translated_message?: string | null
          translated_response?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chats_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_diagnoses: {
        Row: {
          chat_id: string | null
          condition: string | null
          confidence_percentage: number | null
          created_at: string
          diagnosis_data: Json
          doctor_agreed: boolean | null
          flag_reason: string | null
          flagged: boolean
          id: string
          likelihood: number | null
          rationale: string | null
          recommendations: Json | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          severity: Database["public"]["Enums"]["severity_level"] | null
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          condition?: string | null
          confidence_percentage?: number | null
          created_at?: string
          diagnosis_data: Json
          doctor_agreed?: boolean | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          likelihood?: number | null
          rationale?: string | null
          recommendations?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          user_id: string
        }
        Update: {
          chat_id?: string | null
          condition?: string | null
          confidence_percentage?: number | null
          created_at?: string
          diagnosis_data?: Json
          doctor_agreed?: boolean | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          likelihood?: number | null
          rationale?: string | null
          recommendations?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_diagnoses_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "ai_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_diagnoses_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: never
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          drug_id: string
          id: string
          price: number
          quantity: number
        }
        Insert: {
          cart_id: string
          created_at?: string
          drug_id: string
          id?: string
          price: number
          quantity?: number
        }
        Update: {
          cart_id?: string
          created_at?: string
          drug_id?: string
          id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drugs"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      child_orders: {
        Row: {
          created_at: string
          delivery_fee: number
          discount_amount: number
          id: string
          parent_order_id: string
          pharmacy_id: string
          settlement_status: string
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          tracking_number: string | null
          tracking_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee?: number
          discount_amount?: number
          id?: string
          parent_order_id: string
          pharmacy_id: string
          settlement_status?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          tracking_number?: string | null
          tracking_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee?: number
          discount_amount?: number
          id?: string
          parent_order_id?: string
          pharmacy_id?: string
          settlement_status?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount?: number
          tracking_number?: string | null
          tracking_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_orders_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          chief_complaint: string | null
          clinical_summary: string | null
          created_at: string
          decision_support: Json | null
          diagnosis: string | null
          differential_diagnosis: string | null
          doctor_id: string
          ended_at: string | null
          escrow_amount: number | null
          finalized_at: string | null
          follow_up_plan: string | null
          id: string
          notes: string | null
          paid_at: string | null
          patient_id: string
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["consultation_payment_status"]
          physical_exam: string | null
          price: number
          referral: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["consultation_status"] | null
          symptom_checklist: Json
          transcript: Json | null
          updated_at: string
        }
        Insert: {
          chief_complaint?: string | null
          clinical_summary?: string | null
          created_at?: string
          decision_support?: Json | null
          diagnosis?: string | null
          differential_diagnosis?: string | null
          doctor_id: string
          ended_at?: string | null
          escrow_amount?: number | null
          finalized_at?: string | null
          follow_up_plan?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          patient_id: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["consultation_payment_status"]
          physical_exam?: string | null
          price: number
          referral?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"] | null
          symptom_checklist?: Json
          transcript?: Json | null
          updated_at?: string
        }
        Update: {
          chief_complaint?: string | null
          clinical_summary?: string | null
          created_at?: string
          decision_support?: Json | null
          diagnosis?: string | null
          differential_diagnosis?: string | null
          doctor_id?: string
          ended_at?: string | null
          escrow_amount?: number | null
          finalized_at?: string | null
          follow_up_plan?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          patient_id?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["consultation_payment_status"]
          physical_exam?: string | null
          price?: number
          referral?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"] | null
          symptom_checklist?: Json
          transcript?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_doctor_id_profiles_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "consultations_patient_id_profiles_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      doctors: {
        Row: {
          bio: string | null
          consult_price: number | null
          created_at: string
          id: string
          license_number: string | null
          rating: number | null
          specialties: string[] | null
          total_consultations: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          consult_price?: number | null
          created_at?: string
          id?: string
          license_number?: string | null
          rating?: number | null
          specialties?: string[] | null
          total_consultations?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          consult_price?: number | null
          created_at?: string
          id?: string
          license_number?: string | null
          rating?: number | null
          specialties?: string[] | null
          total_consultations?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      drugs: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          dosage_instructions: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          manufacturer: string | null
          name: string
          pharmacy_id: string
          prescription_required: boolean | null
          price: number
          stock_quantity: number | null
          strength: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          dosage_instructions?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          name: string
          pharmacy_id: string
          prescription_required?: boolean | null
          price: number
          stock_quantity?: number | null
          strength?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          dosage_instructions?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          name?: string
          pharmacy_id?: string
          prescription_required?: boolean | null
          price?: number
          stock_quantity?: number | null
          strength?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drugs_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      elite_alerts: {
        Row: {
          alert_level: string
          created_at: string
          id: string
          metric: string | null
          payload: Json | null
          reason: string
          resolved_at: string | null
          score_id: string | null
          user_id: string
        }
        Insert: {
          alert_level: string
          created_at?: string
          id?: string
          metric?: string | null
          payload?: Json | null
          reason: string
          resolved_at?: string | null
          score_id?: string | null
          user_id: string
        }
        Update: {
          alert_level?: string
          created_at?: string
          id?: string
          metric?: string | null
          payload?: Json | null
          reason?: string
          resolved_at?: string | null
          score_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elite_alerts_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "elite_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      elite_baselines: {
        Row: {
          baseline_mean: number
          baseline_sd: number
          id: string
          last_updated: string
          metric: string
          sample_count: number
          user_id: string
        }
        Insert: {
          baseline_mean: number
          baseline_sd?: number
          id?: string
          last_updated?: string
          metric: string
          sample_count?: number
          user_id: string
        }
        Update: {
          baseline_mean?: number
          baseline_sd?: number
          id?: string
          last_updated?: string
          metric?: string
          sample_count?: number
          user_id?: string
        }
        Relationships: []
      }
      elite_scores: {
        Row: {
          cardiovascular_strain: number | null
          computed_at: string
          confidence_json: Json
          id: string
          immune_activation: number | null
          physiological_stability: number | null
          recovery_efficiency: number | null
          score_date: string
          user_id: string
        }
        Insert: {
          cardiovascular_strain?: number | null
          computed_at?: string
          confidence_json?: Json
          id?: string
          immune_activation?: number | null
          physiological_stability?: number | null
          recovery_efficiency?: number | null
          score_date: string
          user_id: string
        }
        Update: {
          cardiovascular_strain?: number | null
          computed_at?: string
          confidence_json?: Json
          id?: string
          immune_activation?: number | null
          physiological_stability?: number | null
          recovery_efficiency?: number | null
          score_date?: string
          user_id?: string
        }
        Relationships: []
      }
      elite_vitals_normalized: {
        Row: {
          created_at: string
          id: string
          metric: string
          normalized_unit: string
          normalized_value: number
          raw_id: string
          rolling_mean_24h: number | null
          rolling_sd_24h: number | null
          timestamp: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          normalized_unit: string
          normalized_value: number
          raw_id: string
          rolling_mean_24h?: number | null
          rolling_sd_24h?: number | null
          timestamp: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          normalized_unit?: string
          normalized_value?: number
          raw_id?: string
          rolling_mean_24h?: number | null
          rolling_sd_24h?: number | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elite_vitals_normalized_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "elite_vitals_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      elite_vitals_raw: {
        Row: {
          confidence: number
          created_at: string
          id: string
          meta: Json | null
          metric: string
          source: string
          timestamp: string
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          meta?: Json | null
          metric: string
          source?: string
          timestamp?: string
          unit: string
          user_id: string
          value: number
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          meta?: Json | null
          metric?: string
          source?: string
          timestamp?: string
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      lab_orders: {
        Row: {
          consultation_id: string
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
          reason: string | null
          results: string | null
          status: string | null
          test_name: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          consultation_id: string
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
          reason?: string | null
          results?: string | null
          status?: string | null
          test_name: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
          reason?: string | null
          results?: string | null
          status?: string | null
          test_name?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          related_score_id: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          related_score_id?: string | null
          severity: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          related_score_id?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_score_id_fkey"
            columns: ["related_score_id"]
            isOneToOne: false
            referencedRelation: "elite_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history: {
        Row: {
          child_order_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_status: string | null
        }
        Insert: {
          child_order_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_status?: string | null
        }
        Update: {
          child_order_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_child_order_id_fkey"
            columns: ["child_order_id"]
            isOneToOne: false
            referencedRelation: "child_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          dosage_instructions_snapshot: string | null
          drug_id: string
          drug_name_snapshot: string | null
          drug_strength_snapshot: string | null
          id: string
          order_id: string
          pharmacy_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          dosage_instructions_snapshot?: string | null
          drug_id: string
          drug_name_snapshot?: string | null
          drug_strength_snapshot?: string | null
          id?: string
          order_id: string
          pharmacy_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          dosage_instructions_snapshot?: string | null
          drug_id?: string
          drug_name_snapshot?: string | null
          drug_strength_snapshot?: string | null
          id?: string
          order_id?: string
          pharmacy_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          commission_amount: number | null
          created_at: string
          delivery_address: string | null
          delivery_instructions: string | null
          escrow_amount: number | null
          id: string
          payment_reference: string | null
          payment_status: string
          prescription_id: string | null
          prescription_image_url: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_amount?: number | null
          created_at?: string
          delivery_address?: string | null
          delivery_instructions?: string | null
          escrow_amount?: number | null
          id?: string
          payment_reference?: string | null
          payment_status?: string
          prescription_id?: string | null
          prescription_image_url?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_amount?: number | null
          created_at?: string
          delivery_address?: string | null
          delivery_instructions?: string | null
          escrow_amount?: number | null
          id?: string
          payment_reference?: string | null
          payment_status?: string
          prescription_id?: string | null
          prescription_image_url?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          child_order_id: string | null
          commission: number | null
          created_at: string
          id: string
          net_amount: number
          order_id: string | null
          payment_reference: string | null
          processed_at: string | null
          processed_by: string | null
          recipient_id: string
          status: Database["public"]["Enums"]["payout_status"] | null
        }
        Insert: {
          amount: number
          child_order_id?: string | null
          commission?: number | null
          created_at?: string
          id?: string
          net_amount: number
          order_id?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          recipient_id: string
          status?: Database["public"]["Enums"]["payout_status"] | null
        }
        Update: {
          amount?: number
          child_order_id?: string | null
          commission?: number | null
          created_at?: string
          id?: string
          net_amount?: number
          order_id?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          recipient_id?: string
          status?: Database["public"]["Enums"]["payout_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_child_order_id_fkey"
            columns: ["child_order_id"]
            isOneToOne: false
            referencedRelation: "child_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address: string | null
          business_name: string
          created_at: string
          id: string
          license_number: string | null
          location: unknown
          phone: string | null
          rating: number | null
          total_orders: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_name: string
          created_at?: string
          id?: string
          license_number?: string | null
          location?: unknown
          phone?: string | null
          rating?: number | null
          total_orders?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_name?: string
          created_at?: string
          id?: string
          license_number?: string | null
          location?: unknown
          phone?: string | null
          rating?: number | null
          total_orders?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacies_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_revenue: {
        Row: {
          amount: number
          created_at: string
          id: string
          source_id: string
          source_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          source_id: string
          source_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          consultation_id: string
          created_at: string
          doctor_id: string
          file_url: string | null
          id: string
          notes: string | null
          patient_id: string
          prescription_data: Json
        }
        Insert: {
          consultation_id: string
          created_at?: string
          doctor_id: string
          file_url?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          prescription_data: Json
        }
        Update: {
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          prescription_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_profiles_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_profiles_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          blood_group: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          metadata: Json | null
          phone: string | null
          rejection_reason: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          blood_group?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          phone?: string | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          blood_group?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          phone?: string | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          consultation_id: string | null
          created_at: string
          id: string
          order_id: string | null
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          against_user_id: string | null
          assigned_to: string | null
          category: string
          consultation_id: string | null
          created_at: string
          description: string
          id: string
          order_id: string | null
          priority: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          against_user_id?: string | null
          assigned_to?: string | null
          category: string
          consultation_id?: string | null
          created_at?: string
          description: string
          id?: string
          order_id?: string | null
          priority?: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          against_user_id?: string | null
          assigned_to?: string | null
          category?: string
          consultation_id?: string | null
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          priority?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vitals: {
        Row: {
          created_at: string | null
          diastolic: number | null
          heart_rate: number | null
          id: string
          oxygen_saturation: number | null
          recorded_at: string | null
          systolic: number | null
          temperature: number | null
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          oxygen_saturation?: number | null
          recorded_at?: string | null
          systolic?: number | null
          temperature?: number | null
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          oxygen_saturation?: number | null
          recorded_at?: string | null
          systolic?: number | null
          temperature?: number | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_deposits: {
        Row: {
          amount: number
          amount_kobo: number
          completed_at: string | null
          created_at: string
          currency: string
          fee: number
          id: string
          metadata: Json | null
          provider: string
          provider_checkout_url: string | null
          provider_reference: string | null
          reference: string
          status: string
          total_amount: number
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          amount_kobo: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          fee?: number
          id?: string
          metadata?: Json | null
          provider?: string
          provider_checkout_url?: string | null
          provider_reference?: string | null
          reference: string
          status?: string
          total_amount: number
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          amount_kobo?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          fee?: number
          id?: string
          metadata?: Json | null
          provider?: string
          provider_checkout_url?: string | null
          provider_reference?: string | null
          reference?: string
          status?: string
          total_amount?: number
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_deposits_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          amount_kobo: number
          balance_after: number
          balance_after_kobo: number
          created_at: string
          description: string
          id: string
          idempotency_key: string | null
          metadata: Json | null
          reference: string
          seq: number
          status: string
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          amount_kobo: number
          balance_after: number
          balance_after_kobo: number
          created_at?: string
          description: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference: string
          seq?: never
          status?: string
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          amount_kobo?: number
          balance_after?: number
          balance_after_kobo?: number
          created_at?: string
          description?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference?: string
          seq?: never
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          escrow_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          id: string
          payment_reference: string | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          requested_at: string
          status: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          id?: string
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank_name?: string
          id?: string
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _ledger: {
        Args: {
          p_amount: number
          p_balance_after: number
          p_desc: string
          p_meta?: Json
          p_ref: string
          p_type: string
          p_user_id: string
          p_wallet_id: string
        }
        Returns: undefined
      }
      _lock_wallet: {
        Args: { p_user_id: string }
        Returns: {
          balance: number
          created_at: string
          escrow_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_grant_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: Json
      }
      admin_list_consultations: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          created_at: string
          doctor_name: string
          id: string
          patient_name: string
          payment_status: string
          price: number
          scheduled_at: string
          status: string
        }[]
      }
      admin_list_flagged_diagnoses: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          condition: string
          confidence_percentage: number
          created_at: string
          doctor_agreed: boolean
          flag_reason: string
          id: string
          reviewed_at: string
          severity: string
        }[]
      }
      admin_list_orders: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          buyer_name: string
          child_order_id: string
          created_at: string
          has_rx_items: boolean
          order_id: string
          pharmacy_name: string
          settlement_status: string
          status: string
          total_amount: number
          tracking_status: string
        }[]
      }
      admin_list_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_search?: string
          p_status?: string
        }
        Returns: {
          business_name: string
          created_at: string
          email: string
          full_name: string
          license_number: string
          role: string
          user_id: string
          verification_status: string
        }[]
      }
      admin_list_withdrawals: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          id: string
          name: string
          payment_reference: string
          requested_at: string
          role: string
          status: string
          user_id: string
        }[]
      }
      admin_overview: { Args: { p_days?: number }; Returns: Json }
      admin_process_withdrawal: {
        Args: {
          p_action: string
          p_reason?: string
          p_reference?: string
          p_withdrawal_id: string
        }
        Returns: Json
      }
      admin_set_verification: {
        Args: {
          p_reason?: string
          p_status: Database["public"]["Enums"]["verification_status"]
          p_user_id: string
        }
        Returns: Json
      }
      admin_update_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      admin_update_ticket: {
        Args: {
          p_assigned_to?: string
          p_note?: string
          p_priority?: string
          p_status?: string
          p_ticket_id: string
        }
        Returns: Json
      }
      charge_wallet_consultation: {
        Args: {
          p_doctor_id: string
          p_notes?: string
          p_price: number
          p_scheduled_at: string
        }
        Returns: Json
      }
      credit_wallet_deposit: {
        Args: {
          p_deposit_reference: string
          p_metadata?: Json
          p_provider_ref?: string
        }
        Returns: Json
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_doctor_booked_slots: {
        Args: { _day: string; _doctor_id: string }
        Returns: {
          scheduled_at: string
        }[]
      }
      get_setting_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      get_setting_numeric: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_treating_doctor: {
        Args: { _doctor_id: string; _patient_id: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type?: string
        }
        Returns: undefined
      }
      owns_order: { Args: { _order_id: string }; Returns: boolean }
      pharmacy_serves_customer: {
        Args: { _customer_id: string }
        Returns: boolean
      }
      pharmacy_serves_order: { Args: { _order_id: string }; Returns: boolean }
      pharmacy_set_order_status: {
        Args: {
          p_child_order_id: string
          p_new_status: string
          p_reason?: string
        }
        Returns: Json
      }
      place_pharmacy_order: {
        Args: {
          p_delivery_address: string
          p_delivery_instructions?: string
          p_items: Json
          p_prescription_id?: string
          p_prescription_image_url?: string
        }
        Returns: Json
      }
      refund_consultation_escrow: {
        Args: { p_consultation_id: string; p_reason?: string }
        Returns: Json
      }
      request_withdrawal: {
        Args: {
          p_account_name: string
          p_account_number: string
          p_amount: number
          p_bank_name: string
        }
        Returns: Json
      }
      review_ai_diagnosis: {
        Args: { p_agreed: boolean; p_diagnosis_id: string; p_notes?: string }
        Returns: Json
      }
      settle_child_order: {
        Args: { p_child_order_id: string }
        Returns: undefined
      }
      settle_consultation: {
        Args: { p_consultation_id: string }
        Returns: undefined
      }
      update_pharmacy_order_status: {
        Args: {
          _actor_id: string
          _child_order_id: string
          _new_tracking_status: string
          _reason: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "patient" | "doctor" | "pharmacist" | "admin"
      consultation_payment_status:
        | "pending"
        | "escrowed"
        | "released"
        | "refunded"
        | "failed"
      consultation_status: "scheduled" | "ongoing" | "completed" | "cancelled"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payout_status: "pending" | "approved" | "rejected" | "paid"
      severity_level: "mild" | "moderate" | "severe"
      verification_status: "pending" | "verified" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["patient", "doctor", "pharmacist", "admin"],
      consultation_payment_status: [
        "pending",
        "escrowed",
        "released",
        "refunded",
        "failed",
      ],
      consultation_status: ["scheduled", "ongoing", "completed", "cancelled"],
      order_status: [
        "pending",
        "paid",
        "processing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payout_status: ["pending", "approved", "rejected", "paid"],
      severity_level: ["mild", "moderate", "severe"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const
