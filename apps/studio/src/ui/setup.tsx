import { Banner, Button, LayerCard } from "@cloudflare/kumo";
import { CheckCircleIcon, SignInIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { Check } from "../targets";

export type Status = { remote: Check; local: Check };

const post = async <T,>(path: string): Promise<T> =>
  (await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json();
export const fetchStatus = () => post<Status>("/api/status");

function Step({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      {ok ? (
        <CheckCircleIcon className="mt-0.5 shrink-0 text-kumo-success" weight="fill" />
      ) : (
        <WarningCircleIcon className="mt-0.5 shrink-0 text-kumo-warning" weight="fill" />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{title}</span>
        <div className="text-sm text-kumo-subtle">{children}</div>
      </div>
    </div>
  );
}

// Primer arranque sin sesión de Cloudflare: en vez de errores sueltos, qué falta y cómo resolverlo.
export function Setup({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const signIn = async () => {
    setBusy(true);
    setError(undefined);
    const r = await post<Check>("/api/login");
    if (!r.ok) setError(r.error);
    onChange(await fetchStatus());
    setBusy(false);
  };

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-6">
      <LayerCard className="flex w-full max-w-lg flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold">Falta conectar el studio</h1>
          <p className="text-sm text-kumo-subtle">
            Producción se lee con tu sesión de Cloudflare. Tu cuenta tiene que ser miembro de la cuenta del proyecto.
          </p>
        </div>
        <Step ok={status.remote.ok} title="Sesión de Cloudflare con acceso a la base">
          {status.remote.ok ? (
            "Lista."
          ) : (
            <>
              <p className="font-mono text-xs break-words">{status.remote.error}</p>
              <p className="mt-1">
                El botón abre el login de Cloudflare en tu navegador (es lo mismo que <code>bunx wrangler login</code>).
              </p>
            </>
          )}
        </Step>
        <Step ok={status.local.ok} title="D1 local (opcional)">
          {status.local.ok ? (
            "Lista."
          ) : (
            <>
              Para probar sin tocar producción: <code>bun run db:migrate:local</code>.
            </>
          )}
        </Step>
        {error && <Banner variant="error" title="No se pudo iniciar sesión" description={error} />}
        <div className="flex justify-end gap-2">
          <Button onClick={async () => onChange(await fetchStatus())}>Reintentar</Button>
          {!status.remote.ok && (
            <Button variant="primary" icon={<SignInIcon />} loading={busy} onClick={signIn}>
              Iniciar sesión en Cloudflare
            </Button>
          )}
        </div>
      </LayerCard>
    </div>
  );
}
