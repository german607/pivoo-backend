# TODO

## Railway — Variables de entorno faltantes

### auth-service
- [ ] `GOOGLE_CALLBACK_URL` → debe coincidir exactamente con la URL registrada en Google Cloud Console  
  Ejemplo: `https://auth-service-production-2504.up.railway.app/api/v1/auth/google/callback`
- [ ] `FRONTEND_URL` → URL del frontend en Vercel  
  Ejemplo: `https://pivoo-web.vercel.app`
- [ ] `USERS_SERVICE_URL` → URL interna del users-service en Railway  
  Ejemplo: `https://users-service-production.up.railway.app`

---

## Google Cloud Console

- [ ] Agregar la URL correcta del callback en **Authorized redirect URIs** del OAuth client  
  Debe ser idéntica a `GOOGLE_CALLBACK_URL` seteada en Railway (ver arriba)

---

## Frontend (Vercel)

- [ ] Setear la variable de entorno del auth-service en Vercel — actualmente llega como `undefined`  
  La URL `/es/undefined/api/v1/auth/login` indica que falta algo como `NEXT_PUBLIC_AUTH_SERVICE_URL`

---

## Railway — Deploys pendientes

Los siguientes cambios están en el código pero aún no deployados:

- [ ] **Todos los servicios** — CORS actualizado (`allowedHeaders: Authorization`)
- [ ] **auth-service** — Login con Google + creación automática de perfil en users-service
- [ ] **matches-service** — Removido `prisma db push` del `startCommand` (causaba el 502)

---

## Base de datos

- [ ] Verificar que el seed de producción incluya `required_category` / `gender` / `complex_name` en los INSERTs de `matches.matches` (actualmente los registros seed tienen esos campos en NULL)


## Logica de negocio

### Nivel y categoría
- [ ] Algoritmo que analice los partidos anteriores del usuario y sugiera automáticamente el nivel o categoría que debería tener

### Partidos
- [ ] **Lista de espera**: cuando un partido está FULL, permitir que usuarios se anoten en espera — si alguien abandona, notificar al primero de la lista y darle una ventana de tiempo para confirmar
- [ ] **Mínimo de jugadores**: si al momento programado del partido no se alcanzó `min_players` con estado APPROVED, cancelar automáticamente y notificar a los participantes
- [ ] **Partidos recurrentes**: el admin puede crear un partido que se repita (ej. todos los martes a las 19h) — genera instancias automáticamente con un ciclo configurable
- [ ] **Revancha (rematch)**: endpoint que duplique la configuración de un partido finalizado y cree uno nuevo con los mismos participantes invitados
- [ ] **Plantillas de partido**: el usuario puede guardar la configuración de un partido como plantilla para reutilizarla

### Sistema de reputación
- [ ] **Valoración post-partido**: al registrarse un resultado, habilitar una ventana de 24h para que los participantes se califiquen mutuamente (puntualidad, fair play, nivel real). Promedio visible en el perfil
- [ ] **Penalización por no-show**: si un usuario con estado APPROVED no se presenta, registrarlo — después de N no-shows reducir su `rankingPoints` y/o restringir unirse a partidos

### Torneos
- [ ] **Generación automática del cuadro**: al cerrar inscripciones de un torneo, generar automáticamente los cruces del bracket según el formato (eliminación directa o round robin) y los seeds de los jugadores
- [ ] **Avance automático de ronda**: al registrar el resultado de un partido de torneo, actualizar automáticamente el siguiente cruce con el ganador
- [ ] **Puntos de ranking por torneo**: al finalizar un torneo, distribuir puntos al ranking de los jugadores según su posición final

### Social
- [ ] **Sistema de seguimiento (follow)**: un usuario puede seguir a otros para ver su actividad reciente (partidos jugados, torneos, logros) en un feed personalizado
- [ ] **Reseñas de complejos**: los usuarios que jugaron en un complejo pueden dejarlo puntuado y con comentario; el complejo muestra su promedio

### Descubrimiento
- [ ] **Recomendación de partidos**: sugerir partidos al usuario basándose en su deporte favorito, nivel/categoría, zona geográfica y horarios habituales de juego
- [ ] **Filtro de compatibilidad de nivel**: al listar partidos, mostrar un indicador visual de si el nivel/categoría del usuario es compatible con el requerido por el partido

---

## Ideas — Escalar para web + iOS + Android

### API Gateway / BFF
- [ ] Agregar un API Gateway (ej. Kong, o un servicio NestJS propio) como único punto de entrada para el frontend y las apps móviles. Permite versioning (`/v1`, `/v2`), auth centralizada, rate limiting global y ocultar la topología interna de microservicios.
- [ ] Considerar un BFF (Backend for Frontend) separado para mobile vs web si los payloads necesitan ser distintos — mobile necesita respuestas más compactas para ahorrar datos.

### Notificaciones push
- [ ] Crear un `notifications-service` que maneje APNs (iOS), FCM (Android y web). Eventos a notificar: invitación a partido, solicitud aprobada/rechazada, partido por comenzar, resultado cargado, nuevo torneo disponible.
- [ ] Agregar tabla `device_tokens` al users-service para almacenar los tokens de dispositivo por usuario (un usuario puede tener múltiples dispositivos).

### Real-time
- [ ] Agregar WebSockets (NestJS Gateway) para actualizaciones en vivo: estado del partido (OPEN → FULL), aprobación de solicitudes, chat básico dentro del partido. Crítico para la app móvil.
- [ ] Evaluar Redis Pub/Sub como bus entre servicios para propagar eventos en tiempo real sin acoplamiento directo.

