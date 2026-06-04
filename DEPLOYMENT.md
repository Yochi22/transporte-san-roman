# Despliegue

La aplicacion se publica como dos contenedores:

- `frontend`: panel React servido por Nginx en el puerto `8080`.
- `backend`: API Node, Socket.IO y WhatsApp con sesion persistente.

## Preparacion

1. Copiar `backend/.env.example` como `backend/.env`.
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
