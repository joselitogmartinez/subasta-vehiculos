import { useAhora } from '../lib/reloj'
import { enCuanto, tiempoRestante } from '../lib/formato'

/**
 * Cuenta regresiva de la subasta.
 *
 * Se calcula contra la fecha de cierre que envia el servidor, nunca
 * contra un contador local: si el reloj del navegador este desfasado, el
 * cliente se sincroniza con la primera respuesta.
 */
export default function Temporizador({ fechaCierre, etiqueta = 'Tiempo restante', compacto = false }) {
  const ahora = useAhora()
  const t = tiempoRestante(fechaCierre, ahora)

  if (compacto) {
    return (
      <span className={`temporizador__compacto ${t.terminado ? '' : 'temporizador__compacto--urgente'}`}>
        {t.terminado ? 'Finalizada' : enCuanto(fechaCierre, ahora)}
      </span>
    )
  }

  const urgente = !t.terminado && t.dias === 0

  return (
    <div className={`temporizador ${urgente ? 'temporizador--urgente' : ''}`}>
      <span className="temporizador__etiqueta">{etiqueta}</span>

      <div className="temporizador__cajas" role="timer" aria-live="off">
        {t.terminado ? (
          <span className="temporizador__finalizada">Subasta finalizada</span>
        ) : (
          <>
            {t.dias > 0 && (
              <div className="temporizador__caja">
                <span className="temporizador__numero">{String(t.dias).padStart(2, '0')}</span>
                <span className="temporizador__unidad">días</span>
              </div>
            )}
            <div className="temporizador__caja">
              <span className="temporizador__numero">{String(t.horas).padStart(2, '0')}</span>
              <span className="temporizador__unidad">horas</span>
            </div>
            <div className="temporizador__caja">
              <span className="temporizador__numero">{String(t.minutos).padStart(2, '0')}</span>
              <span className="temporizador__unidad">min</span>
            </div>
            <div className="temporizador__caja">
              <span className="temporizador__numero">{String(t.segundos).padStart(2, '0')}</span>
              <span className="temporizador__unidad">seg</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Cuenta regresiva hacia el inicio, para subastas programadas. */
export function CuentaApertura({ fechaInicio }) {
  const ahora = useAhora()
  const t = tiempoRestante(fechaInicio, ahora)

  return (
    <div className="temporizador temporizador--apertura">
      <span className="temporizador__etiqueta">Comienza en</span>
      <div className="temporizador__cajas">
        {t.terminado ? (
          <span className="temporizador__finalizada">Abriendo ahora...</span>
        ) : (
          <>
            {t.dias > 0 && (
              <div className="temporizador__caja">
                <span className="temporizador__numero">{String(t.dias).padStart(2, '0')}</span>
                <span className="temporizador__unidad">días</span>
              </div>
            )}
            <div className="temporizador__caja">
              <span className="temporizador__numero">{String(t.horas).padStart(2, '0')}</span>
              <span className="temporizador__unidad">horas</span>
            </div>
            <div className="temporizador__caja">
              <span className="temporizador__numero">{String(t.minutos).padStart(2, '0')}</span>
              <span className="temporizador__unidad">min</span>
            </div>
            <div className="temporizador__caja">
              <span className="temporizador__numero">{String(t.segundos).padStart(2, '0')}</span>
              <span className="temporizador__unidad">seg</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}