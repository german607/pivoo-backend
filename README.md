# 🏟️ Pivoo Backend

**Plataforma de gestión de partidos deportivos y complejos deportivos**

Pivoo Backend es una arquitectura de **microservicios escalable** construida con **NestJS**, **PostgreSQL** y **Prisma ORM**, diseñada para gestionar usuarios, autenticación, partidos, deportes, equipos y complejos deportivos.

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Tecnologías](#tecnologías)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Scripts Disponibles](#scripts-disponibles)
- [Servicios](#servicios)
- [Variables de Entorno](#variables-de-entorno)
- [Desarrollo](#desarrollo)
- [Infraestructura](#infraestructura)
- [Contribuir](#contribuir)

---

## ✨ Características

- ✅ **Autenticación segura** con JWT y Passport
- ✅ **Gestión de usuarios** con roles y permisos
- ✅ **Gestión de partidos** con validaciones complejas
- ✅ **Catálogo de deportes** y categorías
- ✅ **Gestión de complejos** deportivos
- ✅ **Gestión de equipos** y participantes
- ✅ **API REST** documentada con Swagger
- ✅ **Base de datos relacional** con PostgreSQL 16
- ✅ **Arquitectura modular** con monorepo y Turbo
- ✅ **Infrastructure as Code** con Terraform para AWS
- ✅ **Docker Compose** para desarrollo local
- ✅ **Type-safe** con TypeScript

---

## 🏗️ Arquitectura

### Diagrama de Microservicios

```
┌─────────────────────────────────────────────────────────────┐
│                    Cliente / Cliente Web                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────────────┐
│                   API Gateway / Load Balancer                │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────────┐
        │            │            │                │
        ▼            ▼            ▼                ▼
   ┌─────────┐  ┌────────┐  ┌─────────┐   ┌──────────────┐
   │ Auth    │  │ Users  │  │ Matches │   │ Sports       │
   │ Service │  │Service │  │ Service │   │ Service      │
   │ :3001   │  │ :3002  │  │ :3003   │   │ :3004        │
   └────┬────┘  └───┬────┘  └────┬────┘   └──────┬───────┘
        │           │            │               │
        │      ┌────▼────┐       │               │
        │      │ Complexes       │               │
        │      │ Service         │               │
        │      │ :3005   ◄───────┼──────────────┘
        │      └────┬────┘       │
        │           │       ┌────▼────┐
        │           │       │  Teams   │
        │           │       │ Service  │
        │           │       │ :3006    │
        │           │       └──────────┘
        │           │
        └─────┬─────┴─────────────┘
              │
              ▼
         ┌──────────────────┐
         │  PostgreSQL 16   │
         │  (Schemas por    │
         │   Servicio)      │
         └──────────────────┘
```

**Características de la arquitectura:**

- **Desacoplamiento**: Cada servicio tiene su propia base de datos (schema)
- **Comunicación**: HTTP REST entre servicios
- **Autenticación centralizada**: Auth Service valida JWT para todos los servicios
- **ORM**: Prisma gestiona las migraciones y queries
- **Orquestación**: Docker Compose para desarrollo, Terraform para producción

---

## 📁 Estructura del Proyecto

```
pivoo-backend/
├── services/                          # Microservicios
│   ├── auth-service/                 # 🔐 Autenticación y autorización
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── dto/
│   │   │   ├── common/
│   │   │   │   ├── guards/           # Guardias de autenticación
│   │   │   │   └── strategies/       # Estrategias de Passport
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── Dockerfile
│   │
│   ├── users-service/                # 👥 Gestión de usuarios
│   │   └── ...
│   │
│   ├── matches-service/              # ⚽ Gestión de partidos
│   │   ├── prisma/
│   │   │   └── migrations/           # Historial de migraciones
│   │   └── ...
│   │
│   ├── sports-service/               # 🏆 Gestión de deportes
│   │   └── ...
│   │
│   ├── complexes-service/            # 🏟️ Gestión de complejos
│   │   └── ...
│   │
│   └── teams-service/                # 👫 Gestión de equipos
│       └── ...
│
├── packages/                          # Paquetes compartidos
│   └── shared/                        # 📦 Tipos y utilidades comunes
│       ├── src/
│       │   ├── types/
│       │   │   ├── common.types.ts
│       │   │   ├── complex.types.ts
│       │   │   ├── match.types.ts
│       │   │   ├── sport.types.ts
│       │   │   └── user.types.ts
│       │   └── index.ts
│       └── tsconfig.json
│
├── infrastructure/                    # Infraestructura
│   └── terraform/
│       ├── environments/
│       │   ├── dev/                  # Configuración desarrollo
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   ├── outputs.tf
│       │   │   └── terraform.tfvars.example
│       │   └── prod/                 # Configuración producción
│       └── modules/
│           ├── alb/                  # Application Load Balancer
│           ├── ecr/                  # Elastic Container Registry
│           ├── ecs/                  # Elastic Container Service
│           ├── rds/                  # Relational Database Service
│           └── vpc/                  # Virtual Private Cloud
│
├── scripts/                           # Scripts de base de datos
│   ├── init-db.sql                   # Inicialización de BD
│   ├── migrate.sql                   # Migraciones manuales
│   └── seed.sql                      # Datos de prueba
│
├── docker-compose.yml                # Orquestación local
├── turbo.json                        # Configuración de Turbo monorepo
├── package.json                      # Dependencias del proyecto
├── tsconfig.json                     # Configuración TypeScript
└── README.md                         # Este archivo
```

---

## 🛠️ Tecnologías

### Core Framework
| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **NestJS** | ^10.0.0 | Framework principal para microservicios |
| **Node.js** | ^20 | Runtime de JavaScript |
| **TypeScript** | ^5.4.0 | Tipado estático |

### Base de Datos
| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **PostgreSQL** | 16-alpine | Base de datos relacional |
| **Prisma** | ^5.0.0 | ORM y migraciones |
| **Prisma Client** | ^5.0.0 | Query builder |

### Autenticación
| Tecnología | Propósito |
|-----------|----------|
| **JWT** | Tokens de autenticación stateless |
| **Passport.js** | Middleware de autenticación |
| **passport-jwt** | Estrategia JWT |
| **passport-local** | Estrategia local (usuario/contraseña) |
| **bcryptjs** | Hash de contraseñas |

### APIs y Documentación
| Tecnología | Propósito |
|-----------|----------|
| **NestJS Swagger** | Documentación automática de APIs |
| **Axios** | Cliente HTTP entre servicios |
| **@nestjs/axios** | Integración de Axios con NestJS |

### Validación
| Tecnología | Propósito |
|-----------|----------|
| **class-validator** | Validación de DTOs |
| **class-transformer** | Transformación de DTOs |

### Herramientas de DevOps
| Tecnología | Propósito |
|-----------|----------|
| **Docker** | Containerización |
| **Docker Compose** | Orquestación local |
| **Terraform** | Infrastructure as Code |
| **Turbo** | Build system para monorepo |
| **npm** | Package manager |

### Desarrollo
| Tecnología | Propósito |
|-----------|----------|
| **ESLint** | Linting |
| **Jest** | Testing |
| **NestJS CLI** | Scaffolding |

---

## 📦 Requisitos Previos

- **Node.js** >= 20.0.0
- **npm** >= 10.8.2
- **Docker** >= 24.0.0
- **Docker Compose** >= 2.0.0
- **Git**

### Verificar versiones

```bash
node --version     # v20.x.x
npm --version      # 10.8.2+
docker --version   # 24.x.x+
docker-compose --version  # 2.x.x+
```

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/pivoo/pivoo-backend.git
cd pivoo-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Cada servicio necesita un archivo `.env`. Copia los archivos `.env.example` (si existen) o crea los archivos `.env`:

```bash
# En la raíz
cp .env.example .env  # Si existe

# En cada servicio (opcional, usa docker-compose.yml como referencia)
```

### 4. Iniciar los servicios con Docker Compose

```bash
npm run docker:up
```

Esto iniciará:
- PostgreSQL en el puerto 5432
- Auth Service en el puerto 3001
- Users Service en el puerto 3002
- Matches Service en el puerto 3003
- Sports Service en el puerto 3004
- Complexes Service en el puerto 3005
- Teams Service en el puerto 3006

### 5. Verificar que los servicios están corriendo

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

---

## 📜 Scripts Disponibles

### Scripts Globales (Raíz del Proyecto)

```bash
# Construcción
npm run build                 # Construir todos los servicios

# Desarrollo
npm run dev                   # Iniciar todos los servicios en watch mode

# Calidad de código
npm run lint                  # Ejecutar ESLint
npm run test                  # Ejecutar tests

# Docker
npm run docker:up             # Iniciar contenedores (dev mode)
npm run docker:down           # Detener contenedores
```

### Scripts por Servicio

Cada servicio tiene scripts individuales:

```bash
# Dentro de services/<nombre-servicio>/

npm run build                 # Construir servicio
npm run dev                   # Desarrollo con watch mode
npm run start                 # Iniciar en producción
npm run lint                  # Linter
npm run test                  # Tests unitarios
npm run prisma:migrate        # Ejecutar migraciones Prisma
npm run prisma:generate       # Generar Prisma Client
```

---

## 🔧 Servicios

### 🔐 Auth Service (Puerto 3001)

**Responsabilidades:**
- Autenticación de usuarios (login/signup)
- Generación y validación de JWT
- Refresh tokens
- Estrategias de autenticación (local, JWT)

**Endpoints principales:**
- `POST /auth/login` - Login
- `POST /auth/signup` - Registro
- `POST /auth/refresh` - Renovar token
- `GET /auth/profile` - Perfil actual (requiere JWT)

**Variables de entorno:**
```
JWT_SECRET=local_jwt_secret_change_in_prod
JWT_REFRESH_SECRET=local_jwt_refresh_secret_change_in_prod
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
```

---

### 👥 Users Service (Puerto 3002)

**Responsabilidades:**
- Gestión de usuarios
- Perfiles de usuario
- Roles y permisos

**Endpoints principales:**
- `GET /users` - Listar usuarios
- `GET /users/:id` - Obtener usuario
- `POST /users` - Crear usuario
- `PATCH /users/:id` - Actualizar usuario
- `DELETE /users/:id` - Eliminar usuario

**Dependencias:**
- Auth Service (validación de JWT)

---

### ⚽ Matches Service (Puerto 3003)

**Responsabilidades:**
- Gestión de partidos
- Reservas de canchas
- Resultados de partidos
- Validaciones complejas de partidos

**Endpoints principales:**
- `GET /matches` - Listar partidos
- `GET /matches/:id` - Obtener partido
- `POST /matches` - Crear partido
- `PATCH /matches/:id` - Actualizar partido
- `POST /matches/:id/result` - Registrar resultado

**Dependencias:**
- Auth Service
- Users Service
- Sports Service
- Complexes Service

---

### 🏆 Sports Service (Puerto 3004)

**Responsabilidades:**
- Catálogo de deportes
- Categorías y reglas
- Información de deportes

**Endpoints principales:**
- `GET /sports` - Listar deportes
- `GET /sports/:id` - Obtener deporte
- `POST /sports` - Crear deporte
- `PATCH /sports/:id` - Actualizar deporte

**Dependencias:**
- Auth Service

---

### 🏟️ Complexes Service (Puerto 3005)

**Responsabilidades:**
- Gestión de complejos deportivos
- Información de canchas
- Disponibilidad de espacios

**Endpoints principales:**
- `GET /complexes` - Listar complejos
- `GET /complexes/:id` - Obtener complejo
- `POST /complexes` - Crear complejo
- `PATCH /complexes/:id` - Actualizar complejo
- `GET /complexes/:id/courts` - Canchas disponibles

**Dependencias:**
- Auth Service

---

### 👫 Teams Service (Puerto 3006)

**Responsabilidades:**
- Gestión de equipos
- Miembros de equipos
- Información de equipos

**Endpoints principales:**
- `GET /teams` - Listar equipos
- `GET /teams/:id` - Obtener equipo
- `POST /teams` - Crear equipo
- `PATCH /teams/:id` - Actualizar equipo
- `POST /teams/:id/members` - Agregar miembros

**Dependencias:**
- Auth Service
- Users Service

---

---

## 💻 Desarrollo

### Modo Watch (Hot Reload)

```bash
npm run dev
```

Todos los servicios se reiniciarán automáticamente al detectar cambios.

### Ejecutar un servicio específico

```bash
cd services/auth-service
npm run dev
```

### Migraciones de Base de Datos

```bash
# En el directorio del servicio
npm run prisma:migrate         # Crear y aplicar migración
npm run prisma:generate        # Regenerar Prisma Client

# Desde la raíz con Turbo
turbo run prisma:migrate
turbo run prisma:generate
```

### Acceder a Prisma Studio

```bash
# En el directorio del servicio
npx prisma studio
```

Abre una UI para navegar y editar datos de la BD.

### Testing

```bash
# Tests de todos los servicios
npm run test

# Tests de un servicio específico
cd services/auth-service
npm run test

# Tests con coverage
npm run test -- --coverage
```

### Linting

```bash
# Linting de todos los servicios
npm run lint

# Fix automático de problemas
npm run lint -- --fix
```

---

## 🏗️ Infraestructura

### Terraform (AWS)

La infraestructura está definida como código usando **Terraform**:

```
infrastructure/terraform/
├── environments/
│   ├── dev/              # Entorno de desarrollo
│   │   ├── main.tf       # Recursos principales
│   │   ├── variables.tf  # Variables de entrada
│   │   ├── outputs.tf    # Outputs
│   │   └── terraform.tfvars.example
│   └── prod/             # Entorno de producción
└── modules/
    ├── alb/              # Application Load Balancer
    ├── ecr/              # Elastic Container Registry
    ├── ecs/              # Elastic Container Service
    ├── rds/              # RDS Database
    └── vpc/              # Virtual Private Cloud
```

### Iniciar Terraform

```bash
cd infrastructure/terraform/environments/dev

# Inicializar Terraform
terraform init

# Ver plan de cambios
terraform plan

# Aplicar cambios
terraform apply

# Destruir recursos (⚠️ cuidado en producción)
terraform destroy
```

### Docker Compose (Desarrollo Local)

```yaml
# Servicios disponibles en docker-compose.yml:
- PostgreSQL 16
- Auth Service
- Users Service
- Matches Service
- Sports Service
- Complexes Service
- Teams Service
```

**Comandos:**

```bash
# Iniciar servicios
npm run docker:up

# Ver logs
docker-compose logs -f <service-name>

# Detener servicios
npm run docker:down

# Limpiar volúmenes (⚠️ borra datos)
docker-compose down -v
```

---

## 🤝 Contribuir

### Flujo de Contribución

1. **Fork** el repositorio
2. **Crea una rama** para tu feature: `git checkout -b feature/mi-feature`
3. **Commit** tus cambios: `git commit -am 'Agrega nueva feature'`
4. **Push** a la rama: `git push origin feature/mi-feature`
5. **Abre un Pull Request**

### Guía de Código

- Usa **TypeScript** con tipos explícitos
- Sigue la estructura de **NestJS** (controllers, services, modules)
- Escribe **tests** para nuevas features
- Ejecuta `npm run lint` antes de hacer commit
- Actualiza la documentación si es necesario

### Convenciones

- **Nombres de ramas**: `feature/descripcion` o `fix/descripcion`
- **Commits**: Descriptivos en inglés o español
- **DTOs**: Usa `class-validator` para validaciones
- **Modelos**: Define en `prisma/schema.prisma`

---

## 📝 Notas Importantes

### Base de Datos

- Cada servicio tiene su propio **schema** en PostgreSQL (database per service)
- Las migraciones se manejan con **Prisma Migrate**
- En desarrollo, usa `npm run prisma:migrate` después de cambios en `schema.prisma`

### Autenticación

- **JWT** es el mecanismo principal de autenticación
- **Auth Service** es el servicio central que válida tokens
- Todos los servicios validan contra Auth Service
- Tokens expiran en **15 minutos**, refresh tokens en **7 días**

### Comunicación Inter-Servicios

- Los servicios se comunican vía **HTTP REST**
- Usa las variables de entorno para URLs de servicios
- Implementa **retry logic** para llamadas entre servicios
- Valida siempre la respuesta antes de usar datos

### Monorepo con Turbo

- **Workspaces**: `services/*` y `packages/*`
- **Caché**: Turbo cachea resultados de build
- **Dependencias**: Especifica relaciones en `turbo.json`
- **Package manager**: Usa `npm` (no mezcles con yarn/pnpm)

---

## 📞 Soporte

Para reportar problemas o sugerencias:

- **Issues**: Abre un [issue en GitHub](https://github.com/pivoo/pivoo-backend/issues)
- **Email**: contact@pivoo.com
- **Documentación**: Consulta la [Wiki](https://github.com/pivoo/pivoo-backend/wiki)

---

## 📄 Licencia

Este proyecto está licenciado bajo la **MIT License** - Ver [LICENSE](LICENSE) para más detalles.

---

## 🙌 Agradecimientos

- **NestJS** - Framework increíble para Node.js
- **Prisma** - ORM moderno y type-safe
- **PostgreSQL** - Base de datos confiable
- **Docker** - Containerización
- **Terraform** - Infrastructure as Code

---

**Última actualización**: Abril 2026

**Versión**: 0.1.0

---

## 🎯 Roadmap

- [ ] Autenticación OAuth2/OIDC
- [ ] Caché con Redis
- [ ] Message queue (RabbitMQ/Kafka)
- [ ] GraphQL API
- [ ] Websockets para notificaciones en tiempo real
- [ ] Rate limiting mejorado
- [ ] Métricas y monitoreo (Prometheus/Grafana)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] E2E tests
- [ ] Documentación de API OpenAPI/Swagger completa
