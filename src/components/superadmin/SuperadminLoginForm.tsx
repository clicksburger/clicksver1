"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import { signIn } from "@/features/auth/services/auth.service";
import { routes } from "@/constants/routes";

export function SuperadminLoginForm() {
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
      router.replace(routes.superadmin);
      router.refresh();
    } catch {
      setError("Credenciales incorrectas");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <FormField label="Email" htmlFor="sa-email">
        <Input id="sa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </FormField>
      <FormField label="Contraseña" htmlFor="sa-pass">
        <Input id="sa-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </FormField>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={loading}>
        Ingresar
      </Button>
    </form>
  );
}
