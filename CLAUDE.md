# CLAUDE.md - Transporte San Roman

Guia operativa principal para Claude Code. Describe el sistema vigente, sus reglas, integraciones, riesgos y despliegue. Trabaja siempre en espanol y trata este repositorio como un sistema real para una empresa venezolana de transporte, no como una demo visual.

## 1. Mandato de trabajo

Antes de modificar codigo:

1. Ejecuta `git status --short` y preserva cambios que no hayas creado.
2. Lee los archivos relacionados con la tarea.
3. Confirma el comportamiento en codigo; no asumas que los documentos historicos siguen vigentes.
4. Evalua efectos sobre permisos, estados logisticos, finanzas, WhatsApp, GPS y migraciones.
5. Haz cambios pequenos, compatibles con los patrones existentes y verificables.
6. No borres datos, credenciales, volumenes ni historial sin autorizacion explicita.
7. Al terminar, ejecuta verificaciones proporcionales al riesgo y explica el despliegue.

Reglas no negociables:

- Nunca guardes secretos, sesiones de WhatsApp, llaves privadas ni `.env` en Git.
- Nunca expongas `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GPS_WEBHOOK_TOKEN`, credenciales de Traccar o claves de proveedores en frontend.
- No edites migraciones ya aplicadas. Crea una nueva.
- No cambies contratos frontend/backend sin actualizar ambos lados.
- No uses eliminaciones destructivas como solucion por defecto.
- Conserva una interfaz sobria, densa y orientada a operaciones.
- Corrige mojibake (`Ã`, `Â`) cuando toques una zona afectada, sin reescrituras masivas.

## 2. Fuentes de verdad

En caso de contradiccion, usa este orden:

1. Codigo ejecutable y `backend/prisma/schema.prisma`.
2. Migraciones de `backend/prisma/migrations/`.
3. Compose, Dockerfiles y configuraciones montadas.
4. Este `CLAUDE.md`.
5. `DEPLOYMENT.md`, `GPS_TRACCAR.md`, `VPS_TRACCAR_SETUP.md`, `SEGURIDAD_PRODUCCION.md` y `PROMPT_PROYECTO_SAN_ROMAN.md`.

Los documentos del punto 5 contienen contexto valioso, pero tambien referencias historicas a Render, una IP anterior, Supabase Realtime y comandos que no siempre coinciden con la arquitectura actual. Nunca copies IP, dominio, token, correo, puerto espejo o contrasena sin verificar el entorno vigente.

## 3. Producto

Transporte San Roman centraliza:

- Choferes, unidades y asignaciones.
- Empresas clientes y sus sedes o puntos de carga.
- Viajes con una o varias unidades y paradas ordenadas.
- Seguimiento por estados y reportes de WhatsApp.
- Viajes completados logisticamente y pendientes de liquidacion.
- Gastos, viaticos, tasa BCV, documentacion y liquidaciones.
- Retornables y sus movimientos.
- Taller e historial de mantenimiento.
- Ultima posicion GPS por unidad mediante Traccar.
- Usuarios `ADMIN` y `OPERACIONES`.

Es un MVP operativo avanzado. Prioriza integridad de estados, trazabilidad, disponibilidad, seguridad y claridad para operadores.

## 4. Arquitectura vigente

### Backend

- Node.js 20, CommonJS, Express 4.
- Prisma 5.22 con PostgreSQL/Supabase.
- Socket.IO para avisos operativos.
- JWT HS256 en cookie HttpOnly.
- Baileys para WhatsApp Web.
- Gemini para interpretar texto y transcribir audio.
- Traccar por webhook HTTP y, opcionalmente, polling API.

Entrada: `backend/src/server.js`. Al arrancar valida el entorno, crea HTTP/Socket.IO, autentica sockets, prepara el admin inicial, depura datos antiguos, inicia Traccar y luego WhatsApp.

### Frontend

- React 19, Vite 8 y Tailwind CSS.
- Lucide, SweetAlert2, Leaflet y jsPDF.
- Aplicacion principal en `frontend/src/App.jsx`.
- Axios en `frontend/src/lib/api.js`.

Usa `/api` y el mismo origen para Socket.IO. No usa actualmente el SDK de Supabase ni Supabase Realtime. Refresca por carga API, eventos Socket.IO y polling del panel cada 30 segundos.

### Base de datos

- PostgreSQL, normalmente en Supabase.
- Prisma es el acceso de aplicacion.
- RLS y revocacion de grants protegen las tablas frente a `anon`, `authenticated` y `PUBLIC`.
- El navegador no accede directamente a las tablas.

### Docker

- `docker-compose.yml`: modo vigente, backend y frontend separados. Nginx publica `8080` y hace proxy al backend.
- `Dockerfile` raiz: imagen unificada alternativa; el Compose actual no la usa.
- `docker-compose.traccar.yml`: Traccar, dos proxies TCP tee y Nginx de Traccar.

No mezcles procedimientos del modo unificado con el Compose separado sin adaptar rutas, volumenes y puertos.

## 5. Mapa del repositorio

```text
/
|-- CLAUDE.md                       Esta guia
|-- docker-compose.yml              Aplicacion
|-- docker-compose.traccar.yml      Traccar y proxies GPS
|-- Dockerfile                      Imagen unificada alternativa
|-- DEPLOYMENT.md                   Notas historicas
|-- GPS_TRACCAR.md                  Contexto GPS
|-- VPS_TRACCAR_SETUP.md            Procedimientos historicos VPS
|-- SEGURIDAD_PRODUCCION.md         Evaluacion de seguridad
|-- PROMPT_PROYECTO_SAN_ROMAN.md    Contexto funcional
|-- backend/
|   |-- prisma/schema.prisma        Modelo canonico
|   |-- prisma/migrations/          Historial inmutable
|   |-- scripts/                    Chequeos y tareas controladas
|   `-- src/
|       |-- app.js                  HTTP, seguridad y rutas
|       |-- server.js               Arranque y Socket.IO
|       |-- config/                 Entorno, JWT, cookie y Prisma
|       |-- middlewares/            Auth, CSRF, rate limit y GPS
|       |-- modules/empresas/       Empresas, sedes y estadisticas
|       |-- modules/viajes/         Agendamiento, operacion y liquidacion
|       |-- modules/                Demas dominios
|       `-- services/messaging/     WhatsApp y Gemini
|-- frontend/
|   |-- nginx.conf                  SPA y reverse proxy
|   `-- src/App.jsx                 Panel
`-- traccar/
    |-- conf/traccar.xml            Protocolos, H2 y webhook
    |-- nginx/default.conf          Proxy web
    `-- tcp-tee-proxy.js            Duplicacion TCP
