import { useEffect, useState } from 'react'

/**
 * Un solo temporizador de un segundo para toda la aplicacion.
 *
 * Las cuentas regresivas de las tarjetas de vehiculo necesitan
 * actualizarse cada segundo. Si cada componente creara su propio
 * `setInterval`, con 40 vehiculos en pantalla habria 40 temporizadores
 *viviendo y 40 renders por segundo. Con este suscriptor unico hay un
 * solo reloj y cada componente se renderiza cuando lo necesita.
 */

const suscriptores = new Set()
let temporizador = null

function arrancar() {
  if (temporizador) return
  temporizador = setInterval(() => {
    const ahora = Date.now()
    for (const fn of suscriptores) fn(ahora)
  }, 1000)
}

function detenerSiNoHaySuscriptores() {
  if (suscriptores.size > 0 || !temporizador) return
  clearInterval(temporizador)
  temporizador = null
}

/** Devuelve la hora actual, actualizada una vez por segundo. */
export function useAhora() {
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    suscriptores.add(setAhora)
    arrancar()
    return () => {
      suscriptores.delete(setAhora)
      detenerSiNoHaySuscriptores()
    }
  }, [])

  return ahora
}