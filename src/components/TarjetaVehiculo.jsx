import { Link } from 'react-router-dom'
import { Badge } from './ui'
import { dinero, enCuanto, etiquetaDano, etiquetaEstado, reloj, resumenTiempo, tiempoRestante } from '../lib/formato'
import { useAhora } from '../lib/reloj'

/**
 * Tarjeta del catalogo. Muestra la oferta vigente y la cuenta regresiva,
 * pero nunca quien ofertó: esa informacion no llega al navegador.
 */
export default function TarjetaVehiculo({ vehiculo }) {
  const ahora = useAhora()

  const estado = etiquetaEstado(vehiculo.estado_calculado)
  const dano = etiquetaDano(vehiculo.nivel_dano)
  const restante = tiempoRestante(vehiculo.fecha_cierre, ahora)
  const hayPujas = (vehiculo.total_pujas ?? 0) > 0

  return (
    <article className="tarjeta">
      <Link to={`/vehiculo/${vehiculo.id}`} className="tarjeta__enlace-imagen">
        {vehiculo.foto_portada ? (
          <img
            src={vehiculo.foto_portada}
            alt={`${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`}
            className="tarjeta__imagen"
            loading="lazy"
          />
        ) : (
          <div className="tarjeta__sin-imagen" aria-hidden="true">
            🚘
          </div>
        )}

        <div className="tarjeta__insignias">
          <Badge tono={estado.tono} punto={vehiculo.estado_calculado === 'activa'}>
            {estado.texto}
          </Badge>
          <Badge tono={dano.punto} punto>
            {dano.texto}
          </Badge>
        </div>
      </Link>

      <div className="tarjeta__cuerpo">
        <header className="tarjeta__cabecera">
          <h3 className="tarjeta__titulo">
            <Link to={`/vehiculo/${vehiculo.id}`}>
              {vehiculo.marca} {vehiculo.modelo}
            </Link>
          </h3>
          <span className="tarjeta__anio">{vehiculo.anio}</span>
        </header>

        <p className="tarjeta__atributos">
          {vehiculo.tipo_articulo} · {vehiculo.combustible} · {vehiculo.tren_manejo} ·{' '}
          {vehiculo.num_cilindros} cyl.
        </p>

        <div className="tarjeta__oferta">
          <div>
            <span className="tarjeta__oferta-etiqueta">
              {hayPujas ? 'Oferta actual' : 'Monto base'}
            </span>
            <span className="tarjeta__oferta-valor">
              {dinero(hayPujas ? vehiculo.monto_actual : vehiculo.monto_base)}
            </span>
          </div>
          <div className="tarjeta__pujas">
            <span className="tarjeta__pujas-numero">{vehiculo.total_pujas}</span>
            <span className="tarjeta__pujas-texto">
              {vehiculo.total_pujas === 1 ? 'oferta' : 'ofertas'}
            </span>
          </div>
        </div>

        <footer className="tarjeta__pie">
          {vehiculo.estado_calculado === 'activa' ? (
            <>
              <span className={`tarjeta__tiempo ${restante.dias === 0 ? 'tarjeta__tiempo--urgente' : ''}`}>
                {reloj(restante)}
              </span>
              <span className="tarjeta__resumen">{resumenTiempo(restante)}</span>
            </>
          ) : vehiculo.estado_calculado === 'programada' ? (
            <span className="tarjeta__resumen">
              Abre en {enCuanto(vehiculo.fecha_inicio, ahora)}
            </span>
          ) : vehiculo.estado_calculado === 'desierta' ? (
            <span className="tarjeta__resumen tarjeta__resumen--desierta">
              No se alcanzo el monto base
            </span>
          ) : (
            <span className="tarjeta__resumen">Cerrada por {dinero(vehiculo.monto_actual)}</span>
          )}
        </footer>

        <Link to={`/vehiculo/${vehiculo.id}`} className="tarjeta__accion">
          {vehiculo.estado_calculado === 'activa'
            ? 'Entrar a la subasta'
            : vehiculo.estado_calculado === 'programada'
              ? 'Ver detalles'
              : 'Ver resultado'}
        </Link>
      </div>
    </article>
  )
}