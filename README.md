# Converxity - Shopify Affiliate and Commission Engine

Aplicación Shopify para comerciantes: gestión de afiliados, tracking via Web Pixel API y facturación automática del 5% mediante Billing API (Usage Charges).

---

## Instalación y Ejecución Local

prerrequisitos: Node.js >= 20, npm >= 10

git clone https://github.com/dwight-trujillo/converxity-affiliate-app.git
cd converxity-affiliate-app
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
node prisma/seed.mjs
npm run dev -- --port 5000

Abrir http://localhost:5000

Datos de prueba incluidos: 5 afiliados, 25 conversiónes, billing config.

---

## Decisiones de Arquitectura

### Stack y justificación

Framework: Remix (React Router) - Integración nativa con Shopify OAuth y App Bridge. SSR.
Lenguaje: TypeScript 5.7 - Type safety, detección temprana de errores.
ORM: Prisma 5.22 - Queries type-safe, migraciones declarativas, abstracción de BD.
Base de Datos: SQLite (MVP) - Cero configuración, portable. Migrable a PostgreSQL sin cambios.
Tracking: Web Pixel API - Nativo Shopify 2026. Sustituye a ScriptTags legacy.
facturación: Billing API GraphQL - Usage Charges con idempotencyKey nativo.

### Por qué SQLite para MVP

No requiere servidor de BD separado. Archivo único portable.
Prisma abstrae el provider: migrar a PostgreSQL es cambiar una linea.

Plan de migración:
1. Cambiar provider en schema.prisma
2. prisma migrate dev
3. Migrar datos con ETL
4. PgBouncer para connection pooling

### Alternativas Descartadas

ScriptTags: obsoleto en Shopify 2026
Next.js: sin integración nativa con Shopify OAuth
Firebase: vendor lock-in
MongoDB: sin integridad ACID para facturación
---

## Idempotencia y Asincronía

### Problema
El Web Pixel puede enviar eventos checkout_completed duplicados. La Billing API jamas debe recibir cargos duplicados.

### solución: 3 Capas de Protección

Capa 1 - BD: CONSTRAINT UNIQUE (orderId, affiliateId)
Capa 2 - Codigo: SELECT antes de INSERT verifica existencia
Capa 3 - Shopify: idempotencyKey = SHA-256(orderId + affiliateId)

### Máquina de Estados
pending -> billing -> billed
pending -> billing -> retrying -> billed
pending -> billing -> retrying -> failed (8 intentos max)

### Reintentos
Backoff exponencial con jitter para rate limits (HTTP 429)

---

## Base de Datos y Escalabilidad

### Esquema
Affiliate: id, shopDomain, name, email, refId, commissionRate, isActive
Conversión: id, orderId, orderTotal, platformFee(5%), status, idempotencyKey, usageRecordId
BillingConfig: shopDomain, subscriptionId, cappedAmount
AuditLog: action, entity, entityId, details (ISO 27001)

### Indices Clave
UNIQUE(orderId, affiliateId) - garantia de Idempotencia
INDEX(shopDomain, createdAt) - dashboards por tienda
INDEX(status, retryCount) - worker de reintentos

### Escalabilidad para Black Friday
Fase 1: PostgreSQL con particiónamiento hash por shopDomain (16 particiónes)
Fase 2: CQRS - PostgreSQL escritura + ClickHouse lectura. CDC con Debezium + Kafka
Fase 3: Redis cache dashboards (TTL 5min)

---

## facturación (Billing API)

Modelo: 5% de tarifa sobre cada venta referida
Ejemplo: Venta  = .00 UsageRecord en factura mensual del merchant
Protegido con idempotencyKey nativo de Shopify GraphQL

---

## DevOps y CI/CD

Entornos: Dev (SQLite), Staging (PostgreSQL + Fly.io), Prod (PostgreSQL HA + Fly.io)

CI/CD GitHub Actions:
1. Pull Request: lint + typecheck + unit tests + integration tests
2. Push to main: build + deploy Staging
3. Release: deploy Production Blue/Green + health checks

Despliegue Blue/Green: nueva versión se prueba antes de redirigir trafico. Rollback instantaneo.
Secretos: nunca en codigo, inyectados via Fly.io secrets. rotación cada 90 dias.

---

## Seguridad

OWASP Top 10: validación de inputs, sanitizacion XSS, prepared statements (Prisma)
HMAC-SHA256: firma de payloads del Web Pixel para integridad
AuditLog: registro de todas las operaciónes (ISO 27001)
Cookies: SameSite=Lax, Secure, HttpOnly
refId: solo [A-Za-z0-9_-], max 50 caracteres

---

Stack: Remix 2.15 | React 18.3 | TypeScript 5.7 | Prisma 5.22 | SQLite | Web Pixel API | Billing API

ISO/IEC 25010 | OWASP Top 10 | IEEE 829


