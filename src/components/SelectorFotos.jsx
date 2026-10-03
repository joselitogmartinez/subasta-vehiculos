import { useEffect, useMemo, useRef, useState } from 'react'
import { MINIMO_FOTOS, faltanFotos, revisarSeleccion } from '../lib/galeria'

/**
 * Selector de galeria con arrastrar y soltar.
 *
 * El enunciado exige minimo 5 fotografias, asi que el contador de
 * "faltan N" es la guia principal del componente. El servidor vuelve a
 * comprobarlo en fn_activar_vehiculo: esto solo evita que el usuario
 * descubra el problema al final.
 */
export default function SelectorFotos({
  fotos = [],
  nuevas = [],
  onNuevas,
  onQuitarNueva,
  onQuitarExistente,
  onMover,
  deshabilitado = false,
}) {
  const [arrastrando, setArrastrando] = useState(false)
  const [avisos, setAvisos] = useState([])
  const entradaRef = useRef(null)

  // Las vistas previas se crean una vez por archivo y se liberan al
  // cambiar la seleccion o al desmontar. Llamar a createObjectURL en el
  // render generaria una URL nueva en cada repintado y las anteriores
  // quedarian retenidas en memoria.
  const vistasNuevas = useMemo(
    () => nuevas.map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) })),
    [nuevas],
  )

  useEffect(
    () => () => {
      for (const v of vistasNuevas) URL.revokeObjectURL(v.url)
    },
    [vistasNuevas],
  )

  const total = fotos.length + nuevas.length
  const faltan = faltanFotos(total)
  const cumplidos = faltan === 0

  const agregar = (lista) => {
    if (lista.length === 0 || deshabilitado) return
    const { aceptados, rechazados } = revisarSeleccion(lista, total)

    if (aceptados.length) onNuevas([...nuevas, ...aceptados])

    setAvisos(
      rechazados.map((r) => `"${r.archivo.name}": ${r.problema}`),
    )
  }

  const alSoltar = (e) => {
    e.preventDefault()
    setArrastrando(false)
    agregar(Array.from(e.dataTransfer.files ?? []))
  }

  return (
    <div className="galeria">
      <div
        className={`galeria__zona ${arrastrando ? 'galeria__zona--activa' : ''} ${cumplidos ? 'galeria__zona--completa' : ''} ${deshabilitado ? 'galeria__zona--bloqueada' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!deshabilitado) setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
      >
        <input
          ref={entradaRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="sr-solo"
          onChange={(e) => {
            agregar(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
          disabled={deshabilitado}
        />

        <div className="galeria__zona-texto">
          <span className="galeria__zona-icono" aria-hidden="true">
            {cumplidos ? '✓' : '📷'}
          </span>
          <p className="galeria__zona-titulo">
            {cumplidos
              ? 'Galería lista'
              : `Arrastra las fotografías aquí o selecciónalas`}
          </p>
          <p className={`galeria__contador ${cumplidos ? 'galeria__contador--ok' : ''}`}>
            {cumplidos
              ? `${total} fotografías · mínimo cumplido`
              : `${total} de ${MINIMO_FOTOS} · faltan ${faltan}`}
          </p>
          <button
            type="button"
            className="btn btn--secundario"
            onClick={() => entradaRef.current?.click()}
            disabled={deshabilitado}
          >
            Elegir archivos
          </button>
          <p className="galeria__zona-nota">JPG, PNG, WEBP o AVIF · máximo 10 MB por imagen</p>
        </div>
      </div>

      {avisos.length > 0 && (
        <ul className="galeria__avisos" role="alert">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      {(fotos.length > 0 || nuevas.length > 0) && (
        <ul className="galeria__miniaturas">
          {fotos.map((foto, indice) => (
            <li key={foto.id} className="galeria__miniatura">
              <img src={foto.url} alt={`Fotografía ${indice + 1}`} />
              {indice === 0 && <span className="galeria__portada">Portada</span>}
              <div className="galeria__acciones">
                {indice > 0 && (
                  <button
                    type="button"
                    onClick={() => onMover(indice, indice - 1)}
                    disabled={deshabilitado}
                    title="Mover antes"
                  >
                    ←
                  </button>
                )}
                <button
                  type="button"
                  className="galeria__quitar"
                  onClick={() => onQuitarExistente(indice)}
                  disabled={deshabilitado}
                  title="Quitar esta foto"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}

          {vistasNuevas.map(({ archivo, url }, indice) => (
            <li key={`${archivo.name}-${indice}`} className="galeria__miniatura galeria__miniatura--nueva">
              <img src={url} alt={`Nueva: ${archivo.name}`} />
              <span className="galeria__pendiente">Sin subir</span>
              <div className="galeria__acciones">
                <button
                  type="button"
                  className="galeria__quitar"
                  onClick={() => onQuitarNueva(indice)}
                  disabled={deshabilitado}
                  title="Quitar esta foto"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}