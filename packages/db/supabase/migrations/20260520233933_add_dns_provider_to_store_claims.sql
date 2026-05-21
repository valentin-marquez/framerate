-- Detección del provider DNS para mejorar el UX del wizard de reclamo.
--
-- `dns_provider` guarda el id del provider matcheado (ver
-- apps/api/src/lib/dns-provider.ts: DNS_PROVIDERS). `null` = desconocido o
-- detección falló; la UI cae a las instrucciones genéricas.
--
-- `dns_nameservers` guarda los NS resueltos al momento de crear el claim,
-- útil para telemetría y para mostrar "Tu DNS está en X (nsX.foo.com)".

alter table public.store_claim_requests
  add column if not exists dns_provider text,
  add column if not exists dns_nameservers text[];

comment on column public.store_claim_requests.dns_provider is
  'Provider DNS detectado a partir de los NS records al crear el claim. null = desconocido. Ver apps/api/src/lib/dns-provider.ts.';

comment on column public.store_claim_requests.dns_nameservers is
  'Nameservers resueltos via DoH al crear el claim. Snapshot, no se actualiza.';
