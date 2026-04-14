import { useState, useEffect } from 'react'
import { Card, Typography, Form, Input, Button, Alert, Descriptions, Tag, Avatar, Modal } from 'antd'
import { UserOutlined, SaveOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'
import api, { API_URL } from '../api/axios'

const { Title, Text } = Typography

export default function Perfil() {
  const { usuario, login, rolActivo } = useAuth()
  const [form] = Form.useForm()
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState(null)
  const [modalFirma, setModalFirma] = useState(false)
  const [archivoFirma, setArchivoFirma] = useState(null)
  const [previewFirma, setPreviewFirma] = useState(null)
  const [subiendoFirma, setSubiendoFirma] = useState(false)
  const [errorFirma, setErrorFirma] = useState(null)
  const [datosCompletos, setDatosCompletos] = useState(null)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data } = await api.get('/auth/me')
        setDatosCompletos(data)
      } catch {}
    }
    if (usuario?.id) cargarDatos()
  }, [usuario?.id])

  useEffect(() => {
    if (usuario) {
      form.setFieldsValue({
        nombre_completo: usuario.nombre_completo,
        telefono: usuario.telefono,
      })
    }
  }, [usuario])

  const guardar = async (values) => {
    setGuardando(true)
    setExito(false)
    setError(null)
    try {
      await api.put(`/usuarios/${usuario.id}`, values)
      const { data } = await api.get('/auth/me')
      const accessToken = sessionStorage.getItem('access_token')
      const refreshToken = sessionStorage.getItem('refresh_token')
      login({ access_token: accessToken, refresh_token: refreshToken, usuario: data })
      setExito(true)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Error al actualizar')
    } finally {
      setGuardando(false)
    }
  }

  const seleccionarFirma = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setErrorFirma('Solo se permiten imágenes JPG o PNG')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorFirma('La imagen no debe superar 5MB')
      return
    }
    setErrorFirma(null)
    setArchivoFirma(file)
    setPreviewFirma(URL.createObjectURL(file))
  }

  const subirFirma = async () => {
    if (!archivoFirma) return
    setSubiendoFirma(true)
    setErrorFirma(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivoFirma)
      await api.post(`/usuarios/${usuario.id}/firma`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      // Recargar datos completos para obtener la nueva firma_url
      const { data } = await api.get(`/usuarios/${usuario.id}`)
      setDatosCompletos(data)
      const usuarioActualizado = { ...usuario, firma_registrada: true }
      const accessToken = sessionStorage.getItem('access_token')
      const refreshToken = sessionStorage.getItem('refresh_token')
      login({ access_token: accessToken, refresh_token: refreshToken, usuario: usuarioActualizado })
      setModalFirma(false)
      setArchivoFirma(null)
      setPreviewFirma(null)
    } catch (err) {
      setErrorFirma(err.response?.data?.detail ?? 'Error al subir la firma')
    } finally {
      setSubiendoFirma(false)
    }
  }

  const firmaRegistrada = datosCompletos?.firma_registrada ?? usuario?.firma_registrada
  const firmaUrl = datosCompletos?.firma_url
  const requiereFirma = (datosCompletos?.roles ?? usuario?.roles)?.some(r => r.requiere_firma)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 24 }}>Mi Perfil</Title>

      {/* Info del usuario */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <Avatar size={64} style={{ background: '#004A2F', fontSize: 28, flexShrink: 0 }}>
            {usuario?.nombre_completo?.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Title level={5} style={{ margin: 0 }}>{usuario?.nombre_completo}</Title>
            <Text type="secondary">{usuario?.correo}</Text>
            <div style={{ marginTop: 4 }}>
              {usuario?.roles?.map(r => (
                <Tag key={r.id} color="green" style={{ marginRight: 4 }}>{r.nombre}</Tag>
              ))}
            </div>
          </div>
        </div>

        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Documento">{usuario?.documento}</Descriptions.Item>
          <Descriptions.Item label="Correo">{usuario?.correo}</Descriptions.Item>
          <Descriptions.Item label="Rol activo">
            <Tag color="#004A2F">{rolActivo?.nombre ?? '—'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Firma registrada">
            <Tag color={firmaRegistrada ? 'green' : 'orange'}>
              {firmaRegistrada ? '✓ Registrada' : 'Sin firma'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Miembro desde">
            {usuario?.created_at ? new Date(usuario.created_at).toLocaleDateString('es-CO') : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Editar datos */}
      <Card title="Editar datos" style={{ borderRadius: 12 }}>
        {exito && (
          <Alert type="success" title="Datos actualizados correctamente" showIcon style={{ marginBottom: 16 }} />
        )}
        {error && (
          <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />
        )}
        <Form form={form} layout="vertical" onFinish={guardar}>
          <Form.Item name="nombre_completo" label="Nombre completo"
            rules={[{ required: true, message: 'Ingresa tu nombre' }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono (opcional)">
            <Input placeholder="Ej: 3001234567" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={guardando} icon={<SaveOutlined />}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}>
            Guardar cambios
          </Button>
        </Form>
      </Card>

      {/* Firma */}
      {requiereFirma && (
        <Card title="Mi firma" style={{ borderRadius: 12, marginTop: 16 }}>
          {firmaRegistrada ? (
            <div>
              <Alert type="success" showIcon title="Tienes una firma registrada en el sistema."
                style={{ marginBottom: 16 }} />
              {firmaUrl && (
                <div style={{
                  background: '#f5f5f5', borderRadius: 8, padding: 16,
                  textAlign: 'center', marginBottom: 16
                }}>
                  <img
                    src={`${API_URL}/${firmaUrl}`}
                    alt="Mi firma"
                    style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
              )}
              <Button onClick={() => setModalFirma(true)}>Actualizar firma</Button>
            </div>
          ) : (
            <div>
              <Alert type="warning" showIcon
                title="No tienes firma registrada. Debes registrarla para poder firmar solicitudes."
                style={{ marginBottom: 16 }} />
              <Button type="primary" onClick={() => setModalFirma(true)}
                style={{ background: '#004A2F', borderColor: '#004A2F' }}>
                Registrar firma
              </Button>
            </div>
          )}

          <Modal
            title={firmaRegistrada ? 'Actualizar firma' : 'Registrar firma'}
            open={modalFirma}
            onCancel={() => {
              setModalFirma(false)
              setArchivoFirma(null)
              setPreviewFirma(null)
              setErrorFirma(null)
            }}
            footer={null}
          >
            <Alert type="info" showIcon
              title="Usa una imagen con fondo blanco o transparente. El sistema eliminará el fondo automáticamente."
              style={{ marginBottom: 16 }} />

            {errorFirma && (
              <Alert type="error" title={errorFirma} showIcon style={{ marginBottom: 16 }} />
            )}

            {previewFirma && (
              <div style={{
                textAlign: 'center', marginBottom: 16,
                padding: 16, background: '#f5f5f5', borderRadius: 8
              }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Vista previa:</Text>
                <img src={previewFirma} alt="Preview"
                  style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain' }} />
              </div>
            )}

            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: 12,
              border: `2px dashed ${archivoFirma ? '#52c41a' : '#d9d9d9'}`,
              borderRadius: 8, cursor: 'pointer', marginBottom: 16,
              background: archivoFirma ? '#f6ffed' : '#fafafa'
            }}>
              <UserOutlined style={{ color: archivoFirma ? '#52c41a' : '#004A2F', fontSize: 20 }} />
              <Text>{archivoFirma ? archivoFirma.name : 'Haz clic para seleccionar la imagen'}</Text>
              <input type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }}
                onChange={seleccionarFirma} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => {
                setModalFirma(false)
                setArchivoFirma(null)
                setPreviewFirma(null)
                setErrorFirma(null)
              }}>
                Cancelar
              </Button>
              <Button type="primary" loading={subiendoFirma} disabled={!archivoFirma}
                onClick={subirFirma}
                style={{ background: '#004A2F', borderColor: '#004A2F' }}>
                {firmaRegistrada ? 'Actualizar' : 'Registrar'}
              </Button>
            </div>
          </Modal>
        </Card>
      )}
    </div>
  )
}