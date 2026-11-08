-- ============================================================
--  0025 — Comprobantes de transferencia.
--  Bucket PRIVADO "comprobantes": lo escribe y lo lee solo el servidor
--  (service role). El cliente sube el comprobante desde el checkout
--  (opcional); el local lo ve con un link firmado que vence, desde el
--  mensaje de WhatsApp o desde la tarjeta del pedido en Caja.
--  Hasta 5 MB; imágenes o PDF. Sin políticas públicas. IDEMPOTENTE.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
