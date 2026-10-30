"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import { changePassword } from "../services/auth.service";

export function PasswordForm() {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (pass.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres");
    if (pass !== pass2) return setMsg("Las contraseñas no coinciden");
    setSaving(true);
    setMsg(null);
    try {
      await changePassword(pass);
      setMsg("Contraseña actualizada ✓");
      setPass("");
      setPass2("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <FormField label="Nueva contraseña" htmlFor="np">
        <Input id="np" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      </FormField>
      <FormField label="Repetir contraseña" htmlFor="np2">
        <Input id="np2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
      </FormField>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <Button loading={saving} onClick={save}>
        Cambiar contraseña
      </Button>
    </div>
  );
}
