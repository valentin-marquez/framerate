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
| `GET /v1/auth/list-accounts` | sesión | Cuentas de proveedor propias, sin tokens (`LinkedAccountsSchema`). |
| `POST /v1/auth/link-social` | sesión | `{provider, callbackURL, errorCallbackURL}` → `{ url, redirect }`: conecta otro proveedor al usuario actual. |
| `POST /v1/auth/unlink-account` | sesión de < 24 h | `{accountId}` (el `id` de `list-accounts`) → `{ status: true }`. |
| `GET /v1/me` | sesión | Perfil propio (con correo y sanción vigente). |
| `PATCH /v1/me` | sesión | Edita perfil. 409 si el handle está tomado o reservado. |
| `POST /v1/me/merge/start` | sesión (A) | Inicia la unión de usuarios: 204 + cookie `framerate.merge`. |
| `GET /v1/me/merge` | sesión (B) + cookie | Previsualización (`MergePreviewSchema`). |
| `POST /v1/me/merge/confirm` | sesión (B) + cookie | Absorbe B en A. 204. |
| `DELETE /v1/me/merge` | sesión + cookie | Cancela. 204. |
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
| `BETTER_AUTH_URL` | `wrangler.jsonc` | URL pública de la API (`https://api.framerate.cl`); base de los callbacks OAuth. |
| `WEB_ORIGIN` | `wrangler.jsonc` | Origen de la web (`https://framerate.cl`): CORS con cookies y control de origen. |
| `COOKIE_DOMAIN` | `wrangler.jsonc` | `framerate.cl`: comparte la sesión entre la web y `api.framerate.cl`. |
| `ADMIN_TOKEN` | secreto | Token de servicio para scripts. |
| `ASSETS_BASE_URL` | variable, opcional | Base pública de los avatares copiados a R2. |
| `<PROVEEDOR>_CLIENT_ID` / `_CLIENT_SECRET` | secretos | Credenciales OAuth; ambas habilitan el proveedor. |

```bash
cd apps/server
bunx wrangler secret put BETTER_AUTH_SECRET     # openssl rand -base64 32
bunx wrangler secret put ADMIN_TOKEN
bunx wrangler secret put DISCORD_CLIENT_ID
bunx wrangler secret put DISCORD_CLIENT_SECRET
# BETTER_AUTH_URL, WEB_ORIGIN y COOKIE_DOMAIN ya van en wrangler.jsonc (son públicas).
```

**Discord:** <https://discord.com/developers/applications> → OAuth2 → Redirects. **Agregar** (sin quitar el de
Supabase mientras la web siga usándolo): `https://api.framerate.cl/v1/auth/callback/discord`
(en local `http://localhost:8787/v1/auth/callback/discord`).
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

## Cuentas vinculadas

Una persona es un usuario aunque entre por varios proveedores (`auth_accounts` tiene una fila por proveedor).

- **Implícita (mismo correo):** al entrar con un proveedor nuevo cuyo correo ya tiene un usuario, se vincula a ese
  usuario sólo si el proveedor marca el correo como verificado **y** el usuario tiene `email_verified = 1`. Si no,
  no se vincula ni se crea otro usuario (`?error=account_not_linked`). No hay `trustedProviders`.
- **Manual (con sesión):** `link-social` conecta un proveedor con **otro** correo (`allowDifferentEmails`): el
  usuario prueba ambas identidades en el mismo flujo. El proveedor igual debe marcar su correo como verificado.
