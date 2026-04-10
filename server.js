// ─────────────────────────────────────────────────────────────────────
//  DOBLE PROTECCIÓN: EL PARTIDO — Servidor Principal
//  Node.js + Express + Socket.io
//  Enteronorma B-Vit · Carnot Laboratorios · Polar Multimedia 2026
// ─────────────────────────────────────────────────────────────────────

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const QRCode     = require('qrcode');
const os         = require('os');
const JUGADAS    = require('./data/jugadas');
const { crearEstadoStats, calcularDelta, aplicarDelta, getStatsSnapshot } = require('./data/stats');

const { v4: uuidv4 } = require('uuid');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ─── SESIONES PERSISTENTES (recuperación de desconexión) ─────────────
const sesiones = new Map(); // token → { nombre, socketId, votoActual, jugadaIdx }
const checkins = [];        // log de check-ins para el túnel

// ─── ESTADO DEL JUEGO ────────────────────────────────────────────────
const ESTADOS = {
  LOBBY:       'LOBBY',
  PREGUNTA:    'PREGUNTA',
  RESULTADOS:  'RESULTADOS',
  VIDEO:       'VIDEO',
  MARCADOR:    'MARCADOR',    // Pantalla de marcador + narrador IA
  TRANSICION:  'TRANSICION',
  FIN:         'FIN',
};

let estado = {
  fase:          ESTADOS.LOBBY,
  jugadaIdx:     0,
  votos:         { A: 0, B: 0, C: 0 },
  votantes:      new Set(),
  timerSegundos: 0,
  timerInterval: null,
  marcador:      { MEX: 0, SA: 0 },
  modoDemo:      true,
  rangoActual:   null,
  totalVotos:    0,
  // Datos para la pantalla MARCADOR
  ultimoNarradorIA: null,
  ultimoMcPost:     null,
  ultimaDescVideo:  null,
  // Stats y logros
  stats:            crearEstadoStats(),
  ultimoDelta:      null,
  ultimosLogros:    [],
  // Tiempo de votación (para calcular velocidad)
  tiempoInicioVotacion: null,
  tiemposVoto:     [],   // ms desde inicio cuando llegó cada voto
};

// ─── HELPERS ─────────────────────────────────────────────────────────

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const cfg of iface) {
      if (cfg.family === 'IPv4' && !cfg.internal) return cfg.address;
    }
  }
  return 'localhost';
}

function calcularRango(votos, correcta) {
  const total = votos.A + votos.B + votos.C;
  if (total === 0) return 'A'; // demo: sin votos = rango A
  const pctCorrectos = (votos[correcta] / total) * 100;
  if (pctCorrectos >= 75) return 'A';
  if (pctCorrectos >= 40) return 'B';
  return 'C';
}

function calcularPorcentajes(votos) {
  const total = votos.A + votos.B + votos.C || 1;
  return {
    A: Math.round((votos.A / total) * 100),
    B: Math.round((votos.B / total) * 100),
    C: Math.round((votos.C / total) * 100),
    total,
  };
}

function getEstadoPublico() {
  const jugada = JUGADAS[estado.jugadaIdx];
  return {
    fase:           estado.fase,
    jugadaIdx:      estado.jugadaIdx,
    jugadaTotal:    JUGADAS.length,
    jugada:         jugada ? {
      id:           jugada.id,
      nombre:       jugada.nombre,
      subtitulo:    jugada.subtitulo,
      tipo:         jugada.tipo,
      equipo:       jugada.equipo,
      equipoLabel:  jugada.equipoLabel,
      esEstrella:   jugada.esEstrella || false,
      notaOperador: jugada.notaOperador || null,
      pregunta:     jugada.pregunta,
      opciones:     jugada.opciones,
      videoArchivo: jugada.videoArchivo,
      videoTipo:    jugada.videoTipo,
      videoDuracion: jugada.videoDuracion,
      mcScript:     jugada.mcScript,
    } : null,
    porcentajes:    calcularPorcentajes(estado.votos),
    timerSegundos:  estado.timerSegundos,
    marcador:       estado.marcador,
    modoDemo:       estado.modoDemo,
    rangoActual:    estado.rangoActual,
  };
}

