import { useState, useEffect } from 'react'
import { Steps, Form, Input, Select, Button, Typography, Card, Alert, Result, Tag } from 'antd'
import {
  ArrowLeftOutlined, ArrowRightOutlined, SendOutlined,
  FilePdfOutlined, CheckCircleFilled, DeleteOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const { Title, Text } = Typography

const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'PEP', label: 'PEP - Permiso Especial de Permanencia' },
  { value: 'PPT', label: 'PPT - Permiso de Protección Temporal' },
]

export default function NuevaSolicitud() {
  const [pasoActual, setPasoActual] = useState(0)
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [tiposPrograma, setTiposPrograma] = useState([])
  const [documentosRequeridos, setDocumentosRequeridos] = useState([])
  const [archivos, setArchivos] = useState({})
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [exitoso, setExitoso] = useState(false)
  const navigate = useNavigate()

  const [datosPaso1, setDatosPaso1] = useState({})
  const [datosPaso2, setDatosPaso2] = useState({})

  useEffect(() => {
    const cargar = async () => {
      try {
        const { data } = await api.get('/solicitudes/tipos-programa')
        setTiposPrograma(data)
      } catch {
        setError('No se pudieron cargar los niveles de formación')
      }
    }
    cargar()
  }, [])

  const onChangeTipoPrograma = async (id) => {
    setArchivos({})
    try {
      const { data } = await api.get(`/solicitudes/documentos-requeridos/${id}`)
      setDocumentosRequeridos(data)
    } catch {
      setError('No se pudieron cargar los documentos requeridos')
    }
  }

  const siguiente = async () => {
    try {
      if (pasoActual === 0) {
        const valores = await form1.validateFields()
        setDatosPaso1(valores)
      }
      if (pasoActual === 1) {
        const valores = await form2.validateFields()
        setDatosPaso2(valores)
      }
      setPasoActual(pasoActual + 1)
      setError(null)
    } catch {
      // Errores de validación los muestra el Form
    }
  }

  const anterior = () => {
    setPasoActual(pasoActual - 1)
    setError(null)
  }

  const seleccionarArchivo = (docId, e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError(`El archivo debe ser un PDF`)
      e.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(`El archivo supera el tamaño máximo de 10MB`)
      e.target.value = ''
      return
    }

    setError(null)
    setArchivos(prev => ({ ...prev, [docId]: file }))
  }

  const quitarArchivo = (docId) => {
    setArchivos(prev => {
      const nuevo = { ...prev }
      delete nuevo[docId]
      return nuevo
    })
  }

  const enviar = async () => {
    const faltantes = documentosRequeridos
      .filter(d => d.obligatorio && !archivos[d.id])
      .map(d => d.nombre)

    if (faltantes.length > 0) {
      setError(`Faltan los siguientes documentos: ${faltantes.join(', ')}`)
      return
    }

    setCargando(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('tipo_documento', datosPaso1.tipo_documento)
      formData.append('numero_documento', datosPaso1.numero_documento)
      formData.append('nombre_aprendiz', datosPaso1.nombre_aprendiz)
      formData.append('correo_aprendiz', datosPaso1.correo_aprendiz)
      formData.append('confirmar_correo', datosPaso1.confirmar_correo)
      if (datosPaso1.telefono_aprendiz) formData.append('telefono_aprendiz', datosPaso1.telefono_aprendiz)
      formData.append('tipo_programa_id', String(datosPaso2.tipo_programa_id))
      formData.append('nombre_programa', datosPaso2.nombre_programa)
      formData.append('numero_ficha', datosPaso2.numero_ficha)

      Object.entries(archivos).forEach(([docId, archivo]) => {
        formData.append(`archivo_${docId}`, archivo)
      })

      await api.post('/solicitudes/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setExitoso(true)
    } catch (err) {
      const mensaje = err.response?.data?.detail
      setError(typeof mensaje === 'string' ? mensaje : 'Error al enviar la solicitud')
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
        <Card style={{ maxWidth: 500, width: '100%', borderRadius: 16, textAlign: 'center' }}>
          <Result
            status="success"
            title="¡Solicitud enviada exitosamente!"
            subTitle="Recibirás un correo de confirmación. Puedes consultar el estado de tu solicitud en cualquier momento."
            extra={[
              <Button
                key="consultar"
                type="primary"
                style={{ background: '#004A2F', borderColor: '#004A2F' }}
                onClick={() => navigate('/solicitud/consultar')}
              >
                Consultar mi solicitud
              </Button>,
              <Button key="inicio" onClick={() => navigate('/')}>
                Volver al inicio
              </Button>
            ]}
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
      padding: '40px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: 700, marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}
        >
          Volver al inicio
        </Button>
      </div>

      <Card style={{ width: '100%', maxWidth: 700, borderRadius: 16 }}>
        <Title level={4} style={{ textAlign: 'center', color: '#004A2F', marginBottom: 32 }}>
          Nueva Solicitud de Certificación
        </Title>

        <Steps current={pasoActual} style={{ marginBottom: 40 }}>
          <Steps.Step title="Datos personales" />
          <Steps.Step title="Datos del programa" />
          <Steps.Step title="Documentos" />
        </Steps>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}

        {/* Paso 1 */}
        {pasoActual === 0 && (
          <Form form={form1} layout="vertical">
            <Form.Item name="tipo_documento" label="Tipo de documento"
              rules={[{ required: true, message: 'Selecciona el tipo de documento' }]}>
              <Select placeholder="Selecciona..." size="large" options={TIPOS_DOCUMENTO} />
            </Form.Item>
            <Form.Item name="numero_documento" label="Número de documento"
              rules={[{ required: true, message: 'Ingresa tu número de documento' }]}>
              <Input placeholder="Ej: 1234567890" size="large" />
            </Form.Item>
            <Form.Item name="nombre_aprendiz" label="Nombre completo"
              rules={[{ required: true, message: 'Ingresa tu nombre completo' }]}>
              <Input placeholder="Nombres y apellidos" size="large" />
            </Form.Item>
            <Form.Item name="telefono_aprendiz" label="Teléfono (opcional)">
              <Input placeholder="Ej: 3001234567" size="large" />
            </Form.Item>
            <Form.Item name="correo_aprendiz" label="Correo electrónico"
              rules={[
                { required: true, message: 'Ingresa tu correo' },
                { type: 'email', message: 'Ingresa un correo válido' }
              ]}>
              <Input placeholder="correo@ejemplo.com" size="large" />
            </Form.Item>
            <Form.Item name="confirmar_correo" label="Confirmar correo"
              dependencies={['correo_aprendiz']}
              rules={[
                { required: true, message: 'Confirma tu correo' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('correo_aprendiz') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Los correos no coinciden'))
                  }
                })
              ]}>
              <Input placeholder="Repite tu correo" size="large" />
            </Form.Item>
          </Form>
        )}

        {/* Paso 2 */}
        {pasoActual === 1 && (
          <Form form={form2} layout="vertical">
            <Form.Item name="tipo_programa_id" label="Nivel de Formación"
              rules={[{ required: true, message: 'Selecciona el nivel de formación' }]}>
              <Select
                placeholder="Selecciona..."
                size="large"
                onChange={onChangeTipoPrograma}
                options={tiposPrograma.map(t => ({ value: t.id, label: t.nombre }))}
              />
            </Form.Item>
            <Form.Item name="nombre_programa" label="Nombre del programa"
              rules={[{ required: true, message: 'Ingresa el nombre del programa' }]}>
              <Input placeholder="Ej: Técnico en Sistemas" size="large" />
            </Form.Item>
            <Form.Item name="numero_ficha" label="Número de ficha"
              rules={[{ required: true, message: 'Ingresa el número de ficha' }]}>
              <Input placeholder="Ej: 2345678" size="large" />
            </Form.Item>
          </Form>
        )}

        {/* Paso 3 */}
        {pasoActual === 2 && (
          <div>
            {documentosRequeridos.length === 0 ? (
              <Alert message="No se encontraron documentos para este nivel de formación" type="warning" showIcon />
            ) : (
              documentosRequeridos.map(doc => {
                const archivoSubido = archivos[doc.id]
                return (
                  <Card
                    key={doc.id}
                    size="small"
                    style={{
                      marginBottom: 16,
                      borderColor: archivoSubido ? '#52c41a' : doc.obligatorio ? '#ff7875' : '#d9d9d9',
                      background: archivoSubido ? '#f6ffed' : 'white'
                    }}
                  >
                    {/* Nombre y obligatorio */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <Text strong>{doc.nombre}</Text>
                        <Tag
                          color={doc.obligatorio ? 'red' : 'default'}
                          style={{ marginLeft: 8 }}
                        >
                          {doc.obligatorio ? 'Obligatorio' : 'Opcional'}
                        </Tag>
                      </div>
                      {archivoSubido && (
                        <CheckCircleFilled style={{ color: '#52c41a', fontSize: 20 }} />
                      )}
                    </div>

                    {doc.descripcion && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                        {doc.descripcion}
                      </Text>
                    )}

                    {/* Archivo subido */}
                    {archivoSubido ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: '#d9f7be', borderRadius: 8, padding: '8px 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FilePdfOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                          <Text style={{ color: '#389e0d' }}>{archivoSubido.name}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ({(archivoSubido.size / 1024 / 1024).toFixed(2)} MB)
                          </Text>
                        </div>
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => quitarArchivo(doc.id)}
                        >
                          Quitar
                        </Button>
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 8, padding: '12px',
                        border: '2px dashed #d9d9d9', borderRadius: 8,
                        cursor: 'pointer', background: '#fafafa',
                        transition: 'border-color 0.2s'
                      }}>
                        <FilePdfOutlined style={{ fontSize: 20, color: '#004A2F' }} />
                        <Text>Haz clic para seleccionar el PDF</Text>
                        <input
                          type="file"
                          accept=".pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => seleccionarArchivo(doc.id, e)}
                        />
                      </label>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={pasoActual === 0 ? () => navigate('/') : anterior}
            size="large"
          >
            {pasoActual === 0 ? 'Cancelar' : 'Anterior'}
          </Button>

          {pasoActual < 2 ? (
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              onClick={siguiente}
              size="large"
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={enviar}
              loading={cargando}
              size="large"
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Enviar solicitud
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}