```

## 6. Datos y relaciones

- `Usuario`: rol, activo y `sessionVersion` para invalidar sesiones.
- `Chofer`: telefono, JID WhatsApp, estado, ubicacion y unidades.
- `Camion`: placa, tipo, IMEI unico, estado, taller y posicion.
- `ChoferUnidad`: asignacion vigente; `camionId` unico impide doble chofer.
- `Empresa`: cliente al que se presta el viaje; el nombre es unico.
- `EmpresaSede`: sede o punto de carga de una empresa, con nombre, ciudad y direccion opcional.
- `Viaje`: cabecera logistica y financiera; `empresaId` identifica al cliente.
- `ViajeUnidad`: una o varias unidades por viaje.
- `Parada`: secuencia por `orden`, agrupada por `tramo`; una parada `CARGA` puede referenciar `empresaSedeId`.
- `ReporteChofer`: viaje/chofer obligatorios, parada opcional.
- `Gasto`: monto VES, moneda/monto originales, tasa y fuente.
- `TruckPosition`: una fila por camion; no es historial.
- `MantenimientoVehiculo`: entradas de taller.
- `Retornable` y `RetornableMovimiento`: saldo y trazabilidad.

Estados principales:

```text
Rol: ADMIN | OPERACIONES
Camion: DISPONIBLE | EN_RUTA | EN_TALLER
Chofer: DISPONIBLE | EN_RUTA | DESCANSO
Viaje logistico: PENDIENTE | EN_CURSO | COMPLETADO | CANCELADO
Viaje financiero: PENDIENTE | LIQUIDADO
Parada: PENDIENTE | EN_CURSO | COMPLETADA
Reporte: CARGANDO | EN_RUTA | EN_PERNOCTA | DESCARGADO |
         ESPERANDO_INSTRUCCIONES | LIBRE | NOVEDAD | OTRO
