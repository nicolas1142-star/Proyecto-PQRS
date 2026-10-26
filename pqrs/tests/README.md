# Pruebas (DoD)
Casos a cubrir con Vitest u otra herramienta:
1. Radicado válido -> devuelve estado, tipo y fecha.
2. Radicado inexistente -> `consultarEstado` devuelve null y la UI muestra error.
3. Solicitud con respuesta -> el resultado incluye `respuesta`.
4. Seguridad: el resultado NO contiene `email`, `nombre`, `descripcion` ni `evidencias`.

## Casos de autenticación y permisos
5. Registrar cuenta con correo repetido -> error.
6. Login con contraseña incorrecta -> mismo mensaje que correo inexistente.
7. `registrarPqrs` sin sesión o como admin -> lanza "No tienes permiso".
8. `listarTodas` / `actualizarSolicitud` como usuario -> lanza "No tienes permiso".
9. `listarMisSolicitudes` solo devuelve las solicitudes del usuario en sesión.