function resetVotos() {
  estado.votos    = { A: 0, B: 0, C: 0 };
  estado.votantes = new Set();
  estado.totalVotos = 0;
  estado.rangoActual = null;
  estado.tiemposVoto = [];
  estado.tiempoInicioVotacion = Date.now();
}

function stopTimer() {
  if (estado.timerInterval) {
    clearInterval(estado.timerInterval);
    estado.timerInterval = null;
  }
}

function startTimer(segundos, onComplete) {
  stopTimer();
  estado.timerSegundos = segundos;
  io.emit('timer_update', { segundos: estado.timerSegundos });

  estado.timerInterval = setInterval(() => {
    estado.timerSegundos--;
    io.emit('timer_update', { segundos: estado.timerSegundos });
    if (estado.timerSegundos <= 0) {
      stopTimer();
      if (onComplete) onComplete();
    }
  }, 1000);
}

function cambiarFase(nuevaFase, data = {}) {
  estado.fase = nuevaFase;
  io.emit('fase_cambio', { fase: nuevaFase, ...data });
  io.emit('estado_juego', getEstadoPublico());

  // Sound triggers por fase
  const soundMap = {
    PREGUNTA:   'whistle',
    RESULTADOS: 'result',
    VIDEO:      null,
    MARCADOR:   'crowd',
    FIN:        'final_whistle',
  };
  if (soundMap[nuevaFase]) {
    io.emit('sound_trigger', { sound: soundMap[nuevaFase] });
  }
  // Gol trigger
  if (nuevaFase === 'RESULTADOS' && data.rango && data.marcador) {
    const jugada = JUGADAS[estado.jugadaIdx];
    if (jugada.golesImpacto && jugada.golesImpacto[data.rango]) {
      setTimeout(() => io.emit('sound_trigger', { sound: 'gol' }), 800);
    }
  }
}

// ─── FLUJO DEL JUEGO ─────────────────────────────────────────────────

function iniciarJugada(idx) {
  if (idx >= JUGADAS.length) {
    cambiarFase(ESTADOS.FIN);
    return;
  }
  estado.jugadaIdx = idx;
  resetVotos();
  const jugada = JUGADAS[idx];

  cambiarFase(ESTADOS.PREGUNTA);

  // Iniciar timer de votación
  startTimer(jugada.tiempoVotacion, () => {
    cerrarVotacion();
  });
}

function cerrarVotacion() {
  stopTimer();
  const jugada = JUGADAS[estado.jugadaIdx];
  const rango  = estado.modoDemo ? 'A' : calcularRango(estado.votos, jugada.correcta);
  estado.rangoActual = rango;

  // Actualizar marcador si hay gol
  if (jugada.golesImpacto && jugada.golesImpacto[rango]) {
    const equipoGol = jugada.golesImpacto[rango];
    if (equipoGol === 'MEX') estado.marcador.MEX++;
    if (equipoGol === 'SA')  estado.marcador.SA++;
  }

  // Guardar para pantalla MARCADOR
  estado.ultimoNarradorIA = jugada.narradorIA[rango];
  estado.ultimoMcPost     = jugada.mcPost[rango];
  estado.ultimaDescVideo  = jugada.descripcionVideo[rango];

  // ── CALCULAR STATS ──
  const avgMs = estado.tiemposVoto.length
    ? estado.tiemposVoto.reduce((a,b) => a+b, 0) / estado.tiemposVoto.length
    : 15000; // default 15s
  const tiempoPromedio = avgMs / 1000; // segundos

  const delta       = calcularDelta(estado.votos, jugada.correcta, rango, tiempoPromedio, estado.jugadaIdx);
  const logrosNuevos = aplicarDelta(estado.stats, delta, rango);
  estado.ultimoDelta   = delta;
  estado.ultimosLogros = logrosNuevos;

  cambiarFase(ESTADOS.RESULTADOS, {
    votos:        estado.votos,
    porcentajes:  calcularPorcentajes(estado.votos),
    rango,
    correcta:     jugada.correcta,
    mcPost:       jugada.mcPost[rango],
    narradorIA:   jugada.narradorIA[rango],
    descripcionVideo: jugada.descripcionVideo[rango],
    marcador:     estado.marcador,
    // Stats payload
    stats:        getStatsSnapshot(estado.stats, delta),
    logrosNuevos,
  });
}

