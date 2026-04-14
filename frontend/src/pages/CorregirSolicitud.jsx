import { useState, useEffect } from 'react'
import { Steps, Form, Input, Select, Button, Typography, Card, Alert, Result, Tag } from 'antd'
import {
  ArrowLeftOutlined, ArrowRightOutlined, SendOutlined,
  FilePdfOutlined, CheckCircleFilled, DeleteOutlined
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'

const { Title, Text } = Typography

const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
  { value: 'PPT', label: 'Permiso de Protección Temporal' },
]

export default function CorregirSolicitud() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [pasoActual, setPasoActual] = useState(0)
  const [solicitud, setSolicitud] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [tiposPrograma, setTiposPrograma] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [exitoso, setExitoso] = useState(false)
  const [archivos, setArchivos] = useState({})

  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [datosPaso1, setDatosPaso1] = useState({})
  const [datosPaso2, setDatosPaso2] = useState({})

  useEffect(() => {
    const cargar = async () => {
      try {
        const [resSolicitud, resTipos] = await Promise.all([
            api.get(`/documentos/corregir/${token}/solicitud`),
            api.get('/solicitudes/tipos-programa')
        ])
        setSolicitud(resSolicitud.data)
        setTiposPrograma(resTipos.data)
        setDocumentos(resSolicitud.data.documentos?.filter(d => d.es_version_activa) ?? [])

        // Precargar datos en los formularios
        const numero = resSolicitud.data.numero_documento?.split(' ')
        form1.setFieldsValue({
          tipo_documento: numero?.[0],
          numero_documento: numero?.slice(1).join(' '),
          nombre_aprendiz: resSolicitud.data.nombre_aprendiz,
          correo_aprendiz: resSolicitud.data.correo_aprendiz,
          telefono_aprendiz: resSolicitud.data.telefono_aprendiz,
        })
        form2.setFieldsValue({
          tipo_programa_id: resSolicitud.data.tipo_programa_id,
          nombre_programa: resSolicitud.data.nombre_programa,
          numero_ficha: resSolicitud.data.numero_ficha,
        })
      } catch (err) {
        if (err.response?.status === 404) {
          setError('El enlace no es válido o ya fue utilizado.')
        } else {
          setError('Error al cargar la solicitud.')
        }
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [token])

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
    } catch {}
  }

  const anterior = () => {
    setPasoActual(pasoActual - 1)
    setError(null)
  }

  const seleccionarArchivo = (docId, e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('El archivo debe ser un PDF')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera el tamaño máximo de 10MB')
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
    setEnviando(true)
    setError(null)
    try {
      const formData = new FormData()

      // Datos personales
      formData.append('tipo_documento', datosPaso1.tipo_documento)
      formData.append('numero_documento', datosPaso1.numero_documento)
      formData.append('nombre_aprendiz', datosPaso1.nombre_aprendiz)
      formData.append('correo_aprendiz', datosPaso1.correo_aprendiz)
      if (datosPaso1.telefono_aprendiz) formData.append('telefono_aprendiz', datosPaso1.telefono_aprendiz)

      // Datos del programa
      formData.append('tipo_programa_id', String(datosPaso2.tipo_programa_id))
      formData.append('nombre_programa', datosPaso2.nombre_programa)
      formData.append('numero_ficha', datosPaso2.numero_ficha)

      // Documentos nuevos (solo los no aprobados que se reemplazaron)
      Object.entries(archivos).forEach(([docId, archivo]) => {
        formData.append(`archivo_${docId}`, archivo)
      })

      await api.post(`/solicitudes/corregir-datos/${token}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setExitoso(true)
    } catch (err) {
      const mensaje = err.response?.data?.detail
      setError(typeof mensaje === 'string' ? mensaje : 'Error al enviar las correcciones')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)'
    }}>
      <Card style={{ borderRadius: 16, padding: 32 }}>
        <Text>Cargando solicitud...</Text>
      </Card>
    </div>
  )

  if (error && !solicitud) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)', padding: 24
    }}>
      <Card style={{ maxWidth: 480, width: '100%', borderRadius: 16 }}>
        <Result
          status="error"
          title="Enlace no válido o ya fue utilizado"
          subTitle={error}
          extra={
            <Button onClick={() => navigate('/')} style={{ background: '#004A2F', borderColor: '#004A2F' }} type="primary">
              Volver al inicio
            </Button>
          }
        />
      </Card>
    </div>
  )

  if (exitoso) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)', padding: 24
    }}>
      <Card style={{ maxWidth: 500, width: '100%', borderRadius: 16, textAlign: 'center' }}>
        <Result
          status="success"
          title="¡Correcciones enviadas!"
          subTitle="El funcionario revisará nuevamente tu solicitud y te notificará por correo."
          extra={
            <Button
              type="primary"
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
              onClick={() => navigate('/solicitud/consultar')}
            >
              Consultar mi solicitud
            </Button>
          }
        />
      </Card>
    </div>
  )

  const documentosNoAprobados = documentos.filter(d => d.estado_documento !== 'APROBADO')
  const documentosAprobados = documentos.filter(d => d.estado_documento === 'APROBADO')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
      padding: '40px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <Card style={{ width: '100%', maxWidth: 700, borderRadius: 16 }}>
        <Title level={4} style={{ textAlign: 'center', color: '#004A2F', marginBottom: 8 }}>
          Corregir Solicitud
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 32 }}>
          Revisa y corrige los datos de tu solicitud
        </Text>

        <Steps current={pasoActual} style={{ marginBottom: 40 }}>
          <Steps.Step title="Datos personales" />
          <Steps.Step title="Datos del programa" />
          <Steps.Step title="Documentos" />
        </Steps>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 24 }} />}

        {/* Paso 1 — Datos personales */}
        {pasoActual === 0 && (
          <Form form={form1} layout="vertical">
            <Form.Item name="tipo_documento" label="Tipo de documento"
              rules={[{ required: true, message: 'Selecciona el tipo de documento' }]}>
              <Select placeholder="Selecciona..." size="large" options={TIPOS_DOCUMENTO} />
            </Form.Item>
            <Form.Item name="numero_documento" label="Número de documento"
              rules={[{ required: true, message: 'Ingresa tu número de documento' }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="nombre_aprendiz" label="Nombre completo"
              rules={[{ required: true, message: 'Ingresa tu nombre completo' }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="telefono_aprendiz" label="Teléfono (opcional)">
              <Input size="large" />
            </Form.Item>
            <Form.Item name="correo_aprendiz" label="Correo electrónico"
              rules={[
                { required: true, message: 'Ingresa tu correo' },
                { type: 'email', message: 'Correo inválido' }
              ]}>
              <Input size="large" />
            </Form.Item>
          </Form>
        )}

        {/* Paso 2 — Datos del programa */}
        {pasoActual === 1 && (
          <Form form={form2} layout="vertical">
            <Form.Item name="tipo_programa_id" label="Nivel de formación"
              rules={[{ required: true, message: 'Selecciona el nivel de formación' }]}>
              <Select
                placeholder="Selecciona..."
                size="large"
                options={tiposPrograma.map(t => ({ value: t.id, label: t.nombre }))}
              />
            </Form.Item>
            <Form.Item name="nombre_programa" label="Nombre del programa"
              rules={[{ required: true, message: 'Ingresa el nombre del programa' }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="numero_ficha" label="Número de ficha"
              rules={[{ required: true, message: 'Ingresa el número de ficha' }]}>
              <Input size="large" />
            </Form.Item>
          </Form>
        )}

        {/* Paso 3 — Documentos */}
        {pasoActual === 2 && (
          <div>
            {/* Documentos aprobados — solo lectura */}
            {documentosAprobados.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Documentos aprobados (no se pueden modificar):
                </Text>
                {documentosAprobados.map(doc => (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', background: '#f6ffed',
                    borderRadius: 8, border: '1px solid #b7eb8f', marginBottom: 8
                  }}>
                    <CheckCircleFilled style={{ color: '#52c41a' }} />
                    <Text>{doc.nombre_documento}</Text>
                    <Tag color="green" style={{ marginLeft: 'auto' }}>Aprobado</Tag>
                  </div>
                ))}
              </div>
            )}

            {/* Documentos a corregir */}
            {documentosNoAprobados.length > 0 && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Documentos a corregir:
                </Text>
                {documentosNoAprobados.map(doc => {
                  const archivoSubido = archivos[doc.documento_id]
                  return (
                    <Card
                      key={doc.id}
                      size="small"
                      style={{
                        marginBottom: 16,
                        borderColor: archivoSubido ? '#52c41a' : '#ff7875',
                        background: archivoSubido ? '#f6ffed' : 'white'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <Text strong>{doc.nombre_documento}</Text>
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            {doc.estado_documento === 'OBSERVADO' ? 'Observado' : 'Pendiente'}
                          </Tag>
                        </div>
                        {archivoSubido && <CheckCircleFilled style={{ color: '#52c41a', fontSize: 20 }} />}
                      </div>

                      {doc.observaciones && (
                        <Alert
                          title={doc.observaciones}
                          type="warning"
                          showIcon
                          style={{ marginBottom: 8, fontSize: 12 }}
                        />
                      )}

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
                          <Button danger size="small" icon={<DeleteOutlined />}
                            onClick={() => quitarArchivo(doc.documento_id)}>
                            Quitar
                          </Button>
                        </div>
                      ) : (
                        <label style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 8, padding: '12px', border: '2px dashed #ff7875',
                          borderRadius: 8, cursor: 'pointer', background: '#fff2f0'
                        }}>
                          <FilePdfOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
                          <Text>Haz clic para subir el PDF corregido</Text>
                          <input
                            type="file" accept=".pdf" style={{ display: 'none' }}
                            onChange={(e) => seleccionarArchivo(doc.documento_id, e)}
                          />
                        </label>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}

            {documentosNoAprobados.length === 0 && (
              <Alert
                title="Todos tus documentos están aprobados. Solo se enviaron correcciones de datos."
                type="success"
                showIcon
              />
            )}
          </div>
        )}

        {/* Botones de navegación */}
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
              loading={enviando}
              size="large"
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Enviar correcciones
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}