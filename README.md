# Castillos Frozen Foods · Sistema de Ventas

Sistema de punto de venta (POS) para Castillos Frozen Foods, con **backend real**
(Node.js + Express + SQLite), autenticación de usuarios, catálogo de productos,
folios de venta consecutivos, historial y generación/almacenamiento de
comprobantes en PDF. Listo para desplegarse en un VPS o dominio propio.

> El archivo `sistema-ventas.html` en la raíz es el prototipo original (todo en
> un solo HTML, sin backend). Este proyecto (`src/` + `public/`) es la versión
> completa que lo reemplaza para producción.

## Características

- **Autenticación real** con usuarios y contraseñas (JWT), roles `admin` y
  `vendedor`.
- **Base de datos SQLite** (archivo único, sin necesidad de instalar un motor
  de base de datos aparte) con productos, ventas, artículos de venta y
  usuarios.
- **Folios consecutivos** generados y controlados en el servidor (no se
  pueden duplicar ni manipular desde el navegador).
- **Precios validados en el servidor**: el importe de cada venta se calcula
  con el precio actual del catálogo guardado en la base de datos, nunca con
  lo que envíe el navegador.
- **Comprobantes en PDF**: se generan en el navegador (igual que el
  prototipo original, con el mismo diseño) y se suben al servidor para
  quedar disponibles desde cualquier dispositivo en la pestaña "PDFs
  descargados".
- **Panel de usuarios** (solo administradores) para dar de alta cajeros.
- Frontend estático servido por el mismo backend (no requiere un servidor
  web aparte para archivos).

## Estructura del proyecto

```
├── src/                  Backend (Express)
│   ├── server.js         Punto de entrada
│   ├── db.js             Conexión y esquema de SQLite + datos semilla
│   ├── middleware/auth.js
│   └── routes/           auth, users, products, sales, receipts
├── public/                Frontend estático
│   ├── index.html         App principal (POS, historial, PDFs, catálogo, usuarios)
│   ├── login.html
│   ├── css/styles.css
│   └── js/ (api.js, app.js, login.js)
├── data/                  Base de datos SQLite (se crea sola, no se versiona)
├── uploads/receipts/      PDFs de comprobantes guardados (no se versiona)
├── Dockerfile / docker-compose.yml
├── ecosystem.config.js    Configuración de PM2 (alternativa a Docker)
└── nginx/castillos-pos.conf.example
```

## Requisitos

- Node.js 18 o superior (si no usas Docker)
- npm

## 1. Configuración

```bash
cp .env.example .env
```

Edita `.env` y como mínimo cambia:

- `JWT_SECRET`: clave larga y aleatoria. Genera una con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME`: el usuario
  administrador que se crea automáticamente la **primera vez** que arranca
  el servidor (solo si no hay ningún usuario todavía). Puedes crear más
  usuarios luego desde la pestaña "Usuarios" dentro de la app.
- `CORS_ORIGIN`: en producción, el dominio donde vivirá el sistema (por
  ejemplo `https://ventas.tudominio.com`). Déjalo en `*` solo para pruebas
  locales.

## 2. Ejecutar localmente (sin Docker)

```bash
npm install
npm start
```

