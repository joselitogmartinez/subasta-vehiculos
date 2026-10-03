# SubastaYA · Plataforma de subastas de vehículos en tiempo real

Examen de WebDev 2026 · Caso Copart

## 🌐 Sitio publicado

**https://subasta-vehiculos.vercel.app**

> Enlace al repositorio: https://github.com/joselitogmartinez/subasta-vehiculos

Desplegado en Vercel. El frontend se recompila y se publica solo en cada `push` a `main`.

## 🔑 Usuarios de prueba

El enunciado pide 3 usuarios precreados para poder hacer pruebas cruzadas de subasta en
tiempo real desde varios navegadores. Los tres tienen la misma contraseña:

| Correo | Contraseña | Nombre |
|---|---|---|
| `maria@subasta.com` | `Subasta2026!` | María González |
| `carlos@subasta.com` | `Subasta2026!` | Carlos Rodríguez |
| `ana@subasta.com` | `Subasta2026!` | Ana Martínez |

**Para probar el tiempo real:** abre el mismo vehículo en dos ventanas de incógnito
distintas, inicia sesión con un usuario en cada una y puja desde una. La otra actualiza
la oferta y el indicador de estado sin recargar.

**Datos de ejemplo:** el seed crea 10 vehículos con los cuatro estados posibles
(`activa`, `programada`, `desierta`, `vendida`) y un borrador listo para publicar desde
*Mis publicaciones*. Los cuatro trenes de manejo del enunciado (AWD, FWD, RWD, 4WD)
tienen al menos un vehículo, para que ningún filtro del catálogo quede sin resultados.

---

## Qué es

Plataforma web de subastas de vehículos usados, estilo Copart. Un usuario registrado
publica su vehículo con fotos y un monto base, y otros usuarios ofertan en tiempo real
sobre esa subasta.

- **Frontend:** Single Page Application en React 19 + Vite
- **Backend:** Supabase (Web API REST + PostgreSQL + Auth + Storage + Realtime)
- **Tiempo real:** WebSockets de Supabase Realtime, sin recargar la página

## Requisitos cubiertos

| Requisito del enunciado | Dónde vive |
|---|---|
| Login obligatorio para pujar o publicar | RPC `fn_registrar_puja`, RLS |
| Registro con nombre, apellido, correo, teléfono, contraseña | `src/pages/Registro.jsx` |
| Ficha técnica completa + nivel de daño 🟢🟡🔴 | `supabase/migrations/` |
| Mínimo 5 fotografías por vehículo | RPC `fn_activar_vehiculo` |
| Editar y buscar las publicaciones propias | `/mis-publicaciones` · `/editar/:id` |
| Filtros multitarea por ficha técnica | `/` · `src/lib/catalogos.js` |
| Puja ≥ monto base y ≥ oferta actual + 10% | RPC `fn_registrar_puja` |
| Postores anónimos (solo se ve el monto) | `pujas` sin política de lectura |
| Cierre de subasta / subasta desierta | `vw_inventario.estado_calculado` |
| Oferta e indicadores en vivo sin F5 | `src/lib/realtime.js` |
| Badges «Vas ganando» / «Oferta superada» | `src/lib/subasta.js` · `src/components/PanelPuja.jsx` |
| Vista de detalle y carrusel de 5+ fotos | `/vehiculo/:id` · `src/components/Carrusel.jsx` |

## Configuración del despliegue

En Vercel, **Settings → Environment Variables**, para **Production**:

| Variable | ¿Se expone al navegador? |
|---|---|
| `VITE_SUPABASE_URL` | Sí, es pública |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sí, es pública por diseño |

⚠️ **La secret key y la `DATABASE_URL` nunca van en Vercel.** Si se agregan, quedan
escritas en el bundle que descarga el visitante. Vite sustituye las variables en
tiempo de compilación: si faltan, **el build no falla** y el sitio se publica en
blanco. Si la página aparece vacía, revisá esto primero.

## Configuración requerida en Supabase

En *Dashboard → Authentication → Providers → Email*, los tres interruptores deben quedar así:

| Interruptor | Estado |
|---|---|
| Enable Email Signup | **ON** |
| Enable Email Logins | **ON** |
| Confirm email | OFF |

Con el tercero desactivado, un usuario que se registra desde el sitio puede ofertar de
inmediato, sin tener que confirmar la dirección por correo. Los tres usuarios de prueba
ya vienen con el correo confirmado.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local   # completar con tus credenciales de Supabase
npm run db:migrate           # crea el esquema, RLS, RPCs y vistas
npm run db:seed              # usuarios de prueba y vehículos de ejemplo
npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run lint` | Linter (oxlint) |
| `npm run db:migrate` | Aplica `supabase/migrations/*.sql` en orden |
| `npm run db:seed` | Crea usuarios y datos de demostración |
| `npm run db:smoke` | Comprueba conectividad con Supabase |
Las verificaciones golpean la base de datos real, no mocks. Total: **119 comprobaciones**.

| Comando | Comprobaciones | Qué valida |
|---|---|---|
| `npm run db:verify` | 13 | Esquema, RLS, permisos y ausencia de fugas |
| `npm run db:verify-registro` | 9 | Registro, trigger de perfil, login y aislamiento |
| `npm run db:verify-filtros` | 30 | Filtros multitarea del catálogo contra la base real |
| `npm run db:verify-pujas` | 23 | Reglas de puja: base, +10%, tiempos, subasta propia |
| `npm run db:verify-tiempo-real` | 24 | Flujo entre dos navegadores y badges en vivo |
| `npm run db:verify-publicacion` | 20 | Publicar, editar, eliminar y el mínimo de 5 fotos |
| `npm run db:verify-imagenes` | — | Que las galerías tengan 5+ imágenes accesibles |
| `npm run db:verify-todo` | **119** | Corre todas en secuencia |

## Estructura

```
src/
  lib/         cliente de Supabase, realtime, formato de moneda
  components/  componentes de UI reutilizables
  pages/       rutas de la SPA
supabase/
  migrations/  esquema, RLS, funciones y vistas (fuente de verdad)
scripts/       migrate.mjs, seed.mjs y los scripts de verificación
```

## Créditos de las imágenes

Las fotografías de los vehículos de demostración provienen de
[Wikimedia Commons](https://commons.wikimedia.org) y se descargan al bucket del proyecto
durante el seed (`CC BY-SA 4.0`, `CC BY 2.0`, `CC BY 3.0`, `CC BY 4.0`, `CC0` y dominio
público). El seed imprime el desglose de licencias de cada imagen.

## Seguridad

- Las claves viven solo en `.env.local`, que está en `.gitignore`. Solo las variables
  con prefijo `VITE_` llegan al bundle del navegador; la secret key y la connection
  string se quedan en el servidor.
- Toda la lógica de subasta vive en funciones `SECURITY DEFINER` de PostgreSQL.
  El cliente no puede saltarse reglas ni escribir directamente en las tablas.
- La tabla `pujas` no tiene ninguna política de lectura: la identidad de los
  postores no sale del servidor bajo ninguna circunstancia. El navegador
  deduce si va ganando comparando el monto recibido contra su propia oferta.
- La vista `vw_vehiculos` no expone `user_id`: devuelve `es_mio`, que el
  servidor calcula. No hay razón para enviar identificadores de usuario al
  cliente.

## Asignatura

- **Asignatura:** TAREA-PROGRAMACIÓN AVANZADA
- **Integrante:** Augusto Girón