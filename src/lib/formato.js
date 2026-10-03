// Formato de moneda, fechas y cuentas regresivas para mostrar en pantalla.
// Todo se formatea aqui para que ningun componente repita la logique y
// la moneda sea identica en toda la aplicacion.

const QUETZALES = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const NUMERO = new Intl.NumberFormat('es-GT')

/** 20000 -> "Q20,000" */
export const dinero = (monto) => QUETZALES.format(Number(monto ?? 0))

/** 12345 -> "12,345" */
export const numero = (n) => NUMERO.format(Number(n ?? 0))

/** "12 mar 2020" */
export const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

/** "12 mar 2020, 3:45 p. m." */
export const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

/** Para inputs datetime-local, en horario local del navegador. */
export const paraInputFechaHora = (iso) => {
  const d = new Date(iso)
  const desfase = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - desfase).toISOString().slice(0, 16)
}

/**
 * Cuenta regresiva contra una fecha de cierre.
 * Devuelve las partes por separado para poder mostrarlas en cajas
 * separadas, y `terminado` para bloquear la interfaz.
 */
export function tiempoRestante(fechaCierre, ahora = Date.now()) {
  const restante = new Date(fechaCierre).getTime() - ahora
  const terminado = restante <= 0
  const ms = Math.abs(restante)

  return {
    terminado,
    dias: Math.floor(ms / 86400000),
    horas: Math.floor(ms / 3600000) % 24,
    minutos: Math.floor(ms / 60000) % 60,
    segundos: Math.floor(ms / 1000) % 60,
  }
}

/** "2d 04:31:09" */
export const reloj = (t) =>
  t.terminado
    ? '00:00:00'
    : `${String(t.dias).padStart(2, '0')}d ${String(t.horas).padStart(2, '0')}:${String(t.minutos).padStart(2, '0')}:${String(t.segundos).padStart(2, '0')}`

/** "termina en 2 días" / "faltan 4 horas" */
export const resumenTiempo = (t) => {
  if (t.terminado) return 'Finalizada'
  if (t.dias > 0) return `Termina en ${t.dias} ${t.dias === 1 ? 'día' : 'días'}`
  if (t.horas > 0) return `Termina en ${t.horas} ${t.horas === 1 ? 'hora' : 'horas'}`
  if (t.minutos > 0) return `Termina en ${t.minutos} min`
  return 'Termina en menos de un minuto'
}

/**
 * Distancia legible a una fecha futura, sin el verbo.
 * "3 días" · "4 horas" · "12 min" · "ahora"
 * Se usa donde el texto ya dice "en" o "faltan", para no repetir la frase.
 */
export const enCuanto = (fecha, ahora = Date.now()) => {
  const t = tiempoRestante(fecha, ahora)
  if (t.terminado) return 'ahora'
  if (t.dias > 0) return `${t.dias} ${t.dias === 1 ? 'día' : 'días'}`
  if (t.horas > 0) return `${t.horas} ${t.horas === 1 ? 'hora' : 'horas'}`
  if (t.minutos > 0) return `${t.minutos} min`
  return `${t.segundos} s`
}


export const ETIQUETA_ESTADO = {
  activa: { texto: 'En vivo', tono: 'verde' },
  programada: { texto: 'Proximamente', tono: 'azul' },
  desierta: { texto: 'Desierta', tono: 'rojo' },
  vendida: { texto: 'Vendida', tono: 'azul' },
  borrador: { texto: 'Borrador', tono: 'neutro' },
}

export const ETIQUETA_DANO = {
  verde: { texto: 'Dano menor', punto: 'verde' },
  amarillo: { texto: 'Dano medio', punto: 'amarillo' },
  rojo: { texto: 'Dano severo', punto: 'rojo' },
}

export const etiquetaEstado = (estado) => ETIQUETA_ESTADO[estado] ?? ETIQUETA_ESTADO.borrador

export const etiquetaDano = (nivel) => ETIQUETA_DANO[nivel] ?? ETIQUETA_DANO.verde

/** Convierte el error de Supabase en algo legible para el usuario. */
export const mensajeDeError = (error) => {
  if (!error) return 'Ocurrio un error inesperado.'
  const texto = error.message ?? String(error)

  if (/Invalid login credentials/i.test(texto))
    return 'Correo o contrasena incorrectos.'
  if (/User already registered/i.test(texto))
    return 'Ya existe una cuenta con ese correo electronico.'
  if (/Password should be/i.test(texto))
    return 'La contrasena no cumple los requisitos de seguridad.'
  if (/rate limit|too many/i.test(texto))
    return 'Demasiados intentos. Espera un momento e intenta de nuevo.'
  if (/Email signups are disabled/i.test(texto))
    return 'Los registros estan deshabilitados en este proyecto.'

  return texto
}