Abre `http://localhost:3000`. Verás la pantalla de inicio de sesión; entra
con el usuario/contraseña que definiste en `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

Para desarrollo con recarga automática:

```bash
npm run dev
```

## 3. Ejecutar con Docker (recomendado para servidor propio)

```bash
docker compose up -d --build
```

Esto compila la imagen, crea el contenedor y monta `./data` y `./uploads`
como volúmenes (así la base de datos y los PDFs sobreviven a reinicios o
actualizaciones del contenedor). La app queda escuchando en el puerto 3000
del host.

Para ver logs:

```bash
docker compose logs -f
```

Para actualizar tras hacer `git pull` de una nueva versión:

```bash
docker compose up -d --build
```

## 4. Desplegar en tu propio dominio (VPS + Nginx + HTTPS)

Este flujo aplica tanto si corres la app con Docker como con PM2 (paso 3 o
alternativa manual `npm start` detrás de PM2/systemd) — Nginx solo hace de
proxy inverso hacia el puerto 3000.

1. Sube el proyecto a tu servidor (por ejemplo con `git clone` de tu propio
   repositorio) y sigue el paso 1 y 2 o 3 anteriores para dejarlo corriendo
   en `127.0.0.1:3000`.
2. Instala Nginx y Certbot:
   ```bash
   sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
   ```
3. Copia la configuración de ejemplo:
   ```bash
   sudo cp nginx/castillos-pos.conf.example /etc/nginx/sites-available/castillos-pos
   sudo nano /etc/nginx/sites-available/castillos-pos   # cambia server_name por tu dominio
   sudo ln -s /etc/nginx/sites-available/castillos-pos /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Apunta el registro DNS tipo `A` de tu dominio (o subdominio, ej.
   `ventas.tudominio.com`) a la IP pública de tu servidor.
5. Activa HTTPS automáticamente:
   ```bash
   sudo certbot --nginx -d ventas.tudominio.com
   ```
6. Actualiza `CORS_ORIGIN` en tu `.env` al dominio final con `https://` y
   reinicia el proceso (`docker compose restart` o `pm2 restart
   castillos-pos`).

### Alternativa sin Docker: PM2

```bash
npm install -g pm2
npm install --omit=dev
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # sigue las instrucciones para que arranque con el servidor
```

## Respaldo de datos

Todo lo importante vive en dos carpetas que **no** se borran al actualizar
el código y que conviene respaldar periódicamente:

- `data/castillos.sqlite` — productos, ventas, usuarios.
- `uploads/receipts/` — PDFs de comprobantes ya generados.

Un respaldo simple:

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz data uploads
```

## Resumen de la API

Todas las rutas (excepto `/api/auth/login`) requieren el header
`Authorization: Bearer <token>` obtenido al iniciar sesión.

| Método | Ruta                     | Descripción                                   | Rol requerido |
|--------|--------------------------|------------------------------------------------|---------------|
| POST   | `/api/auth/login`        | Inicia sesión, devuelve token JWT              | —             |
| GET    | `/api/auth/me`           | Datos del usuario autenticado                  | cualquiera    |
| POST   | `/api/auth/change-password` | Cambia la contraseña propia                | cualquiera    |
| GET    | `/api/users`             | Lista usuarios                                 | admin         |
| POST   | `/api/users`             | Crea un usuario                                | admin         |
| DELETE | `/api/users/:id`         | Elimina un usuario                             | admin         |
| GET    | `/api/products`          | Lista el catálogo                              | cualquiera    |
| POST   | `/api/products`          | Crea un producto                               | admin         |
| PUT    | `/api/products/:id`      | Edita un producto                              | admin         |
| DELETE | `/api/products/:id`      | Elimina un producto                            | admin         |
| GET    | `/api/sales`             | Lista ventas (`?search=`)                      | cualquiera    |
| GET    | `/api/sales/next-folio`  | Folio que se asignará a la próxima venta       | cualquiera    |
| GET    | `/api/sales/:id`         | Detalle de una venta                           | cualquiera    |
| POST   | `/api/sales`              | Registra una venta (genera folio y total)    | cualquiera    |
| GET    | `/api/receipts`          | Ventas con PDF ya generado (`?search=`)        | cualquiera    |
| POST   | `/api/receipts/:id/pdf`  | Sube el PDF generado en el navegador           | cualquiera    |
| GET    | `/api/receipts/:id/pdf`  | Descarga el PDF guardado de una venta          | cualquiera    |
| GET    | `/api/health`            | Chequeo de salud                               | —             |

## Notas de seguridad

- Cambia `JWT_SECRET` y la contraseña del administrador antes de exponer el
  sistema a internet.
- Sirve el sistema siempre detrás de HTTPS (paso 4).
- Los backups de `data/` y `uploads/` contienen información de clientes y
  ventas: trátalos con el mismo cuidado que cualquier otro dato del negocio.
