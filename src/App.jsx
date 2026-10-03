import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProveedorAuth from './context/ProveedorAuth'
import Navbar from './components/Navbar'
import Privado, { SoloAnonimo } from './components/Privado'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Home from './pages/Home'
import DetalleVehiculo from './pages/DetalleVehiculo'
import Publicar from './pages/Publicar'
import MisPublicaciones from './pages/MisPublicaciones'
import EditarVehiculo from './pages/EditarVehiculo'
import NoEncontrado from './pages/NoEncontrado'

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorAuth>
        <div className="app">
          <Navbar />

          <main className="app__contenido">
            <Routes>
              {/* Catálogo: visible sin iniciar sesión (modo lectura) */}
              <Route path="/" element={<Home />} />

              {/* Detalle y subasta en vivo */}
              <Route path="/vehiculo/:id" element={<DetalleVehiculo />} />

              {/* Exigen sesión */}
              <Route
                path="/publicar"
                element={
                  <Privado>
                    <Publicar />
                  </Privado>
                }
              />
              <Route
                path="/mis-publicaciones"
                element={
                  <Privado>
                    <MisPublicaciones />
                  </Privado>
                }
              />
              <Route
                path="/editar/:id"
                element={
                  <Privado>
                    <EditarVehiculo />
                  </Privado>
                }
              />

              {/* Autenticación */}
              <Route
                path="/login"
                element={
                  <SoloAnonimo>
                    <Login />
                  </SoloAnonimo>
                }
              />
              <Route
                path="/registro"
                element={
                  <SoloAnonimo>
                    <Registro />
                  </SoloAnonimo>
                }
              />

              <Route path="*" element={<NoEncontrado />} />
            </Routes>
          </main>

          <footer className="app__pie">
            <p>
              SubastaYA · Proyecto academico de WebDev 2026 · Frontend React + Vite,
              backend Supabase (PostgreSQL, Auth, Storage, Realtime)
            </p>
          </footer>
        </div>
      </ProveedorAuth>
    </BrowserRouter>
  )
}