// ─────────────────────────────────────────────────────────────────────
//  SISTEMA DE STATS Y LOGROS — Doble Protección: El Partido
//  Enteronorma B-Vit · Carnot Laboratorios · Polar Multimedia 2026
// ─────────────────────────────────────────────────────────────────────

// Máximo posible por jugada: 100 pts por stat
// Total 8 jugadas = 800 pts máximo por stat
const MAX_JUGADAS = 8;
const MAX_PTS     = 800;

// ── DEFINICIÓN DE STATS ──────────────────────────────────────────────
const STATS_DEF = {
  precision: {
    nombre: 'Precisión',
    icon:   '🎯',
    color:  '#4ECBCA',
    desc:   '% de respuestas correctas del grupo',
    logros: [
      { nivel: 1, umbral: 200, badge: '🥉', nombre: 'Agente Inmune',
        desc: 'Los linfocitos están activos y respondiendo' },
      { nivel: 2, umbral: 450, badge: '🥈', nombre: 'Escudo de Bacillus',
        desc: 'La microbiota resiste. La sala conoce el mecanismo' },
      { nivel: 3, umbral: 680, badge: '🥇', nombre: 'Espora de Acero',
        desc: '4,000 millones de esporas imparables. Conocimiento total' },
    ],
  },
  velocidad: {
    nombre: 'Velocidad',
    icon:   '⚡',
    color:  '#F5C518',
    desc:   'Rapidez de respuesta del grupo',
    logros: [
      { nivel: 1, umbral: 200, badge: '🏃', nombre: 'Respuesta Rápida',
        desc: 'El organismo actúa antes que el patógeno avance' },
      { nivel: 2, umbral: 450, badge: '⚡', nombre: 'Flash Inmune',
        desc: 'Velocidad de linfocito activado. El patógeno no reacciona' },
      { nivel: 3, umbral: 680, badge: '🚀', nombre: 'Esporas en Vuelo',
        desc: 'Más rápido que el tránsito gástrico. Enteronorma en acción' },
    ],
  },
  colocacion: {
    nombre: 'Colocación',
    icon:   '🎯',
    color:  '#E0179D',
    desc:   'Concentración de votos — sala alineada',
    logros: [
      { nivel: 1, umbral: 200, badge: '🎯', nombre: 'Diagnóstico Certero',
        desc: 'El equipo piensa en la misma dirección clínica' },
      { nivel: 2, umbral: 450, badge: '🧬', nombre: 'ADN Clínico',
        desc: 'Precisión de espora llegando al intestino. Concentración total' },
      { nivel: 3, umbral: 680, badge: '💎', nombre: 'Consenso Total',
        desc: 'La sala habla con una sola voz. Criterio unificado' },
    ],
  },
  potencia: {
    nombre: 'Potencia',
    icon:   '💥',
    color:  '#FF6B35',
    desc:   'Fuerza de ejecución por rango obtenido',
    logros: [
      { nivel: 1, umbral: 200, badge: '💪', nombre: 'Probiótico Activo',
        desc: 'Bacillus Clausii colonizando el intestino' },
      { nivel: 2, umbral: 450, badge: '🔥', nombre: 'Doble Impacto',
        desc: 'B6 y Bacillus al máximo. La doble protección opera' },
      { nivel: 3, umbral: 680, badge: '👑', nombre: 'Doble Protección Máxima',
        desc: 'Microbiota e inmunidad protegidas simultáneamente. Invencible' },
    ],
  },
  resistencia: {
    nombre: 'Resistencia',
    icon:   '🛡️',
    color:  '#9B59B6',
    desc:   'Consistencia — racha sin caer en Rango C',
    logros: [
      { nivel: 1, umbral: 200, badge: '🛡️', nombre: 'Línea Defensiva',
        desc: 'La defensa no cede. Bacillus clausii activo' },
      { nivel: 2, umbral: 450, badge: '🏰', nombre: 'Fortaleza Intestinal',
        desc: 'El patógeno no puede con esta línea de defensa' },
      { nivel: 3, umbral: 680, badge: '⚔️', nombre: 'Enteronorma Invicto',
        desc: 'Ni un solo gol del patógeno. La sala es imparable' },
    ],
  },
};

// ── ESTADO DE STATS (mutable, se modifica en el juego) ──────────────
function crearEstadoStats() {
  return {
    precision:   0,
    velocidad:   0,
    colocacion:  0,
    potencia:    0,
    resistencia: 0,
    // Racha para resistencia
    racha:       0,
    // Logros ya desbloqueados { 'precision_1': true, ... }
    logrosDesbloqueados: {},
  };
}

