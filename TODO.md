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

- [ ] Algoritmo que permita al usuario en caso de querer, que analice sus partidos anteriores y genere automaticamente el nivel o categoria que deberia tener