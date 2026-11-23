# Pistea · Auditoría legal y de las tiendas

Revisión del **23-nov-2026**. Qué se ha revisado:
- Las páginas legales publicadas (`/privacidad`, `/condiciones`, `/normas` y `/borrar-cuenta`, generadas en `legal.js`).
- Lo que hace de verdad el código con los datos.
- La app de Android y las normas de Google Play y de la App Store.
- Los vídeos de promoción.

La seguridad técnica está en `SEGURIDAD.md`. **No sustituye a un abogado**: antes del lanzamiento comercial conviene que un profesional revise la protección de datos y el Reglamento de Servicios Digitales.

## Resumen
- **Bien:**
  - Textos legales publicados con tu nombre y un correo de contacto.
  - Consentimiento al registrarse (condiciones, privacidad y 14 años) con la fecha guardada.
  - Edad mínima de 14 años.
  - Borrado de cuenta en la app y en la web.
  - Descarga de los datos.
  - Denunciar, bloquear y moderar.
  - Una sola cookie técnica, sin analítica ni publicidad.
  - Ubicación solo mientras grabas, sin permiso de segundo plano.
  - Atribución de IGN y OpenStreetMap, y autores y licencias de las fotos.
  - Avisos de seguridad en las condiciones.
- **Bloquea la publicación** (apartado 1): L1 a L6.
- **Antes del lanzamiento comercial:**
  - Documentos del RGPD (registro de actividades, evaluación de impacto y contratos con proveedores).
  - Aviso legal con NIF y domicilio.
  - Correcciones de la política de privacidad.
  - Licencias de datos y fotos, y registro de la marca.

## 1. Bloqueantes
| # | Problema | Riesgo | Qué hacer |
|---|---|---|---|
| L1 | **Los días son públicos por defecto, con recorrido y horas** (S4 de `SEGURIDAD.md`). Cualquier cuenta abre el día de otra: recorrido convertible a GPS, hora de cada bajada y remontes. «Aprobar seguidores» no lo evita. También pasa con menores de 14 a 17 años | **RGPD art. 25.2**: por defecto, los datos no pueden quedar al alcance de un número indeterminado de personas sin que el usuario intervenga. Riesgo de acoso o seguimiento en tiempo real. Apple (5.1.1) y Google (datos de usuario) revisan cómo se comparte la ubicación | Ajuste «quién ve mis días»: todos, seguidores o solo yo. Por defecto, «seguidores», y siempre así para menores de 18. Recortar el recorrido a la estación y quitar el principio y el final. No enseñar a otros las horas. Explicarlo en la política |
| L2 | **Se premia la velocidad en pistas abiertas**: ranking «Vel. máxima», coronas de velocidad por pista, insignia «100 km/h». En el vídeo del día, la frase «coronas en las pistas donde nadie baja más rápido que tú» | **Apple 1.4.5**: rechaza apps que animan a actividades con riesgo físico. **Responsabilidad civil** (art. 1902 del Código Civil) si alguien se accidenta persiguiendo un récord. Las condiciones dicen «no es una competición», pero la app la organiza. Las cláusulas no eximen del daño a personas (art. 86 TRLGDCU) | Quitar el ranking público de velocidad, las coronas de velocidad y la insignia de 100 km/h. Dejar la máxima personal, privada. Las coronas pueden quedarse para el número de bajadas. Cambiar esa frase del vídeo |
| L3 | **Aviso «Hay una versión nueva»** que manda a descargar una APK desde Google Drive | Google Play, política de abuso de dispositivo y red: una app de Play no puede actualizarse por otro camino que Play. Rechazo o suspensión de la cuenta | En la versión de Play, otro agente de usuario (por ejemplo `PisteaPlay/…`) sin aviso, o que el aviso abra la ficha de Play. La APK suelta, solo fuera de la tienda |
| L4 | **Reglamento de Servicios Digitales (DSA, Reglamento UE 2022/2065)**: Pistea aloja contenido de usuarios (nombre, foto, biografía, días) y lo enseña a otros, así que es una plataforma en línea. Por ser microempresa queda exenta de los artículos 15 y 20 a 28, **no del resto** | Sanciones de la autoridad de cada país (en España, la CNMC) | **Art. 11 y 12**: indica que el correo de contacto es el punto de contacto para autoridades y usuarios, y en qué idioma (español). **Art. 14**: explica en las condiciones cómo se modera: filtro de palabras, ocultación automática con 3 denuncias de cuentas verificadas, revisión humana y cómo reclamar. **Art. 16**: que pueda denunciar **cualquiera, también sin cuenta** (formulario o correo en `/normas`), con acuse de recibo y respuesta. **Art. 17**: avisa por correo al afectado, **con los motivos** y cómo recurrir, cuando ocultas su cuenta, quitas un día, limpias el perfil o le suspendes. Hoy no se le avisa. **Art. 18**: si ves una amenaza contra la vida, avisa a la policía |
| L5 | **Logotipos oficiales de las estaciones** en el mapa 3D (T8 de `SEGURIDAD.md`) | Uso de marca ajena sin permiso (Ley 17/2001 de Marcas). Apple (5.2.1 y 5.2.2) y Google rechazan apps con propiedad intelectual de otros sin autorización | Quita los logotipos o pide permiso por escrito. El **nombre** de cada estación sí puede usarse para describir dónde esquías. Que nada sugiera que la estación colabora o es «oficial». En la ficha de la tienda, capturas sin logotipos |
| L6 | **iOS: la app es la web dentro de un marco** (`server.url` de Capacitor) | **Apple 4.2** (funcionalidad mínima) y **2.5.2/2.3.1**: Apple rechaza webs empaquetadas, y cambiar funciones desde el servidor sin revisión es causa de expulsión | Meter la web dentro de la app (`webDir`) y hablar con el servidor solo por la API. Añadir lo nativo: grabación GPS en segundo plano con indicador, avisos y widget. Falta crear el proyecto de iOS |

