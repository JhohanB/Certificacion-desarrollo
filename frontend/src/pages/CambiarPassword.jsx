import { useState } from 'react'
import {Form, Input, Button, Card, Typography, Alert, Result } from 'antd'
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

  const esPrimerLogin = Boolean(usuario?.debe_cambiar_password)

  const onFinish = async (values) => {
    setCargando(true)
    setError(null)

    try {
      await api.put('/auth/cambiar-password', {
        password_actual: values.password_actual,
        password_nueva: values.password_nueva,
        password_confirmacion: values.password_nueva,
      })

      // actualizar contexto
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
      setError(
        typeof mensaje === 'string'
          ? mensaje
          : 'Error al cambiar la contraseña'
      )
    } finally {
      setCargando(false)
    }
  }

  if (exitoso) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
          padding: 16
        }}
      >
        <Card
          style={{
            width: '100%',
            maxWidth: 500,
            borderRadius: 16,
            textAlign: 'center'
          }}
        >
          <Result
            status="success"
            title="¡Contraseña actualizada!"
            subTitle="Tu contraseña ha sido cambiada exitosamente."
            extra={
              <Button
                type="primary"
                size="large"
                style={{
                  background: '#004A2F',
                  borderColor: '#004A2F'
                }}
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
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px'
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 500,
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 24
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#f6ffed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid #b7eb8f'
            }}
          >
            <LockOutlined
              style={{
                fontSize: 34,
                color: '#004A2F'
              }}
            />
          </div>

          <Title
            level={4}
            style={{
              margin: 0,
              color: '#004A2F'
            }}
          >
            {esPrimerLogin
              ? 'Crea tu contraseña'
              : 'Cambiar contraseña'}
          </Title>

          <Text
            type="secondary"
            style={{
              display: 'block',
              marginTop: 8
            }}
          >
            {esPrimerLogin
              ? 'Por seguridad debes crear una contraseña personal antes de continuar'
              : 'Ingresa tu contraseña actual y define una nueva contraseña'}
          </Text>
        </div>

        {/* Aviso primer login */}
        {esPrimerLogin && (
          <Alert
            type="warning"
            showIcon
            message="Debes cambiar tu contraseña temporal antes de continuar"
            style={{
              marginBottom: 20,
              borderRadius: 10
            }}
          />
        )}

        {/* Error */}
        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            style={{
              marginBottom: 20,
              borderRadius: 10
            }}
          />
        )}

        {/* Formulario */}
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="password_actual"
            label={
              esPrimerLogin
                ? 'Contraseña temporal'
                : 'Contraseña actual'
            }
            rules={[
              {
                required: true,
                message: 'Ingresa tu contraseña actual'
              }
            ]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder={
                esPrimerLogin
                  ? 'Contraseña recibida por correo'
                  : 'Tu contraseña actual'
              }
            />
          </Form.Item>

          <Form.Item
            name="password_nueva"
            label="Nueva contraseña"
            rules={[
              {
                required: true,
                message: 'Ingresa la nueva contraseña'
              },
              {
                min: 8,
                message: 'Mínimo 8 caracteres'
              },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message:
                  'Debe tener al menos una mayúscula, una minúscula y un número'
              }
            ]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="Mínimo 8 caracteres"
            />
          </Form.Item>

          <Form.Item
            name="confirmar_password"
            label="Confirmar nueva contraseña"
            dependencies={['password_nueva']}
            rules={[
              {
                required: true,
                message: 'Confirma tu nueva contraseña'
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (
                    !value ||
                    getFieldValue('password_nueva') === value
                  ) {
                    return Promise.resolve()
                  }

                  return Promise.reject(
                    new Error(
                      'Las contraseñas no coinciden'
                    )
                  )
                }
              })
            ]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="Repite la nueva contraseña"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={cargando}
            icon={<CheckCircleOutlined />}
            style={{
              background: '#004A2F',
              borderColor: '#004A2F',
              height: 48,
              marginTop: 8
            }}
          >
            {esPrimerLogin
              ? 'Crear contraseña'
              : 'Actualizar contraseña'}
          </Button>
        </Form>
      </Card>
    </div>
  )
}