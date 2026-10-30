import type { EstadoPedido } from "@/constants/order-states";
import type { RolStaff } from "@/constants/roles";

export interface Tenant {
  id: string;
  slug: string;
  nombre: string;
  colorPrimario: string;
  colorFondo: string;
  colorSurface: string;
  colorTexto: string;
  logoUrl: string | null;
  activo: boolean;
  horarios: HorarioDia[] | null;
}

export interface HorarioDia {
  dia: number; // 0=Domingo .. 6=Sábado
  abierto: boolean;
  abre: string; // "HH:MM"
  cierra: string; // "HH:MM"
}

export interface MenuVariant {
  id: string;
  menuItemId: string;
  label: string;
  precio: number;
  orden: number;
}

export interface MenuItem {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  categoria: string;
  categoriaId: string | null;
  imagenUrl: string | null;
  activo: boolean;
  destacado: boolean;
  orden: number;
  variantes: MenuVariant[];
}

export interface Categoria {
  id: string;
  tenantId: string;
  nombre: string;
  orden: number;
}

export type TipoPedido = "delivery" | "salon" | "takeaway";

export interface PedidoItem {
  itemId: string;
  nombre: string;
  variante: string | null;
  cantidad: number;
  precio: number;
  obs?: string;
  checkout?: CheckoutDetails;
}

export interface CheckoutDetails {
  version: 1;
  telefono: string;
  direccion: string | null;
  referencia: string | null;
  pago: "efectivo" | "transferencia";
  requestHash: string;
}

export interface Pedido {
  id: string;
  tenantId: string;
  num: number;
  estado: EstadoPedido;
  tipo: TipoPedido;
  nombre: string | null;
  items: PedidoItem[];
  demora: number | null;
  horaConfirmado: string | null;
  horaEntregado: string | null;
  creadoEn: string;
  checkout?: CheckoutDetails;
}

export interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  rol: RolStaff;
}