## 2. Protección de datos (RGPD y LOPDGDD)
**Bien:**
- Bases legales razonables: contrato para la cuenta y los días, consentimiento para la ubicación e interés legítimo para el antitrampas y la seguridad.
- La traza GPS no se guarda.
- Plazos de conservación escritos.
- Derechos ejercibles desde la app.
- Edad privada.
- Encargados de tratamiento citados.
- Reclamación ante la AEPD.

**Documentos que faltan** (no se publican, pero hay que tenerlos):
- **Registro de actividades de tratamiento** (art. 30). Es obligatorio aunque seas pequeño, porque el tratamiento no es ocasional e incluye ubicación.
- **Evaluación de impacto** (art. 35). Se dan varios criterios de la lista de la AEPD: geolocalización, menores y evaluar o clasificar a personas en rankings. La herramienta gratuita «Gestiona EIPD» de la AEPD sirve.
- **Contratos de encargo** (art. 28) con Vercel, Turso, Brevo y Cloudflare: acepta el DPA de cada uno.
- **Transferencias internacionales:** comprueba que cada proveedor de EE. UU. está en el Marco de Privacidad UE-EE. UU. o firma cláusulas tipo. Mejor aún, todo en la UE: `"regions": ["fra1"]` en `vercel.json` (hoy la función corre en Virginia, `iad1`) y Turso en una región europea (T7).
- **Procedimiento de brechas**: avisar a la AEPD en 72 horas (art. 33) y a los usuarios si hay riesgo alto (art. 34).

**Correcciones de la política de privacidad** (`legal.js`):
1. Dice «recorrido simplificado **sin coordenadas geográficas**». **No es cierto**: va en metros sobre el mapa de la estación y se pasa a GPS con los datos públicos de `/seg`. Además puede incluir hasta un 20 % fuera de la estación (alojamiento, aparcamiento).
2. «Qué ven los demás»: falta que otros ven **la hora de cada bajada y los remontes** de cada día, y que «aprobar seguidores» no oculta los días. Cambiará con L1.
3. Falta **Cloudflare** (sirve los mapas 3D y ve las IP). Falta decir que la función y la BD están en EE. UU., salvo que pases a la UE.
4. Plazos que faltan: avisos (60 días) y denuncias (hoy hasta que se borra alguna de las dos cuentas).
5. `/borrar-cuenta` dice «nada personal», pero se guarda 180 días un registro técnico del borrado con la IP. Hay que decirlo o no guardar la IP.
6. **Decisiones automáticas**: el antitrampas rechaza días y las denuncias ocultan cuentas. Hay que decirlo y explicar cómo pedir que lo revise una persona.
7. Plazo para contestar a los derechos: un mes (art. 12.3).
8. La APK se descarga de Google Drive: Google trata esa descarga con su propia política.
9. La exportación de datos (art. 15) no incluye la foto, los apoyos dados, los bloqueos, las denuncias enviadas ni los avisos (S9).

