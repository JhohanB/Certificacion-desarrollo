import { Button, Typography, Card, Row, Col } from 'antd'
import { FileAddOutlined, SearchOutlined, LoginOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import logoSena from '../assets/logo_sena.png'

const { Title, Text } = Typography

export default function Inicio() {
  const navigate = useNavigate()

  const opciones = [
    {
      icono: <FileAddOutlined style={{ fontSize: 42, color: '#004A2F' }} />,
      titulo: 'Realizar solicitud',
      descripcion:
        'Inicia tu proceso de certificación cargando los documentos requeridos de forma rápida y segura.',
      boton: 'Iniciar solicitud',
      onClick: () => navigate('/solicitud/nueva'),
      fondo: '#f6ffed',
      borde: '#b7eb8f'
    },
    {
      icono: <SearchOutlined style={{ fontSize: 42, color: '#1677ff' }} />,
      titulo: 'Consultar solicitud',
      descripcion:
        'Revisa el estado actual de tu solicitud utilizando tu número de documento y ficha.',
      boton: 'Consultar estado',
      onClick: () => navigate('/solicitud/consultar'),
      fondo: '#f0f5ff',
      borde: '#91caff'
    }
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 1100,
          borderRadius: 24,
          border: 'none',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}
        styles={{
          body: {
            padding: 0
          }
        }}
      >
        <Row>
          {/* Panel izquierdo */}
          <Col
            xs={24}
            md={10}
            style={{
              background: 'linear-gradient(180deg, #004A2F 0%, #006C44 100%)',
              padding: '48px 36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <img
                src={logoSena}
                alt="SENA"
                style={{
                  width: 90,
                  marginBottom: 24,
                  background: 'white',
                  padding: 12,
                  borderRadius: 50,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  objectFit: 'contain'
                }}
              />

              <Title
                level={2}
                style={{
                  color: 'white',
                  marginBottom: 12
                }}
              >
                Sistema de Certificación
              </Title>

              <Text
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 16,
                  display: 'block',
                  lineHeight: 1.7
                }}
              >
                Centro Atención Sector Agropecuario
              </Text>

              <div
                style={{
                  marginTop: 40,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                  padding: 20
                }}
              >
                <SafetyCertificateOutlined
                  style={{
                    fontSize: 28,
                    color: '#ffffff',
                    marginBottom: 12
                  }}
                />

                <Text
                  style={{
                    color: 'white',
                    display: 'block',
                    fontSize: 15,
                    lineHeight: 1.6
                  }}
                >
                  Gestiona tu proceso de certificación de manera organizada,
                  segura y sencilla desde cualquier lugar.
                </Text>
              </div>
            </div>

            <Button
              icon={<LoginOutlined />}
              size="large"
              onClick={() => navigate('/login')}
              style={{
                marginTop: 32,
                height: 50,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.12)',
                borderColor: 'rgba(255,255,255,0.25)',
                color: 'white',
                fontWeight: 500
              }}
            >
              Acceso funcionarios
            </Button>
          </Col>

          {/* Panel derecho */}
          <Col
            xs={24}
            md={14}
            style={{
              padding: '48px 40px',
              background: '#ffffff'
            }}
          >
            <Title
              level={3}
              style={{
                color: '#004A2F',
                marginBottom: 8
              }}
            >
              Bienvenido
            </Title>

            <Text
              type="secondary"
              style={{
                fontSize: 15,
                display: 'block',
                marginBottom: 36
              }}
            >
              Selecciona una opción para continuar con tu proceso.
            </Text>

            <Row gutter={[20, 20]}>
              {opciones.map((op, i) => (
                <Col xs={24} key={i}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: 18,
                      border: `1px solid ${op.borde}`,
                      background: op.fondo,
                      transition: '0.2s'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 20,
                        alignItems: 'center'
                      }}
                    >
                      <div>{op.icono}</div>

                      <div style={{ flex: 1 }}>
                        <Title
                          level={4}
                          style={{
                            marginBottom: 6
                          }}
                        >
                          {op.titulo}
                        </Title>

                        <Text
                          type="secondary"
                          style={{
                            display: 'block',
                            marginBottom: 18
                          }}
                        >
                          {op.descripcion}
                        </Text>

                        <Button
                          type="primary"
                          size="large"
                          onClick={op.onClick}
                          style={{
                            background: '#004A2F',
                            borderColor: '#004A2F',
                            borderRadius: 10
                          }}
                        >
                          {op.boton}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      </Card>
    </div>
  )
}