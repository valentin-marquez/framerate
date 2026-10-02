import type { PublicProfile } from "@framerate/contracts";
import { IconCalendar, IconCpu, IconPencil, IconShare3 } from "@tabler/icons-react";
import { Link } from "react-router";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { buttonVariants } from "~/shared/components/primitives/button";

const joined = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" });

/**
 * /perfil y /u/:username sin portada (GitHub, Letterboxd): identidad en una fila, sin degradados inventados, y
 * debajo las secciones de contenido. Hoy la única que existe es Cotizaciones, vacía hasta que haya API.
 */
export function ProfileView({ profile, isOwner }: { profile: PublicProfile; isOwner: boolean }) {
  const name = profile.displayName || profile.username;

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <Avatar src={profile.avatarUrl} name={name} />
          <div className="min-w-0 space-y-2 pt-1">
            <div>
              <h1 className="truncate font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">{name}</h1>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
            {profile.bio && (
              <p className="max-w-xl whitespace-pre-line text-foreground/85 text-sm leading-relaxed">{profile.bio}</p>
            )}
            <p className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
              <IconCalendar className="size-3.5" stroke={1.75} />
              En Framerate desde {joined(profile.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={buttonVariants({ variant: "secondary" })}>
            <IconShare3 className="size-4" />
            Compartir
          </button>
          {isOwner && (
            <Link to="/ajustes/cuenta" className={buttonVariants({ variant: "secondary" })}>
              <IconPencil className="size-4" />
              Editar perfil
            </Link>
          )}
        </div>
      </header>

      <section className="space-y-4 border-border border-t pt-8">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground text-xl">{isOwner ? "Tus cotizaciones" : "Cotizaciones"}</h2>
          <p className="text-muted-foreground text-sm">
            {isOwner ? "Las públicas aparecen aquí para quien visite tu perfil." : `Las que ${name} hizo públicas.`}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-card px-6 py-12 text-center">
          <IconCpu className="size-6 text-muted-foreground" stroke={1.5} />
          <p className="font-medium text-foreground">
            {isOwner ? "Todavía no tienes cotizaciones" : `${name} todavía no publica cotizaciones`}
          </p>
          {isOwner && (
            <p className="max-w-sm text-muted-foreground text-sm">
              Arma un PC con precios de varias tiendas y compártelo con un enlace.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/** Foto del proveedor de inicio de sesión o la inicial sobre la superficie del sistema (sin colores inventados). */
function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = (
    <span className="flex size-full items-center justify-center font-semibold text-2xl text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </span>
  );
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-secondary sm:size-24">
      {src ? (
        <AsyncImage src={src} alt={name} className="absolute inset-0 size-full object-cover" errorFallback={initial} />
      ) : (
        initial
      )}
    </div>
  );
}
