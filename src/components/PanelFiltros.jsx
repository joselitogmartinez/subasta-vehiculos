import { Boton, Seleccion } from './ui'
import { ORDENES, contarFiltros } from '../lib/filtros'
import { ETIQUETA_DANO } from '../lib/formato'

// Se evalua al cargar el modulo, no en cada render.
const ANIO_ACTUAL = new Date().getFullYear()

const TRENES = [
  { valor: 'AWD', texto: 'AWD · Todas las ruedas' },
  { valor: 'FWD', texto: 'FWD · Delanteras' },
  { valor: 'RWD', texto: 'RWD · Traseras' },
  { valor: '4WD', texto: '4WD · Cuatro ruedas' },
]

const ESTADOS = [
  { valor: 'activa', texto: 'En vivo ahora' },
  { valor: 'programada', texto: 'Proximamente' },
  { valor: 'vendida', texto: 'Vendidas' },
  { valor: 'desierta', texto: 'Desiertas' },
]

/**
 * Panel de filtros multitarea.
 *
 * Todos los criterios son combinables: buscar "Toyota" con daño verde y
 * orden por precio sigue funcionando porque cada uno se envía al
 * servidor como un filtro independiente.
 */
export default function PanelFiltros({ filtros, onCambio, onLimpiar, catalogos, abierta, onCerrar }) {
  const cambiar = (clave) => (e) => onCambio({ ...filtros, [clave]: e.target.value })

  const activos = contarFiltros(filtros)
  const anioMin = catalogos?.anio_min ?? 1990
  const anioMax = catalogos?.anio_max ?? ANIO_ACTUAL

  return (
    <aside className={`filtros ${abierta ? 'filtros--abierta' : ''}`} aria-label="Filtros">
      <div className="filtros__cabecera">
        <h2 className="filtros__titulo">Filtrar</h2>
        {activos > 0 && (
          <button type="button" className="filtros__limpiar" onClick={onLimpiar}>
            Limpiar ({activos})
          </button>
        )}
        <button
          type="button"
          className="filtros__cerrar"
          onClick={onCerrar}
          aria-label="Cerrar filtros"
        >
          ✕
        </button>
      </div>

      <div className="filtros__cuerpo">
        <div className="filtros__grupo">
          <label className="filtros__etiqueta" htmlFor="filtro-q">
            Buscar
          </label>
          <input
            id="filtro-q"
            type="search"
            className="filtros__input"
            placeholder="Marca o modelo..."
            value={filtros.q}
            onChange={cambiar('q')}
          />
        </div>

        <div className="filtros__grupo">
          <span className="filtros__etiqueta">Nivel de daño</span>
          <div className="filtros__dano">
            {Object.entries(ETIQUETA_DANO).map(([valor, datos]) => (
              <button
                key={valor}
                type="button"
                className={`filtros__chip filtros__chip--${valor} ${
                  filtros.dano === valor ? 'filtros__chip--activo' : ''
                }`}
                onClick={() => onCambio({ ...filtros, dano: filtros.dano === valor ? '' : valor })}
                aria-pressed={filtros.dano === valor}
              >
                <span className="filtros__chip-punto" aria-hidden="true" />
                {datos.texto}
              </button>
            ))}
          </div>
        </div>

        <div className="filtros__grupo filtros__grupo--par">
          <Seleccion
            etiqueta="Marca"
            placeholder="Todas"
            value={filtros.marca}
            onChange={cambiar('marca')}
            opciones={catalogos?.marcas ?? []}
          />
          <Seleccion
            etiqueta="Modelo"
            placeholder="Todos"
            value={filtros.modelo}
            onChange={cambiar('modelo')}
            opciones={catalogos?.modelos ?? []}
          />
        </div>

        <div className="filtros__grupo filtros__grupo--par">
          <Seleccion
            etiqueta="Tipo"
            placeholder="Todos"
            value={filtros.tipo}
            onChange={cambiar('tipo')}
            opciones={catalogos?.tipos ?? []}
          />
          <Seleccion
            etiqueta="Combustible"
            placeholder="Todos"
            value={filtros.combustible}
            onChange={cambiar('combustible')}
            opciones={catalogos?.combustibles ?? []}
          />
        </div>

        <div className="filtros__grupo">
          <span className="filtros__etiqueta">Año</span>
          <div className="filtros__rango">
            <input
              type="number"
              className="filtros__input"
              placeholder={String(anioMin)}
              min={anioMin}
              max={anioMax}
              aria-label="Año mínimo"
              value={filtros.anioMin}
              onChange={cambiar('anioMin')}
            />
            <span className="filtros__guion" aria-hidden="true">
              —
            </span>
            <input
              type="number"
              className="filtros__input"
              placeholder={String(anioMax)}
              min={anioMin}
              max={anioMax}
              aria-label="Año máximo"
              value={filtros.anioMax}
              onChange={cambiar('anioMax')}
            />
          </div>
        </div>

        <div className="filtros__grupo filtros__grupo--par">
          <Seleccion
            etiqueta="Transmisión"
            placeholder="Todas"
            value={filtros.transmision}
            onChange={cambiar('transmision')}
            opciones={catalogos?.transmisiones ?? []}
          />
          <Seleccion
            etiqueta="Tren de manejo"
            placeholder="Todos"
            value={filtros.tren}
            onChange={cambiar('tren')}
            opciones={TRENES}
          />
        </div>

        <div className="filtros__grupo">
          <Seleccion
            etiqueta="Cilindros"
            placeholder="Cualquiera"
            value={filtros.cilindros}
            onChange={cambiar('cilindros')}
            opciones={(catalogos?.cilindros ?? []).map((n) => String(n))}
          />
        </div>

        <div className="filtros__grupo">
          <Seleccion
            etiqueta="Estado de la subasta"
            placeholder="Todos"
            value={filtros.estado}
            onChange={cambiar('estado')}
            opciones={ESTADOS}
          />
        </div>

        <div className="filtros__grupo">
          <Seleccion
            etiqueta="Ordenar por"
            value={filtros.orden}
            onChange={cambiar('orden')}
            opciones={ORDENES}
          />
        </div>

        <div className="filtros__pie">
          <Boton variante="secundario" ancho onClick={onLimpiar} disabled={activos === 0}>
            Limpiar filtros
          </Boton>
        </div>
      </div>
    </aside>
  )
}

export { ESTADOS, TRENES }