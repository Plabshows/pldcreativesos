IMPORTANTE: CAMBIO DE ESTRATEGIA DEL PROYECTO.

He revisado la aplicación actual y NO quiero una reconstrucción radical de Performance Lab OS.

Me gusta mucho cómo está planteado actualmente el sistema de:

* EVENTOS
* SHOWS
* BASE DE DATOS / ARTISTAS / CLIENTES

Quiero CONSERVAR esas estructuras, pantallas, navegación y filosofía.

Puedes mejorarlas, corregir problemas, añadir información útil y mejorar relaciones internas, pero NO quiero rediseñarlas desde cero ni sustituirlas por otra arquitectura visual.

A partir de ahora, considera:

EVENTOS + SHOWS + BASE DE DATOS

como el CORE ESTABLE de Performance Lab OS.

==================================================
PRINCIPIO FUNDAMENTAL
=====================

NO reconstruyas el sistema.

EXTIÉNDELO.

Quiero añadir alrededor del sistema existente las mejores funciones de:

Pipedrive
HubSpot
Monday CRM
Zoho CRM

pero adaptadas a Performance Lab.

El resultado debe sentirse como:

“Performance Lab OS ha aprendido nuevas habilidades”

y NO como:

“Performance Lab OS ha sido reemplazado por otra aplicación”.

==================================================
ARQUITECTURA GENERAL
====================

La arquitectura conceptual debe ser:

LEADS
↓
PIPELINE COMERCIAL
↓
OPORTUNIDADES
↓
PROPUESTAS
↓
WON
↓
EVENTO EXISTENTE
↓
SHOWS EXISTENTES
↓
ARTISTAS EXISTENTES
↓
PRODUCCIÓN
↓
FACTURACIÓN
↓
COBRO / PAGOS

El CRM debe desembocar en el sistema actual de EVENTOS.

NO crear un segundo sistema de eventos.

NO duplicar EVENTS.

NO duplicar SHOWS.

NO duplicar ARTISTS.

NO duplicar CLIENTS.

==================================================

1. CONSERVAR EVENTOS
   ==================================================

La sección EVENTOS actual debe permanecer reconocible tal y como está.

Me gusta:

* su estructura
* sus fichas
* la forma de visualizar eventos
* su funcionamiento general
* su relación con clientes
* su integración dentro del workspace

NO reemplazarla por un sistema de proyectos genérico.

Mejoras permitidas:

* filtros
* búsqueda
* estados
* información incompleta
* artistas
* shows
* costes
* timings
* tareas
* documentos
* pagos
* alertas
* salud del evento
* automatizaciones

Pero deben añadirse SOBRE la ficha y estructura actual.

==================================================
2. CONSERVAR SHOWS
==================

La actual base de SHOWS me gusta.

No crear una nueva biblioteca independiente si ya existe.

Mejorarla progresivamente con:

* fotografías
* vídeos
* categorías
* descripción
* precio orientativo
* coste aproximado
* número de artistas
* duración
* sets
* requisitos
* artistas compatibles
* vestuario
* eventos donde ha sido contratado
* ingresos históricos
* rentabilidad

Pero manteniendo la estructura existente.

==================================================
3. CONSERVAR BASE DE DATOS
==========================

Mantener la actual base de datos de:

ARTISTAS

CLIENTES

SHOWS

EVENTOS.

Añadir campos o relaciones cuando sea necesario.

No rehacer el diseño completo.

No convertirlo en un Excel.

No sustituirlo por tablas gigantes.

==================================================
4. CREAR MÓDULO LEADS
=====================

Quiero añadir una sección:

LEADS.

Un Lead es una consulta comercial que todavía no es necesariamente un evento confirmado.

Campos:

Lead name

Company / client

Contact person

Email

Phone

WhatsApp

Event type

Possible event date

City

Country

Venue

Estimated budget

Source

Responsible user

Status

