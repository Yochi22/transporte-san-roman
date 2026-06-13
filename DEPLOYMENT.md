# Despliegue

La opcion principal usa el `Dockerfile` de la raiz para servir API, panel, Socket.IO y WhatsApp en un solo dominio HTTPS.

## Variables requeridas

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=una-cadena-aleatoria-de-64-caracteres-o-mas
FRONTEND_URL=https://tu-dominio.example
GEMINI_API_KEY=...
ADMIN_EMAIL=admin@sanroman.com
ADMIN_PASSWORD=una-clave-inicial-de-12-caracteres-o-mas
WHATSAPP_AUTH_PATH=/app/backend/.whatsapp-auth
DEMO_PUBLIC_WHATSAPP_QR=false
```

`FRONTEND_URL` debe coincidir exactamente con el dominio del panel, sin barra final. `ADMIN_PASSWORD` puede retirarse del proveedor despues de crear el administrador. Para cambiar esa clave, definir temporalmente `ADMIN_RESET_PASSWORD=true`, desplegar una vez y eliminar ambas variables de reinicio.

## WhatsApp

La ruta `/whatsapp-qr` requiere una sesion de administrador. Durante una demo se puede definir `DEMO_PUBLIC_WHATSAPP_QR=true`; debe volver a `false` antes de operar con datos reales. No se imprime el QR ni la informacion de mensajes en los logs.

El directorio configurado en `WHATSAPP_AUTH_PATH` debe montarse como volumen persistente y no debe publicarse ni copiarse fuera del proveedor.

## Base de datos

Aplicar las migraciones con:

```bash
npx prisma migrate deploy
```

La migracion RLS bloquea el acceso de los roles `anon` y `authenticated` de Supabase. El panel nunca debe contener `DATABASE_URL`, `DIRECT_URL`, claves `service_role`, `JWT_SECRET` ni `GEMINI_API_KEY`.

## Docker Compose

```bash
docker compose up -d --build
```

El acceso en produccion debe estar detras de HTTPS. El volumen `whatsapp_auth` conserva la sesion de WhatsApp entre despliegues.