// ── CÁLCULO DE DELTA POR JUGADA ──────────────────────────────────────
// Devuelve { precision: +N, velocidad: +N, ... } y la lista de logros nuevos
function calcularDelta(votos, correcta, rango, tiempoPromedio, jugadaIdx) {
  const total = (votos.A + votos.B + votos.C) || 1;

  // ── PRECISIÓN ── % de votos correctos, escalado a 0-100 por jugada
  const pctCorrectos = (votos[correcta] / total) * 100;
  const deltaPrec    = Math.round(pctCorrectos); // 0-100 por jugada

  // ── VELOCIDAD ── cuánto tiempo les sobró (más rápido = más puntos)
  // tiempoPromedio = segundos que tardaron en votar (0-30)
  // Si votaron en promedio en los primeros 10s → full, en 25s → mínimo
  const tiempoRestante = Math.max(0, 30 - (tiempoPromedio || 20));
  const deltaVel       = Math.round((tiempoRestante / 30) * 100); // 0-100

  // ── COLOCACIÓN ── concentración de votos en UNA opción
  const maxVotos  = Math.max(votos.A, votos.B, votos.C);
  const concent   = maxVotos / total; // 0.33 mín (empate) → 1.0 (todos igual)
  // Escalar: 33% = 0 pts, 100% = 100 pts
  const deltaColoc = Math.round(Math.max(0, (concent - 0.33) / 0.67) * 100);

  // ── POTENCIA ── según el rango obtenido
  const deltaPot = rango === 'A' ? 100 : rango === 'B' ? 55 : 15;

  // ── RESISTENCIA ── racha de A/B sin C
  // Se maneja externamente con la racha acumulada
  // Cada jugada no-C = +100, C = -50 (no debajo de 0)
  const deltaRes = rango === 'C' ? -50 : 100;

  return { deltaPrec, deltaVel, deltaColoc, deltaPot, deltaRes };
}

// ── APLICAR DELTA AL ESTADO Y DETECTAR LOGROS NUEVOS ────────────────
function aplicarDelta(statsState, delta, rango) {
  const antes = { ...statsState };
  const logrosNuevos = [];

  // Actualizar racha
  if (rango === 'C') {
    statsState.racha = 0;
  } else {
    statsState.racha++;
  }

  // Aplicar deltas (clamp 0-800)
  statsState.precision   = Math.min(MAX_PTS, Math.max(0, statsState.precision   + delta.deltaPrec));
  statsState.velocidad   = Math.min(MAX_PTS, Math.max(0, statsState.velocidad   + delta.deltaVel));
  statsState.colocacion  = Math.min(MAX_PTS, Math.max(0, statsState.colocacion  + delta.deltaColoc));
  statsState.potencia    = Math.min(MAX_PTS, Math.max(0, statsState.potencia    + delta.deltaPot));
  statsState.resistencia = Math.min(MAX_PTS, Math.max(0, statsState.resistencia + delta.deltaRes));

  // Verificar logros nuevos para cada stat
  for (const [statKey, def] of Object.entries(STATS_DEF)) {
    const valAntes  = antes[statKey] || 0;
    const valAhora  = statsState[statKey];
    for (const logro of def.logros) {
      const key = `${statKey}_${logro.nivel}`;
      if (!statsState.logrosDesbloqueados[key] && valAhora >= logro.umbral) {
        statsState.logrosDesbloqueados[key] = true;
        logrosNuevos.push({
          key,
          statKey,
          statNombre: def.nombre,
          nivel:   logro.nivel,
          badge:   logro.badge,
          nombre:  logro.nombre,
          desc:    logro.desc,
          color:   def.color,
        });
      }
    }
  }

  return logrosNuevos;
}

// ── SNAPSHOT PARA CLIENTE ────────────────────────────────────────────
// Lo que se envía al display con cada actualización
function getStatsSnapshot(statsState, delta) {
  return {
    valores: {
      precision:   statsState.precision,
      velocidad:   statsState.velocidad,
      colocacion:  statsState.colocacion,
      potencia:    statsState.potencia,
      resistencia: statsState.resistencia,
    },
    delta: {
      precision:   delta?.deltaPrec  || 0,
      velocidad:   delta?.deltaVel   || 0,
      colocacion:  delta?.deltaColoc || 0,
      potencia:    delta?.deltaPot   || 0,
      resistencia: delta?.deltaRes   || 0,
    },
    maxPts:   MAX_PTS,
    racha:    statsState.racha,
    statsDef: Object.fromEntries(
      Object.entries(STATS_DEF).map(([k, v]) => [k, {
        nombre: v.nombre,
        icon:   v.icon,
        color:  v.color,
        desc:   v.desc,
        logros: v.logros,
      }])
    ),
  };
}

module.exports = { STATS_DEF, crearEstadoStats, calcularDelta, aplicarDelta, getStatsSnapshot, MAX_PTS };
