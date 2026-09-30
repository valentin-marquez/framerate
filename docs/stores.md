# Tiendas: reclamo por DNS, perfil y reseñas

Código: `apps/server/src/features/{stores,claims}`, re-chequeo en `apps/ingest/src/features/claims`,
DNS en `packages/kit/src/dns.ts`, contratos en `packages/contracts/src/{stores,claims}.ts`.

## Reclamo

```
POST /v1/claims {storeSlug}        → pending  (token aleatorio; TXT a crear)
GET  /v1/claims/:id/dns-check      → peek de sólo lectura (la web lo consulta en bucle)
POST /v1/claims/:id/verify         → pending → verified (enfriamiento de 10 s)
POST /v1/claims/:id/confirm        → verified → confirmed: crea la organización y deja al usuario como dueño
GET  /v1/claims/mine
POST /v1/admin/claims/:id/revoke   → personal; desvincula la tienda, conserva a los miembros
```

- Registro: `_framerate-verify.<dominio>  TXT  "framerate-verify=v1:<token>"`.
- Se consulta DNS-over-HTTPS a Cloudflare **y** Google; ambos deben ver el registro.
- Un solo reclamo vivo por tienda (índice único). Vence a los 7 días si no se completa.
- **Re-chequeo** (Cron de `ingest`, cada 6 h): un reclamo confirmado que pierde el TXT en 3 chequeos
  **conclusivos** seguidos pasa a `stale` y congela la tienda (sólo un admin edita). Si el registro vuelve,
  se descongela sola. Una caída de los resolvers no cuenta como falla.

## Gestión

- `PATCH /v1/stores/:slug` (perfil), `GET|POST|DELETE /v1/stores/:slug/members[/:userId]`.
- Roles de la organización: `owner` (sólo por reclamo), `admin`, `editor`. Se suma gente por nombre de usuario.
- Falta: iconos/banner (R2) e invitaciones por correo (`organization_invitations` ya existe en el esquema).

## Reseñas

Ver `/v1/stores/:slug/reviews` y `/v1/reviews/:id`. Una reseña activa por usuario; responder y fijar es de la
organización dueña (no si la tienda está congelada); eliminar, del autor o del personal (con auditoría).
