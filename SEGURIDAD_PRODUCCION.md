# Seguridad para produccion

## Estado actual

El sistema quedo considerablemente mas protegido que el MVP inicial, pero todavia no debe considerarse listo para almacenar informacion altamente sensible sin completar las medidas pendientes.

- Demo controlada: 7/10
- Produccion con la configuracion actual: 6/10
- Produccion despues de las medidas prioritarias: 8 a 8.5/10

Un atacante externo sin credenciales tendria una dificultad media-alta. El mayor riesgo sigue siendo el robo de credenciales, el acceso a proveedores, el secuestro de WhatsApp o errores de configuracion.

## Protecciones implementadas

- JWT fuera de `localStorage`.
- Cookie `HttpOnly`, `Secure`, `SameSite=Strict` y prefijo `__Host-`.
- Cierre de sesion que invalida tokens anteriores.
- CORS restringido al dominio configurado.
- Proteccion CSRF.
- Limites de intentos de login y solicitudes.
- Separacion de roles `ADMIN` y `OPERACIONES`.
- Operaciones financieras restringidas al administrador.
- WebSockets autenticados.
- Validacion de campos, montos, estados y tamanos.
- Eliminacion de asignacion masiva hacia Prisma.
- Campos internos de WhatsApp e IA fuera de las respuestas.
- RLS activo en Supabase.
- Sin privilegios para `anon` o `authenticated` sobre las tablas privadas.
- QR, telefonos, mensajes y transcripciones fuera de los logs.
- Contenedores ejecutados como usuario no privilegiado.
- Dependencias sin vulnerabilidades conocidas segun `npm audit`.
- Contrasena administrativa expuesta anteriormente rotada.

## Riesgos altos pendientes

### QR publico

Durante las demostraciones se permite:

```env
DEMO_PUBLIC_WHATSAPP_QR=true
```

Antes de produccion debe cambiarse a:

```env
DEMO_PUBLIC_WHATSAPP_QR=false
```

Un QR publico disponible durante una desconexion puede permitir que un tercero vincule la sesion de WhatsApp.

### Integracion no oficial de WhatsApp

Baileys no es una integracion oficial de WhatsApp y actualmente se utiliza una version candidata. Para produccion se recomienda migrar a WhatsApp Cloud API oficial.

### Sin autenticacion multifactor

El robo de la clave del administrador permitiria el acceso directo al panel. Se debe implementar MFA para administradores y activarlo tambien en GitHub, Render, Supabase y el correo asociado.

### Cuenta de base de datos con permisos amplios

El backend puede estar conectando como propietario de PostgreSQL. Se debe crear un usuario exclusivo para la aplicacion:

- Sin permisos para crear o eliminar tablas.
- Sin permisos DDL.
- Con acceso solamente a las tablas y operaciones necesarias.
- Con credenciales diferentes a las del administrador de Supabase.

### Informacion enviada a Gemini

Mensajes, ubicaciones, rutas y notas de voz pueden transmitirse a Google Gemini. Antes de produccion se debe definir:

- Que informacion puede enviarse.
- Tiempo de conservacion.
- Consentimiento informado de los choferes.
- Politica de privacidad.
- Anonimizacion de nombres, telefonos y cedulas cuando no sean necesarios.

## Riesgos medios pendientes

- No existe MFA ni bloqueo acumulado por cuenta.
- El limite de login se basa principalmente en IP.
- No hay auditoria inmutable de acciones administrativas.
- Los gastos pueden eliminarse en lugar de anularse.
- `OPERACIONES` recibe telefono y cedula de los choferes.
- Faltan pruebas automatizadas de permisos y seguridad.
- No existen alertas por accesos inusuales.
- No se ha realizado un pentest externo.
- No se ha probado formalmente la restauracion de backups.
- La sesion de Baileys almacenada en el volumen permite controlar WhatsApp.
- La clave administrativa antigua sigue en el historial Git, aunque ya no funciona.

## Evaluacion de ataques

- Adivinar un JWT: extremadamente dificil con un secreto fuerte.
- Robar el JWT mediante JavaScript: dificil por la cookie `HttpOnly`.
- Manipular solicitudes desde DevTools: posible, pero limitado por validaciones y roles del backend.
- Fuerza bruta de contrasenas: dificultad media; falta MFA.
- Phishing o contrasenas reutilizadas: riesgo alto mientras no exista MFA.
- Ver datos autorizados desde DevTools: siempre es posible.
- Comprometer Render, Supabase, GitHub o el correo administrador: impacto critico.
- Aprovechar el QR publico: facil y critico si queda activo en produccion.

La consola del navegador siempre puede mostrar los datos que la cuenta recibe. La proteccion correcta consiste en limitar los campos por rol, enmascarar datos personales y auditar consultas o exportaciones.

## Lista obligatoria antes de produccion

- [ ] Configurar `DEMO_PUBLIC_WHATSAPP_QR=false`.
- [ ] Implementar MFA para administradores.
- [ ] Activar MFA en GitHub, Render, Supabase y correo.
- [ ] Crear un usuario PostgreSQL de privilegios minimos.
- [ ] Migrar a WhatsApp Cloud API oficial.
- [ ] Implementar auditoria de acciones administrativas.
- [ ] Reemplazar eliminaciones financieras por anulaciones.
- [ ] Enmascarar cedulas y telefonos para `OPERACIONES`.
- [ ] Agregar pruebas automatizadas de autenticacion y autorizacion.
- [ ] Configurar alertas de seguridad y accesos inusuales.
- [ ] Configurar backups y ejecutar una restauracion de prueba.
- [ ] Definir politica de privacidad y tratamiento de datos.
- [ ] Revisar el tratamiento de datos enviados a Gemini.
- [ ] Limpiar el secreto antiguo del historial Git.
- [ ] Realizar un pentest externo.
- [ ] Revisar variables y secretos del entorno de produccion.
- [ ] Confirmar HTTPS y cabeceras de seguridad.
- [ ] Documentar respuesta a incidentes y rotacion de credenciales.

## Referencias

- OWASP API Security Top 10: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Baileys: https://github.com/WhiskeySockets/Baileys