Motor: ENCENDIDO | APAGADO
Retornable: PENDIENTE | PARCIAL | DEVUELTO | AJUSTADO
```

Compatibilidad historica: `Viaje.camionId` conserva la unidad principal; `ViajeUnidad` representa el conjunto real. Usa primero `viaje.unidades` y `camionId` solo como fallback, como hace `tripUnitIds`.

Compatibilidad de empresas: `Viaje.empresaId` y `Parada.empresaSedeId` son nullable para conservar viajes creados antes de esta funcionalidad. No conviertas esos campos a obligatorios sin una migracion de datos validada. Los textos `Parada.lugar` y `Parada.ciudad` son la fotografia historica; la relacion con `EmpresaSede` permite busqueda y estadistica, pero renombrar una sede no debe reescribir viajes anteriores.

## 7. Reglas de negocio

### Recursos

- Una unidad solo puede pertenecer a un chofer.
- Inactivar preserva historial.
- El borrado permanente valida dependencias.
- Un camion `EN_TALLER` no puede despacharse.
- Al completar el ultimo mantenimiento, queda `EN_RUTA` si conserva viaje activo; si no, `DISPONIBLE`.

### Empresas y sedes

- Una empresa representa al cliente contractual, no una ubicacion. Ejemplo: `Pepsico` es una empresa; `Mixing Maracay`, `CD Caracas` y `Planta Santa Cruz` son sedes de esa empresa.
- El nombre de empresa es unico y el servicio tambien evita duplicados que solo cambien mayusculas/minusculas.
- Cada sede pertenece a una sola empresa. La combinacion nombre/ciudad debe ser unica dentro de esa empresa.
- `ADMIN` crea, edita, inactiva, reactiva y elimina empresas/sedes. `OPERACIONES` puede consultarlas y usarlas al agendar.
- Inactivar preserva historial. Una empresa inactiva no aparece como opcion de un viaje o tramo nuevo; una sede inactiva no puede asignarse a una carga nueva.
- La eliminacion fisica solo se permite si no hay viajes o paradas vinculados. Si existe uso historico, se debe inactivar.
- No borres ni reasignes relaciones historicas al editar nombres. `lugar` y `ciudad` de cada parada siguen siendo el dato mostrado para ese viaje.
- Las sedes son opcionales: si una empresa aun no tiene sedes, la carga puede capturarse manualmente. Si se elige sede, el frontend completa `lugar` y `ciudad`, y el backend comprueba que sea activa y pertenezca a la empresa seleccionada.
- `GET /api/empresas` entrega cada empresa con sedes y estadisticas. `total` excluye cancelados; `activos` cuenta viajes con alguna parada incompleta; `finalizados` cuenta viajes no cancelados con todas sus paradas completas e incluye los ya liquidados; `liquidados` usa `estadoFinanciero=LIQUIDADO`.

### Viajes

- Los viajes nuevos requieren una empresa activa. Los viajes historicos sin empresa siguen siendo consultables y pueden filtrarse con `empresaId=sin_empresa`.
- Requieren entre 2 y 50 paradas; cada una necesita tipo, lugar y ciudad validos.
- Solo se despachan unidades activas asignadas al chofer.
- Un viaje nuevo, su chofer y sus unidades pasan a `EN_CURSO`/`EN_RUTA`.
- Continuar un viaje agrega un tramo solo si sigue pendiente de liquidacion, todas las paradas estan completas y conserva exactamente las mismas unidades y empresa. Un viaje historico sin empresa debe adoptar una empresa activa al continuarse.
- Al completar todas las paradas se liberan recursos, pero el viaje sigue financieramente `PENDIENTE`.
- Detecta pendiente de liquidacion por `estadoFinanciero=PENDIENTE` y todas las paradas completas; no solo por `estadoLogistico`.
- Solo se cancela antes de cualquier avance y sin reportes, gastos ni retornables vinculados.
- Un viaje liquidado no permite editar ruta, paradas, gastos o viaticos.
- Operaciones puede cerrar logistica; las acciones financieras restringidas son de `ADMIN`.
- `numeroGuia` es opcional y unico cuando existe.

### Reportes

- Retencion por `DIAS_RETENCION_REPORTES`, 5 dias por defecto.
- Cada viaje devuelve hasta 100 reportes recientes y 200 gastos.
- La depuracion corre al arrancar y cada 24 horas.
- No guardar multimedia indefinidamente sin politica aprobada.

### Gastos

- Solo `ADMIN` crea/elimina gastos en la API actual.
- Monedas: `VES` y `USD`.
- USD exige tasa BCV; `monto` queda en VES y `montoOriginal` conserva USD.
- Eliminar decrementa `viaticosGastados`.
- No cambies redondeo sin revisar PDF, totales e historicos.

### Retornables

- No pertenecen permanentemente a chofer o unidad.
- Crear produce un movimiento `REGISTRO`.
- La API actual admite devolucion parcial o total.
- Nunca se devuelve mas que el saldo.
- Los devueltos se depuran tras `DIAS_RETENCION_RETORNABLES`, 30 dias por defecto.

## 8. API, permisos y seguridad

Respuesta normal: `{ ok: true, mensaje: ..., data: {} }`. Error: `{ ok: false, mensaje: ..., detalle: null }`.

Rutas publicas/especiales:

- `GET /health`.
- `POST /api/auth/login`, limitada a 10 fallos por 15 minutos.
- `POST /api/gps/positions`, protegida por token GPS.
- `/whatsapp-qr` y su estado: admin salvo demo publica explicita.

Rutas autenticadas: auth perfil/logout, choferes, camiones, viajes, retornables, taller, tasas y consulta GPS. Son solo admin: usuarios; mutaciones de choferes/camiones; gastos; recarga/documentacion; pendientes de liquidacion; administracion de WhatsApp.

### Inventario de endpoints

`A/O` significa ambos roles autenticados; `ADMIN` significa administrador.

| Metodo y ruta | Permiso | Funcion |
|---|---|---|
| `POST /api/auth/login` | Publica | Inicia sesion y crea cookie |
| `GET /api/auth/perfil` | A/O | Devuelve usuario actual |
| `POST /api/auth/logout` | A/O | Invalida sesiones por version |
| `GET /api/usuarios` | ADMIN | Lista usuarios |
| `POST /api/usuarios` | ADMIN | Crea usuario |
| `PUT /api/usuarios/:id` | ADMIN | Edita usuario/rol/clave |
| `PATCH /api/usuarios/:id/reactivar` | ADMIN | Reactiva usuario |
| `DELETE /api/usuarios/:id` | ADMIN | Desactiva usuario |
| `GET /api/choferes` | A/O | Lista y filtra choferes |
| `GET /api/choferes/:id` | A/O | Detalle de chofer |
| `POST /api/choferes` | ADMIN | Crea chofer |
| `PUT /api/choferes/:id` | ADMIN | Edita y asigna unidades |
| `PATCH /api/choferes/:id/inactivar` | ADMIN | Inactiva chofer |
| `DELETE /api/choferes/:id` | ADMIN | Eliminacion permanente validada |
| `GET /api/camiones` | A/O | Lista y filtra unidades |
| `GET /api/camiones/:id` | A/O | Detalle de unidad |
| `POST /api/camiones` | ADMIN | Crea unidad |
| `PUT /api/camiones/:id` | ADMIN | Edita unidad/IMEI |
| `PATCH /api/camiones/:id/inactivar` | ADMIN | Inactiva unidad |
| `DELETE /api/camiones/:id` | ADMIN | Eliminacion permanente validada |
| `GET /api/empresas` | A/O | Lista empresas, sedes, busqueda y estadisticas |
| `GET /api/empresas/:id` | A/O | Detalle de empresa y sedes |
| `POST /api/empresas` | ADMIN | Crea empresa con sedes opcionales |
| `PUT /api/empresas/:id` | ADMIN | Edita empresa |
| `PATCH /api/empresas/:id/inactivar` | ADMIN | Inactiva empresa |
| `PATCH /api/empresas/:id/reactivar` | ADMIN | Reactiva empresa |
| `DELETE /api/empresas/:id` | ADMIN | Elimina solo si no tiene historial |
| `POST /api/empresas/:id/sedes` | ADMIN | Crea sede o punto de carga |
| `PUT /api/empresas/:id/sedes/:sedeId` | ADMIN | Edita sede |
| `PATCH /api/empresas/:id/sedes/:sedeId/inactivar` | ADMIN | Inactiva sede |
| `PATCH /api/empresas/:id/sedes/:sedeId/reactivar` | ADMIN | Reactiva sede |
| `DELETE /api/empresas/:id/sedes/:sedeId` | ADMIN | Elimina sede sin uso historico |
| `GET /api/viajes` | A/O | Hasta 500 viajes con relaciones |
| `GET /api/viajes/:id` | A/O | Detalle de viaje |
| `GET /api/viajes/archivo/listado` | A/O | Archivo paginado/por periodo |
| `GET /api/viajes/pendientes-liquidacion/listado` | ADMIN | Pendientes paginados |
| `POST /api/viajes` | A/O | Crea viaje o agrega tramo |
| `PATCH /api/viajes/:id/ruta` | A/O | Edita ruta con restricciones |
| `POST /api/viajes/:id/cancelar` | A/O | Cancela antes de iniciar |
| `PATCH /api/viajes/:id/paradas/:paradaId` | A/O | Cambia estado de parada |
| `PATCH /api/viajes/:id/recarga` | ADMIN | Suma viaticos |
| `PATCH /api/viajes/:id/confirmar-documentacion` | ADMIN | Marca documentos recibidos |
| `POST /api/viajes/:id/cerrar` | A/O condicionado | Cierre logistico; finanzas valida rol |
| `POST /api/gastos` | ADMIN | Registra gasto |
| `DELETE /api/gastos/:id` | ADMIN | Elimina gasto y ajusta total |
| `GET /api/tasas/bcv` | A/O | Obtiene tasa/fallback |
| `GET /api/retornables` | A/O | Lista paginada |
| `GET /api/retornables/viajes/:viajeId` | A/O | Retornables relacionados |
| `POST /api/retornables` | A/O | Registra retornable y movimiento |
| `POST /api/retornables/:id/movimientos` | A/O | Registra devolucion |
| `GET /api/taller` | A/O | Lista mantenimientos |
| `POST /api/taller` | A/O | Ingresa unidad a taller |
| `PATCH /api/taller/:id/completar` | A/O | Completa mantenimiento |
| `POST /api/gps/positions` | Token GPS | Upsert de ultima posicion |
| `GET /api/gps/trucks/:truckId/position` | A/O | Consulta posicion |
| `GET /api/whatsapp/status` | ADMIN | Estado del bot |
| `POST /api/whatsapp/reiniciar` | ADMIN | Borra sesion y genera QR nuevo |

No existe endpoint independiente de reportes: se cargan dentro de viajes y se crean principalmente desde WhatsApp. Los controladores de viaje filtran informacion financiera para `OPERACIONES`; conserva ese filtrado al agregar campos.

Los listados `GET /api/viajes`, `GET /api/viajes/archivo/listado` y `GET /api/viajes/pendientes-liquidacion/listado` aceptan `empresaId`. Un UUID filtra por empresa; `sin_empresa` recupera registros historicos con `empresaId IS NULL`. El frontend expone este filtro en viajes activos, finalizados y liquidaciones.

Solicitudes mutables bajo `/api` deben enviar JSON y `X-Requested-With: XMLHttpRequest`. Axios ya lo hace. No retires esa cabecera sin sustituir la proteccion CSRF.

- JWT HS256, issuer `transporte-san-roman`, audience `panel-operativo`, 8 horas por defecto.
- Cookie produccion `__Host-tsr_session`: HttpOnly, Secure, SameSite Strict, Path `/`.
- Logout incrementa `sessionVersion` e invalida sesiones anteriores.
- Socket.IO verifica cookie, origen, usuario activo y version de sesion.
- CORS produccion acepta solo origenes HTTPS exactos de `FRONTEND_URL`.
- Helmet/CSP activos, JSON maximo 100 KB y API 500 solicitudes/15 minutos.
- Errores de produccion no devuelven detalle interno.

No debilites cookie, CORS, CSP, CSRF o rate limits para resolver desarrollo. Corrige proxy, origen o cliente. `DEMO_PUBLIC_WHATSAPP_QR=true` esta prohibido en produccion.

## 9. WhatsApp y Gemini

Flujo tecnico:

1. `server.js` inicia Baileys.
2. Credenciales quedan en `WHATSAPP_AUTH_PATH/session`.
3. El QR solo vive en memoria como data URL y se muestra por ruta protegida.
4. Los mensajes entrantes se filtran; no se procesan mensajes propios.
5. Texto, caption de foto o transcripcion pasan a `mensajes.handler.js`.
6. Se identifica al chofer por telefono normalizado y `whatsappChatId`.
7. Reglas deterministas y Gemini infieren viaje, tipo, ubicacion y parada.
8. Si hay varios viajes ambiguos, se solicita seleccion numerica.
9. El reporte actualiza entidades relacionadas cuando corresponde.
10. Socket.IO emite alertas al panel.

Eventos relevantes:

```text
whatsapp:qr-disponible
whatsapp:conectado
whatsapp:reiniciado
reporte:nuevo
gasto:nuevo
viaje_actualizado
operaciones:alerta
```

Reglas funcionales:

- El numero debe corresponder a un chofer activo.
- `TSR` y `Transporte San Roman` representan la sede en Barquisimeto.
- Se reconocen cargando, carga lista, descargando, descarga lista, pernocta, esperando instrucciones y novedad.
- El flujo del chofer no registra gastos; los administra el panel.
- Si Gemini falla/no esta configurado, existen reglas locales de respaldo.
- Nunca registres mensajes completos, telefonos completos, QR, audio, fotos, tokens o credenciales.
- Revisa `vocabulario.operativo.js`, `ia.parser.js` y `mensajes.handler.js` juntos al cambiar vocabulario.

Baileys no es la API oficial y puede desconectarse o ser bloqueado. WhatsApp Cloud API es la direccion recomendada para operacion critica, pero no es un refactor incidental: cambia webhooks, autenticacion, plantillas, persistencia y operacion.

## 10. GPS y Traccar

### Flujo

```text
Equipo GPS
  -> proxy TCP publico
       -> Traccar (primario)
       -> plataforma original (espejo)