Last activity

Next action

Notes.

LEAD SOURCE:

Instagram

Website

WhatsApp

Email

Referral

Agency

Existing client

Google

LinkedIn

Other.

==================================================
5. PIPELINE COMERCIAL
=====================

Ya existe conceptualmente Pipeline Comercial en el sistema.

Quiero convertirlo en una herramienta real.

Vista principal:

KANBAN.

Estados:

NEW LEAD

CONTACTED

QUALIFIED

PROPOSAL NEEDED

PROPOSAL SENT

FOLLOW UP

NEGOTIATION

VERBAL YES

WON

LOST.

Permitir Drag & Drop.

Cada tarjeta debe mostrar de forma compacta:

Client

Event

Date

Location

Value

Last activity

Next action.

==================================================
6. NO MEZCLAR PIPELINE Y EVENTOS
================================

Esto es muy importante.

PIPELINE responde:

¿Voy a conseguir este trabajo?

EVENTOS responde:

¿Cómo gestiono este trabajo?

Cuando una oportunidad pasa a:

WON

debe aparecer una acción:

CREATE EVENT

o

LINK EXISTING EVENT.

CREATE EVENT utilizará exactamente el SISTEMA DE EVENTOS ACTUAL.

No crear una versión alternativa.

==================================================
7. CONVERTIR LEAD EN CLIENTE
============================

Si un Lead nuevo termina siendo real:

Convert to Client.

El sistema debe comprobar antes:

¿Existe ya este cliente?

¿Existe este contacto?

Evitar duplicados.

Al convertirlo:

conservar toda la información y actividad.

==================================================
8. OPPORTUNITIES / DEALS
========================

Crear Opportunity asociada a:

Lead

Client

Contact.

Campos:

Opportunity name

Client

Estimated value

Probability

Expected close date

Event date

Location

Event type

Lead source

Owner

Stage

Last activity

Next action.

==================================================
9. NEXT ACTION
==============

Esta es una de las funcionalidades más importantes.

Toda oportunidad debe tener:

NEXT ACTION.

Ejemplos:

Call client

WhatsApp client

Send proposal

Follow up

Confirm budget

Ask event date

Ask venue

Schedule meeting.

Mostrar siempre:

Action

Date

Responsible person.

==================================================
10. DEAL ROT / FOLLOW-UP ALERT
==============================

Detectar automáticamente oportunidades olvidadas.

Ejemplo:

3 días sin actividad

Yellow.

7 días

Orange.

14 días

Red.

Mostrar:

NO ACTIVITY FOR 8 DAYS.

NO NEXT ACTION.

Acción rápida:

FOLLOW UP.

==================================================
11. PROPUESTAS
==============

Mantener / mejorar el actual concepto de propuesta.

Quiero poder crear una propuesta usando directamente mis SHOWS existentes.

Ejemplo:

CLIENT:
Wedding X

ADD SHOW:

PomPom Monsters.

Quantity:
4.

Price:
€400 each.

Después:

Mirror Characters

2 performers

€350 each.

Extras:

Transport

Flights

Accommodation

Creative Direction

Production.

Calcular total.

==================================================
12. ESTADOS DE PROPUESTA
========================

Estados:

DRAFT

READY

SENT

VIEWED

FOLLOW UP

ACCEPTED

DECLINED

EXPIRED.

Si pasa a:

ACCEPTED

mostrar:

CREATE EVENT.

El evento creado debe usar el sistema de eventos que ya existe.

==================================================
13. CLIENT 360
==============

NO rehacer completamente la pantalla de cliente.

Mejorar la ficha existente añadiendo módulos.

Mostrar:

Total events

Lifetime revenue

Outstanding

Last event

Next event

Open opportunities

Proposals

Last activity

Next action.

Añadir tabs o bloques:

EVENTS

OPPORTUNITIES

PROPOSALS

TASKS

ACTIVITY

