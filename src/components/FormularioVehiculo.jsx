import { Campo } from './ui'
import { paraInputFechaHora } from '../lib/formato'

/**
 * Ficha tecnica y parametros de subasta.
 *
 * Marca, modelo, tipo, combustible y transmision usan entradas con
 * sugerencias (datalist) en vez de desplegables cerrados: el usuario
 * puede elegir una de las existentes o escribir una nueva sin que
 * ningun otro este obligado a repetirla.
 *
 * El tren de manejo si es un desplegable cerrado, porque el enunciado
 * fija exactamente los cuatro valores admitidos.
 */

const TRENES = [
  { valor: 'FWD', texto: 'FWD · Traccion delantera' },
  { valor: 'RWD', texto: 'RWD · Traccion trasera' },
  { valor: 'AWD', texto: 'AWD · Todas las ruedas' },
  { valor: '4WD', texto: '4WD · Cuatro ruedas motrices' },
]

const ANIO_ACTUAL = new Date().getFullYear()

const DANOS = [
  {
    valor: 'verde',
    titulo: 'Daño menor',
    detalle: 'Limpio, sin golpes. Listo para usar.',
  },
  {
    valor: 'amarillo',
    titulo: 'Daño medio',
    detalle: 'Reparable. Golpes o rayones que no afectan el uso.',
  },
  {
    valor: 'rojo',
    titulo: 'Daño severo',
    detalle: 'Salvamento. Averías importantes o pérdida total.',
  },
]

export default function FormularioVehiculo({
  valores,
  errores,
  onCambio,
  catalogos,
 disabled = false,
}) {
  const cambiar = (campo) => (e) => onCambio({ ...valores, [campo]: e.target.value })

  // Campo de texto libre con lista de sugerencias. El `id` fijo permite
  // apuntar el <datalist> correspondiente con el atributo `list`.
  const conSugerencias = (campo) => ({
    id: `veh-${campo}`,
    list: `lista-${campo}`,
    autoComplete: 'off',
    value: valores[campo] ?? '',
    onChange: cambiar(campo),
    error: errores[campo],
  })

  return (
    <div className="formulario">
      <fieldset className="formulario__grupo" disabled={disabled}>
        <legend className="formulario__leyenda">Ficha técnica</legend>

        <div className="formulario__rejilla">
          <Campo
            etiqueta="Año"
            type="number"
            placeholder="2020"
            min={1900}
            max={ANIO_ACTUAL + 1}
            value={valores.anio}
            onChange={cambiar('anio')}
            error={errores.anio}
            required
          />

          <Campo
            {...conSugerencias('tipo_articulo')}
            etiqueta="Tipo de artículo"
            placeholder="Automóvil"
            autoComplete="off"
          />

          <datalist id="lista-tipo_articulo">
            {(catalogos?.tipos ?? []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <Campo
            {...conSugerencias('marca')}
            etiqueta="Marca"
            placeholder="Toyota"
            autoComplete="off"
          />

          <datalist id="lista-marca">
            {(catalogos?.marcas ?? []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <Campo
            {...conSugerencias('modelo')}
            etiqueta="Modelo"
            placeholder="COROLLA LE"
            autoComplete="off"
          />

          <datalist id="lista-modelo">
            {(catalogos?.modelos ?? []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <Campo
            etiqueta="Motor"
            placeholder="1.8L 4 cilindros"
            value={valores.motor}
            onChange={cambiar('motor')}
            error={errores.motor}
            required
          />

          <Campo
            {...conSugerencias('transmision')}
            etiqueta="Transmisión"
            placeholder="Automática CVT"
            autoComplete="off"
          />

          <datalist id="lista-transmision">
            {(catalogos?.transmisiones ?? []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <Campo
            {...conSugerencias('combustible')}
            etiqueta="Combustible"
            placeholder="Gasolina"
            autoComplete="off"
          />

          <datalist id="lista-combustible">
            {(catalogos?.combustibles ?? []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <div className="campo">
            <label className="campo__etiqueta" htmlFor="veh-tren">
              Tren de manejo
            </label>
            <div className="campo__select">
              <select
                id="veh-tren"
                value={valores.tren_manejo}
                onChange={cambiar('tren_manejo')}
                disabled={disabled}
              >
                <option value="">Selecciona...</option>
                {TRENES.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </div>
            {errores.tren_manejo && <p className="campo__error">{errores.tren_manejo}</p>}
          </div>

          <div className="campo">
            <label className="campo__etiqueta" htmlFor="veh-cilindros">
              Número de cilindros
            </label>
            <div className="campo__select">
              <select
                id="veh-cilindros"
                value={valores.num_cilindros}
                onChange={cambiar('num_cilindros')}
                disabled={disabled}
              >
                <option value="">Selecciona...</option>
                {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            {errores.num_cilindros && <p className="campo__error">{errores.num_cilindros}</p>}
          </div>
        </div>

        <div className="formulario__campo-ancho">
          <Campo
            etiqueta="Descripción"
            multilinea
            placeholder="Estado general, mantenimiento, documentos y cualquier detalle relevante."
            value={valores.descripcion}
            onChange={cambiar('descripcion')}
            error={errores.descripcion}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <fieldset className="formulario__grupo" disabled={disabled}>
        <legend className="formulario__leyenda">Clasificación por estado de daño</legend>
        <div className="dano">
          {DANOS.map((d) => (
            <label
              key={d.valor}
              className={`dano__opcion dano__opcion--${d.valor} ${valores.nivel_dano === d.valor ? 'dano__opcion--activa' : ''}`}
            >
              <input
                type="radio"
                name="nivel_dano"
                value={d.valor}
                checked={valores.nivel_dano === d.valor}
                onChange={() => onCambio({ ...valores, nivel_dano: d.valor })}
              />
              <span className="dano__punto" aria-hidden="true" />
              <span className="dano__texto">
                <strong>{d.titulo}</strong>
                <small>{d.detalle}</small>
              </span>
            </label>
          ))}
        </div>
        {errores.nivel_dano && <p className="campo__error">{errores.nivel_dano}</p>}
      </fieldset>

      <fieldset className="formulario__grupo" disabled={disabled}>
        <legend className="formulario__leyenda">Parámetros de la subasta</legend>
        <div className="formulario__rejilla">
          <Campo
            contenedor="campo--ancho"
            etiqueta="Monto base (Q.)"
            type="number"
            min={1}
            step="0.01"
            placeholder="20000"
            value={valores.monto_base}
            onChange={cambiar('monto_base')}
            error={errores.monto_base}
            ayuda="Nadie puede ofertar por menos de este monto. Ejemplo: Q. 20,000."
            required
          />

          <Campo
            etiqueta="Fecha y hora de inicio"
            type="datetime-local"
            value={paraInputFechaHora(valores.fecha_inicio)}
            onChange={cambiar('fecha_inicio')}
            error={errores.fecha_inicio}
            ayuda="Antes de esta fecha no se puede ofertar."
            required
          />

          <Campo
            etiqueta="Fecha y hora de cierre"
            type="datetime-local"
            value={paraInputFechaHora(valores.fecha_cierre)}
            onChange={cambiar('fecha_cierre')}
            error={errores.fecha_cierre}
            ayuda="Al llegar aquí la oferta se cierra y la subasta se declara desierta si nadie alcanzó el monto base."
            required
          />
        </div>
      </fieldset>
    </div>
  )
}