Traccar
  -> webhook JSON del backend
       -> busca Camion por gpsImei
       -> upsert de TruckPosition
       -> actualiza ubicacion del camion
       -> actualiza choferes con viaje activo

Panel
  -> obtiene posiciones en consultas de viajes/camiones
  -> refresca y muestra Leaflet/OpenStreetMap
```

Solo se conserva la ultima posicion. `TruckPosition.truckId` es unico. No conviertas la tabla en historial sin decidir retencion, volumen, indices y costos.

### Puertos

| Uso | Publico | Destino interno |
|---|---:|---|
| GPS103 directo Traccar | `5001/tcp` | `traccar:5001` |
| Proxy Baanool | `5002/tcp` | GPS103 `5001` + `tracker.baanooliot.com:8090` |
| Traccar h02 SinoTrack | no publicado | `traccar:5013` |
| Proxy SinoTrack | `5014/tcp` | h02 `5013` + espejo configurable |
| Web Traccar directo | `8082/tcp` | `traccar:8082` |
| Web Traccar via Nginx | `8088/tcp` | `traccar:8082` |

No asumas que todos los SinoTrack usan `h02`. Valida una unidad, observa paquetes con debug temporal y confirma el protocolo antes de migrar la flota.

### Proxy TCP tee

`traccar/tcp-tee-proxy.js` abre dos conexiones por equipo:

- `PRIMARY_HOST:PRIMARY_PORT`: Traccar.
- `MIRROR_HOST:MIRROR_PORT`: plataforma original.

Copia cada paquete a ambos. Solo una respuesta vuelve al GPS, segun `RESPONSE_SOURCE`; normalmente debe ser `mirror` para conservar comandos de la plataforma original. `DEBUG_HEX=true` puede revelar identificadores y payloads: usalo temporalmente y vuelve a `false`.

### Webhook y polling

Metodo preferido con Traccar propio:

```text
POST https://PANEL_DOMINIO/api/gps/positions?token=GPS_WEBHOOK_TOKEN
```

El backend valida IMEI numerico de 10-20 digitos, latitud, longitud y velocidad 0-300. Alternativamente, `TRACCAR_SYNC_ENABLED=true` consulta `/api/devices` y `/api/positions` con Basic Auth, como minimo cada 15 segundos. Evita webhook y polling simultaneos salvo necesidad conocida.

El webhook no emite hoy un evento Socket.IO GPS dedicado. El marcador llega en el refresco del panel, normalmente dentro de 30 segundos.

Traccar usa actualmente H2 en `traccar_data`. Sirve para piloto; una flota productiva debe evaluar PostgreSQL dedicado, backup consistente y restauracion probada. Esa base es independiente de PostgreSQL operacional.

## 11. Variables de entorno

El backend usa `backend/.env`, con permisos `600` en servidor.

### Obligatorias

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexion Prisma/pooling |
| `DIRECT_URL` | Conexion directa para migraciones |
| `JWT_SECRET` | Minimo tecnico 32; recomendado 64+ aleatorios |
| `FRONTEND_URL` | Origen HTTPS exacto, sin ruta/barra final |
| `GPS_WEBHOOK_TOKEN` | Token largo para webhook en produccion |

### Aplicacion

| Variable | Nota |
|---|---|
| `NODE_ENV` | `production` en VPS |
| `PORT` | `3000` interno |
| `TRUST_PROXY` | `1` tras un reverse proxy confiable |
| `JWT_EXPIRES_IN` | `8h` por defecto |
| `AUTH_COOKIE_MAX_AGE_MS` | 15 minutos a 24 horas |
| `ADMIN_EMAIL`, `ADMIN_NAME` | Admin inicial |
| `ADMIN_PASSWORD` | Solo bootstrap/rotacion, minimo 12 caracteres |
| `ADMIN_RESET_PASSWORD` | `true` solo durante una rotacion |
| `DIAS_RETENCION_REPORTES` | 5 por defecto |
| `DIAS_RETENCION_RETORNABLES` | 30 por defecto |

Tras crear/rotar el admin, elimina `ADMIN_PASSWORD` y `ADMIN_RESET_PASSWORD` y recrea backend.

### Integraciones

| Variable | Uso |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Interpretacion/transcripcion |
| `WHATSAPP_AUTH_PATH` | En Compose: `/app/.whatsapp-auth` |
| `DEMO_PUBLIC_WHATSAPP_QR` | Siempre `false` en produccion |
| `TRACCAR_SYNC_ENABLED` | `false` si el webhook funciona |
| `TRACCAR_BASE_URL` | API Traccar para polling |
| `TRACCAR_EMAIL`, `TRACCAR_PASSWORD` | Basic Auth polling |
| `TRACCAR_SYNC_INTERVAL_SECONDS` | Minimo efectivo 15; recomendado 30 |
| `BCV_RATE_API_URL`, `BCV_RATE_API_KEY` | Fuente opcional de tasa |
| `BCV_USD_RATE` | Fallback manual |

El `.env` raiz configura SinoTrack:

```env
SINOTRACK_MIRROR_HOST=host_original_verificado
SINOTRACK_MIRROR_PORT=puerto_original_verificado
SINOTRACK_DEBUG_HEX=false
SINOTRACK_DEBUG_BYTES=48
```

No inventes host/puerto espejo. Se obtienen del equipo/proveedor. Las variables antiguas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` aparecen en el Dockerfile raiz y documentos, pero el frontend actual no usa Supabase; no son necesarias en el Compose separado.