FINANCE.

==================================================
14. ACTIVITY TIMELINE
=====================

Añadir cronología dentro de clientes y oportunidades.

Ejemplo:

13 SEP

Proposal sent.

WhatsApp follow-up.

Client answered.

Event created.

12 SEP

Lead created from website.

La Activity Timeline puede incluir:

EMAIL

WHATSAPP

CALL

NOTE

TASK

PROPOSAL

STATUS CHANGE

EVENT CREATED

PAYMENT.

==================================================
15. TASK SYSTEM
===============

Mejorar la sección de tareas ya existente.

Cada Task puede estar relacionada con:

Client

Lead

Opportunity

Proposal

Event

Artist.

Campos:

Title

Due date

Priority

Responsible

Status

Related entity.

==================================================
16. MI DÍA
==========

Conservar la pantalla MI DÍA actual.

Me gusta el concepto.

Quiero hacerla mucho más potente.

Debe mostrar:

TODAY EVENTS

UPCOMING EVENTS

TODAY TASKS

OVERDUE TASKS

FOLLOW UPS NEEDED

PROPOSALS WAITING RESPONSE

EVENTS NEEDING ATTENTION

INVOICES TO COLLECT

ARTIST PAYMENTS

IMPORTANT ALERTS.

La pregunta que debe responder esta página es:

“¿Qué necesita mi atención hoy?”

==================================================
17. CRM NOTIFICATIONS
=====================

Añadir alertas como:

Proposal unanswered for 5 days.

Client needs follow-up.

Event tomorrow.

Event missing performers.

Invoice overdue.

Artist payment pending.

Lead has no next action.

Opportunity inactive.

==================================================
18. FORECAST
============

Utilizar las oportunidades para calcular:

TOTAL PIPELINE

WEIGHTED PIPELINE

EXPECTED REVENUE 30 DAYS

EXPECTED REVENUE 90 DAYS.

Ejemplo:

Opportunity:
€10,000

Probability:
50%

Weighted:
€5,000.

==================================================
19. QUICK CRM ACTIONS
=====================

Añadir acciones rápidas:

NEW LEAD

NEW OPPORTUNITY

NEW PROPOSAL

NEW TASK

FOLLOW UP.

Mantener las existentes:

NEW CLIENT

CREATE EVENT.

==================================================
20. GLOBAL SEARCH
=================

Mejorar CMD + K.

Debe encontrar:

Clients

Artists

Events

Shows

Leads

Opportunities

Proposals

Tasks.

También comandos:

Create Lead

Create Event

Create Proposal

Create Task.

==================================================
21. EVENT HEALTH
================

NO cambiar la ficha de evento.

Añadir encima o dentro de ella un pequeño indicador:

EVENT HEALTH.

Ejemplo:

READY

78%.

Checks:

Client confirmed

Venue

Shows

Artists

Timings

Travel

Production

Invoice.

Mostrar solo información útil.

==================================================
22. ARTISTAS EN EVENTOS
=======================

Conservar la forma actual de trabajar con artistas dentro de eventos.

NO cambiar la UX si ya funciona bien.

Si técnicamente hace falta mejorar la relación de base de datos entre:

EVENT

ARTIST

SHOW

puedes hacerlo internamente mediante una tabla relacional.

Pero esto NO debe obligar a reconstruir la interfaz actual.

El usuario debe seguir sintiendo que utiliza el mismo sistema de eventos.

==================================================
23. DISPONIBILIDAD
==================

Añadir progresivamente:

AVAILABLE

OPTION

BOOKED

UNAVAILABLE.

Desde evento:

CHECK AVAILABILITY.

Poder filtrar artistas por:

City

Skill

Show

Availability.

==================================================
24. CONFLICT DETECTION
======================

Si intento añadir un artista que ya tiene un evento:

WARNING:

POSSIBLE BOOKING CONFLICT.

No impedir automáticamente la acción.

