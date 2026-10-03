import { useCallback, useState } from 'react'

/**
 * Carrusel de la galeria del vehiculo.
 *
 * Navegacion con flechas, con el teclado (accesible) y con las
 * miniaturas. El enunciado pide minimo 5 fotos, asi que el carrusel es
 * la pieza que mas se usa de la vista de detalle.
 *
 * Al cambiar de vehiculo, el padre lo monta de nuevo con una `key`
 * distinta, asi que el indice vuelve a cero sin necesidad de un efecto.
 */
export default function Carrusel({ fotos, alt }) {
  const [indice, setIndice] = useState(0)
  const total = fotos?.length ?? 0

  const ir = useCallback(
    (nuevo) => {
      if (total === 0) return
      setIndice(((nuevo % total) + total) % total)
    },
    [total],
  )

  const alTeclear = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      ir(indice - 1)
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      ir(indice + 1)
    }
  }

  if (total === 0) {
    return (
      <div className="carrusel carrusel--vacio">
        <span aria-hidden="true">🚘</span>
        <p>Este vehiculo no tiene fotografias cargadas.</p>
      </div>
    )
  }

  return (
    <div
      className="carrusel"
      role="group"
      aria-roledescription="carrusel"
      aria-label={`Galeria de ${alt}`}
      tabIndex={0}
      onKeyDown={alTeclear}
    >
      <div className="carrusel__escenario">
        <img
          src={fotos[indice].url}
          alt={`${alt} · fotografia ${indice + 1} de ${total}`}
          className="carrusel__imagen"
        />

        <button
          type="button"
          className="carrusel__flecha carrusel__flecha--prev"
          onClick={() => ir(indice - 1)}
          aria-label="Foto anterior"
        >
          ‹
        </button>
        <button
          type="button"
          className="carrusel__flecha carrusel__flecha--next"
          onClick={() => ir(indice + 1)}
          aria-label="Foto siguiente"
        >
          ›
        </button>

        <span className="carrusel__contador">
          {indice + 1} / {total}
        </span>
      </div>

      {total > 1 && (
        <div className="carrusel__miniaturas">
          {fotos.map((foto, i) => (
            <button
              key={foto.id ?? foto.url}
              type="button"
              className={`carrusel__miniatura ${i === indice ? 'carrusel__miniatura--activa' : ''}`}
              onClick={() => setIndice(i)}
              aria-label={`Ver fotografia ${i + 1}`}
              aria-current={i === indice}
            >
              <img src={foto.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}