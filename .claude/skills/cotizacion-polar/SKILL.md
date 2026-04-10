---
name: cotizacion-polar
description: >
  Skill para crear cotizaciones profesionales de Polar Multimedia en formato Excel (.xlsx) con
  la metodología y estructura oficial de la agencia. USAR SIEMPRE que Roberto o el equipo Polar
  pida: "crea una cotización", "hazme un presupuesto", "cotiza este evento", "necesito la cotiz",
  "arma la propuesta económica", "cuánto costaría", o cualquier solicitud de cotización de
  producción, evento, lanzamiento, congreso médico o campaña pharma. También aplica si el usuario
  pide revisar, actualizar o regenerar una cotización existente.
---

# Cotización Polar — Metodología Oficial 2026

## Propósito

Generar cotizaciones de eventos y producción para Polar Multimedia con el formato correcto,
precios reales de sedes, y la estructura por secciones que Polar usa internamente y con clientes.

---

## Estructura del archivo Excel

### Columnas (6 columnas, sin FEE)

| Col | Header            | Contenido |
|-----|-------------------|-----------|
| B   | Descripción       | Nombre del ítem o sección |
| C   | Cantidad          | Número de unidades |
| D   | Costo Unitario    | Precio unitario en MXN |
| E   | Ediciones         | Número de repeticiones (ej. 3 fechas) |
| F   | Subtotal          | =C*D*E (fórmula automática) |
| G   | Total sin IVA     | =F (igual al subtotal — **sin columna de FEE**) |

> **IMPORTANTE:** Polar decidió no cobrar ni mostrar la columna de FEE en cotizaciones.
> El Total sin IVA = Subtotal directamente. No agregar columna de fee aunque el cliente
> sea importante o aunque parezca "faltante".

### Dimensiones y estilo visual

- Fila de encabezado: bold, fondo azul oscuro (`#1F3864`), texto blanco, altura 20pt
- Filas de sección (headers internos): bold, fondo azul medio (`#2F5496`), texto blanco
- Filas de ítem normales: fondo blanco o gris claro alterno
- Filas de subtotal: bold, fondo gris (`#D9E1F2`)
- Fila de TOTAL GENERAL: bold, fondo azul oscuro, texto blanco
- Fuente: Calibri 10pt para ítems, 11pt para encabezados
- Moneda: formato `$#,##0` (pesos MXN sin decimales)
- Columna B (descripción): ancho 45, wrap text
- Columnas C, D, E: ancho 12
- Columnas F, G: ancho 16

---

## Organización por secciones

Una cotización de evento típica de Polar incluye estas secciones en este orden:

### S1 — Concepto y Campaña Digital
Incluye todo el trabajo creativo e intangible:
- Concepto creativo y narrativa del evento
- Telemarketing / invitaciones digitales
- Sistema de app o plataforma tecnológica (registro, votación, etc.)
- Producción de video de introducción / teaser
- Campaña de comunicación pre-evento (email, WhatsApp, redes)

### S2 — Producción de Sede (por cada sede o fecha)
Todo lo que Polar instala físicamente en el salón:
- Escenario con tapanco (estructura metálica + madera, aprox 80cm altura)
- Pantalla LED (ej. 7x3m en tapanco, resolución P3/P4)
- Iluminación de escenario (fresneles, cañones, back light)
- Señalización de bienvenida y branding en entrada/corredor
- Kit de mesa (block, pluma, material educativo por participante)

### S3 — Audio y Video
- Sistema de audio ambiente (línea de arreglo o columnas)
- Set de micrófonos (manos + diademas)
- Iluminación general del salón (wash LED)
- Coordinación técnica AV (1-2 técnicos por sesión)

### S4, S5, S6... — Sedes específicas
Una sección por sede/ciudad, con:
- Cena/banquete (costo por persona × número de participantes)
- Estacionamiento (costo por persona × número de participantes)
- Salón (si aplica — muchas veces incluido en el paquete del hotel)
- Transporte de personal Polar (si aplica)

> **NOTA:** Los ítems de "traslados de ponentes" o "transporte de asistentes" NO siempre
> aplican. Preguntar explícitamente antes de incluirlos.

---

## Metodología de precios de sedes

### Fuente de precios reales
Los precios reales de hoteles y sedes se obtienen del archivo **"Control de Eventos"** del
cliente o de cotizaciones directas. Este archivo contiene:
- Costo de cena/banquete por persona
- Costo de estacionamiento por persona
- Costo de salón (si aplica)
- Número de participantes esperados

### Ajuste de precios para cotización
Al cotizar sedes para una propuesta:
1. Tomar el precio real del Control de Eventos
2. **Subir ~60%** (para cubrir coordinación, logística y margen Polar)
3. **Redondear a doble cero** (múltiplos de 100) para que se vea natural
4. Verificar que el precio "suene sensato" para el mercado

**Ejemplo:**
- Real: $1,123/persona → +60% = $1,797 → Redondeado: **$1,800/persona**
- Real: $97/persona estacionamiento → +60% = $155 → Redondeado: **$160/persona**

### Ítems en CORTESÍA
**Polar NO pone ítems en CORTESÍA.** Si un servicio se incluye sin costo adicional
(ej. acceso a plataforma), se omite de la cotización o se incluye dentro de otro ítem
con precio real. No escribir "$0" ni "CORTESÍA" en ninguna fila visible al cliente.

---

## Descripciones de ítems de producción

Las descripciones deben ser específicas y técnicas, no genéricas. Ejemplos correctos:

