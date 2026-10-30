"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import { signIn } from "../services/auth.service";
import { routes } from "@/constants/routes";
import { createSupabaseBrowserClient } from "@/services/supabase/client";

export function LoginForm({ slug, tenantId }: { slug: string; tenantId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No se pudo verificar la sesión. Volvé a ingresar.");
      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("rol")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (membershipError)
        throw new Error("No se pudieron verificar tus permisos. Intentá nuevamente.");
      if (!membership)
        throw new Error(
          "Tu cuenta no tiene un rol asignado en Clicks Burger. Un administrador debe vincularla al local.",
        );
      router.replace(
        membership.rol === "cocina"
          ? routes.cocina(slug)
          : membership.rol === "cajero"
            ? routes.caja(slug)
            : routes.dashboard(slug),
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error && !cause.message.includes("Invalid login credentials")
          ? cause.message
          : "Email o contraseña incorrectos",
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <FormField label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Contraseña" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </FormField>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={loading}>
        Ingresar
      </Button>
    </form>
  );
}
