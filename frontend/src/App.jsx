import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Spin } from 'antd'
import Login from './pages/Login'
import AppLayout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inicio from './pages/Inicio'
import NuevaSolicitud from './pages/NuevaSolicitud'
import ConsultarSolicitud from './pages/ConsultarSolicitud'
import Solicitudes from './pages/Solicitudes'
import CambiarPassword from './pages/CambiarPassword'
import DetalleSolicitud from './pages/DetalleSolicitud'
import RegistrarFirma from './pages/RegistrarFirma'
import Usuarios from './pages/Usuarios'
import SeleccionarRol from './pages/SeleccionarRol'
import CorregirSolicitud from './pages/CorregirSolicitud'
import TiposPrograma from './pages/configuracion/TiposPrograma'
import Roles from './pages/configuracion/Roles'
import Plantillas from './pages/configuracion/Plantillas'
import Reportes from './pages/Reportes'
import Auditoria from './pages/Auditoria'
import Perfil from './pages/Perfil'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'

const Proximamente = ({ titulo }) => (
  <div style={{
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)'
  }}>
    <Result
      status="info"
      title={titulo}
      subTitle="Esta sección está en construcción"
      extra={
        <Button
          type="primary"
          icon={<ArrowLeftOutlined />}
          onClick={() => window.location.href = '/'}
          style={{ background: '#004A2F', borderColor: '#004A2F' }}
        >
          Volver al inicio
        </Button>
      }
    />
  </div>
)

function RutaPrivada() {
  const { usuario, debeCambiarPassword, debeRegistrarFirma, debeSeleccionarRol } = useAuth()

  if (!usuario) return <Navigate to="/login" />
  if (debeCambiarPassword) return <Navigate to="/cambiar-password" />
  if (debeRegistrarFirma) return <Navigate to="/registrar-firma" />
  if (debeSeleccionarRol) return <Navigate to="/seleccionar-rol" />

  return <AppLayout />
}

function App() {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/" element={<Inicio />} />
      <Route path="/solicitud/nueva" element={<NuevaSolicitud />} />
      <Route path="/solicitud/consultar" element={<ConsultarSolicitud />} />
      <Route path="/login" element={!usuario ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/corregir/:token" element={<CorregirSolicitud />} />

      {/* Rutas de primer login — accesibles sin pasar por RutaPrivada */}
      <Route path="/cambiar-password" element={usuario ? <CambiarPassword /> : <Navigate to="/login" />} />
      <Route path="/registrar-firma" element={usuario ? <RegistrarFirma /> : <Navigate to="/login" />} />
      <Route path="/seleccionar-rol" element={usuario ? <SeleccionarRol /> : <Navigate to="/login" />} />


      {/* Rutas privadas */}
      <Route element={<RutaPrivada />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/configuracion/programas" element={<TiposPrograma />} />
        <Route path="/configuracion/roles" element={<Roles />} />
        <Route path="/configuracion/plantillas" element={<Plantillas />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/*" element={<div>Página no encontrada</div>} />
      </Route>
    </Routes>
  )
}

export default App