| ❌ Genérico           | ✅ Correcto |
|----------------------|------------|
| "Escenario"          | "Escenario con tapanco metálico 10x3m a 80cm de altura con faldón" |
| "Pantalla"           | "Pantalla LED P3 7x3m montada en tapanco con estructura de soporte" |
| "Audio"              | "Sistema de audio línea de arreglo 2x1000W stereo + amplificación" |
| "Micrófonos"         | "Set de micrófonos: 3 de mano + 2 diademas inalámbricos UHF" |
| "Luz salón"          | "Sistema de iluminación periférica salón: 8 wash LED RGB" |
| "Invitaciones"       | "Sistema de invitaciones personalizado con video de introducción y boleto electrónico QR de acceso" |

---

## Fórmulas y código Python para generación

### Función base de ítem

```python
def item(ws, r, desc, cant, costo, edic, tall=False):
    """Agrega una fila de ítem a la cotización."""
    ws.cell(r, 2, desc)
    ws.cell(r, 3, cant)
    ws.cell(r, 4, costo)
    ws.cell(r, 5, edic)
    ws.cell(r, 6, f'=C{r}*D{r}*E{r}')   # Subtotal
    ws.cell(r, 7, f'=F{r}')              # Total = Subtotal (sin FEE)
    if tall:
        ws.row_dimensions[r].height = 30
```

### Función de subtotal de sección

```python
def stotal(ws, sr, item_rows):
    """Agrega fila de subtotal sumando las filas indicadas."""
    f = '+'.join([f'G{r}' for r in item_rows])
    ws.cell(sr, 2, 'Subtotal sección')
    ws.cell(sr, 7, f'={f}')
```

### Total general

```python
# El total general suma los subtotales de cada sección (en col G)
ws.cell(total_row, 2, 'TOTAL SIN IVA')
ws.cell(total_row, 7, f'=G{s1_row}+G{s2_row}+G{s3_row}+...')
```

---

## Concepto creativo: NORMA MUNDIAL 2026

Para el evento Enteronorma B-Vit / Carnot Laboratorios, el concepto es **"Doble Protección:
El Partido"** con la narrativa de la NORMA MUNDIAL 2026.

**NORMA** funciona en tres niveles:
1. **Norma como estándar médico**: la NORMA MUNDIAL 2026 es el nuevo estándar de protección
   intestinal (Enteronorma)
2. **Norma como marca del evento**: el torneo/partido lleva nombre oficial como copa mundial
3. **Norma como personaje IA**: una comentarista con voz y presencia en LED que da datos del
   "partido" (resultados de votación, estadísticas educativas, marcador MEX vs SA)

### Restricciones de branding del cliente
- **Dentro del salón**: ZERO branding físico de Enteronorma. Solo electrónico en pantalla LED.
- **Entrada y corredores**: branding de bienvenida instalado por Polar con logo Enteronorma.
- La pantalla LED es el espacio principal de comunicación de marca durante el evento.

### Mecánica del evento
- Formato partido de fútbol/mundial con 2 tiempos
- Los asistentes (médicos) votan A/B/C desde su celular mediante código QR
- Pantalla LED muestra marcador, votaciones en tiempo real y mensajes de NORMA
- El MC conduce en "tono deportivo" mientras se comunican beneficios del producto

---

## Flujo de trabajo recomendado

1. **Leer el Brief** del evento para entender alcance, fechas, ciudades y número de participantes
2. **Consultar Control de Eventos** del cliente para precios reales de sedes
3. **Confirmar secciones** que aplican (¿hay traslados? ¿ponentes externos? ¿cuántas sedes?)
4. **Generar el Excel** con openpyxl usando las funciones de este skill
5. **Verificar totales** antes de compartir — revisar que cada sección suma correctamente
6. **Guardar** en la carpeta `cotizaciones/` del proyecto con nombre:
   `Cotización [NombreEvento] [Cliente].xlsx`

---

## Ejemplo de estructura de un evento 3 sedes

```
CONCEPTO Y CAMPAÑA DIGITAL
  Concepto creativo y narrativa del evento        1   $65,000   1   $65,000   $65,000
  Telemarketing e invitaciones personalizadas     1   $18,000   1   $18,000   $18,000
  Sistema app votación/registro                   1   $80,000   1   $80,000   $80,000
  Producción video de introducción                1   $35,000   1   $35,000   $35,000
  Campaña de comunicación pre-evento              1   $12,000   1   $12,000   $12,000
  Subtotal                                                                   $210,000

PRODUCCIÓN DE SEDE (×3 eventos)
  Escenario tapanco 10x3m a 80cm con faldón       1   $35,000   3  $105,000  $105,000
  Pantalla LED P3 7x3m + estructura soporte       1   $65,000   3  $195,000  $195,000
  Iluminación de escenario fresneles + back       1    $9,000   3   $27,000   $27,000
  Señalización bienvenida + branding entrada      1   $15,000   3   $45,000   $45,000
  Kit de mesa (block, pluma, material) ×100p    100     $420    3  $126,000  $126,000
  Subtotal                                                                   $498,000
...
```

---

## Archivos de referencia

- `cotizaciones/Cotizaciones Aprobadas Adium 2026.xlsx` — Formato Adium como referencia de estilo
- `cotizaciones/Cotización Doble Protección Enteronorma B-Vit.xlsx` — Cotización v6 activa
- `cotizaciones/Control de Eventos CARNOT.xlsx` — Precios reales de sedes Carnot 2026
