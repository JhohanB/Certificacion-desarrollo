import { useState, useCallback } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, Drawer } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, UserOutlined,
  TeamOutlined, SettingOutlined, AuditOutlined,
  BarChartOutlined, LogoutOutlined, MenuOutlined,
  BellOutlined, KeyOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useInactividad } from '../hooks/useInactividad'

const { Header, Sider, Content } = Layout
const { Text } = Typography

function MenuContent({ items, location, onMenuClick, enDrawer = false }) {
  const [openKeys, setOpenKeys] = useState(enDrawer ? [] : ['/configuracion'])

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      openKeys={openKeys}
      onOpenChange={setOpenKeys}
      items={items}
      onClick={onMenuClick}
      style={{ background: '#004A2F', borderRight: 0, flex: 1 }}
    />
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const { usuario, logout, esAdmin, rolActivo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleInactividad = useCallback(async () => {
    await logout()
    navigate('/login')
  }, [logout, navigate])

  useInactividad(handleInactividad)

  const esAdminActivo = !!rolActivo?.es_admin
  const esFuncionarioActivo = !!rolActivo?.es_funcionario_revision

  const items = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Inicio' },
    { key: '/solicitudes', icon: <FileTextOutlined />, label: 'Solicitudes' },
    esAdminActivo && { key: '/usuarios', icon: <TeamOutlined />, label: 'Usuarios' },
    (esAdminActivo || esFuncionarioActivo) && {
      key: '/configuracion',
      icon: <SettingOutlined />,
      label: 'Configuración',
      children: [
        esAdminActivo && { key: '/configuracion/roles', label: 'Roles y Permisos' },
        esAdminActivo && { key: '/configuracion/programas', label: 'Tipos de Programa' },
        { key: '/configuracion/plantillas', label: 'Plantillas' },
      ].filter(Boolean)
    },
    esAdminActivo && { key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes' },
    esAdminActivo && { key: '/auditoria', icon: <AuditOutlined />, label: 'Auditoría' },
  ].filter(Boolean)

  const menuUsuario = {
    items: [
      usuario?.roles?.length > 1 && {
        key: 'cambiar-rol',
        icon: <UserOutlined />,
        label: `Rol: ${rolActivo?.nombre}`,
        onClick: () => {
          sessionStorage.removeItem('rol_activo')
          window.location.href = '/seleccionar-rol'
        }
      },
      usuario?.roles?.length > 1 && { type: 'divider' },
      {
        key: 'perfil',
        icon: <UserOutlined />,
        label: 'Mi perfil',
        onClick: () => navigate('/perfil')
      },
      {
        key: 'password',
        icon: <KeyOutlined />,
        label: 'Cambiar contraseña',
        onClick: () => navigate('/cambiar-password')
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Cerrar sesión',
        danger: true,
        onClick: async () => {
          await logout()
          navigate('/login')
        }
      },
    ].filter(Boolean)
  }

  const onMenuClick = ({ key }) => {
    navigate(key)
    setDrawerVisible(false)
  }

  const LogoContent = ({ showText }) => (
    <div style={{
      height: 64, display: 'flex', alignItems: 'center',
      justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '0 16px'
    }}>
      <img src="/src/assets/logo_sena.png" alt="SENA"
        style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
      {showText && (
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>
          Certificaciones
        </Text>
      )}
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* Sidebar desktop — oculto en móvil */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="md"
        collapsedWidth={0}
        onBreakpoint={(broken) => setCollapsed(broken)}
        style={{
          background: '#004A2F',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}
      >
        <LogoContent showText={!collapsed} />
        <MenuContent items={items} location={location} onMenuClick={onMenuClick} enDrawer={false} />
      </Sider>

      {/* Drawer móvil */}
      <Drawer
        placement="left"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={220}
        styles={{ body: { padding: 0, background: '#004A2F' }, header: { display: 'none' } }}
      >
        <LogoContent showText={true} />
        <MenuContent items={items} location={location} onMenuClick={onMenuClick} enDrawer={true} />
      </Drawer>

      <Layout style={{ overflow: 'hidden' }}>
        {/* Header */}
        <Header style={{
          padding: '0 16px', background: 'white',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          position: 'sticky', top: 0, zIndex: 100
        }}>
          {/* Botón menú — en móvil abre Drawer, en desktop colapsa Sider */}
          <div
            onClick={() => {
              if (window.innerWidth < 768) {
                setDrawerVisible(true)
              } else {
                setCollapsed(!collapsed)
              }
            }}
            style={{ fontSize: 18, cursor: 'pointer', color: '#004A2F', padding: '0 8px' }}
          >
            <MenuOutlined />
          </div>

          {/* Info usuario */}
          <Dropdown menu={menuUsuario} placement="bottomRight" arrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar style={{ background: '#004A2F', flexShrink: 0 }}>
                {usuario?.nombre_completo?.charAt(0).toUpperCase()}
              </Avatar>
              <div style={{ lineHeight: 1.2, display: 'none' }}
                className="user-info-desktop">
                <div style={{ fontWeight: 600, fontSize: 13 }}>{usuario?.nombre_completo}</div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {usuario?.roles?.map(r => r.nombre).join(', ')}
                </div>
              </div>
            </div>
          </Dropdown>
        </Header>

        {/* Contenido */}
        <Content style={{ margin: 24, minHeight: 280, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}