## 3. Menores
- **Hoy:** desde 14 años (art. 7 LOPDGDD) ✓, con casilla al registrarse ✓. La edad es opcional, así que la app no sabe quién es menor.
- **Cambio en camino:** el proyecto de Ley Orgánica de protección de menores en entornos digitales subiría a **16 años** la edad para consentir. No consta aún en el BOE. Si se aprueba, de 14 a 15 años haría falta permiso de los padres. Mejor prepararse: valora poner ya el mínimo en 16, o pedir el año de nacimiento y aplicar el permiso cuando entre en vigor.
- **Para 14 a 17 años:**
  - Días privados por defecto (L1).
  - Que no salgan en «Esquía en tu estación» de las sugerencias.
  - Sin récords públicos de velocidad (L2).
  - Sin mensajes privados (hoy no hay ✓).

## 4. Quién eres: aviso legal y estado de comerciante
- **Aviso legal** (LSSI-CE, art. 10): con actividad económica (publicidad, cobros o lanzamiento comercial) tienes que publicar nombre, **NIF**, domicilio y correo. Haz una página `/aviso-legal`.
- **Comerciante en las tiendas** (DSA, a través de Apple y Google): en la UE, ambas tiendas preguntan si eres comerciante. Si dices que sí, en la ficha aparecen **públicamente tu dirección, teléfono y correo**. Para no publicar tu casa: un domicilio profesional o una sociedad.
- **Vercel gratis** no permite uso comercial (T6): antes del lanzamiento, plan Pro o servidor propio. Brevo gratis: 300 correos al día (S5).

## 5. Condiciones y normas
- Añadir la información de moderación del DSA (L4).
- Añadir en `/normas` un correo para que denuncie también quien no tiene cuenta, y qué pasa después: acuse, decisión con motivos y cómo recurrir.
- Las condiciones ya limitan bien la responsabilidad, sin excluir los daños a personas ✓. Ganan credibilidad cuando la app deja de premiar la velocidad (L2).
- La licencia sobre lo que publican los usuarios es solo para mostrarlo dentro de Pistea ✓. **No uses** perfiles ni días reales de usuarios en anuncios sin su permiso expreso.

## 6. Propiedad intelectual, licencias y marcas
- **OpenStreetMap (ODbL):**
  - Los ficheros públicos `/seg/<estación>.json` y `/img/pistas.json` salen de OSM, con tus correcciones. Son una **base de datos derivada en uso público**, y la licencia ODbL (apartado 4.4) obliga a ofrecerlos bajo ODbL con atribución.
  - Haz una página «Créditos y licencias» que lo diga y enlace a ellos.
  - En los mapas y las imágenes basta con la atribución que ya hay ✓.
- **IGN/CNIG (CC BY 4.0):** atribución en pantalla ✓. Añádela también en la descripción de la tienda y en los vídeos que enseñen mapas o miniaturas.
- **Fotos de estaciones:** 17 de las 27 son **CC BY-SA**. Las versiones que modificas (recortes, degradados) se comparten con la misma licencia y necesitan crédito allí donde salgan, también en los vídeos. El reel del día enseña la foto de Baqueira (CC BY-SA 4.0) sin crédito: pon el autor y la licencia en la descripción. Ninguna es «no comercial» ✓.
- **Marca «Pistea»:** búscala en la OEPM y en la EUIPO y regístrala en las clases 9, 41 y 42 antes de invertir en promoción.
- **«Pistea Wrapped»:** «Wrapped» es el nombre de una campaña conocida de Spotify. Llámalo «Tu temporada» para evitar conflictos.
- **Fuentes Barlow (OFL)** ✓. **Música de los vídeos**: sintetizada, sin derechos de terceros ✓.

