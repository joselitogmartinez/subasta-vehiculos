/**
 * Motor de subasta del lado del navegador.
 *
 * REGLA DE ORO DEL ANONIMATO
 * --------------------------
 * El navegador nunca sabe quien es el mejor postor, y no hace falta.
 * El servidor difunde unicamente el monto; cada cliente deduce su propia
 * situacion comparando ese monto contra su ultima oferta:
 *
 *   total_pujas === 0        -> nadie ha ofertado
 *   monto > miOferta          -> me superaron
 *   monto === miOferta       -> soy el mejor postor
 *
 * Es seguro porque fn_monto_minimo garantiza que una oferta valida es
 * siempre MAYOR que la vigente (+10%), asi que dos usuarios nunca pueden
 * tener el mismo monto. La igualdad no es ambigua: significa "esta oferta
 * es la mia y sigue en cabeza".
 *
 * Por eso `mi_oferta` viene de fn_estado_subasta, que solo le devuelve
 * las pujas del propio usuario, y nunca de una consulta a `pujas`.
 */

const PREFIJO = 'subastaya:mi-oferta'

const clave = (vehiculoId, usuarioId) => `${PREFIJO}:${vehiculoId}:${usuarioId ?? 'anonimo'}`

/**
 * Ultima oferta del usuario, para pintar el estado al instante sin
 * esperar la respuesta del servidor. No es la fuente de verdad: al abrir
 * la pagina se consulta fn_estado_subasta y manda ese valor.
 */
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
    // Modo privado o cuota llena: se sigue funcionando con el estado en memoria.
  }
}

export function borrarMiOferta(vehiculoId, usuarioId) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(clave(vehiculoId, usuarioId))
  } catch {}
}

/**
 * Situacion del visitante frente a la subasta.
 * Devuelve el tono del aviso y el texto ya redactado.
 */
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

/**
 * Sugerencias de puja. Siempre multiples del minimo, para que el monto
 * que se ve coincida con los botones y no haya sorpresas al confirmar.
 */
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
 * Convierte lo que escribe el usuario a numero.
 *
 * Se descartan todos los caracteres que no sean digitos, porque en esta
 * plataforma los montos son siempre quetzales enteros. Filtrar solo los
 * no-numericos dejaba pasar el punto de "Q. 30,000" y Number lo leia
 * como decimal: "Q. 30,000" terminaba siendo 0.3 y la oferta se enviaba
 * mal. Aceptar "20,000", "Q. 30,000", "$45.500" y "20 000" da el mismo
 * resultado, que es lo que espera cualquiera que teclee un monto.
 */
export function parsearMonto(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  if (typeof texto !== 'string') return null

  const digitos = texto.replace(/\D/g, '')
  if (digitos === '') return null

  const monto = Number(digitos)
  return Number.isFinite(monto) ? monto : null
}