Mostrar información y dejar decidir al administrador.

==================================================
25. FINANZAS
============

Mantener la actual sección:

ECONOMÍA DE LOS EVENTOS.

Mejorarla.

No crear un ERP financiero gigantesco.

Cada evento debe poder tener:

Client revenue

Artist costs

Transport

Flights

Accommodation

Production

Other costs.

Calcular:

REVENUE

COST

PROFIT

MARGIN.

==================================================
26. MONEY TO COLLECT
====================

Crear vista:

MONEY TO COLLECT.

Mostrar:

Client

Event

Invoice

Amount

Due date

Status.

==================================================
27. MONEY TO PAY
================

Crear vista:

MONEY TO PAY.

Mostrar:

Artist

Event

Amount

Status.

==================================================
28. AUTOMATIONS
===============

Añadir automatizaciones sencillas y útiles.

Ejemplos:

WHEN Proposal accepted

THEN suggest Create Event.

WHEN Opportunity Won

THEN suggest Create Event.

WHEN Event completed

THEN create task “Invoice client”.

WHEN Invoice overdue

THEN create follow-up task.

WHEN Opportunity inactive

THEN alert owner.

WHEN Event approaching AND information missing

THEN alert production.

==================================================
29. GMAIL
=========

Preparar integración.

Objetivo:

Email received

↓

Identify Client / Contact

↓

Add Activity

↓

Allow:

Create Lead

Create Task

Create Opportunity

Create Event.

No rehacer el CRM alrededor de Gmail.

Gmail es una fuente más de información.

==================================================
30. GOOGLE CALENDAR
===================

Eventos confirmados pueden sincronizarse con Calendar.

Objetivo:

Performance Lab OS = source of truth.

Google Calendar = calendar representation.

No al revés.

==================================================
31. WHATSAPP
============

Dejar preparada arquitectura para futura integración.

Especialmente útil para:

Client communication

Artist availability

Booking confirmations.

Pero NO bloquear el desarrollo actual si la integración de WhatsApp requiere API externa.

==================================================
32. LEAD CAPTURE
================

Preparar endpoints/formularios para crear Leads desde:

Website

Manual entry

Email

Instagram / social media in future

WhatsApp in future.

Todos deben acabar dentro del mismo módulo Leads.

==================================================
33. LEAD SCORING SIMPLE
=======================

No crear IA compleja inicialmente.

Crear puntuación básica basada en:

Existing client

Budget

Event date

Location

Response activity

Proposal requested.

Ejemplo:

HOT

WARM

COLD.

==================================================
34. LOST REASONS
================

Cuando Opportunity sea LOST:

pedir opcionalmente motivo:

Too expensive

No availability

Client cancelled

Competitor

Date conflict

No response

Event cancelled

Other.

Esto permitirá aprender qué trabajos estamos perdiendo.

==================================================
35. SALES ANALYTICS
===================

Añadir:

Leads this month

Opportunities

Proposals sent

Won

Lost

Conversion rate

Pipeline value

Average deal value

Revenue by lead source

Lost reasons.

==================================================
36. CLIENT ANALYTICS
====================

Añadir sin cambiar la base de clientes:

Top clients

Revenue per client

Events per client

Average event value

Outstanding payments

Last booking.

==================================================
37. SHOW ANALYTICS
==================

Utilizando los SHOWS existentes:

Times booked

Revenue

Average selling price

Clients

Events

Markets

Estimated profitability.

==================================================
38. ARTIST ANALYTICS
====================

Utilizando ARTISTAS existentes:

Events worked

Next event

Amount earned

Amount paid

Amount pending

Most common shows.

==================================================
39. ASK LAB
===========

Más adelante añadir asistente:

ASK LAB.

Debe consultar la base de datos existente.

Ejemplos:

Who needs a follow-up?

What proposals are waiting?

What events do I have this weekend?

Which events are missing artists?

