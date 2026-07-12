# VPS Traccar San Roman

## Datos actuales

```text
VPS: 104.251.219.40
Sistema: Ubuntu 24.04
Traccar web: http://104.251.219.40:8082
GPS103/Coban probado: 5001 / 5002
```

## Actualizar configuracion de Traccar en el VPS

Entrar por SSH:

```bash
ssh root@104.251.219.40
```

Aplicar configuracion:

```bash
cd /opt/sanroman

cat > docker-compose.yml <<'EOF'
services:
  traccar:
    image: traccar/traccar:latest
    container_name: sanroman-traccar
    restart: unless-stopped
    ports:
      - "8082:8082"
      - "5001:5001/tcp"
      - "5002:5002/tcp"
    volumes:
      - ./traccar/conf/traccar.xml:/opt/traccar/conf/traccar.xml:ro
      - ./traccar/logs:/opt/traccar/logs
      - ./traccar/data:/opt/traccar/data
EOF

cat > traccar/conf/traccar.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
    <entry key="config.default">./conf/default.xml</entry>
    <entry key="web.port">8082</entry>

    <entry key="database.driver">org.h2.Driver</entry>
    <entry key="database.url">jdbc:h2:./data/database</entry>
    <entry key="database.user">sa</entry>
    <entry key="database.password"></entry>

    <entry key="gps103.port">5001</entry>
    <entry key="coban.port">5002</entry>

    <entry key="forward.enable">true</entry>
    <entry key="forward.type">json</entry>
    <entry key="forward.url">https://transporte-san-roman-1.onrender.com/api/gps/positions?token=TU_GPS_WEBHOOK_TOKEN</entry>
    <entry key="forward.link">tracker.baanooliot.com:8090</entry>
</properties>
EOF

ufw allow 5001/tcp
ufw allow 5002/tcp
ufw allow 8082/tcp

docker compose up -d
docker compose logs -f --tail=120
```

Reemplazar `TU_GPS_WEBHOOK_TOKEN` por el valor real configurado en Render.

## SMS para el GPS actual

Si funciono con puerto `5002`, dejar:

```text
dns123456 104.251.219.40 5002
gprs123456
fix030s060m***n123456
check123456
```

Si funciono con puerto `5001`, dejar:

```text
dns123456 104.251.219.40 5001
gprs123456
fix030s060m***n123456
check123456
```

## Variables en Render mientras la app siga alli

```env
TRACCAR_SYNC_ENABLED=true
TRACCAR_BASE_URL=http://104.251.219.40:8082
TRACCAR_EMAIL=correo_del_traccar_del_vps
TRACCAR_PASSWORD=clave_del_traccar_del_vps
TRACCAR_SYNC_INTERVAL_SECONDS=30
```

Luego ejecutar `Manual Deploy -> Clear build cache & deploy`.

## Validacion

En el VPS:

```bash
cd /opt/sanroman
docker compose ps
docker compose logs --tail=120
```

En Render se debe ver:

```text
Traccar sync activado: http://104.251.219.40:8082 cada 30s
Traccar sync: 1 dispositivos, 1 posiciones, 1 guardadas, 0 ignoradas
```

En la app, el camion debe tener el mismo IMEI en `gps_imei`.

## Volver a Baanool directo

Si se quiere detener la prueba y regresar el GPS a Baanool sin pasar por Traccar:

```text
dns123456 tracker.baanooliot.com 8090
```
