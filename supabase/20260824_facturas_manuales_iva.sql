-- ── facturas_manuales: desglose de IVA ─────────────────────────────────────
--
-- Las facturas de IT ASAP Solutions SL (España) suelen venir con IVA
-- discriminado (Base imponible + IVA = Total). Se agrega una columna para
-- guardar el monto de IVA por separado; `monto` sigue representando el
-- total de la factura (base + iva), que es lo que efectivamente hay que
-- cobrarle al cliente.

alter table public.facturas_manuales add column if not exists iva numeric(14, 2) not null default 0;
