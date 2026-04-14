import { useState } from 'react'
import { Form, Input, Select, Button, Card, Typography, Alert, Steps, Tag, Table, Divider, Space } from 'antd'
import { ArrowLeftOutlined, SearchOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const { Title, Text } = Typography

const PASOS = [
  { estado: 'PENDIENTE_REVISION', titulo: 'En revisión', descripcion: 'El funcionario está revisando tu solicitud.' },
  { estado: 'CON_OBSERVACIONES', titulo: 'Con observaciones', descripcion: 'Se enviaron observaciones a tu correo. Revísalo para corregir.' },
  { estado: 'CORREGIDO', titulo: 'Corregido', descripcion: 'Enviaste las correcciones. El funcionario las está revisando.' },
  { estado: 'PENDIENTE_FIRMAS', titulo: 'En proceso de firmas', descripcion: 'Los funcionarios están firmando tu solicitud.' },
  { estado: 'PENDIENTE_CERTIFICACION', titulo: 'Pendiente certificación', descripcion: 'Todas las firmas completadas. Tu certificación está siendo procesada.' },
  { estado: 'CERTIFICADO', titulo: '¡Certificado!', descripcion: '¡Felicitaciones! Tu proceso fue completado exitosamente.' },
]

const columnasDocumentos = [
  { title: 'Documento', dataIndex: 'nombre_documento', key: 'nombre_documento' },
  {
    title: 'Estado',
    dataIndex: 'estado_documento',
    key: 'estado_documento',
    render: (estado) => {
      const colores = { PENDIENTE: 'orange', OBSERVADO: 'red', APROBADO: 'green' }
      const textos = { PENDIENTE: 'Pendiente', OBSERVADO: 'Observado', APROBADO: 'Aprobado' }
      return <Tag color={colores[estado]}>{textos[estado]}</Tag>
    }
  },
  {
    title: 'Observaciones',
    dataIndex: 'observaciones',
    key: 'observaciones',
    render: (obs) => obs || <Text type="secondary">—</Text>
  },
]

export default function ConsultarSolicitud() {
  const [form] = Form.useForm()
  const [solicitud, setSolicitud] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const consultar = async (values) => {
    setCargando(true)
    setError(null)
    setSolicitud(null)
    try {
      const { data } = await api.post('/solicitudes/consultar', {
        numero_documento: `${values.tipo_documento} ${values.numero_documento}`,
        numero_ficha: values.numero_ficha,
      })
      setSolicitud(data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No se encontró ninguna solicitud con esos datos.')
      } else {
        setError('Error al consultar la solicitud.')
      }
    } finally {
      setCargando(false)
    }
  }

  const indiceActual = solicitud
    ? PASOS.findIndex(p => p.estado === solicitud.estado_actual)
    : 0

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

      {/* Formulario */}
      <Card style={{ width: '100%', maxWidth: 700, borderRadius: 16, marginBottom: 24 }}>
        <Title level={4} style={{ textAlign: 'center', color: '#004A2F', marginBottom: 24 }}>
          Consultar Estado de Solicitud
        </Title>

        <Form form={form} layout="vertical" onFinish={consultar}>
          <Form.Item label="Número de documento">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="tipo_documento" noStyle
                rules={[{ required: true, message: 'Selecciona el tipo' }]}>
                <Select
                  placeholder="Tipo"
                  size="large"
                  style={{ width: 110 }}
                  options={[
                    { value: 'CC', label: 'CC' },
                    { value: 'CE', label: 'CE' },
                    { value: 'TI', label: 'TI' },
                    { value: 'PA', label: 'PA' },
                    { value: 'PEP', label: 'PEP' },
                    { value: 'PPT', label: 'PPT' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="numero_documento" noStyle
                rules={[{ required: true, message: 'Ingresa tu número de documento' }]}>
                <Input placeholder="Número de documento" size="large" />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item name="numero_ficha" label="Número de ficha"
            rules={[{ required: true, message: 'Ingresa tu número de ficha' }]}>
            <Input placeholder="Ej: 2345678" size="large" />
          </Form.Item>

          <Button
            type="primary" htmlType="submit" size="large" block
            loading={cargando} icon={<SearchOutlined />}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}
          >
            Consultar
          </Button>
        </Form>

        {error && <Alert title={error} type="error" showIcon style={{ marginTop: 16 }} />}
      </Card>

      {/* Resultado */}
      {solicitud && (
        <Card style={{ width: '100%', maxWidth: 700, borderRadius: 16 }}>

          {/* Datos básicos */}
          <div style={{ marginBottom: 24 }}>
            <Title level={5} style={{ color: '#004A2F', marginBottom: 12 }}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              Datos de la solicitud
            </Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><Text type="secondary">Aprendiz:</Text> <Text strong>{solicitud.nombre_aprendiz}</Text></div>
              <div><Text type="secondary">Documento:</Text> <Text strong>{solicitud.numero_documento}</Text></div>
              <div><Text type="secondary">Programa:</Text> <Text strong>{solicitud.nombre_programa}</Text></div>
              <div><Text type="secondary">Ficha:</Text> <Text strong>{solicitud.numero_ficha}</Text></div>
            </div>
          </div>

          <Divider />

          {/* Progreso */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Steps
              orientation="vertical"
              size="small"
              current={indiceActual}
              style={{ maxWidth: 400 }}
              items={PASOS.map((paso, i) => {
                // Pasos condicionales — solo mostrar si aplican
                if (paso.estado === 'CON_OBSERVACIONES' &&
                  !['CON_OBSERVACIONES', 'CORREGIDO', 'PENDIENTE_FIRMAS',
                    'PENDIENTE_CERTIFICACION', 'CERTIFICADO'].includes(solicitud.estado_actual)) {
                  return null
                }
                if (paso.estado === 'CORREGIDO' &&
                  !['CORREGIDO', 'PENDIENTE_FIRMAS', 'PENDIENTE_CERTIFICACION',
                    'CERTIFICADO'].includes(solicitud.estado_actual)) {
                  return null
                }

                return {
                  title: paso.titulo,
                  description: i === indiceActual ? paso.descripcion : '',
                  status: i < indiceActual
                    ? 'finish'
                    : i === indiceActual
                      ? (solicitud.estado_actual === 'CON_OBSERVACIONES' ? 'error' : 'process')
                      : 'wait'
                }
              }).filter(Boolean)}
            />
          </div>

          {/* Certificado */}
          {solicitud.estado_actual === 'CERTIFICADO' && (
            <>
              <Divider />
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 12, display: 'block' }} />
                <Title level={5} style={{ color: '#52c41a' }}>¡Proceso completado!</Title>
                <Text type="secondary">
                  Para descargar tu certificado ingresa a {' '}
                  <a href="https://certificados.sena.edu.co" target="_blank" rel="noreferrer">
                    certificados.sena.edu.co
                  </a>
                </Text>
              </div>
            </>
          )}

          {/* Observaciones — solo si no está certificado */}
          {solicitud.observaciones_generales && solicitud.estado_actual !== 'CERTIFICADO' && (
            <>
              <Divider />
              <Alert
                title="Observaciones del funcionario"
                description={solicitud.observaciones_generales}
                type="warning"
                showIcon
              />
            </>
          )}

          {/* Documentos — solo si no está certificado */}
          {solicitud.estado_actual !== 'CERTIFICADO' && (
            <>
              <Divider />
              <Title level={5} style={{ color: '#004A2F', marginBottom: 12 }}>
                Mis documentos
              </Title>
              <Table
                dataSource={solicitud.documentos?.filter(d => d.es_version_activa)}
                columns={columnasDocumentos}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 400 }}
              />
            </>
          )}
        </Card>
      )}
    </div>
  )
}