// Videos demo — usa IDs de Vimeo si están en env, si no usa archivos locales
const DEMO_VIDEOS = {
  A: process.env.VIMEO_A || 'acierto.mp4',
  B: process.env.VIMEO_B || 'medio.mp4',
  C: process.env.VIMEO_C || 'falla.mp4',
};

function reproducirVideo() {
  const jugada = JUGADAS[estado.jugadaIdx];
  const rango  = estado.rangoActual;

  // En modo demo siempre usamos los videos fijos de rango
  const videoArchivo = estado.modoDemo
    ? (DEMO_VIDEOS[rango] || null)
    : jugada.videoArchivo;

  cambiarFase(ESTADOS.VIDEO, {
    videoArchivo,
    videoDuracion: jugada.videoDuracion,
    videoTipo:     jugada.videoTipo,
    rango,
    narradorIA:    jugada.narradorIA[rango],
    marcador:      estado.marcador,
  });
}

function siguienteJugada() {
  const siguiente = estado.jugadaIdx + 1;
  if (siguiente >= JUGADAS.length) {
    cambiarFase(ESTADOS.FIN, { marcador: estado.marcador });
  } else {
    cambiarFase(ESTADOS.TRANSICION);
    // Breve pausa antes de la siguiente jugada
    setTimeout(() => {
      iniciarJugada(siguiente);
    }, 3000);
  }
}

// ─── SOCKET.IO — EVENTOS ─────────────────────────────────────────────

