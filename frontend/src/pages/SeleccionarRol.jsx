import { Card, Typography, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const { Title, Text } = Typography

const COLORES_ROL = {
  ADMIN: '#004A2F',
  FUNCIONARIO_CERTIFICACION: '#1677ff',
  COORDINADOR: '#722ed1',
  APE: '#fa8c16',
  BIENESTAR: '#eb2f96',
  BIBLIOTECA: '#13c2c2',
  INSTRUCTOR_SEGUIMIENTO: '#52c41a',
}

const DESCRIPCIONES_ROL = {
  ADMIN: 'Gestión completa del sistema',
  FUNCIONARIO_CERTIFICACION: 'Revisión y gestión de solicitudes',
  COORDINADOR: 'Coordinación y firma de certificaciones',
  APE: 'Firma de solicitudes — Agencia Pública de Empleo',
  BIENESTAR: 'Firma de solicitudes — Bienestar',
  BIBLIOTECA: 'Firma de solicitudes — Biblioteca',
  INSTRUCTOR_SEGUIMIENTO: 'Firma de solicitudes — Seguimiento',
}

export default function SeleccionarRol() {
  const { usuario, seleccionarRol } = useAuth()
  const navigate = useNavigate()

  const onSeleccionar = (rol) => {
    seleccionarRol(rol)
    navigate('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
      padding: 24
    }}>
      <div style={{ maxWidth: 500, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/src/assets/logo_sena.png"
            alt="SENA"
            style={{ width: 70, height: 70, objectFit: 'contain', marginBottom: 16 }}
          />
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            Bienvenido, {usuario?.nombre_completo?.split(' ')[0]}
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Selecciona el rol con el que deseas ingresar
          </Text>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {usuario?.roles?.map(rol => (
            <Card
              key={rol.id}
              hoverable
              onClick={() => onSeleccionar(rol)}
              style={{
                borderRadius: 12,
                cursor: 'pointer',
                border: `2px solid ${COLORES_ROL[rol.nombre] ?? '#004A2F'}`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: COLORES_ROL[rol.nombre] ?? '#004A2F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 'bold', fontSize: 18, flexShrink: 0
                }}>
                  {rol.nombre.charAt(0)}
                </div>
                <div>
                  <Tag color={COLORES_ROL[rol.nombre]} style={{ marginBottom: 4 }}>
                    {rol.nombre}
                  </Tag>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {DESCRIPCIONES_ROL[rol.nombre] ?? ''}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}