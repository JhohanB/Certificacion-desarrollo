import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { UserOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const { Title, Text } = Typography

export default function Login() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(() => sessionStorage.getItem('login_error') || null)
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
      mostrarError(typeof mensaje === 'string' ? mensaje : 'Error al conectar con el servidor')
      setCargando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
    }}>
      <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/src/assets/logo_sena.png" alt="SENA"
            style={{ width: 80, height: 80, objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
          <Title level={3} style={{ margin: 0, color: '#004A2F' }}>SENA Certificaciones</Title>
          <Text type="secondary">Ingresa tus credenciales para continuar</Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={limpiarError}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish}
          onValuesChange={limpiarError}
        >
          <Form.Item name="correo" label="Correo electrónico"
            rules={[
              { required: true, message: 'Ingresa tu correo' },
              { type: 'email', message: 'Ingresa un correo válido' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="correo@sena.edu.co" size="large" />
          </Form.Item>

          <Form.Item name="password" label="Contraseña"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Tu contraseña" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary" htmlType="submit" size="large" block
              loading={cargando}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Ingresar
            </Button>
            <Button type="link" icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
              style={{ padding: 0, marginTop: 16, color: '#004A2F' }}
            >
              Volver al inicio
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}