## 12. Desarrollo y verificacion

Backend:

```powershell
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Frontend, otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Vite sirve normalmente `http://localhost:5173` y envia `/api` y `/socket.io` a `http://localhost:3000`.

Traccar local:

```powershell
docker compose -f docker-compose.traccar.yml up -d
docker compose -f docker-compose.traccar.yml ps
docker compose -f docker-compose.traccar.yml logs --tail=100 traccar
```

El Compose exige variables SinoTrack. Define destinos validos o levanta solo los servicios necesarios. No conectes la misma identidad real de Baileys desde varias instancias.

No hay suite automatizada. Verificacion minima:

```powershell
cd frontend
npm run lint
npm run build
```

```powershell
cd backend
node --check src/server.js
npx prisma validate
npx prisma generate
```

Ejecuta `node --check` en cada JS backend modificado. Para esquema, aplica la migracion en una base de prueba.

`npm run check:production` consulta la base configurada y comprueba posiciones, retencion, RLS, grants, Realtime y secretos frontend. Es de solo lectura, pero verifica el entorno antes de apuntarlo a produccion.

Pruebas manuales segun alcance: auth y roles; crear/avanzar/liquidar viaje; doble asignacion; taller; gastos VES/USD; WhatsApp ambiguo/novedad; webhook GPS/token/IMEI/mapa; y UI desktop/movil.

## 13. Despliegue inicial en VPS

Objetivo: Ubuntu 24.04 LTS, usuario sudo, SSH por llave, Docker Engine/Compose plugin, DNS y HTTPS.

Los bloques de despliegue omiten `sudo` para facilitar lectura. Si el usuario no pertenece deliberadamente al grupo `docker`, antepone `sudo` a cada comando Docker; no cambies permisos del socket Docker para evitarlo.

### Acceso SSH desde Windows

Nunca guardes la llave privada dentro del repositorio, OneDrive compartido, correo o chat. La clave publica termina en `.pub` y si puede copiarse al proveedor; la privada no.

Entorno verificado el 30 de septiembre de 2026:

- VPS de San Roman: `104.251.219.40`, hostname `ubuntu-4gb-dal-hquw`.
- Usuario SSH vigente: `root`.
- Checkout: `/opt/sanroman`, rama `main`.
- Llave local autorizada: `~/.ssh/sanroman_vps_ed25519`.
- Acceso: `ssh -i $env:USERPROFILE\.ssh\sanroman_vps_ed25519 root@104.251.219.40`.
- Panel: `http://104.251.219.40:8080` mientras no exista dominio/TLS.
- `104.237.5.23` no es el despliegue vigente de San Roman; no despliegues alli sin volver a identificarlo.

El VPS conserva cambios locales preparados en `docker-compose.yml` y archivos bajo `traccar/traccar/`. No los reviertas, no uses `git reset --hard` y comprueba siempre que no colisionan con el commit entrante. El override local de Compose mantiene `NODE_ENV=development` porque el panel aun usa HTTP por IP; es deuda de seguridad. Para volver a `production`, configura primero dominio/TLS y un `FRONTEND_URL=https://...` valido.

Crear una llave dedicada desde PowerShell, solo si aun no existe:

```powershell
$key = Join-Path $env:USERPROFILE '.ssh\sanroman_vps_ed25519'
Test-Path $key
ssh-keygen -t ed25519 -a 64 -f $key -C sanroman-produccion
Get-Content ($key + '.pub')
```

Si `Test-Path` devuelve `True`, no sobrescribas la llave sin saber donde se utiliza. Pega en el proveedor solo la linea obtenida de `.pub`, que comienza con `ssh-ed25519`.

Primer acceso durante el aprovisionamiento:

```powershell
$key = Join-Path $env:USERPROFILE '.ssh\sanroman_vps_ed25519'
ssh -i $key root@IP_DEL_VPS
```

Acceso normal despues de crear un usuario administrativo:

```powershell
$key = Join-Path $env:USERPROFILE '.ssh\sanroman_vps_ed25519'
ssh -i $key USUARIO_ADMIN@IP_DEL_VPS
```

En la primera conexion, compara la huella mostrada por SSH con la huella publicada en la consola del proveedor. Si cambia posteriormente, detente y verifica que el VPS no fue reinstalado o comprometido. No ejecutes `ssh-keygen -R` a ciegas.

Para no escribir IP, usuario y llave cada vez, edita la configuracion local:

```powershell
notepad (Join-Path $env:USERPROFILE '.ssh\config')
```

Contenido sugerido:

```sshconfig
Host sanroman-prod
    HostName IP_DEL_VPS
    User USUARIO_ADMIN
    IdentityFile ~/.ssh/sanroman_vps_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Luego basta:

```powershell
ssh sanroman-prod
```

No escribas una IP historica de los documentos en el alias. Usa la IP vigente del panel del proveedor. Si existe dominio administrativo, verifica primero que su DNS apunta al VPS correcto.

### Primer acceso y usuario administrativo

Si el proveedor solo entrega `root`, crea un usuario dedicado. Sustituye `USUARIO_ADMIN` por el nombre elegido:

```bash
adduser USUARIO_ADMIN
usermod -aG sudo USUARIO_ADMIN
install -d -m 700 -o USUARIO_ADMIN -g USUARIO_ADMIN /home/USUARIO_ADMIN/.ssh
install -m 600 -o USUARIO_ADMIN -g USUARIO_ADMIN /root/.ssh/authorized_keys /home/USUARIO_ADMIN/.ssh/authorized_keys
```

Abre una segunda terminal y confirma que el usuario entra y puede ejecutar `sudo`. No cierres la sesion root original hasta terminar esta prueba.

Endurecimiento SSH recomendado, despues de comprobar el acceso alternativo:

```bash
sudoedit /etc/ssh/sshd_config.d/99-sanroman.conf
```

```text
PubkeyAuthentication yes
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo sshd -t
sudo systemctl reload ssh
```

El grupo `docker` equivale practicamente a acceso root. Es preferible usar `sudo docker ...`; si se agrega el usuario al grupo por ergonomia, debe ser una decision consciente y requiere cerrar/reabrir sesion.

Al entrar, identifica siempre el servidor antes de operar:

```bash
whoami
hostnamectl
pwd
cd /opt/sanroman
git status --short
docker --version
docker compose version
sudo docker compose ps
```

Si `cd /opt/sanroman` falla, no improvises otra ruta: localiza el checkout autorizado o confirma si aun no fue clonado. Para tareas largas usa `tmux` o una sesion persistente, de modo que una caida SSH no deje el despliegue a medias.

### 13.1 Seguridad base

1. Accede por llave y cambia cualquier contrasena temporal expuesta.
2. Crea un usuario sudo sin root directo.
3. Pruebalo en otra terminal antes de deshabilitar password y root por SSH.
4. Activa UFW solo con SSH, HTTP, HTTPS y puertos GPS necesarios.
5. Configura actualizaciones de seguridad, zona horaria y NTP.
6. Habilita MFA en GitHub, Supabase, VPS, correo y DNS.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5002/tcp   # solo Baanool por proxy
sudo ufw allow 5014/tcp   # solo SinoTrack por proxy
sudo ufw enable
```

