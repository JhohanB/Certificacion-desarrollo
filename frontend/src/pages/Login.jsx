import { useState } from 'react'
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Row,
  Col
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  ArrowLeftOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const { Title, Text } = Typography

export default function Login() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(
    () => sessionStorage.getItem('login_error') || null
  )

  const { login, seleccionarRol } = useAuth()
  const navigate = useNavigate()

  const mostrarError = (msg) => {
    sessionStorage.setItem('login_error', msg)
    setError(msg)
  }

  const limpiarError = () => {
    sessionStorage.removeItem('login_error')
    setError(null)
  }

  const onFinish = async (values) => {
    setCargando(true)

    try {
      const { data } = await api.post('/auth/login', values)

      limpiarError()
      login(data)

      if (data.usuario?.roles?.length === 1) {
        seleccionarRol(data.usuario.roles[0])
      }

      if (data.usuario?.debe_cambiar_password) {
        navigate('/cambiar-password')
      } else if (data.usuario?.debe_registrar_firma) {
        navigate('/registrar-firma')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      const mensaje = err.response?.data?.detail

      mostrarError(
        typeof mensaje === 'string'
          ? mensaje
          : 'Error al conectar con el servidor'
      )

      setCargando(false)
    }
  }

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
          maxWidth: 1000,
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
        <Row style={{ minHeight: 600 }}>
          {/* Panel izquierdo */}
          <Col xs={24} md={12}>
            <div
              style={{
                height: '100%',
                background:
                  'linear-gradient(180deg, #004A2F 0%, #006C44 100%)',
                padding: '48px 40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <img
                  src="/src/assets/logo_sena.png"
                  alt="SENA"
                  style={{
                    width: 90,
                    background: 'white',
                    padding: 12,
                    borderRadius: 50,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                    objectFit: 'contain',
                    marginBottom: 24
                  }}
                />

                <Title
                  level={2}
                  style={{
                    color: 'white',
                    marginBottom: 12
                  }}
                >
                  Acceso de Funcionarios
                </Title>

                <Text
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 16,
                    display: 'block',
                    lineHeight: 1.7
                  }}
                >
                  Ingresa al sistema institucional para gestionar solicitudes,
                  revisar documentos y completar el proceso de certificación.
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
                      lineHeight: 1.6
                    }}
                  >
                    Plataforma segura para la gestión de certificaciones del
                    Centro de Atención del Sector Agropecuario.
                  </Text>
                </div>
              </div>

              <Button
                icon={<ArrowLeftOutlined />}
                size="large"
                onClick={() => navigate('/')}
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
                Volver al inicio
              </Button>
            </div>
          </Col>

          {/* Panel derecho */}
          <Col xs={24} md={12}>
            <div
              style={{
                height: '100%',
                padding: '48px 40px',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <Title
                level={3}
                style={{
                  color: '#004A2F',
                  marginBottom: 8
                }}
              >
                Iniciar sesión
              </Title>

              <Text
                type="secondary"
                style={{
                  display: 'block',
                  marginBottom: 28
                }}
              >
                Ingresa tus credenciales para continuar
              </Text>

              {error && (
                <Alert
                  message={error}
                  type="error"
                  showIcon
                  closable
                  onClose={limpiarError}
                  style={{
                    marginBottom: 20,
                    borderRadius: 10
                  }}
                />
              )}

              <Form
                layout="vertical"
                onFinish={onFinish}
                onValuesChange={limpiarError}
              >
                <Form.Item
                  name="correo"
                  label="Correo electrónico"
                  rules={[
                    {
                      required: true,
                      message: 'Ingresa tu correo'
                    },
                    {
                      type: 'email',
                      message: 'Ingresa un correo válido'
                    }
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="correo@sena.edu.co"
                    size="large"
                    style={{
                      borderRadius: 10
                    }}
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Contraseña"
                  rules={[
                    {
                      required: true,
                      message: 'Ingresa tu contraseña'
                    }
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Tu contraseña"
                    size="large"
                    style={{
                      borderRadius: 10
                    }}
                  />
                </Form.Item>

                <Form.Item
                  style={{
                    marginTop: 24,
                    marginBottom: 0
                  }}
                >
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={cargando}
                    style={{
                      height: 48,
                      background: '#004A2F',
                      borderColor: '#004A2F',
                      borderRadius: 10,
                      fontWeight: 600
                    }}
                  >
                    Ingresar al sistema
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}