============================================================
## RESPUESTAS DETALLADAS A LA PRUEBA TÉCNICA
============================================================

---

## 1. Decisiones de Arquitectura - justificación Completa

### por qué esta estructura de proyecto

Elegi Remix (React Router) sobre Next.js porque:
- Shopify ofrece integración oficial con Remix via @shopify/shopify-app-remix
- Manejo nativo de sesiónes OAuth con Shopify
- Server-Side Rendering para mejor SEO y carga inicial
- Nested routing para layouts de admin (dashboard, affiliates, settings)
- App Bridge integrado para comunicacion con el admin de Shopify

Elegi Prisma sobre TypeORM o Sequelize porque:
- Type safety completo (tipos generados automáticamente del schema)
- Migraciones declarativas sin SQL manual
- Abstracción de BD: mismo codigo para SQLite (dev) y PostgreSQL (prod)
- Mejor DX con Prisma Studio y autocompletado

### Alternativas consideradas y descartadas

Next.js: Descartado porque no tiene soporte oficial de Shopify para OAuth.
Express + REST: Descartado porque Shopify recomienda Remix para apps embebidas.
Firebase/Firestore: Descartado por vendor lock-in y falta de integración con Billing API.
MongoDB: Descartado porque no ofrece transacciones ACID robustas para facturación.
ScriptTags: Descartado porque Shopify los marco como legacy en 2026. Web Pixel es el reemplazo.
Charges API (REST): Descartada porque GraphQL ofrece idempotencyKey nativo.

### Cómo manejé la Asincronía en facturación

La facturación se procesa de forma asincrona despues de recibir el evento del Web Pixel:

1. El Web Pixel envia el evento checkout_completed al backend
2. El backend valida el payload y persiste la Conversión (status: pending)
3. Se dispara processBillingAsync() que ejecuta en background:
   - Lee la Conversión de la BD
   - Obtiene el subscriptionId del BillingConfig
   - Llama a usageRecordCreate con idempotencyKey
   - Actualiza status a billed o retrying
4. Si falla por rate limit, programa reintentos con backoff exponencial

### Cómo garantizo la Idempotencia

Tres capas de Protección contra cobros duplicados:

Capa 1 - Base de Datos:
  CONSTRAINT UNIQUE (orderId, affiliateId) en tabla Conversión
  Previene inserciónes duplicadas a nivel de motor de BD

Capa 2 - Logica de Aplicación:
  SELECT verifica si existe Conversión antes de INSERT
  Si existe, retorna el ID existente sin crear otro registro

Capa 3 - Shopify Billing API:
  idempotencyKey = SHA-256(orderId + affiliateId + subscriptionId)
  Shopify rechaza automáticamente cualquier UsageRecord con clave duplicada
  Esto funciona incluso si nuestro backend reintenta la misma operación

### Cómo adaptaría la solución para alta concurrencia (Black Friday)

Para 1,000+ tiendas procesando miles de eventos/minuto:

1. Separar el endpoint de tracking del resto de la app:
   - Deploy del endpoint /api/track como funcion serverless (Fly.io Machines)
   - Escala horizontalmente bajo carga sin afectar el admin

2. Cola de mensajes para facturación:
   - BullMQ + Redis para encolar jobs de billing
   - Workers independientes procesan la cola
   - Rate limiting por shop para respetar limites de Shopify (4 req/s)

3. Base de datos separada para lectura y escritura (CQRS):
   - PostgreSQL para escrituras transaccionales (OLTP)
   - ClickHouse para dashboards y analítica (OLAP)
   - CDC con Debezium + Kafka para sincronizar en tiempo real

4. Cache agresivo:
   - Redis para Métricas de dashboard (TTL 5 minutos)
   - CDN para assets estaticos

---

## 2. Sustentacion de Base de Datos

### justificación TÉCNICA del esquema

El esquema tiene 4 tablas con separacion clara de responsabilidades:

Affiliate: Entidad de negocio principal. Separada de Conversión para evitar
redundancia. La relación 1:N permite que un afiliado tenga muchas conversiónes.

Conversión: Registro inmutable de cada venta referida. Contiene tanto la
comisión del afiliado como el platformFee (5%). El campo status permite
trazabilidad del ciclo de facturación.

BillingConfig: configuración por tienda de la suscripcion. Separada porque
una tienda tiene exactamente una configuración de billing activa.

AuditLog: Registro de auditoría para compliance ISO 27001. Inmutable, solo
inserciónes. Permite reconstruir el historial de cualquier entidad.

### Cómo garantizo integridad bajo carga

1. Transacciones ACID via Prisma  para operaciónes multi-tabla
2. Constraints UNIQUE que previenen duplicados a nivel de motor de BD
3. IdempotencyKey único en cada Conversión
4. WAL (Write-Ahead Logging) en SQLite/PostgreSQL para recuperación ante fallos
5. Connection pooling con PgBouncer en produccion (10,000+ conexiónes)

