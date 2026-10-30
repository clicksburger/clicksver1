import Link from "next/link";

export default function TenantNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-display text-5xl tracking-widest text-primary">404</span>
      <h1 className="text-xl font-bold">Restaurante no encontrado</h1>
      <p className="text-muted">El local que buscás no existe o está desactivado.</p>
      <Link href="/" className="text-primary underline">
        Volver al inicio
      </Link>
    </main>
  );
}
