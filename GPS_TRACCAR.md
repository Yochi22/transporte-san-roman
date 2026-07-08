# Rastreo GPS con Traccar

## Flujo demo local

1. Instala y abre Docker Desktop.
2. Levanta Traccar y nginx:

```bash
docker compose -f docker-compose.traccar.yml up -d
```

3. Abre el panel local de Traccar:

```text
http://localhost:8088
```

4. Abre un tunel TCP de ngrok hacia el puerto Coban local de Traccar:

```bash
ngrok tcp 5002
```

Ngrok mostrara algo como:

```text
tcp://0.tcp.ngrok.io:19384
```

Ese host y puerto son los que se envian por SMS al GPS.

5. Reconfigura el GPS Baanool/Coban 403C por SMS para apuntar al host y puerto TCP que entregue ngrok.
6. El reenvio `forward.link` ya queda configurado en `traccar/conf/traccar.xml` hacia `tracker.baanooliot.com:8090`.
7. Configura el webhook HTTP de Traccar hacia el backend:

```text
https://TU_BACKEND/api/gps/positions?token=TU_GPS_WEBHOOK_TOKEN
```

En desarrollo local puedes dejar `GPS_WEBHOOK_TOKEN` vacio, pero en demo publica y produccion debe ser un token largo.

## SMS del GPS

Los Baanool/Coban 403C suelen usar la clave por defecto `123456`. Si la empresa la cambio, reemplazala en todos los comandos.

Comandos comunes para Coban/TK:

```text
begin123456
gprs123456
apn123456 internet
adminip123456 0.tcp.ngrok.io 19384
fix030s***n123456
check123456
```

Variantes usadas por algunos Baanool:

```text
APN,internet#
SERVER,1,0.tcp.ngrok.io,19384,0#
TIMER,30#
STATUS#
```

Reemplaza `internet` por el APN real de la SIM del GPS. Reemplaza `0.tcp.ngrok.io` y `19384` por los datos exactos que entregue ngrok.

Cuando el GPS responda `check` o `STATUS`, debe mostrar GPRS activo y el servidor nuevo. Luego espera una posicion o mueve la unidad a cielo abierto.

## Variables

Backend:

```env
GPS_WEBHOOK_TOKEN=un_token_largo_privado
TRACCAR_SYNC_ENABLED=true
TRACCAR_BASE_URL=https://demo4.traccar.org
TRACCAR_EMAIL=tu_correo_de_traccar
TRACCAR_PASSWORD=tu_clave_de_traccar
TRACCAR_SYNC_INTERVAL_SECONDS=30
```

Frontend:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

En Render agrega estas variables al servicio:

```env
GPS_WEBHOOK_TOKEN=un_token_largo_privado
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

`GPS_WEBHOOK_TOKEN` lo usa el backend en runtime. Las variables `VITE_` se usan durante el build del panel, asi que despues de agregarlas debes hacer `Manual Deploy` en Render.

## Traccar Demo sin VPS

Si el GPS ya aparece en `demo4.traccar.org`, puedes usar ese servidor para la demo sin Docker, ngrok ni VPS:

1. En Traccar Demo crea el dispositivo con el IMEI real.
2. En el panel de Transporte San Roman registra el mismo IMEI en el camion.
3. En Render agrega:

```env
TRACCAR_SYNC_ENABLED=true
TRACCAR_BASE_URL=https://demo4.traccar.org
TRACCAR_EMAIL=tu_correo_de_traccar
TRACCAR_PASSWORD=tu_clave_de_traccar
TRACCAR_SYNC_INTERVAL_SECONDS=30
```

El backend consultara `/api/devices` y `/api/positions` de Traccar cada 30 segundos y actualizara `truck_positions` en Supabase. El mapa del panel se actualiza por Supabase Realtime.

Limitacion: el demo server de Traccar no garantiza disponibilidad ni historial. Sirve para demostraciones, no para operacion estable.

## Base de datos

La migracion agrega:

- `camiones.gps_imei`: IMEI unico del tracker fisico.
- `truck_positions`: ultima posicion conocida por camion.
- Publicacion de `truck_positions` en Supabase Realtime.

Para que el mapa en vivo funcione, Supabase Realtime debe tener activa la tabla `truck_positions`.

En Supabase verifica:

1. Database > Publications > `supabase_realtime`.
2. La tabla `truck_positions` debe estar incluida.
3. Authentication/Policies: en demo la tabla tiene lectura para `anon`; en produccion conviene reemplazarlo por lectura autenticada o por canal del backend.

Si aplicaste la migracion manual, no borres los archivos de `backend/prisma/migrations`. Prisma necesita ese historial en Git para que Render y cualquier entorno futuro sepan que estructura corresponde al codigo.

## Forward a Baanool oficial

El archivo local donde se configura es:

```text
traccar/conf/traccar.xml
```

La entrada actual es:

```xml
<entry key="forward.link">tracker.baanooliot.com:8090</entry>
```

Despues de cambiar ese archivo, reinicia Traccar:

```bash
docker compose -f docker-compose.traccar.yml restart traccar
```

Si Traccar no reenvia con `forward.link` en tu version exacta, revisa el log:

```bash
docker compose -f docker-compose.traccar.yml logs -f traccar
```

Algunas versiones usan propiedades de forward diferentes. En ese caso se ajusta esta misma entrada sin tocar el backend.

## Ngrok y reinicios

Si usas ngrok gratis, el host/puerto TCP cambia cada vez que cierras y vuelves a abrir el tunel. Cuando eso pase:

- No cambies variables en Render.
- No cambies Supabase.
- Si el GPS apunta a ngrok, si debes reenviar el SMS `adminip...` o `SERVER...` con el nuevo host/puerto.
- Si solo reinicias Traccar pero ngrok sigue abierto con el mismo host/puerto, no debes cambiar nada.

Con ngrok pago/reserved TCP o con un VPS/IP fija, no tendras que reenviar SMS cada vez.

## Payload esperado

El backend acepta formatos comunes de Traccar, por ejemplo:

```json
{
  "device": { "uniqueId": "123456789012345" },
  "position": {
    "latitude": 10.0678,
    "longitude": -69.3474,
    "speed": 24.5,
    "attributes": { "ignition": true }
  }
}
```

Tambien reconoce `imei`, `uniqueid`, `lat`, `lon`, `lng`, `acc`, `ACC`, `engine`, `engineStatus` y `motion`.

## Produccion

En produccion se elimina ngrok. Traccar y Node.js deben vivir en un VPS con IP fija:

- El GPS apunta directo al puerto TCP publico de Traccar.
- Traccar mantiene `forward.link` si todavia se necesita la plataforma oficial.
- Traccar envia el webhook al dominio del backend.
- El backend escribe en Supabase/PostgreSQL.
- El frontend escucha Supabase Realtime y mueve el marcador sin recargar.

Nota de seguridad: en este MVP el mapa usa la `anon key` de Supabase para leer `truck_positions`. Para produccion, si las ubicaciones se consideran altamente sensibles, conviene cerrar esa lectura anonima y mover el tiempo real a usuarios autenticados o a un canal controlado por el backend.