- Vincular no cambia `email`, `username`, `display_name` ni avatar del usuario.
- Una cuenta de proveedor que ya es de otro usuario no se mueve (`account_already_linked_to_different_user`):
  para eso está la [fusión de usuarios](#fusión-de-usuarios).
- No se puede quitar la última cuenta. Desvincular pide una sesión de menos de 24 h (`freshAge` de Better Auth).

`callbackURL` y `errorCallbackURL` deben ser de `WEB_ORIGIN` (o de la propia API) y todo `POST` con cookie a
`/v1/auth/*` debe traer `Origin: WEB_ORIGIN`: el SSR de la web lo reenvía (`auth-action.tsx`).

**Errores del callback** (redirige a `errorCallbackURL?error=<código>&error_description=…`):

| Código | Cuándo |
|---|---|
| `account_not_linked` | Login con un correo que ya tiene usuario, sin verificar en algún lado. |
| `account_already_linked_to_different_user` | `link-social` con una cuenta que es de otro usuario. |
| `unable_to_link_account` | `link-social` con un correo que el proveedor no verificó (o falla al guardar). |
| `email_not_found` | El proveedor no entregó correo (login). |
| `state_mismatch`, `state_not_found` | Estado OAuth vencido (10 min) o sin su cookie. |
| `invalid_code`, `unable_to_get_user_info` | Falló el canje con el proveedor. |
| `access_denied` (u otro del proveedor) | El usuario canceló en el proveedor. |

**Errores JSON** de `link-social` / `unlink-account` (`{ code, message }`, formato de Better Auth, no el
`{ error }` de la API): `401 UNAUTHORIZED`, `403 INVALID_ORIGIN`, `403 MISSING_OR_NULL_ORIGIN`,
`403 INVALID_CALLBACK_URL`, `403 INVALID_ERROR_CALLBACK_URL`, `404 PROVIDER_NOT_FOUND`,
`400 FAILED_TO_UNLINK_LAST_ACCOUNT`, `400 ACCOUNT_NOT_FOUND`, `403 SESSION_NOT_FRESH` (volver a iniciar sesión).

Los tests (`apps/server/test/account-linking.integration.test.ts`) recorren el callback OAuth real con la red del
proveedor falseada.

## Fusión de usuarios

Cuando la cuenta que alguien quiere conectar ya es **otro** usuario de Framerate (B), se unen en el que la inicia
(A, el que se queda). Cada uno prueba ser dueño con su propio login y nadie recibe la sesión del otro.

1. A, con sesión, llama `POST /v1/me/merge/start`: crea una fila `pending` en `account_merges` (sólo el hash del
   token, vence en 10 min) y deja la cookie `framerate.merge` (httpOnly, Secure, SameSite=Lax, `Domain=COOKIE_DOMAIN`,
   `Path=/`, 600 s). Empezar otra vez reemplaza la anterior.
2. La web hace el `sign-in/social` normal con el proveedor de B (`callbackURL=/ajustes/cuenta/unir`). La sesión
   queda como B.
3. `GET /v1/me/merge` muestra quién se queda, quién se absorbe y qué se mueve.
4. `POST /v1/me/merge/confirm` (sesión de B) absorbe B en A en un solo batch de D1, marca la fila `done` (guarda id,
   handle, correo de B y un resumen, sin FK a B), borra la cookie y **revoca todas las sesiones de B**. No se abre
   sesión de A: la persona vuelve a entrar con cualquiera de sus proveedores y cae en A.
5. `DELETE /v1/me/merge` cancela (borra la fila pendiente y la cookie).

Reglas (B → A):

- A conserva correo, handle, nombre, bio, avatar, idioma y tema. `role` = el mayor de ambos (si B era el único
  admin, A queda admin); `email_verified` = el de cualquiera; `created_at` = el más antiguo.
- Toda columna con FK a `users(id)` pasa a A. La lista vive en `USER_REFERENCES`
  (`features/identity/merge.repository.ts`) y un test la compara con `PRAGMA foreign_key_list` de todas las tablas:
  una FK nueva sin cubrir hace fallar CI.
- Choques por unicidad: si ambos reseñaron la misma tienda, queda la reseña más reciente y la otra se marca
  eliminada (`deletion_reason = 'author'`; los triggers recalculan el promedio). Votos, likes y reportes vivos
  repetidos quedan uno (los contadores bajan por trigger). En una organización compartida A queda con el rol mayor.
- Las sanciones viajan: unir cuentas no sirve para esquivar un ban. Un usuario suspendido igual puede unir.
- B se borra al final (hard delete, ya sin nada que apunte a él).

Errores (formato `{ error: { code, message } }` de la API):

| Código | Cuándo |
|---|---|
| `404 merge_not_found` | Sin cookie, token desconocido o ya usado, o A se eliminó. |
| `410 merge_expired` | Pasaron los 10 minutos. |
| `409 merge_same_user` | La sesión ya es A (el proveedor era de A o se vinculó solo por correo). |
| `403 bad_origin` | `POST`/`DELETE` con un `Origin` que no es la web. |
| `401 unauthorized` | Sin sesión. |

## Cómo la usa la web

`apps/web` no guarda sesión: la cookie es de la API (`framerate.session_token`, compartida con `COOKIE_DOMAIN`).

- **SSR:** `workers/app.ts` guarda la cookie de la petición y `app/shared/lib/api.ts` la reenvía en cada llamada. En
  producción va por *service binding* (`API` → `framerate-server`): un Worker no puede llamar por HTTP público a otro
  de su misma zona. En local usa HTTP normal.
- **Navegador:** `fetch` con `credentials: "include"`; por eso todo CORS de la API es sólo para `WEB_ORIGIN` y con cookies.
- **Login/logout:** `POST /action/auth` (web) → `POST /v1/auth/sign-in/social` o `/sign-out` de la API, reenviando
  al navegador sus `Set-Cookie` (el estado OAuth). `returnTo` pasa por `safeRedirectPath`.
- **Usuario y rol:** el loader raíz lee `GET /v1/me` (una consulta por petición, memoizada). El menú de admin usa
  `me.role`; ya no se decodifica ningún JWT.
- **Botones de login:** salen de `GET /v1/auth/providers` (`useAuthProviders`), no de una lista fija.
- **Datos:** `features/*/services` traducen los contratos de la API a los tipos que usa la UI
  (`features/product/services/adapters.ts`); los componentes no cambian.

### Herramienta de desarrollo

`bun run dev:session <nombre> [rol]` (en `apps/server`) crea un usuario en la D1 local e imprime la cabecera `Cookie`
de una sesión válida, para probar la web y la API sin pasar por Discord.

## Pendiente

- **Copiar el avatar a R2** al iniciar sesión (`avatar_key`), en vez de servir la URL del proveedor.
- **Eliminar cuenta** (la base ya soporta `deleted_at`; falta la ruta y la anonimización).
- **Caché de sesión** (`session.cookieCache`) para bajar lecturas a D1; hoy cada petición autenticada
  hace ~4 lecturas (sesión + usuario + sanción), aceptable a este volumen.
- **Tamaño del Worker:** Better Auth lo llevó de ~175 KB a ~490 KB comprimidos. Medir el arranque en frío tras
  el primer despliegue.
- Al crear usuarios en paralelo con el mismo handle candidato, la restricción UNIQUE de la base decide y una
  de las dos altas puede fallar (el usuario reintenta el login). No se reintenta automáticamente.