### Caché
- [ ] Agregar Redis como capa de caché para rankings por deporte (se consultan frecuentemente, cambian poco), lista de deportes/complejos (datos casi estáticos) y validación de JWT (evitar consultar auth-service en cada request).

### Geolocalización
- [ ] Agregar índice espacial (`PostGIS` o columnas `lat/lng` con índice) en `sport_complexes` y en `matches` para permitir búsqueda de partidos cercanos — esencial para la app móvil ("partidos cerca mío").
- [ ] Endpoint `GET /matches?lat=X&lng=Y&radiusKm=Z` en matches-service.

### Media / Archivos
- [ ] Agregar un endpoint de upload de avatar en users-service que suba a S3 o Cloudflare R2 y guarde solo la URL. Actualmente `avatarUrl` se guarda como string libre sin validación.
- [ ] Considerar un `media-service` liviano si se suma carga de fotos de complejos o imágenes de partidos.

### Observabilidad
- [ ] Agregar `GET /health` en cada servicio con check de DB (Railway lo usa para healthchecks y zero-downtime deploys).
- [ ] Centralizar logs estructurados (JSON) con un request ID propagado entre servicios para poder trazar un request de punta a punta.

### Seguridad móvil
- [ ] Implementar **refresh token rotation con detección de reutilización**: si un refresh token ya usado vuelve a presentarse, revocar todos los tokens del usuario (protección contra robo de token en mobile).
- [ ] Rate limiting por `userId` además del global actual por IP — necesario cuando los clientes son apps móviles que comparten IPs (NAT, redes corporativas).

### Infraestructura
- [ ] Mover las migraciones de SQL manual (`migrate.sql`) a un sistema versionado (ej. correr `migrate.sql` desde un job de Railway en cada deploy, o adoptar Prisma Migrate con `--create-only` para no perder el control manual).
- [ ] Configurar `DATABASE_URL` con pool de conexiones (PgBouncer o `?connection_limit=5` en la URL) — en Railway con múltiples réplicas cada instancia abre sus propias conexiones y se puede agotar el pool de Postgres.

---

## Ideas — Seguridad general

### Autenticación y tokens
- [ ] **Refresh token rotation con detección de reutilización**: si un refresh token ya invalidado se presenta de nuevo, revocar todos los tokens activos del usuario y forzar re-login. Protege contra robo de token (especialmente crítico en mobile).
- [ ] **Access token de corta duración + blacklist en Redis**: actualmente el token vive hasta que expira aunque el usuario haga logout. Con un blacklist en Redis se puede invalidar instantáneamente sin esperar a que venza.
- [ ] **Binding de dispositivo**: guardar un fingerprint del dispositivo en el refresh token (user-agent + plataforma) y rechazar si cambia abruptamente — reduce el impacto de robo de token.

### Comunicación entre servicios
- [ ] **Service-to-service auth**: los endpoints internos (ej. `POST /users/stats`, `PATCH /matches/expire-past`) actualmente solo usan una `SERVICE_KEY` estática. Considerar JWT firmados con una clave interna o mTLS para evitar que cualquiera que conozca la key pueda llamarlos.
- [ ] **Red privada entre servicios**: en Railway, configurar los servicios para que se comuniquen por la red interna (`.railway.internal`) y no por los dominios públicos — elimina un vector de ataque externo y reduce latencia.

### Inputs y API
- [ ] **Validación de UUIDs en todos los `:id` params**: actualmente un `:id` malformado llega hasta Prisma y genera un error 500 en lugar de un 400. Agregar un pipe `ParseUUIDPipe` en los controllers.
- [ ] **Sanitización de campos de texto libre**: `description`, `bio`, `name`, `username` — truncar y sanitizar para prevenir almacenamiento de payloads maliciosos.
- [ ] **Limitar tamaño de body** en todos los servicios (`app.use(express.json({ limit: '50kb' }))`) para prevenir ataques de payload gigante.

### Rate limiting
- [ ] **Rate limiting diferenciado por endpoint**: los endpoints de auth (`/login`, `/register`, `/refresh`) deben tener límites más agresivos que el resto. Actualmente el throttler aplica el mismo límite global.
- [ ] **Rate limiting por userId** además de por IP — necesario para apps móviles donde muchos usuarios comparten la misma IP (NAT, redes de datos móviles).
- [ ] **Bloqueo progresivo en login fallido**: después de N intentos fallidos consecutivos, aplicar backoff exponencial o bloqueo temporal por email — previene brute force aunque se roten IPs.

### Base de datos
- [ ] **Least privilege en la DB**: crear un usuario de Postgres por servicio con permisos solo sobre su propio schema (ej. el matches-service no debería poder leer `auth.auth_users`). Actualmente todos usan el mismo superusuario.
- [ ] **Auditoría de cambios sensibles**: loggear en una tabla `audit_log` las operaciones de escritura en `auth_users` (cambios de password, provider linking) y en `match_results` (quién cargó el resultado y cuándo).

### HTTPS y headers
- [ ] **Security headers** en todos los servicios: `Helmet` (NestJS tiene `@nestjs/helmet`) agrega `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc. con una línea.
- [ ] **CORS restrictivo en producción**: actualmente `origin: true` refleja cualquier origen. En producción debería ser una whitelist explícita (`['https://pivoo-web.vercel.app', 'capacitor://localhost']`).

### Secretos
- [ ] **Rotación de JWT_SECRET**: definir un proceso para rotar el secreto sin downtime (ventana de gracia con dos secretos válidos simultáneamente).
- [ ] **Nunca loggear tokens ni passwords**: auditar que ningún `console.log` o logger estructurado exponga `accessToken`, `refreshToken`, `passwordHash` o `GOOGLE_CLIENT_SECRET` en los logs de Railway.