Who owes me money?

How much do I owe performers?

Which clients have not booked this year?

What is my current pipeline?

Which opportunities are likely to close?

No inventar datos.

==================================================
40. UI / UX
===========

MUY IMPORTANTE:

NO cambiar radicalmente la identidad visual actual.

Extender el mismo design system.

Las nuevas pantallas deben parecer parte natural de Performance Lab OS.

Especialmente:

Pipeline

Leads

Opportunities

Proposals

Tasks

Notifications.

Utilizar:

Cards

Kanban

Badges

Drawers

Modals

Timelines

Filters

Search.

No crear apariencia de software contable viejo.

==================================================
41. NAVEGACIÓN
==============

Mantener navegación actual.

Añadir de manera lógica:

MI DÍA

CRM
Leads
Pipeline
Proposals

EVENTOS

SHOWS

BASE DE DATOS
Clients
Artists

FINANCE

TASKS

Opcionalmente:

ANALYTICS.

No llenar el sidebar con 30 secciones.

==================================================
42. PRIORIDADES
===============

Implementar en este orden:

PHASE A — CRM ESSENTIALS

1. Leads

2. Opportunities

3. Pipeline Kanban

4. Next Action

5. Follow-up alerts.

PHASE B — SALES

6. Proposal improvements

7. Proposal → Event

8. Forecast

9. Activity timeline.

PHASE C — OPERATIONS ENHANCEMENT

10. Event Health

11. Artist availability

12. Conflict detection

13. Better tasks.

PHASE D — MONEY

14. Event profitability

15. Money to collect

16. Money to pay.

PHASE E — AUTOMATION

17. Notifications

18. Automations.

PHASE F — INTEGRATIONS

19. Gmail

20. Calendar

21. WhatsApp architecture.

PHASE G — AI

22. Ask Lab.

==================================================
43. LO QUE NO QUIERO
====================

NO cambiar EVENTOS por otro sistema.

NO cambiar SHOWS por otro sistema.

NO reconstruir la base de artistas.

NO reconstruir clientes.

NO crear entidades duplicadas.

NO cambiar toda la navegación.

NO rehacer toda la UI.

NO modificar componentes que funcionan únicamente porque exista una forma técnicamente más elegante.

NO intentar convertirlo en Salesforce.

==================================================
44. REGLA DE DESARROLLO
=======================

Antes de tocar un módulo existente:

pregúntate:

“¿Necesito realmente modificarlo para implementar la nueva función?”

Si la respuesta es NO:

NO LO TOQUES.

Añade la nueva funcionalidad alrededor.

==================================================
45. EXPERIENCIA FINAL QUE QUIERO
================================

Ejemplo:

Entra una petición para un evento corporativo.

Creo:

LEAD.

Lo muevo por:

PIPELINE.

Creo:

PROPOSAL.

Hago:

FOLLOW UP.

Cliente acepta.

Marco:

WON.

Pulso:

CREATE EVENT.

Y en ese momento entro exactamente en mi sistema actual de EVENTOS.

Desde allí continúo trabajando como hasta ahora:

Shows.

Artists.

Timings.

Production.

Costs.

Event.

Invoice.

Payment.

ESTE ES EL FLUJO CORRECTO.

No quiero que la introducción del CRM destruya la herramienta de eventos que ya hemos conseguido construir.

Quiero que la complete.

==================================================
OBJETIVO FINAL
==============

Performance Lab OS debe evolucionar desde una buena herramienta de gestión de eventos a:

CRM
+
EVENT MANAGEMENT
+
SHOW DATABASE
+
ARTIST DATABASE
+
PRODUCTION
+
FINANCIAL CONTROL
+
AUTOMATION
+
AI.

Pero la evolución debe ser progresiva.

Mantén lo que funciona.

Mejora lo que pueda mejorarse.

Añade lo que falta.

No reconstruyas innecesariamente.