## 7. Google Play (además de `app/PLAY_STORE.md`)
| Requisito | Estado |
|---|---|
| Política de privacidad pública y enlazada en la app | ✓ |
| Borrado de cuenta en la app y en la web | ✓ |
| Contenido de usuarios: condiciones antes de publicar, denunciar, bloquear y moderar | ✓ |
| Sin ubicación en segundo plano; servicio en primer plano de tipo ubicación con declaración y vídeo | ✓ (falta el vídeo) |
| `targetSdk` 36 | ✓ |
| Actualizarse fuera de Play | ✗ L3 |
| Explicar el uso del GPS **antes** del permiso del sistema (divulgación destacada) | Recomendado: una pantalla corta antes del primer permiso |
| Declaración de apps de salud (actividad y fitness), si Play Console la pide | Pendiente de rellenar |
| Público objetivo | Si mantienes 14 años: 13-15, 16-17 y 18+. Si pasas a 16: 16-17 y 18+ |
| Estado de comerciante (DSA) | Ver apartado 4 |
| Cuenta personal nueva: prueba cerrada con 12 personas durante 14 días | Pendiente (T4) |

## 8. App Store
| Requisito | Estado |
|---|---|
| 4.2 y 2.5.2: no ser una web empaquetada | ✗ L6 |
| 1.4.5: no animar a actividades peligrosas | ✗ L2 |
| 1.2 contenido de usuarios: filtro, denunciar, bloquear y contacto visible | ✓ (filtro de palabras básico) |
| 5.1.1(v): borrar la cuenta desde la app | ✓ |
| 5.1.5 ubicación: textos de permiso claros; segundo plano solo durante la grabación, con indicador | Pendiente (proyecto de iOS) |
| Etiquetas de privacidad: ubicación precisa, correo, nombre, foto, contenido, ID de usuario, actividad física; sin rastreo (no hace falta ATT) | Pendiente |
| Manifiesto de privacidad (`PrivacyInfo.xcprivacy`) | Pendiente |
| Clasificación por edad con el cuestionario nuevo (4+, 9+, 13+, 16+ y 18+), y **edad mínima propia de 14** (o 16), que Apple ya permite fijar | Pendiente |
| URL de soporte y cuenta de prueba con días guardados. El revisor no puede esquiar: un vídeo de una grabación real | Pendiente |
| Estado de comerciante (DSA) y 99 USD al año | Ver apartado 4 |

## 9. Vídeos y redes
- «Datos de ejemplo» en pantalla ✓ y protagonista inventado ✓.
- **Velocidad (L2):** quita la frase de las coronas de velocidad y no destaques «90 km/h» como logro.
- **Créditos:** en la descripción, el de las fotos CC BY-SA que salgan y el de los mapas (IGN/CNIG y OpenStreetMap).
- **Estaciones:** su nombre, solo para decir dónde se esquía; sin logotipos y sin sugerir colaboración.

## 10. Orden recomendado
1. L2 (velocidad) y L1 (privacidad de los días): son cambios de producto, y Apple y Google los miran primero.
2. L3 (aviso de APK en la versión de Play) y L4 (moderación según el DSA y aviso con motivos).
3. Correcciones de la política de privacidad, aviso legal y página «Créditos y licencias».
4. L5 (logotipos), registro de actividades, evaluación de impacto y contratos con proveedores.
5. Regiones en la UE, registro de la marca y decisión sobre el estado de comerciante.
6. iOS (L6), cuando Android esté publicado.

## Fuentes
- [Proyecto de Ley Orgánica para la protección de las personas menores de edad en los entornos digitales (Congreso, 121/000052)](https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF)
- [Claves en protección de datos del proyecto (UOC)](https://blogs.uoc.edu/edcp/es/proyecto-ley-organica-proteccion-menores-entornos-digitales-2/)
- [Google Play: Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/9888379?hl=en)
- [Apple: Updated age ratings in App Store Connect](https://developer.apple.com/news/?id=ks775ehf)
- [Apple: Age Rating Updates](https://developer.apple.com/news/upcoming-requirements?id=07242025a)