No abras PostgreSQL, `3000`, `8080`, `8082` o `8088` si un proxy/red privada puede cubrirlos. El Compose publica puertos web en todas las interfaces; antes de produccion cambia bindings a loopback, por ejemplo `127.0.0.1:8080:80`.

### 13.2 Codigo

```bash
sudo mkdir -p /opt/sanroman
sudo chown $USER:$USER /opt/sanroman
git clone https://github.com/Yochi22/transporte-san-roman.git /opt/sanroman
cd /opt/sanroman
git checkout main
```

En repositorio privado usa deploy key de solo lectura, nunca un token en la URL.

### 13.3 Secretos

Crea `/opt/sanroman/backend/.env` con valores reales y nuevos:

```env
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=GENERAR_64_O_MAS_CARACTERES_ALEATORIOS
JWT_EXPIRES_IN=8h
FRONTEND_URL=https://panel.example.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=CLAVE_INICIAL_UNICA
DEMO_PUBLIC_WHATSAPP_QR=false
WHATSAPP_AUTH_PATH=/app/.whatsapp-auth
GPS_WEBHOOK_TOKEN=TOKEN_LARGO_ALEATORIO
TRACCAR_SYNC_ENABLED=false
DIAS_RETENCION_REPORTES=5
DIAS_RETENCION_RETORNABLES=30
GEMINI_API_KEY=...
```

Ejecuta `chmod 600 backend/.env`. Crea `/opt/sanroman/.env` solo si se usa SinoTrack, tambien con permisos `600`.

#### Como modificar `.env` por SSH

Archivos que no deben confundirse:

| Archivo | Contenido | Consumidor |
|---|---|---|
| `/opt/sanroman/backend/.env` | App, BD, auth, WhatsApp, Gemini, GPS y tasa | `backend` |
| `/opt/sanroman/.env` | Espejo/debug SinoTrack | Compose Traccar |
| `/opt/sanroman/traccar/conf/traccar.xml` | Protocolos, H2 y webhook | Traccar; no es `.env` |
| Configuracion reverse proxy | Dominio y TLS | Caddy/Nginx del host |

Antes de editar, confirma servidor, ruta y Git:

```bash
hostname
whoami
cd /opt/sanroman
pwd
git status --short
```

Haz una copia restringida fuera del repositorio. Esa copia tambien contiene secretos:

```bash
sudo install -d -m 700 /root/sanroman-env-backups
sudo cp --preserve=mode,timestamps backend/.env /root/sanroman-env-backups/backend.env.before-change
```

Edita con `nano` o `sudoedit`, nunca con un comando que deje el secreto en el historial:

```bash
nano /opt/sanroman/backend/.env
```

En Nano: `Ctrl+O`, Enter para guardar y `Ctrl+X` para salir. Protege el archivo:

```bash
chmod 600 /opt/sanroman/backend/.env
```

Para SinoTrack:

```bash
nano /opt/sanroman/.env
chmod 600 /opt/sanroman/.env
```

Reglas de formato:

- Una variable por linea: `NOMBRE=valor`.
- Sin espacios alrededor de `=`.
- Usa comillas si hay espacios o `#`.
- No agregues comentarios al final de un secreto.
- En URLs PostgreSQL, codifica caracteres especiales de usuario/contrasena.
- No reutilices `JWT_SECRET` como `GPS_WEBHOOK_TOKEN`.
- `GPS_WEBHOOK_TOKEN` debe coincidir exactamente con el webhook Traccar.
- No reemplaces todo el archivo para cambiar una sola variable.

Genera secretos nuevos y guardalos inmediatamente en un gestor:

```bash
openssl rand -hex 64
```

No pegues la salida en tickets, Git, logs ni conversaciones. Lista solo nombres, sin valores:

```bash
grep -E '^[A-Za-z_][A-Za-z0-9_]*=' backend/.env | cut -d= -f1 | sort
```

Claude nunca debe ejecutar `cat backend/.env`, imprimir `docker compose config` sin `--quiet`, mostrar el entorno del contenedor ni incluir valores en su respuesta. Debe comprobar presencia, longitud o conectividad sin revelar el valor.

Valida Compose sin imprimir la configuracion expandida:

```bash
cd /opt/sanroman
sudo docker compose config --quiet
sudo docker compose -f docker-compose.traccar.yml config --quiet
```

Despues de cambiar `backend/.env`, `docker compose restart` no basta: reiniciar conserva las variables con las que se creo el contenedor. Recrea backend y vigila su healthcheck:

```bash
cd /opt/sanroman
sudo docker compose up -d --force-recreate backend
sudo docker compose ps
sudo docker compose logs --tail=100 backend
```

Si el backend no queda `healthy`, restaura la copia restringida, conserva permiso `600` y vuelve a recrearlo. No publiques valores de error que contengan URLs o credenciales.

Si cambia una variable `VITE_*`, reconstruye frontend porque Vite la incorpora durante build. El frontend actual no necesita las variables Supabase antiguas:

```bash
sudo docker compose build frontend
sudo docker compose up -d --force-recreate frontend
```

Despues de cambiar `/opt/sanroman/.env`, recrea solo el proxy SinoTrack:

```bash
sudo docker compose -f docker-compose.traccar.yml up -d --force-recreate tcp-tee-sinotrack
sudo docker compose -f docker-compose.traccar.yml logs --tail=100 tcp-tee-sinotrack
```

Despues de cambiar `traccar.xml`, reinicia Traccar:

```bash
sudo docker compose -f docker-compose.traccar.yml restart traccar
sudo docker compose -f docker-compose.traccar.yml logs --tail=150 traccar
```

Matriz rapida de aplicacion:

| Cambio | Accion minima |
|---|---|
| `backend/.env` | Recrear `backend` |
| Codigo backend | Build, migracion si aplica, recrear `backend` |
| Codigo frontend | Build y recrear `frontend` |
| `.env` raiz SinoTrack | Recrear `tcp-tee-sinotrack` |
| `traccar.xml` | Reiniciar `traccar` |
| `frontend/nginx.conf` | Build y recrear `frontend` |
| Proxy HTTPS del host | Validar configuracion y recargar proxy |

Nunca edites secretos localmente para luego subirlos con Git. Tampoco uses `scp` para reemplazar todo `/opt/sanroman`: el codigo llega por Git y los secretos se administran separadamente en el VPS.

### 13.4 Traccar

`traccar/conf/traccar.xml` contiene placeholders. `forward.url` debe apuntar al dominio real y usar el mismo `GPS_WEBHOOK_TOKEN` del backend. No confirmes el token en Git.

El XML montado pertenece al repositorio y no interpola entorno. Un secreto en el checkout puede generar conflictos/exposicion. La mejora recomendada es montar una copia fuera del repo o generarla durante despliegue. Hasta implementarlo, revisa `git status` y nunca hagas commit del XML real.

```bash
cd /opt/sanroman
docker compose -f docker-compose.traccar.yml config --quiet
docker compose -f docker-compose.traccar.yml up -d
docker compose -f docker-compose.traccar.yml ps
docker compose -f docker-compose.traccar.yml logs --tail=150 traccar tcp-tee-baanool tcp-tee-sinotrack
```

### 13.5 Migraciones

La imagen final elimina dependencias de desarrollo y puede no incluir Prisma CLI. No dejes que `npx prisma` descargue una version mayor incompatible. Usa la version fijada:

```bash
cd /opt/sanroman
docker compose build backend
docker compose run --rm backend npx --yes prisma@5.22.0 migrate deploy
```

Confirma exito antes de iniciar codigo nuevo. Para despliegue offline, ajusta primero Dockerfile con una etapa de migracion que incluya Prisma fijado.

Para el modulo Empresas, la migracion esperada es `20260930150000_add_companies_and_loading_sites`. Es aditiva: crea `empresas` y `empresas_sedes`, agrega referencias nullable a `viajes` y `paradas`, indices, claves foraneas y proteccion RLS/grants. No necesita variables de entorno nuevas ni rellena viajes antiguos. Despliega primero la migracion y despues recrea backend/frontend; el codigo nuevo consulta estas tablas desde el arranque.

Estado verificado el 30 de septiembre de 2026: esta migracion ya fue aplicada en la base Supabase de produccion, figura terminada y no revertida en `_prisma_migrations`, y el despliegue `32e1a9e` quedo activo en el VPS. Las tablas tienen RLS y no exponen grants a `PUBLIC`, `anon` o `authenticated`.

Validacion posterior especifica:

1. Crea una empresa de prueba y dos sedes desde el panel.
2. Agenda un viaje seleccionando empresa y una sede de carga.
3. Confirma en el detalle que aparecen empresa, sede, lugar y ciudad.
4. Comprueba el filtro de empresa en activos, finalizados y liquidaciones.
5. Inactiva la empresa y confirma que desaparece del agendamiento, pero permanece visible en el viaje historico.
6. Reactivala o elimina los datos de prueba solo si no tienen historial real asociado.

### 13.6 Aplicacion

```bash
cd /opt/sanroman
docker compose up -d --build
docker compose ps
docker compose logs --tail=150 backend frontend
```

El healthcheck de Compose valida `/health` dentro del backend. `docker compose ps` debe mostrar `healthy`. No uses `http://127.0.0.1:8080/health` como unica prueba: Nginx puede devolver la SPA.

### 13.7 DNS y HTTPS

Crea un registro `A` hacia el VPS. Coloca Caddy, Nginx o proxy del proveedor delante de `127.0.0.1:8080` y emite TLS.

```caddyfile
panel.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

El proxy debe conservar Host, `X-Forwarded-Proto` y WebSocket upgrade. `FRONTEND_URL` debe ser exactamente `https://panel.example.com`. Restringe Traccar por VPN, IP o autenticacion adicional.

### 13.8 Validacion inicial

1. Comprueba healthcheck y login.
2. Elimina `ADMIN_PASSWORD` y recrea backend.
3. Vincula WhatsApp y prueba persistencia tras reinicio.
4. Crea una unidad piloto con IMEI real.
5. Crea en Traccar el mismo IMEI como `uniqueId`.
6. Migra un solo GPS y valida Traccar, panel y plataforma original.
7. Confirma comandos remotos originales.
8. Ejecuta el chequeo productivo.
9. Realiza y restaura una copia de prueba antes de incorporar la flota.

## 14. Despliegue continuo

Antes: arbol limpio o cambios conocidos, backup reciente, variables nuevas creadas, migracion revisada y rollback definido.

```bash
cd /opt/sanroman
git status --short
git fetch origin
git log --oneline HEAD..origin/main
git pull --ff-only origin main
docker compose build backend frontend
docker compose run --rm backend npx --yes prisma@5.22.0 migrate deploy
docker compose up -d --force-recreate backend frontend
docker compose ps
docker compose logs --tail=200 backend frontend
```

Si cambia Traccar/proxy:

```bash
docker compose -f docker-compose.traccar.yml config --quiet
docker compose -f docker-compose.traccar.yml up -d --build
docker compose -f docker-compose.traccar.yml logs --tail=200 traccar tcp-tee-baanool tcp-tee-sinotrack
```

Nunca uses `git reset --hard`, `docker compose down -v`, `docker system prune --volumes` ni recrees volumenes en un despliegue normal.

## 15. Rollback

Codigo sin migracion incompatible:

```bash
cd /opt/sanroman
git log --oneline -10
git checkout ID_COMMIT_ANTERIOR
docker compose up -d --build --force-recreate backend frontend
```

Luego vuelve a rama/etiqueta normal; no dejes detached HEAD indefinidamente.

Una migracion no se revierte bajando codigo. Si elimina o transforma datos, exige SQL probado o restauracion. Prefiere migraciones aditivas: agrega nullable/default, despliega codigo compatible, migra datos y retira lo antiguo en otro ciclo.

Rollback GPS:

- Conserva host, puerto, APN y comando originales.
- Migra una unidad, luego grupo pequeno, finalmente el resto.
- Si falla, devuelve el equipo al destino original con el comando de ese modelo.
- No asumas que comandos Baanool y SinoTrack son intercambiables.

## 16. Backups

Debe existir retencion, cifrado, copia externa y restauracion periodica. Respalda:

- PostgreSQL operacional mediante proveedor/herramienta oficial.
- `traccar_data` con Traccar detenido o metodo consistente.
- `whatsapp_auth`, cifrado y muy restringido.
- Reverse proxy y configuracion Traccar externa.
- Inventario de IMEI, destino original y configuracion por equipo.

No guardes backups en Git. No son validos hasta restaurarlos en entorno aislado. Una sesion WhatsApp restaurada puede estar invalidada y requerir QR nuevo.

