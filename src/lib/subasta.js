/**
 * El navegador nunca sabe quien es el mejor postor y no hace falta.
 * El servidor difunde solo el monto; cada cliente deduce su situacion
 * comparandolo contra su ultima oferta. Es seguro porque el minimo es
 * siempre +10% sobre la vigente, asi que dos postores nunca empatan y la
 * igualdad significa "esta oferta es la mia y sigue en cabeza".
 */

const PREFIJO = 'subastaya:mi-oferta'

const clave = (vehiculoId, usuarioId) => `${PREFIJO}:${vehiculoId}:${usuarioId ?? 'anonimo'}`

/** Ultima oferta del usuario. El servidor sigue siendo la fuente de verdad. */
export function leerMiOferta(vehiculoId, usuarioId) {
  if (typeof localStorage === 'undefined') return null
  const bruto = localStorage.getItem(clave(vehiculoId, usuarioId))
  if (!bruto) return null
  const monto = Number(bruto)
  return Number.isFinite(monto) ? monto : null
}

export function guardarMiOferta(vehiculoId, usuarioId, monto) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(clave(vehiculoId, usuarioId), String(monto))
  } catch {
    // Modo privado o cuota llena: se sigue con el estado en memoria.
  }
}

export function borrarMiOferta(vehiculoId, usuarioId) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(clave(vehiculoId, usuarioId))
  } catch {}
}

export function situacionPostor({ estado, totalPujas, montoActual, miOferta, autenticado, esMio }) {
  if (esMio) {
    return { tono: 'azul', texto: 'Esta subasta es tuya', icono: '👤' }
  }

  if (!autenticado) {
    return { tono: 'neutro', texto: 'Inicia sesion para ofertar', icono: '🔒' }
  }

  if (estado === 'programada') {
    return { tono: 'azul', texto: 'La subasta aun no comienza', icono: '⏳' }
  }
  if (estado === 'desierta') {
    return { tono: 'rojo', texto: 'Subasta desierta: no se alcanzo el monto base', icono: '✖' }
  }
  if (estado === 'vendida') {
    return { tono: 'azul', texto: 'Subasta cerrada y vendida', icono: '✔' }
  }
  if (estado !== 'activa') {
    return { tono: 'neutro', texto: 'La oferta esta cerrada', icono: '🔒' }
  }

  if (totalPujas === 0) {
    return { tono: 'azul', texto: 'Se el primero en ofertar', icono: '🔔' }
  }

  if (!miOferta) {
    return {
      tono: 'azul',
      texto: 'Aun no has ofertado en esta subasta',
      icono: '✋',
    }
  }

  if (Number(miOferta) === Number(montoActual)) {
    return { tono: 'verde', texto: '¡Vas ganando esta subasta!', icono: '🏆' }
  }

  return {
    tono: 'rojo',
    texto: 'Tu oferta ha sido superada. ¡Haz tu oferta ahora antes de que termine el tiempo!',
    icono: '⚠',
  }
}

export function sugerenciasPuja(montoMinimo, yaOfertado) {
  const base = Number(montoMinimo) || 0
  if (base <= 0) return []

  const montos = new Set([base])
  for (const factor of [1.1, 1.25, 1.5]) {
    montos.add(Math.ceil((base * factor) / 100) * 100)
  }

  return [...montos]
    .sort((a, b) => a - b)
    .map((monto) => ({
      monto,
      etiqueta: monto === base ? 'Mínima' : `+${Math.round((monto / base - 1) * 100)}%`,
      repetida: yaOfertado != null && Number(yaOfertado) === monto,
    }))
    .slice(0, 4)
}

/**
 * Solo se conservan los digitos porque los montos son quetzales enteros.
 * Filtrar solo los no-numericos dejaba pasar el punto de "Q. 30,000" y
 * Number lo leia como decimal: terminaba siendo 0.3.
 */
export function parsearMonto(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  if (typeof texto !== 'string') return null

  const digitos = texto.replace(/\D/g, '')
  if (digitos === '') return null

  const monto = Number(digitos)
  return Number.isFinite(monto) ? monto : null
}