import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Result } from 'antd'
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const { Title, Text } = Typography

export default function CambiarPassword() {
  const [form] = Form.useForm()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [exitoso, setExitoso] = useState(false)
  const { usuario, login } = useAuth()
  const navigate = useNavigate()

  const esPrimerLogin = usuario?.debe_cambiar_password

  const onFinish = async (values) => {
    setCargando(true)
    setError(null)
    try {
      const { data } = await api.put('/auth/cambiar-password', {
        password_actual: values.password_actual,
        password_nueva: values.password_nueva,
        password_confirmacion: values.password_nueva,
      })

      // Actualizar usuario en contexto con debe_cambiar_password = false
      const usuarioActualizado = {
        ...usuario,
        debe_cambiar_password: false
      }
      const accessToken = sessionStorage.getItem('access_token')
      const refreshToken = sessionStorage.getItem('refresh_token')
      login({
        access_token: accessToken,
        refresh_token: refreshToken,
        usuario: usuarioActualizado
      })

      setExitoso(true)
    } catch (err) {
      const mensaje = err.response?.data?.detail
      setError(typeof mensaje === 'string' ? mensaje : 'Error al cambiar la contraseña')
    } finally {
      setCargando(false)
    }
  }

  if (exitoso) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
        padding: 24
      }}>
        <Card style={{ maxWidth: 440, width: '100%', borderRadius: 16, textAlign: 'center' }}>
          <Result
            status="success"
            title="¡Contraseña actualizada!"
            subTitle="Tu contraseña ha sido cambiada exitosamente."
            extra={
              <Button
                type="primary"
                size="large"
                style={{ background: '#004A2F', borderColor: '#004A2F' }}
                onClick={() => navigate('/dashboard')}
              >
                Ir al sistema
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
      padding: 24
    }}>
      <Card style={{ maxWidth: 440, width: '100%', borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LockOutlined style={{ fontSize: 40, color: '#004A2F', marginBottom: 12 }} />
          <Title level={4} style={{ color: '#004A2F', margin: 0 }}>
            {esPrimerLogin ? 'Crea tu contraseña' : 'Cambiar contraseña'}
          </Title>
          <Text type="secondary">
            {esPrimerLogin
              ? 'Por seguridad debes crear una contraseña personal antes de continuar'
              : 'Ingresa tu contraseña actual y la nueva contraseña'}
          </Text>
        </div>

        {esPrimerLogin && (
          <Alert
            type="warning"
            showIcon
            message="Debes cambiar tu contraseña temporal antes de continuar"
            style={{ marginBottom: 24 }}
          />
        )}

        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="password_actual"
            label={esPrimerLogin ? 'Contraseña temporal' : 'Contraseña actual'}
            rules={[{ required: true, message: 'Ingresa tu contraseña actual' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={esPrimerLogin ? 'Contraseña recibida por correo' : 'Tu contraseña actual'}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password_nueva"
            label="Nueva contraseña"
            rules={[
              { required: true, message: 'Ingresa la nueva contraseña' },
              { min: 8, message: 'Mínimo 8 caracteres' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: 'Debe tener al menos una mayúscula, una minúscula y un número'
              }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mínimo 8 caracteres"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmar_password"
            label="Confirmar nueva contraseña"
            dependencies={['password_nueva']}
            rules={[
              { required: true, message: 'Confirma tu nueva contraseña' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password_nueva') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Las contraseñas no coinciden'))
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Repite la nueva contraseña"
              size="large"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={cargando}
            icon={<CheckCircleOutlined />}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}
          >
            {esPrimerLogin ? 'Crear contraseña' : 'Actualizar contraseña'}
          </Button>
        </Form>
      </Card>
    </div>
  )
}