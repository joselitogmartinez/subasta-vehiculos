// Validacion de formularios del cliente. Es una AYUDA para el usuario,
// no una garantia: el servidor vuelve a validar todo lo importante en
// las funciones fn_* de PostgreSQL.

/**
 */
export function validarPassword(password) {
  const errores = []

  if (!password || password.length < 8) errores.push('Debe tener al menos 8 caracteres.')
  if (!/[A-Z]/.test(password ?? '')) errores.push('Debe incluir al menos una mayuscula.')
  if (!/[a-z]/.test(password ?? '')) errores.push('Debe incluir al menos una minuscula.')
  if (!/\d/.test(password ?? '')) errores.push('Debe incluir al menos un numero.')

  return errores
}

/** Fuerza de la contrasena de 0 a 4, para la barra visual del registro. */
export function fuerzaPassword(password) {
  if (!password) return { nivel: 0, texto: 'Vacia' }

  let puntos = 0
  if (password.length >= 8) puntos++
  if (password.length >= 12) puntos++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) puntos++
  if (/\d/.test(password)) puntos++
  if (/[^A-Za-z0-9]/.test(password)) puntos++

  if (puntos <= 1) return { nivel: 1, texto: 'Muy debil' }
  if (puntos === 2) return { nivel: 2, texto: 'Debil' }
  if (puntos === 3) return { nivel: 3, texto: 'Aceptable' }
  if (puntos === 4) return { nivel: 4, texto: 'Buena' }
  return { nivel: 5, texto: 'Excelente' }
}

export const esCorreo = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor ?? '')

export const esTelefono = (valor) => /^[0-9+()\s-]{7,20}$/.test(valor ?? '')

/** Valida el formulario de registro. Devuelve { campo: mensaje }. */
export function validarRegistro({ nombre, apellido, correo, telefono, password, repetir }) {
  const errores = {}

  if (!nombre?.trim() || nombre.trim().length < 2) errores.nombre = 'Escribe tu nombre.'
  if (!apellido?.trim() || apellido.trim().length < 2) errores.apellido = 'Escribe tu apellido.'
  if (!esCorreo(correo)) errores.correo = 'Escribe un correo electronico valido.'
  if (!esTelefono(telefono)) errores.telefono = 'Escribe un telefono valido.'

  const pw = validarPassword(password)
  if (pw.length) errores.password = pw[0]

  if (password !== repetir) errores.repetir = 'Las contrasenas no coinciden.'

  return errores
}


export const TRENES = ['AWD', 'FWD', 'RWD', '4WD']
export const NIVELES_DANO = ['verde', 'amarillo', 'rojo']

/**
 * Valida la ficha tecnica y los parametros de subasta.
 *
 * Es una ayuda para el usuario: el servidor vuelve a comprobarlo todo
 * en fn_publicar_vehiculo, que es donde de verdad vive la regla. Aqui
 * solo se evita un viaje de ida y vuelta por un campo vacio.
 */
export function validarVehiculo(v) {
  const errores = {}
  const texto = (campo) => (v[campo] ?? '').toString().trim()

  if (!Number(v.anio) || Number(v.anio) < 1900 || Number(v.anio) > 2100) {
    errores.anio = 'Escribe el ano del vehiculo.'
  }

  for (const campo of [
    'tipo_articulo',
    'marca',
    'modelo',
    'motor',
    'transmision',
    'combustible',
  ]) {
    if (texto(campo).length < 2) errores[campo] = 'Este campo es obligatorio.'
  }

  if (!TRENES.includes(v.tren_manejo)) {
    errores.tren_manejo = 'Selecciona el tren de manejo.'
  }

  const cilindros = Number(v.num_cilindros)
  if (!cilindros || cilindros < 1 || cilindros > 16) {
    errores.num_cilindros = 'Selecciona el numero de cilindros.'
  }

  if (!NIVELES_DANO.includes(v.nivel_dano)) {
    errores.nivel_dano = 'Selecciona el nivel de dano.'
  }

  const base = Number(v.monto_base)
  if (!base || base <= 0) {
    errores.monto_base = 'El monto base debe ser mayor que cero.'
  }

  const inicio = new Date(v.fecha_inicio).getTime()
  const cierre = new Date(v.fecha_cierre).getTime()

  if (!Number.isFinite(inicio)) errores.fecha_inicio = 'Elige la fecha de inicio.'
  if (!Number.isFinite(cierre)) errores.fecha_cierre = 'Elige la fecha de cierre.'

  if (Number.isFinite(inicio) && Number.isFinite(cierre)) {
    if (cierre <= inicio) {
      errores.fecha_cierre = 'El cierre debe ser posterior al inicio.'
    } else if (cierre <= Date.now()) {
      errores.fecha_cierre = 'El cierre debe ser una fecha futura.'
    }
  }

  return errores
}