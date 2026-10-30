/**
 * Tipos generados desde Supabase (proyecto GestorPedidos).
 * Regenerar con: supabase gen types typescript  (o el conector de Supabase).
 * No editar a mano.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caja_turnos: {
        Row: {
          abierto_en: string
          abierto_por: string
          abierto_por_email: string | null
          cerrado_en: string | null
          cerrado_por: string | null
          diferencia: number | null
          id: string
          monto_final: number | null
          monto_inicial: number
          nota_apertura: string | null
          nota_cierre: string | null
          pedidos_count: number | null
          tenant_id: string
          ventas: number | null
        }
        Insert: {
          abierto_en?: string
          abierto_por: string
          abierto_por_email?: string | null
          cerrado_en?: string | null
          cerrado_por?: string | null
          diferencia?: number | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          nota_apertura?: string | null
          nota_cierre?: string | null
          pedidos_count?: number | null
          tenant_id: string
          ventas?: number | null
        }
        Update: {
          abierto_en?: string
          abierto_por?: string
          abierto_por_email?: string | null
          cerrado_en?: string | null
          cerrado_por?: string | null
          diferencia?: number | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          nota_apertura?: string | null
          nota_cierre?: string | null
          pedidos_count?: number | null
          tenant_id?: string
          ventas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_turnos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          creado_en: string
          id: string
          nombre: string
          orden: number
          tenant_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          nombre: string
          orden?: number
          tenant_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          nombre?: string
          orden?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          creado_en: string
          id: string
          rol: Database["public"]["Enums"]["rol_staff"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_staff"]
          tenant_id: string
          user_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_staff"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          activo: boolean
          categoria: string
          categoria_id: string | null
          creado_en: string
          descripcion: string | null
          destacado: boolean
          id: string
          imagen_url: string | null
          nombre: string
          orden: number
          precio: number | null
          tenant_id: string
        }
        Insert: {
          activo?: boolean
          categoria?: string
          categoria_id?: string | null
          creado_en?: string
          descripcion?: string | null
          destacado?: boolean
          id?: string
          imagen_url?: string | null
          nombre: string
          orden?: number
          precio?: number | null
          tenant_id: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          categoria_id?: string | null
          creado_en?: string
          descripcion?: string | null
          destacado?: boolean
          id?: string
          imagen_url?: string | null
          nombre?: string
          orden?: number
          precio?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_variants: {
        Row: {
          creado_en: string
          id: string
          label: string
          menu_item_id: string
          orden: number
          precio: number
          tenant_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          label: string
          menu_item_id: string
          orden?: number
          precio: number
          tenant_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          label?: string
          menu_item_id?: string
          orden?: number
          precio?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_variants_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          costo_envio: number | null
          creado_en: string
          demora: number | null
          estado: string
          hora_confirmado: string | null
          hora_entregado: string | null
          id: string
          items: Json
          nombre: string | null
          num: number
          tenant_id: string
          tipo: string
        }
        Insert: {
          costo_envio?: number | null
          creado_en?: string
          demora?: number | null
          estado?: string
          hora_confirmado?: string | null
          hora_entregado?: string | null
          id?: string
          items?: Json
          nombre?: string | null
          num: number
          tenant_id: string
          tipo?: string
        }
        Update: {
          costo_envio?: number | null
          creado_en?: string
          demora?: number | null
          estado?: string
          hora_confirmado?: string | null
          hora_entregado?: string | null
          id?: string
          items?: Json
          nombre?: string | null
          num?: number
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          creado_en: string
          user_id: string
        }
        Insert: {
          creado_en?: string
          user_id: string
        }
        Update: {
          creado_en?: string
          user_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          activo: boolean
          admin_pass_hash: string | null
          admin_user: string | null
          color_fondo: string
          color_primario: string
          color_surface: string
          color_texto: string
          creado_en: string
          envio_config: Json | null
          horarios: Json | null
          id: string
          logo_url: string | null
          nombre: string
          slug: string
        }
        Insert: {
          activo?: boolean
          admin_pass_hash?: string | null
          admin_user?: string | null
          color_fondo?: string
          color_primario?: string
          color_surface?: string
          color_texto?: string
          creado_en?: string
          envio_config?: Json | null
          horarios?: Json | null
          id?: string
          logo_url?: string | null
          nombre: string
          slug: string
        }
        Update: {
          activo?: boolean
          admin_pass_hash?: string | null
          admin_user?: string | null
          color_fondo?: string
          color_primario?: string
          color_surface?: string
          color_texto?: string
          creado_en?: string
          envio_config?: Json | null
          horarios?: Json | null
          id?: string
          logo_url?: string | null
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crear_pedido: {
        Args: {
          p_tenant_id: string
          p_tipo: string
          p_nombre: string | null
          p_items: Json
        }
        Returns: number
      }
      caja_ventas: {
        Args: {
          p_tenant_id: string
          p_desde: string
          p_hasta?: string
        }
        Returns: {
          total: number
          cantidad: number
          envios: number
        }[]
      }
      cerrar_caja: {
        Args: {
          p_turno_id: string
          p_monto_final: number
          p_nota?: string
        }
        Returns: Database["public"]["Tables"]["caja_turnos"]["Row"]
      }
    }
    Enums: {
      rol_staff: "admin" | "cajero" | "cocina"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