### Cómo garantizo rapidez de consultas

Indices estrategicos:
- UNIQUE(orderId, affiliateId): busqueda O(log n) para verificación de Idempotencia
- INDEX(shopDomain, createdAt): consultas de dashboard filtradas por tienda y fecha
- INDEX(status, retryCount): worker de reintentos encuentra conversiónes pendientes
- INDEX(refId): busqueda O(log n) de afiliado durante tracking

### Estrategia para millones de registros

particiónamiento por shopDomain en PostgreSQL:
- 16 particiónes hash distribuyen uniformemente la carga
- Consultas de dashboard solo escanean la partición de la tienda
- VACUUM y ANALYZE por partición, no sobre toda la tabla

CQRS para analítica:
- PostgreSQL para operaciónes transaccionales (inserciónes rapidas)
- ClickHouse para dashboards (consultas agregadas en ms sobre billones de filas)
- CDC con Debezium para replicar datos en tiempo real sin carga extra en OLTP

### Consistencia entre Pixel y facturación

El flujo garantiza consistencia:

1. El Web Pixel envia el evento con orderId, total y affiliateRef
2. El backend valida HMAC del payload (integridad en transito)
3. Crea Conversión ATOMICAMENTE (pending) antes de facturar
4. Solo si la Conversión se persistio exitosamente, procede a Billing API
5. Si Billing API falla, la Conversión queda en estado retrying
6. El worker de reintentos procesa las conversiónes retrying
7. La idempotencyKey asegura que aunque el worker reintente, no se cobra doble

Esto garantiza que NUNCA se pierde un evento y NUNCA se cobra doble.

---

## 3. Sustentacion de DevOps

### gestión de Entornos (Seccion 3.E)

Development:
- App Shopify en modo desarrollo en Partner Dashboard
- SQLite local, sin caché externa
- Ngrok para túnel HTTPS durante desarrollo
- Mock de Billing API (MOCK_BILLING=true) para pruebas sin cargos reales

Staging:
- App privada en Partner Dashboard
- PostgreSQL en Fly.io
- Redis para cache y colas
- Billing API en modo test
- Pruebas E2E automatizadas contra este entorno

Production:
- App publica listada en Shopify App Store
- PostgreSQL HA con replicas de lectura
- Redis Cluster para cache y colas
- Billing API real con Capped Amount
- Monitoreo 24/7 con alertas

### Pipeline CI/CD (Seccion 3.E)

GitHub Actions con 3 stages:

Stage 1 - Pull Request:
  - ESLint + Prettier (code quality)
  - TypeScript type checking (tsc --noEmit)
  - Unit tests (Vitest)
  - Integration tests (Vitest + Supertest)
  - Security audit (npm audit --audit-level=high)

Stage 2 - Push to main:
  - Build (Remix vite:build)
  - Docker build
  - Deploy to Staging (Fly.io)
  - Smoke tests against staging URL

Stage 3 - Release Tag:
  - Deploy to Production with Blue/Green strategy
  - Health check on Green
  - Traffic switch to Green
  - Rollback automatico si health check falla

### Estrategia de Despliegue (Seccion 3.E)

Plataforma: Fly.io (edge deployment)

Configuración:
- Dockerfile multi-stage para optimizar tamaño de imagen
- Variables de entorno inyectadas via fly secrets
- Health checks configurados en fly.toml (interval: 10s, timeout: 3s)
- Auto-scaling basado en CPU/memoria
- PostgreSQL gestiónado (Fly Postgres) con backups diarios
- Redis via Upstash para cache y colas

Base de datos en produccion:
- PostgreSQL en instancia dedicada
- Backups automaticos cada 6 horas
- Replicas de lectura para dashboards
- Connection pooling con PgBouncer

### Rotación de Secretos

Procedimiento de rotación sin downtime:

1. Generar nuevo secreto: openssl rand -hex 32
2. Agregar como nuevo secreto: fly secrets set HMAC_SECRET_NEW=xxx
3. Desplegar codigo que acepte ambos secretos (viejo y nuevo)
4. Verificar que todo funciona con el nuevo secreto
5. Eliminar secreto viejo: fly secrets unset HMAC_SECRET_OLD
6. Rotar cada 90 dias o ante compromiso de seguridad

### Health Checks y Monitoreo

Endpoint GET /api/health verifica:
- Conexión a base de datos (SELECT 1)
- Tiempo de respuesta

Respuesta 200: { status: healthy, database: true, uptime: 3600 }
Respuesta 503: { status: degraded, database: false }

Métricas monitoreadas:
- Billing_success_rate: alerta si < 95%
- Retry_queue_depth: alerta si > 100
- Api_latency_p99: alerta si > 2s
- failed_conversións_rate: alerta si > 1%
- Database_connections: alerta si > 80% del pool

Alertas enviadas via Slack/Email/PagerDuty.