## 17. Diagnostico

```bash
docker compose ps
docker compose logs --tail=200 backend frontend
docker compose -f docker-compose.traccar.yml ps
docker compose -f docker-compose.traccar.yml logs --tail=200 traccar tcp-tee-baanool tcp-tee-sinotrack
```

### Panel no abre

- Comprueba DNS, certificado, proxy y `8080` loopback.
- Comprueba healthcheck backend y logs frontend.
- No abras CORS indiscriminadamente.

### Login funciona, Socket.IO falla

- Proxy debe soportar WebSocket upgrade.
- Origen debe coincidir exactamente con `FRONTEND_URL`.
- Cookie Secure requiere HTTPS.

### WhatsApp pide QR constantemente

- Verifica volumen `whatsapp_auth` y `WHATSAPP_AUTH_PATH`.
- Confirma permisos y una sola instancia usando la sesion.
- No borres volumen sin aceptar perdida de vinculacion.

### GPS llega al proxy, no a Traccar

- Revisa bytes y conectividad al primario.
- Activa `DEBUG_HEX` solo temporalmente.
- Confirma protocolo, puerto interno e IMEI.
- Crea dispositivo Traccar con `uniqueId` exacto.

### Traccar ve GPS, panel no

- Revisa `forward.url`, token y respuesta HTTP.
- Confirma `gpsImei` exacto en `camiones`.
- Si usa polling, revisa URL, credenciales y logs `Traccar sync`.
- Un IMEI desconocido devuelve 404; no crea camion automaticamente.

### Plataforma original pierde equipo

- Comprueba mirror y `RESPONSE_SOURCE=mirror`.
- Revierte al destino original si la operacion queda en riesgo.

No registres payloads completos de produccion. Enmascara IMEI, telefonos, JID, tokens y PII.

## 18. Convenciones de implementacion

### Backend

- Rutas -> controladores -> servicios -> Prisma.
- Controladores manejan HTTP; reglas/transacciones viven en servicios.
- Usa `ok` y middleware global de errores.
- Valida tipos, rangos, longitud y estados antes de escribir.
- Usa transacciones cuando varias entidades deben cambiar juntas.
- Usa `utils/prismaSelects.js` para evitar filtrar campos sensibles.
- Conserva limites y paginacion.
- Evita SQL inseguro; limita cualquier SQL dinamico a entradas internas.

### Frontend

- Conserva same-origin y `withCredentials`.
- Mutaciones usan Axios con cabecera CSRF.
- Usa Lucide y titulos accesibles.
- Usa tablas para volumen, modales para alta/edicion y drawer para viaje.
- El agendamiento usa selector de empresa con busqueda interna. No lo reemplaces por un `select` largo sin busqueda.
- El selector de sede solo ofrece sedes activas de la empresa elegida; al cambiar de empresa limpia una sede anterior incompatible.
- Viajes y liquidaciones conservan la opcion global `Todas las empresas` y la opcion historica `Sin empresa`.
- Cada tarjeta de viaje activo muestra de forma visible `Empresa: <nombre>` entre el codigo del viaje y el chofer; los registros historicos usan `Empresa: Sin empresa`.
- El panel Empresas es un catalogo operativo: alta, busqueda, estado, sedes y estadisticas por fila. No muestra cards con conteos generales; esos resumenes pertenecen al dashboard principal.
- Evita cards decorativas, gradientes, heroes y texto instructivo innecesario.
- Mantiene iPhone/escritorio y evita desbordes de nombres, rutas y montos.
- Si divides `App.jsx`, hazlo por dominio sin reescritura total incidental.

### Prisma

1. Edita `schema.prisma`.
2. Crea migracion nueva y descriptiva.
3. Revisa SQL, indices, defaults, nulos y datos existentes.
4. Ejecuta validate/generate.
5. Prueba en copia de base.
6. Actualiza selects, servicio, API y UI.
7. Define orden de despliegue y rollback.

No uses scripts `apply_*_migration.js` antiguos como primera opcion si Prisma Migrate cubre el cambio. Conservalos porque documentan recuperaciones historicas.

## 19. Acciones peligrosas

Requieren confirmacion explicita y backup:

- `backend/scripts/reset_demo_data.js`, que borra operacion y exige `ALLOW_DEMO_RESET=true`.
- `DELETE`, `TRUNCATE`, migracion destructiva o limpieza masiva.
- Borrar `.whatsapp-auth` o `whatsapp_auth`.
- Borrar `traccar_data` o migrar H2.
- Cambiar servidor/puerto de toda la flota GPS.
- Rotar tokens sin actualizar ambos extremos.
- Habilitar QR publico.
- Exponer bases o interfaces administrativas a Internet.

## 20. Checklist de entrega

- [ ] `git status` revisado y cambios ajenos preservados.
- [ ] Reglas de negocio afectadas identificadas.
- [ ] Roles y autorizacion comprobados.
- [ ] Validacion del servidor presente; no confiar solo en UI.
- [ ] Secretos/PII ausentes de codigo, logs y respuestas.
- [ ] Migracion nueva si cambia esquema.
- [ ] Filtros y estadisticas de empresa verificados si cambia agendamiento, cierre o liquidacion.
- [ ] Frontend lint/build ejecutado si aplica.
- [ ] Prisma validate/generate y sintaxis backend ejecutados si aplica.
- [ ] Flujo manual critico probado.
- [ ] Compatibilidad movil revisada si cambia UI.
- [ ] Despliegue y variables nuevas documentados.
- [ ] Rollback definido para cambios de riesgo.
- [ ] No quedan procesos de prueba, debug HEX ni QR publico activos.

## 21. Deuda tecnica conocida

- No hay suite automatizada.
- Baileys no ofrece garantias de Cloud API.
- Falta MFA de aplicacion y auditoria inmutable.
- Gastos se eliminan en vez de anularse.
- Traccar usa H2 y publica puertos web en Compose.
- El token webhook se inserta manualmente en XML.
- Prisma CLI no queda en imagen final; migracion es paso separado.
- `App.jsx` concentra demasiados dominios.
- No existe evento Socket.IO de posicion GPS.
- Documentos historicos contradicen partes de la implementacion.
- Hay mojibake en codigo/documentacion.
- Falta backup/restore automatizado y probado.
- Falta monitoreo externo, alertas y rotacion formal de logs.

Esta lista orienta decisiones; no autoriza un refactor total durante una tarea acotada.

## 22. Criterio de terminado

Una tarea no termina solo porque compila. Debe:

1. Respetar reglas operativas y permisos.
2. Preservar datos/compatibilidad o incluir migracion segura.
3. Funcionar en frontend, API e integraciones afectadas.
4. Haber sido verificada proporcionalmente al riesgo.
5. Incluir despliegue si cambia runtime, variables, base, proxy, WhatsApp o GPS.
6. Declarar riesgos o verificaciones no ejecutadas.