io.on('connection', (socket) => {
  const token = socket.handshake.auth?.token || null;
  let sesion = token ? sesiones.get(token) : null;

  // Recuperar sesión existente o crear nueva
  if (sesion) {
    sesion.socketId = socket.id;
    console.log(`[↻] Reconexión: ${socket.id} (sesión ${token.slice(0,8)}…)`);
    // Si votó en esta jugada, restaurar estado
    if (sesion.jugadaIdx === estado.jugadaIdx && sesion.votoActual) {
      socket.emit('voto_confirmado', { opcion: sesion.votoActual, recuperado: true });
    }
  } else {
    console.log(`[+] Conexión nueva: ${socket.id} (${socket.handshake.address})`);
  }

  // Enviar estado actual al nuevo cliente
  socket.emit('estado_juego', getEstadoPublico());

  // ── OPERADOR ──────────────────────────────────────────────────────

  // Iniciar juego desde lobby
  socket.on('op_iniciar', () => {
    if (estado.fase === ESTADOS.LOBBY || estado.fase === ESTADOS.FIN) {
      estado.marcador = { MEX: 0, SA: 0 };
      iniciarJugada(0);
    }
  });

  // Cerrar votación manualmente
  socket.on('op_cerrar_votacion', () => {
    if (estado.fase === ESTADOS.PREGUNTA) {
      cerrarVotacion();
    }
  });

  // Avanzar a video
  socket.on('op_reproducir_video', () => {
    if (estado.fase === ESTADOS.RESULTADOS) {
      reproducirVideo();
    }
  });

  // Ver marcador (desde video o resultados)
  socket.on('op_ver_marcador', () => {
    if (estado.fase === ESTADOS.VIDEO || estado.fase === ESTADOS.RESULTADOS) {
      cambiarFase(ESTADOS.MARCADOR, {
        marcador:     estado.marcador,
        narradorIA:   estado.ultimoNarradorIA,
        mcPost:       estado.ultimoMcPost,
        descripcion:  estado.ultimaDescVideo,
      });
    }
  });

  // Lanzar siguiente pregunta (desde marcador o video)
  socket.on('op_siguiente_pregunta', () => {
    if (estado.fase === ESTADOS.MARCADOR || estado.fase === ESTADOS.VIDEO || estado.fase === ESTADOS.RESULTADOS) {
      siguienteJugada();
    }
  });

  // Avanzar a siguiente jugada (alias legacy)
  socket.on('op_siguiente', () => {
    if (estado.fase === ESTADOS.VIDEO || estado.fase === ESTADOS.RESULTADOS || estado.fase === ESTADOS.MARCADOR) {
      siguienteJugada();
    }
  });

  // Saltar a jugada específica
  socket.on('op_ir_jugada', ({ idx }) => {
    if (idx >= 0 && idx < JUGADAS.length) {
      stopTimer();
      iniciarJugada(idx);
    }
  });

  // Resetear al lobby
  socket.on('op_reset', () => {
    stopTimer();
    estado.jugadaIdx  = 0;
    estado.marcador   = { MEX: 0, SA: 0 };
    estado.stats      = crearEstadoStats();
    estado.ultimoDelta = null;
    estado.ultimosLogros = [];
    resetVotos();
    cambiarFase(ESTADOS.LOBBY);
  });

  // Ajuste manual de marcador
  socket.on('op_ajustar_marcador', ({ equipo, delta }) => {
    if (equipo === 'MEX') estado.marcador.MEX = Math.max(0, estado.marcador.MEX + delta);
    if (equipo === 'SA')  estado.marcador.SA  = Math.max(0, estado.marcador.SA  + delta);
    io.emit('marcador_actualizado', { marcador: estado.marcador });
    io.emit('estado_juego', getEstadoPublico());
    console.log(`[Marcador manual] MEX:${estado.marcador.MEX} SA:${estado.marcador.SA}`);
  });

  // Toggle modo demo
  socket.on('op_toggle_demo', () => {
    estado.modoDemo = !estado.modoDemo;
    io.emit('modo_demo', { activo: estado.modoDemo });
    io.emit('estado_juego', getEstadoPublico());
  });

  // Forzar rango manualmente
  socket.on('op_forzar_rango', ({ rango }) => {
    if (['A', 'B', 'C'].includes(rango) && estado.fase === ESTADOS.PREGUNTA) {
      stopTimer();
      const jugada = JUGADAS[estado.jugadaIdx];
      estado.rangoActual = rango;
      if (jugada.golesImpacto && jugada.golesImpacto[rango]) {
        const eq = jugada.golesImpacto[rango];
        if (eq === 'MEX') estado.marcador.MEX++;
        if (eq === 'SA')  estado.marcador.SA++;
      }
      estado.ultimoNarradorIA = jugada.narradorIA[rango];
      estado.ultimoMcPost     = jugada.mcPost[rango];
      estado.ultimaDescVideo  = jugada.descripcionVideo[rango];
      cambiarFase(ESTADOS.RESULTADOS, {
        votos:        estado.votos,
        porcentajes:  calcularPorcentajes(estado.votos),
        rango,
        correcta:     jugada.correcta,
        mcPost:       jugada.mcPost[rango],
        narradorIA:   jugada.narradorIA[rango],
        descripcionVideo: jugada.descripcionVideo[rango],
        marcador:     estado.marcador,
      });
    }
  });

  // ── VOTANTE (médicos) ─────────────────────────────────────────────

  // Registrar sesión del votante
  socket.on('registrar_sesion', ({ token: clientToken, nombre }) => {
    const tk = clientToken || uuidv4();
    if (!sesiones.has(tk)) {
      sesiones.set(tk, { nombre: nombre || null, socketId: socket.id, votoActual: null, jugadaIdx: -1 });
    } else {
      sesiones.get(tk).socketId = socket.id;
    }
    socket.sesionToken = tk;
    socket.emit('sesion_registrada', { token: tk });
  });

  socket.on('votar', ({ opcion, token: voteToken }) => {
    const tk = voteToken || socket.sesionToken || socket.id;

    if (estado.fase !== ESTADOS.PREGUNTA) {
      socket.emit('voto_rechazado', { motivo: 'Votación cerrada' });
      return;
    }
    if (estado.votantes.has(tk)) {
      socket.emit('voto_rechazado', { motivo: 'Ya votaste en esta jugada' });
      return;
    }
    if (!['A', 'B', 'C'].includes(opcion)) {
      socket.emit('voto_rechazado', { motivo: 'Opción inválida' });
      return;
    }

    estado.votos[opcion]++;
    estado.votantes.add(tk);
    estado.totalVotos++;
    estado.tiemposVoto.push(Date.now() - (estado.tiempoInicioVotacion || Date.now()));

    // Guardar voto en sesión para recuperación
    if (sesiones.has(tk)) {
      const ses = sesiones.get(tk);
      ses.votoActual = opcion;
      ses.jugadaIdx  = estado.jugadaIdx;
    }

    socket.emit('voto_confirmado', { opcion });
    io.emit('votos_actualizados', {
      votos:       estado.votos,
      porcentajes: calcularPorcentajes(estado.votos),
    });
  });

  socket.on('disconnect', () => {
    console.log(`[-] Desconexión: ${socket.id}`);
  });
});

