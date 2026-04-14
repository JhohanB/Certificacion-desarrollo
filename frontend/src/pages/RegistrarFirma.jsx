import { useState } from 'react'
import { Card, Typography, Button, Alert, Result, Upload } from 'antd'
import { InboxOutlined, CheckCircleOutlined, SignatureOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const { Title, Text } = Typography
const { Dragger } = Upload

export default function RegistrarFirma() {
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [exitoso, setExitoso] = useState(false)
  const { usuario, login } = useAuth()
  const navigate = useNavigate()

  const seleccionarArchivo = (file) => {
    const extensiones = ['image/jpeg', 'image/jpg', 'image/png']
    if (!extensiones.includes(file.type)) {
      setError('Solo se permiten imágenes JPG o PNG')
      return false
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar 5MB')
      return false
    }
    setError(null)
    setArchivo(file)
    setPreview(URL.createObjectURL(file))
    return false // Evitar subida automática
  }

  const enviar = async () => {
    if (!archivo) {
      setError('Selecciona una imagen de tu firma')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)

      await api.post(`/usuarios/${usuario.id}/firma`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      // Actualizar usuario en contexto
      const usuarioActualizado = { ...usuario, debe_registrar_firma: false, firma_registrada: true }
      const accessToken = sessionStorage.getItem('access_token')
      const refreshToken = sessionStorage.getItem('refresh_token')
      login({ access_token: accessToken, refresh_token: refreshToken, usuario: usuarioActualizado })

      setExitoso(true)
    } catch (err) {
      const mensaje = err.response?.data?.detail
      setError(typeof mensaje === 'string' ? mensaje : 'Error al registrar la firma')
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
            title="¡Firma registrada!"
            subTitle="Tu firma ha sido registrada exitosamente en el sistema."
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
      <Card style={{ maxWidth: 480, width: '100%', borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <SignatureOutlined style={{ fontSize: 40, color: '#004A2F', marginBottom: 12 }} />
          <Title level={4} style={{ color: '#004A2F', margin: 0 }}>
            Registrar firma
          </Title>
          <Text type="secondary">
            Debes registrar tu firma antes de continuar. Esta se usará para firmar las solicitudes de certificación.
          </Text>
        </div>

        <Alert
          type="info"
          showIcon
          title="Recomendaciones para la firma"
          description="Usa una imagen con fondo blanco o transparente. El sistema eliminará el fondo automáticamente. Formatos permitidos: JPG, PNG."
          style={{ marginBottom: 24 }}
        />

        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Preview */}
        {preview && (
          <div style={{
            textAlign: 'center', marginBottom: 16,
            padding: 16, background: '#f5f5f5', borderRadius: 8
          }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Vista previa:
            </Text>
            <img
              src={preview}
              alt="Preview firma"
              style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain' }}
            />
          </div>
        )}

        <Dragger
          accept=".jpg,.jpeg,.png"
          maxCount={1}
          beforeUpload={seleccionarArchivo}
          showUploadList={false}
          style={{ marginBottom: 24 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#004A2F' }} />
          </p>
          <p className="ant-upload-text">
            {archivo ? archivo.name : 'Arrastra tu firma aquí o haz clic para seleccionar'}
          </p>
          <p className="ant-upload-hint">JPG o PNG, máximo 5MB</p>
        </Dragger>

        <Button
          type="primary"
          size="large"
          block
          loading={cargando}
          icon={<CheckCircleOutlined />}
          onClick={enviar}
          style={{ background: '#004A2F', borderColor: '#004A2F' }}
        >
          Registrar firma
        </Button>
      </Card>
    </div>
  )
}