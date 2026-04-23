import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Spin } from 'antd'
import Login from './pages/Login'
import AppLayout from './components/Layout'
import Inicio from './pages/Inicio'
import NuevaSolicitud from './pages/NuevaSolicitud'
import ConsultarSolicitud from './pages/ConsultarSolicitud'
import CambiarPassword from './pages/CambiarPassword'
import RegistrarFirma from './pages/RegistrarFirma'
import SeleccionarRol from './pages/SeleccionarRol'
import CorregirSolicitud from './pages/CorregirSolicitud'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'
import PageSkeleton from './components/PageSkeleton'

// Lazy load de páginas privadas para reducir bundle inicial
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Solicitudes = React.lazy(() => import('./pages/Solicitudes'))
const DetalleSolicitud = React.lazy(() => import('./pages/DetalleSolicitud'))
const Usuarios = React.lazy(() => import('./pages/Usuarios'))
const TiposPrograma = React.lazy(() => import('./pages/configuracion/TiposPrograma'))
const Roles = React.lazy(() => import('./pages/configuracion/Roles'))
const Plantillas = React.lazy(() => import('./pages/configuracion/Plantillas'))
const Reportes = React.lazy(() => import('./pages/Reportes'))
const Auditoria = React.lazy(() => import('./pages/Auditoria'))
const Perfil = React.lazy(() => import('./pages/Perfil'))

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
        <Route path="/dashboard" element={
          <Suspense fallback={<PageSkeleton title="Cargando dashboard..." />}>
            <Dashboard />
          </Suspense>
        } />
        <Route path="/solicitudes" element={
          <Suspense fallback={<PageSkeleton title="Cargando solicitudes..." />}>
            <Solicitudes />
          </Suspense>
        } />
        <Route path="/solicitudes/:id" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <DetalleSolicitud />
          </Suspense>
        } />
        <Route path="/usuarios" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <Usuarios />
          </Suspense>
        } />
        <Route path="/configuracion/programas" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <TiposPrograma />
          </Suspense>
        } />
        <Route path="/configuracion/roles" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <Roles />
          </Suspense>
        } />
        <Route path="/configuracion/plantillas" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <Plantillas />
          </Suspense>
        } />
        <Route path="/reportes" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <Reportes />
          </Suspense>
        } />
        <Route path="/auditoria" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <Auditoria />
          </Suspense>
        } />
        <Route path="/perfil" element={
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <Perfil />
          </Suspense>
        } />
        <Route path="/*" element={<div>Página no encontrada</div>} />
      </Route>
    </Routes>
  )
}

export default App