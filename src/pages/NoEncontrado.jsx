import { Link } from 'react-router-dom'

export default function NoEncontrado() {
  return (
    <div className="proximamente">
      <div className="proximamente__panel">
        <span className="proximamente__icono" aria-hidden="true">
          🧭
        </span>
        <h1 className="proximamente__titulo">Pagina no encontrada</h1>
        <p className="proximamente__texto">
          La direccion que buscas no existe o el vehiculo ya no esta disponible.
        </p>
        <Link className="btn btn--primario" to="/">
          Volver al catalogo
        </Link>
      </div>
    </div>
  )
}