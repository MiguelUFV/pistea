# Evaluación de impacto en la protección de datos (art. 35 RGPD)

**Tratamiento:** Pistea, red social de esquiadores: grabar días de esquí con el GPS, rankings, comunidad y perfil.
**Responsable:** el titular de Pistea (ver `/aviso-legal`).
**Fecha:** 23-nov-2026. **Revisar:** antes del lanzamiento comercial, al llegar a 1.000 usuarios, al añadir funciones que usen la ubicación o los datos de menores y, como mínimo, una vez al año.

## 1. Por qué hace falta
La lista de la AEPD de tratamientos que requieren evaluación de impacto incluye estos criterios, y Pistea cumple varios:
- **Geolocalización** de forma sistemática mientras se graba un día.
- **Menores**: se admite desde 14 años.
- **Evaluar o clasificar a personas**: rankings, ligas y clasificaciones de pista.
- **Datos que se hacen visibles a otros**: días y recorridos.

Con dos criterios o más, la AEPD considera que hay que hacerla.

## 2. Descripción
- **Datos:** cuenta y perfil; ubicación GPS mientras se graba; días calculados con su desglose y su recorrido; pasaporte de pistas; relaciones sociales; denuncias; registro de seguridad. Detalle en `legal/registro_actividades.md`.
- **Ciclo de vida:**
  1. La app graba en el móvil.
  2. Al terminar, envía la traza al servidor.
  3. El servidor recalcula el día, guarda las cifras y un recorrido simplificado y recortado, y **descarta la traza**.
  4. Los días se muestran según «Quién ve tus días».
- **Personas:** esquiadores de 14 años en adelante, en España.
- **Tecnología:** servidor Node en Vercel, base de datos Turso, correos con Brevo, mapas en Cloudflare y app de Android con Capacitor.

## 3. Necesidad y proporcionalidad
- La ubicación es imprescindible para el servicio, que consiste en medir el día de esquí. Solo se toma mientras el usuario graba (en Android, con un aviso fijo), nunca en segundo plano sin su acción.
- **Minimización:**
  - La traza completa no se guarda.
  - El recorrido se recorta a la estación y sin el principio y el final.
  - Otras personas no ven las horas.
  - La edad es opcional y privada.
  - Las velocidades no se comparan con otros.
- **Transparencia:**
  - Política de privacidad.
  - Explicación antes del primer permiso de ubicación.
  - Aviso en la app cuando cambian las normas.
- **Derechos:** editar, exportar todo, borrar la cuenta al momento, elegir quién ve los días y pedir revisión humana de las decisiones automáticas.

## 4. Riesgos y medidas
| Riesgo | Probabilidad / gravedad antes | Medidas aplicadas | Riesgo que queda |
|---|---|---|---|
| **Seguimiento o acoso** a partir de los días (dónde y cuándo está alguien) | Alta / alta | Días solo para seguidores por defecto; «Solo tú» disponible; sin horas para los demás; recorrido recortado a la estación; bloqueo en los dos sentidos | Bajo: un seguidor aceptado ve dónde se esquió ese día, por decisión del usuario |
| **Menores** expuestos a desconocidos | Media / alta | Con menos de 18 años no se puede elegir «Todos»; no se les sugiere por su estación; sin mensajes privados; normas y denuncias | Bajo-medio: la edad es declarada, no comprobada |
| **Revelar el domicilio o el alojamiento** por el inicio o el final del recorrido | Media / alta | Recorte de lo anterior al primer remonte y lo posterior a la última bajada, y de todo lo que queda fuera de la estación | Bajo |
| **Incitar a ir rápido** (lesiones) | Media / alta | Sin rankings, coronas ni insignias de velocidad; avisos de seguridad en condiciones y fichas | Bajo |
| **Acceso indebido** a cuentas o a la base de datos | Media / alta | Ver `SEGURIDAD.md`: scrypt, límites de intentos, sesiones seguras, CSP y 33 pruebas de ataque superadas | Bajo |
| **Abuso de la moderación** (ocultar a alguien con denuncias falsas) | Media / media | Solo cuentan denuncias de cuentas verificadas; revisión humana; aviso con motivos y reclamación | Bajo |
| **Transferencias a EE. UU.** | Media / media | Proveedores con contratos de encargo; Marco de Privacidad o cláusulas tipo | Medio hasta pasar a la UE (T7) |
| **Decisiones automáticas** injustas (día rechazado, cuenta oculta) | Baja / media | Explicadas en la política; revisión humana a petición | Bajo |

## 5. Conclusión
Con las medidas aplicadas el 23-nov-2026, el riesgo que queda es **aceptable** y no hace falta consultar a la AEPD (art. 36).

**Pendiente para bajarlo más:**
- Pasar la base de datos y el servidor a la UE.
- Aceptar los contratos de encargo de todos los proveedores.
- Revisar esta evaluación antes de abrir la app a todo el público.

**Firma y fecha del responsable:** ______________________
