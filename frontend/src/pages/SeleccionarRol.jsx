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
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          {/* Logo con fondo blanco para mejor contraste */}
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <img
              src="/src/assets/logo_sena.png"
              alt="SENA"
              style={{
                width: 58,
                height: 58,
                objectFit: 'contain',
              }}
            />
          </div>

          <Title
            level={3}
            style={{
              color: 'white',
              margin: 0,
            }}
          >
            Bienvenido, {usuario?.nombre_completo?.split(' ')[0]}
          </Title>

          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 15,
            }}
          >
            Selecciona el rol con el que deseas ingresar
          </Text>
        </div>

        {/* Roles */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {usuario?.roles?.map((rol) => (
            <Card
              key={rol.id}
              hoverable
              onClick={() => onSeleccionar(rol)}
              style={{
                borderRadius: 16,
                cursor: 'pointer',
                border: `2px solid ${
                  COLORES_ROL[rol.nombre] ?? '#004A2F'
                }`,
                boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                {/* Círculo inicial */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background:
                      COLORES_ROL[rol.nombre] ?? '#004A2F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {rol.nombre.charAt(0)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Tag
                    color={COLORES_ROL[rol.nombre]}
                    style={{
                      marginBottom: 8,
                      fontSize: 13,
                      padding: '4px 10px',
                    }}
                  >
                    {rol.nombre}
                  </Tag>

                  <div>
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
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