import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Mantiene la pantalla de subasta sincronizada con los broadcasts que
 * emite el trigger `trg_diffundir_puja` de la base de datos.
 *
 * El payload NO lleva user_id, solo el monto. Ver src/lib/subasta.js para
 * como se deduce si el visitante va ganando sin conocer la identidad de
 * los demas postores.
 *
 * Un unico canal por vehiculo: el topic es `subasta:{id}`, asi que dos
 * personas mirando el mismo vehiculo reciben los mismos eventos y personas
 * mirando vehiculos distintos no se interfieren.
 */
export function useSubastaEnVivo(vehiculoId, alCambiar) {
  const [conectado, setConectado] = useState(false)

  // El callback se guarda en un ref en vez de dependerlo: si cambiara en
  // cada render, habria que cerrar y reabrir el canal, y en ese hueco se
  // perderian pujas ajenas. Se asigna en un efecto declarado ANTES del
  // de suscripcion, para que React los ejecute en ese orden.
  const alCambiarRef = useRef(alCambiar)

  useEffect(() => {
    alCambiarRef.current = alCambiar
  }, [alCambiar])

  useEffect(() => {
    if (!vehiculoId) return

    let vigente = true

    const canal = supabase.channel(`subasta:${vehiculoId}`)

    canal
      .on('broadcast', { event: 'subasta' }, ({ payload }) => {
        if (vigente) alCambiarRef.current?.(payload)
      })
      .subscribe((estado) => {
        if (vigente) setConectado(estado === 'SUBSCRIBED')
      })

    return () => {
      vigente = false
      setConectado(false)
      supabase.removeChannel(canal)
    }
  }, [vehiculoId])

  return conectado
}