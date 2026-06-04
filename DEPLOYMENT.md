# Despliegue

La aplicacion se publica como dos contenedores:

- `frontend`: panel React servido por Nginx en el puerto `8080`.
- `backend`: API Node, Socket.IO y WhatsApp con sesion persistente.

## Preparacion

1. Crear `backend/.env` con las variables de produccion.
2. Completar las variables de base de datos, JWT, Gemini y administrador.
3. Definir `FRONTEND_URL` con el dominio publico del panel.
4. Instalar Docker Engine y Docker Compose en el servidor.

La variable `ADMIN_PASSWORD` solo crea el administrador si no existe. Para
cambiar su clave intencionalmente, usar temporalmente
`ADMIN_RESET_PASSWORD=true`, iniciar una vez y devolverla a `false`.

## Inicio

```bash
docker compose up -d --build
```

El panel queda disponible en `http://SERVIDOR:8080`. En el primer inicio,
consultar los logs para escanear el QR de WhatsApp:

```bash
docker compose logs -f backend
```

## Actualizacion

```bash
docker compose up -d --build
```

El volumen `whatsapp_auth` conserva la sesion de WhatsApp entre despliegues.

## Railway

Railway despliega la aplicacion completa como un solo servicio usando el
`Dockerfile` de la raiz.

1. Conectar el repositorio de GitHub en Railway.
2. Crear un servicio desde ese repositorio sin configurar Root Directory.
3. Agregar las variables requeridas por el backend.
4. Generar un dominio publico desde `Settings > Networking`.
5. Crear un volumen y montarlo en `/app/backend/.whatsapp-auth`.

En Railway, definir:

```env
NODE_ENV=production
WHATSAPP_AUTH_PATH=/app/backend/.whatsapp-auth
FRONTEND_URL=https://DOMINIO_GENERADO.railway.app
```

No es necesario definir `PORT`: Railway lo proporciona automaticamente.
