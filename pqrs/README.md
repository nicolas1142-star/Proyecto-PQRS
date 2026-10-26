# Proyecto PQRS
Abrir con VS Code + extensión **Live Server** (los módulos ES no funcionan con doble clic).

## Cuentas
- **Administrador (por defecto):** admin@pqrs.com / Admin123!  (cámbiala antes de usar en serio)
- **Usuario:** se crea desde `cuenta.html`.

## Permisos
| Acción | Público | Usuario | Admin |
|---|---|---|---|
| Consultar estado por radicado | Sí | Sí | Sí |
| Registrar PQRS | No | Sí | No |
| Ver "Mis solicitudes" | No | Sí (solo las suyas) | No |
| Ver todas, cambiar estado y responder | No | No | Sí |

## Datos de prueba
Consola del navegador: `const s = await import('/js/utils/seed.js'); s.cargarDatosDePrueba();`