// ─── RUTAS HTTP ───────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Check-in API para el túnel de bienvenida
app.post('/api/checkin', (req, res) => {
  const { nombre, sede } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  const entry = { nombre, sede: sede || 'CDMX', timestamp: Date.now() };
  checkins.push(entry);
  io.emit('checkin_nuevo', entry);
  io.emit('sound_trigger', { sound: 'checkin' });
  console.log(`[CHECK-IN] ${nombre} — ${sede || 'CDMX'}`);
  res.json({ ok: true, entry });
});

app.get('/api/checkins', (req, res) => {
  res.json({ total: checkins.length, checkins });
});

// Raíz → redirige al voter
app.get('/', (req, res) => res.redirect('/voter.html'));

// Ruta explícita para videos — evita problemas de permisos en macOS APFS
const fs = require('fs');
app.get('/videos/:archivo', (req, res) => {
  const archivo = req.params.archivo.replace(/[^a-zA-Z0-9_\-\.]/g, ''); // sanitize
  const filePath = path.join(__dirname, 'public', 'videos', archivo);
  if (!fs.existsSync(filePath)) return res.status(404).send('Video no encontrado');

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Soporte para seeking (Range requests)
    const parts  = range.replace(/bytes=/, '').split('-');
    const start  = parseInt(parts[0], 10);
    const end    = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   'video/mp4',
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   'video/mp4',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// QR code para la URL del votante
app.get('/qr', async (req, res) => {
  const ip  = getLocalIP();
  const url = `http://${ip}:${PORT}/voter.html`;
  try {
    const qr = await QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: '#1F3864', light: '#FFFFFF' } });
    res.send(`
      <html><body style="background:#060d18;display:flex;flex-direction:column;
        align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:white">
        <div style="font-size:0.8rem;letter-spacing:0.3em;color:#F5C518;margin-bottom:1rem;text-transform:uppercase">NORMA MUNDIAL 2026</div>
        <img src="${qr}" style="border-radius:16px;border:4px solid #F5C518"/>
        <p style="font-size:1.3rem;margin-top:1rem;color:#F5C518;font-weight:bold">${url}</p>
        <p style="color:#888;margin-top:0.5rem">Escanea este QR desde tu celular para votar</p>
        <p style="color:rgba(245,197,24,0.4);font-size:0.75rem;margin-top:2rem">Enteronorma B-Vit · Carnot Laboratorios · Polar Multimedia</p>
      </body></html>
    `);
  } catch (e) {
    res.send(`URL del votante: http://${getLocalIP()}:${PORT}/voter.html`);
  }
});

// Info del servidor
app.get('/info', (req, res) => {
  const ip = getLocalIP();
  res.json({
    display:  `http://${ip}:${PORT}/display.html`,
    voter:    `http://${ip}:${PORT}/voter.html`,
    operator: `http://${ip}:${PORT}/operator.html`,
    qr:       `http://${ip}:${PORT}/qr`,
  });
});

// ─── INICIO ───────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  DOBLE PROTECCIÓN: EL PARTIDO                     ║');
  console.log('║  Enteronorma B-Vit · Polar Multimedia · 2026      ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  🖥️  Display (pantalla sala):                      ║`);
  console.log(`║     http://${ip}:${PORT}/display.html          ║`);
  console.log(`║  📱 Votación (celulares):                         ║`);
  console.log(`║     http://${ip}:${PORT}/voter.html             ║`);
  console.log(`║  🎛️  Operador (control):                           ║`);
  console.log(`║     http://${ip}:${PORT}/operator.html          ║`);
  console.log(`║  📷 QR para médicos:                              ║`);
  console.log(`║     http://${ip}:${PORT}/qr                     ║`);
  console.log('╚═══════════════════════════════════════════════════╝\n');
});
