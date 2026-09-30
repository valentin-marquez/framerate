# Identidad (login, perfil, roles y sanciones)

Vive en `apps/server`, en las features `identity` y `users-admin`. El login lo
resuelve [Better Auth](https://www.better-auth.com) (OAuth + sesiones); todo lo
demás —perfil, roles, sanciones— es código propio sobre nuestras tablas.

Tablas: `users`, `auth_accounts`, `auth_sessions`, `auth_verifications`,
`user_bans` (ver [data-model.md](./data-model.md#identity)).

## Cómo funciona

```
 navegador ──► apps/web ──► apps/server (/v1/*)
                              │
        /v1/auth/*  ──────────┼─► Better Auth ── OAuth ──► Discord (y otros)
        /v1/me      (sesión)  ├─► perfil propio
        /v1/users/:u (público)├─► perfil público
        /v1/admin/* (personal)└─► usuarios: buscar, suspender, cambiar rol
```

**Sesión ≠ autoridad.** La cookie sólo identifica al usuario. Su rol y su
sanción se leen de la base en cada petición autenticada, así un ban o un cambio
de rol aplican al instante y no cuando vence la cookie.

### Reglas

| Tema | Regla |
|---|---|
| Handle (`username`) | Lo genera el **servidor**: `[a-z0-9_]{3,24}`, único, sin nombres reservados (`admin`, `soporte`, rutas del sitio…). Nunca se copia crudo del proveedor. Si choca, agrega sufijo (`ana_4821`). |
| Avatar | El cliente no puede escribirlo. `avatar_source_url` viene del proveedor; `avatar_key` es la copia propia en R2 (pendiente de implementar). Sólo se expone si es `https`. |
| Perfil editable | `displayName`, `username`, `bio`, `lang`, `theme` vía `PATCH /v1/me` (esquema estricto: cualquier otro campo → 400). |
| Rol | Uno por usuario: `user` < `moderator` < `admin`. Sólo un admin lo cambia; nadie cambia el suyo; siempre queda al menos un admin. |
| Sanciones | Una fila por sanción (historial). Bloquean **publicar**, no iniciar sesión ni editar el perfil. Se aplican con `assertNotBanned(user)` en toda ruta que cree contenido. |
| Quién sanciona a quién | Sólo a alguien de **menor** rango: un moderador sanciona usuarios; un admin, moderadores y usuarios; nadie a un par ni a sí mismo. |
| Personal | Sesión con rol suficiente **o** el token de servicio `ADMIN_TOKEN` (scripts; equivale a admin, queda como `null` en la bitácora). |
| CSRF | Toda escritura con cookie exige que `Origin`, si viene, sea `WEB_ORIGIN`. CORS con cookies sólo para la web. |
| Bitácora | Bans, unbans y cambios de rol quedan en `moderation_actions` con el antes y el después. |

### Rutas de Better Auth deshabilitadas

`/update-user`, `/change-email`, `/delete-user`: dejarían al cliente escribir su
avatar o correo. El perfil se edita con nuestro `PATCH /v1/me`.

## Endpoints

| Método y ruta | Acceso | Qué hace |
|---|---|---|
| `GET /v1/auth/providers` | público | Proveedores habilitados (`[{id, label}]`). La web dibuja sus botones con esto. |
| `POST /v1/auth/sign-in/social` | público | Inicia el login. Devuelve `{ url, redirect }` (Better Auth). |
| `GET /v1/auth/callback/:provider` | público | Vuelta del proveedor. Crea el usuario la primera vez. |
| `POST /v1/auth/sign-out` | sesión | Cierra sesión. |
| `GET /v1/me` | sesión | Perfil propio (con correo y sanción vigente). |
| `PATCH /v1/me` | sesión | Edita perfil. 409 si el handle está tomado o reservado. |
| `GET /v1/users/:username` | público | Perfil público (sin correo, rol ni sanciones). |
| `GET /v1/admin/users?q=` | moderador+ | Busca por handle o nombre (fragmento) o por correo (exacto). |
| `POST /v1/admin/users/:id/ban` | moderador+ | Suspende (`reason?`, `expiresAt?` futura). |
| `POST /v1/admin/users/:id/unban` | moderador+ | Levanta la sanción vigente. |
| `PATCH /v1/admin/users/:id/role` | admin | Cambia el rol. |

Los contratos (Zod) están en `packages/contracts/src/identity.ts`.

## Configuración

Variables (ver `apps/server/.dev.vars.example`):

| Variable | Tipo | Para qué |
|---|---|---|
| `BETTER_AUTH_SECRET` | secreto | Firma cookies y cifra tokens. ≥ 32 caracteres. |
| `BETTER_AUTH_URL` | variable | URL pública de la API; base de los callbacks OAuth. |
| `WEB_ORIGIN` | variable | Origen de la web (CORS con cookies y control de origen). |
| `COOKIE_DOMAIN` | variable, opcional | p. ej. `framerate.cl`: comparte la sesión entre `framerate.cl` y `api.framerate.cl`. |
| `ADMIN_TOKEN` | secreto | Token de servicio para scripts. |
| `ASSETS_BASE_URL` | variable, opcional | Base pública de los avatares copiados a R2. |
| `<PROVEEDOR>_CLIENT_ID` / `_CLIENT_SECRET` | secretos | Credenciales OAuth; ambas habilitan el proveedor. |

```bash
cd apps/server
bunx wrangler secret put BETTER_AUTH_SECRET     # openssl rand -base64 32
bunx wrangler secret put ADMIN_TOKEN
bunx wrangler secret put DISCORD_CLIENT_ID
bunx wrangler secret put DISCORD_CLIENT_SECRET
# BETTER_AUTH_URL, WEB_ORIGIN, COOKIE_DOMAIN: variables en el dashboard de Cloudflare
# (el Worker usa keep_vars, no las pisa al desplegar).
```

**Discord:** <https://discord.com/developers/applications> → OAuth2 → Redirect:
`${BETTER_AUTH_URL}/v1/auth/callback/discord` (en local `http://localhost:8787/...`).
Scopes: `identify` y `email` (ya configurados).

## Agregar un proveedor

Todo pasa por el registro `apps/server/src/features/identity/providers.ts`
(la web no cambia: lee la lista de `/v1/auth/providers`).

1. **Google y Facebook ya están cableados**: basta cargar sus dos credenciales
   (`GOOGLE_CLIENT_ID`/`_SECRET`, `FACEBOOK_CLIENT_ID`/`_SECRET`) y el proveedor
   aparece solo. Nunca se han probado con credenciales reales.
2. **Otro proveedor que Better Auth trae** (GitHub, Twitch, Microsoft…): agregar
   sus dos variables a `Env` (`env.ts`) y una entrada en `PROVIDERS`.
3. **Apple**: requiere generar un JWT como client secret; se agrega aparte.
4. Crear la app OAuth en el proveedor con el callback
   `${BETTER_AUTH_URL}/v1/auth/callback/<id>`.

Los tests recorren todos los proveedores habilitados y comprueban que cada uno
genera su URL de autorización, así una entrada mal armada falla en CI.

Si el mismo correo (verificado) entra por dos proveedores, se vincula a la misma
cuenta (`accountLinking`).

## Integrar la web (pendiente)

`apps/web` todavía usa Supabase Auth. Al migrarla:

- **Botones de login:** leer `GET /v1/auth/providers`; una sola lista, sin duplicarla en el navbar.
- **Iniciar sesión:** `POST /v1/auth/sign-in/social { provider, callbackURL }` → redirigir a `url`.
  Si se llama desde el SSR de la web, reenviar al navegador las cabeceras `Set-Cookie` de la respuesta.
- **Cookies:** con `COOKIE_DOMAIN` compartido, la web y la API ven la misma sesión. Desde el SSR, reenviar
  la cabecera `cookie` del navegador a la API.
- **Sanitizar `callbackURL`/`returnTo`** (`apps/web/app/shared/lib/safe-redirect.ts`): el sistema anterior
  tenía un open redirect por no hacerlo. Better Auth además exige que esté en `trustedOrigins`.
- El rol para mostrar el menú de admin sale de `GET /v1/me` (`role`), no de decodificar el JWT.

## Pendiente

- **Copiar el avatar a R2** al iniciar sesión (`avatar_key`), en vez de servir la URL del proveedor.
- **Eliminar cuenta** (la base ya soporta `deleted_at`; falta la ruta y la anonimización).
- **Caché de sesión** (`session.cookieCache`) para bajar lecturas a D1; hoy cada petición autenticada
  hace ~4 lecturas (sesión + usuario + sanción), aceptable a este volumen.
- **Tamaño del Worker:** Better Auth lo llevó de ~175 KB a ~490 KB comprimidos. Medir el arranque en frío tras
  el primer despliegue.
- Al crear usuarios en paralelo con el mismo handle candidato, la restricción UNIQUE de la base decide y una
  de las dos altas puede fallar (el usuario reintenta el login). No se reintenta automáticamente.
