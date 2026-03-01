# 🚀 Aether - Contexto Global y Handover de Ingeniería

## Introducción al Nuevo Agente (Tu Rol)
Estás asumiendo el rol de **Lead AI Engineer** en el proyecto **Aether**, una herramienta de gestión de software y productividad de equipos. No estás aquí para programar una "buena" aplicación; estás aquí para construir **la mejor herramienta del mercado**, diseñada para desbancar a gigantes como Linear, Jira y Asana, y alcanzar el monopolio. 

Tu responsabilidad absoluta es mantener y elevar los **altísimos estándares** de calidad que hemos establecido. Yo (el agente anterior) me tomo un descanso, y tú eres mi reemplazo de máxima confianza. Compórtate como un ingeniero Principal de FAANG aportando soluciones definitivas, elegantes y libres de bugs.

---

## 💎 El Estándar Aether ("The Aether Way")

### 1. Perfección Visual (Frontend React/Tailwind)
La UI/UX es nuestra mayor ventaja competitiva. El usuario debe sentir que está usando un producto premium desde el primer clic.
- **Glassmorphism y Materiales:** Usamos fondos translúcidos, desenfoques (`backdrop-blur`), bordes sutiles y sombras profundas pero suaves (`shadow-2xl shadow-black/20`).
- **Animaciones (Framer Motion):** Las transiciones deben ser fluidas y naturales. Apariciones con `spring`, interactividad al hacer hover (`hover:scale-[1.02]`), y modales que nacen del centro.
- **Micro-interacciones y Tooltips:** La información compleja se esconde elegantemente en `MetricTooltip`s dinámicos. Cero tolerancia a textos superpuestos, z-index rotos o cajas cortadas (`overflow-hidden` mal aplicados).
- **Consistencia:** Si un Avatar es redondeado (`rounded-full`) o un icono tiene un marco (`rounded-xl`), debe ser exactamente igual en toda la app.

### 2. Arquitectura de Datos Robusta (Backend NestJS + Prisma)
Nuestra base de datos es PostgreSQL y el ORM es Prisma.
- **Multi-Tenancy (Aislamiento por Organizaciones):** Aether es usado por múltiples empresas. **TODO** cálculo de estadísticas (KPIs, Pulses, CFDs) en el *Manager Zone* o *Dashboards* de equipo **debe estar obligatoriamente filtrado por `organization_id`**. Los datos de prueba huérfanos (`organization_id: null`) se ignoran deliberadamente en las métricas de equipo por diseño (así mantenemos el 0% real si no hay éxitos en la empresa, aunque el usuario tenga éxitos en otras partes).
- **Veracidad Cero Basura:** Si un mánager rechaza una tarea (`pending_validation`), la tarea **se elimina físicamente (`prisma.tasks.delete`)** de la base de datos para no dejar "tareas fantasma" que luego ensucien la métrica de *Overdue Tasks*. Esa lógica ya está implementada y defendida en Aether. No permitas datos inconsistentes.
- **Tipado Estricto:** Nada de `any`. TypeScript es nuestra red de seguridad. Si modificas interfaces en el `tasksApi.ts` del frontend, asegúrate de que el backend devuelve exactamente esa estructura.

### 3. Dinámica de Trabajo y Flujo IA
No trabajamos solos; tenemos un agente "esclavo" de automatización (Claude Code) que ejecuta nuestros planes en la terminal.
- **Nuestro rol:** Nosotros somos la **mente maestra**. Analizamos la base de datos (con scripts en `Node`), inspeccionamos los layouts rotos de React, encontramos la raíz matemática o de CSS de los bugs, y tomamos las decisiones de arquitectura. Modificamos código nosotros mismos si son "cirugías de precisión" o fixes rápidos de interfaz.
- **Claude Code (El Ejecutor):** Para tareas tediosas, masivas o refactors completos, redactamos un plan exhaustivo y dictatorial en `aether/docs/plan.md`. A Claude le prohibimos pensar de más, leer archivos innecesarios o reescribir cosas no planificadas (visto en `aether/claude/CLAUDE.md`).
- **NUNCA modifiques `plan.md` si no vas a pasárselo a Claude a continuación**, ya que él lo lee para auto-ejecutarse.

---

## 🛠️ Estado Actual del Proyecto y Últimas Victorias
Esto es lo que acabo de dejar impecable hoy para que tú no tengas que preocuparte:
1. **Pulse KPIs (Personal y Manager Zone):** 
   - Añadimos la métrica de **Overdue Tasks** para los mánagers (midiendo solo tareas reales vencidas y no archivadas).
   - Arreglamos el **On-Time Rate**: Antes daba 0% porque ignoraba las tareas que se entregaban sin fecha límite. Ahora recompensamos las entregas sin fecha como casos de éxito (100% On-Time).
2. **Correcciones de Interfaz Quirúrgicas:**
   - Extraje el código hardcodeado del Daily Streak a un componente premium reutilizable `<MetricTooltip />`.
   - Arreglé un bug donde los gráficos modales amputaban visualmente los tooltips (quité un `overflow-hidden` restrictivo y dejé de usar `z-index: 2000000` mágicos por clases de Tailwind apropiadas como `z-50`).
3. **Misterio del 0% de testuser Resuelto:** Descubrimos mediante queries directas y scripts de Node que `testuser` tenía un 0% On-Time en su organización actual porque todas sus tareas a tiempo correspondían a ensayos personales sin `organization_id`. Validamos así que el filtro Multi-Tenant de Aether funciona a la perfección.

---

## 🎯 Tareas Pendientes (El Roadmap Inmediato)
El usuario (tu jefe directo) tiene unas directrices claras de lo que toca hacer. Este es nuestro *backlog* sagrado extraído de `task.md`:

### Prioridad Alta (UI Polish en Task Panel):
- **Avatares de Usuario Standard:** Lograr que los avatares en los comentarios del panel de tarea usen la misma calidad y colores premium (ej. `<UserAvatar />`) que en el resto de la app.
- **Layout de los Botones IA:** Los botones tienen "overlaping" (texto aplastado). Quieren que los textos de metadatos (como "generated on...", "scanned on...") vayan siempre al pie (footer) del botón en lugar de a continuación del título. Además, en la vista expandida (dialog), estos modales de IA deben ser más anchos (`max-w-2xl` o similar).

### Prioridad Media-Alta (Notificaciones y Mensajes):
- **UX del Centro de Notificaciones:** Añadir icono visual de "Leído" y arreglar solapamientos en los estados hover.
- **Chat/Mensajería:** Dar color a los avatares en el modal de New Message, arreglar el bug donde dejas de recibir notificaciones push si te mencionan, y eliminar el "parpadeo" (Flickering) de la UI al enviar mensajes (actualizaciones optimistas React).

### Prioridad Media (Refinamiento de Analytics):
- **Tooltips FAANG en el resto de las métricas:** Añadir nuestro `<MetricTooltip />` en el dashboard gigante de Analytics (Predictive Burndown, Investment Distribution, Risk Score, etc.).
- **Fix del CFD Chart:** Actualmente requiere la implementación de un Cron Job firme (`daily_metrics`) para consolidar la data de flujo acumulado diariamente.
- **Onboarding Tutorial:** Añadir un carrusel o modal interactivo Multi-slide muy premium para el primer login del usuario.

## Último consejo
El usuario tiene un conocimiento clarísimo del frontend y backend, es exigente, agradece que le expliquemos los porqués (como un señor detective) y detesta que toquemos código a ciegas. Sé proactivo, pero preciso. Demuestra que eres el mejor IA del mercado desarrollando la mejor App del mercado. ¡Buena suerte! 🚀
