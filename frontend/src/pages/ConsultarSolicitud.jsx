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
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Botón volver */}
      <div
        style={{
          width: '100%',
          maxWidth: 850,
          marginBottom: 24
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.15)',
            borderColor: 'rgba(255,255,255,0.4)',
            color: 'white',
            borderRadius: 10,
            height: 42,
            paddingInline: 20
          }}
        >
          Volver al inicio
        </Button>
      </div>

      {/* Formulario principal */}
      <Card
        style={{
          width: '100%',
          maxWidth: 850,
          borderRadius: 24,
          border: 'none',
          boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
          marginBottom: 24
        }}
        styles={{
          body: {
            padding: 40
          }
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 32
          }}
        >
          <Title
            level={3}
            style={{
              color: '#004A2F',
              marginBottom: 8,
              fontWeight: 700
            }}
          >
            Consultar Estado de Solicitud
          </Title>

          <Text
            type="secondary"
            style={{
              fontSize: 15
            }}
          >
            Consulta el avance de tu proceso de certificación
          </Text>
        </div>

        {/* Formulario */}
        <Form
          form={form}
          layout="vertical"
          onFinish={consultar}
        >
          <Form.Item label="Número de documento">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="tipo_documento"
                noStyle
                rules={[
                  {
                    required: true,
                    message: 'Selecciona el tipo'
                  }
                ]}
              >
                <Select
                  placeholder="Tipo"
                  size="large"
                  style={{ width: 130 }}
                  options={[
                    { value: 'CC', label: 'CC' },
                    { value: 'CE', label: 'CE' },
                    { value: 'TI', label: 'TI' },
                    { value: 'PA', label: 'PA' },
                    { value: 'PEP', label: 'PEP' },
                    { value: 'PPT', label: 'PPT' }
                  ]}
                />
              </Form.Item>

              <Form.Item
                name="numero_documento"
                noStyle
                rules={[
                  {
                    required: true,
                    message: 'Ingresa tu número de documento'
                  }
                ]}
              >
                <Input
                  placeholder="Número de documento"
                  size="large"
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="numero_ficha"
            label="Número de ficha"
            rules={[
              {
                required: true,
                message: 'Ingresa tu número de ficha'
              }
            ]}
          >
            <Input
              placeholder="Ej: 2345678"
              size="large"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={cargando}
            icon={<SearchOutlined />}
            style={{
              background: '#004A2F',
              borderColor: '#004A2F',
              height: 50,
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 15
            }}
          >
            Consultar solicitud
          </Button>
        </Form>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{
              marginTop: 20,
              borderRadius: 12
            }}
          />
        )}
      </Card>

      {/* Resultado */}
      {solicitud && (
        <Card
          style={{
            width: '100%',
            maxWidth: 850,
            borderRadius: 24,
            border: 'none',
            boxShadow: '0 15px 40px rgba(0,0,0,0.08)'
          }}
          styles={{
            body: {
              padding: 40
            }
          }}
        >
          {/* Datos básicos */}
          <div style={{ marginBottom: 28 }}>
            <Title
              level={4}
              style={{
                color: '#004A2F',
                marginBottom: 20
              }}
            >
              <FileTextOutlined style={{ marginRight: 8 }} />
              Datos de la solicitud
            </Title>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14
              }}
            >
              <div>
                <Text type="secondary">Aprendiz</Text>
                <br />
                <Text strong>{solicitud.nombre_aprendiz}</Text>
              </div>

              <div>
                <Text type="secondary">Documento</Text>
                <br />
                <Text strong>{solicitud.numero_documento}</Text>
              </div>

              <div>
                <Text type="secondary">Programa</Text>
                <br />
                <Text strong>{solicitud.nombre_programa}</Text>
              </div>

              <div>
                <Text type="secondary">Ficha</Text>
                <br />
                <Text strong>{solicitud.numero_ficha}</Text>
              </div>
            </div>
          </div>

          <Divider />

          {/* Progreso */}
          <div style={{ marginBottom: 28 }}>
            <Title
              level={4}
              style={{
                color: '#004A2F',
                marginBottom: 20
              }}
            >
              Estado del proceso
            </Title>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <Steps
                orientation="vertical"
                current={indiceActual}
                style={{
                  width: '100%',
                  maxWidth: 500
                }}
                items={PASOS.map((paso, i) => {
                  if (
                    paso.estado === 'CON_OBSERVACIONES' &&
                    ![
                      'CON_OBSERVACIONES',
                      'CORREGIDO',
                      'PENDIENTE_FIRMAS',
                      'PENDIENTE_CERTIFICACION',
                      'CERTIFICADO'
                    ].includes(solicitud.estado_actual)
                  ) {
                    return null
                  }

                  if (
                    paso.estado === 'CORREGIDO' &&
                    ![
                      'CORREGIDO',
                      'PENDIENTE_FIRMAS',
                      'PENDIENTE_CERTIFICACION',
                      'CERTIFICADO'
                    ].includes(solicitud.estado_actual)
                  ) {
                    return null
                  }

                  return {
                    title: paso.titulo,
                    content:
                      i === indiceActual
                        ? paso.descripcion
                        : '',
                    status:
                      i < indiceActual
                        ? 'finish'
                        : i === indiceActual
                        ? solicitud.estado_actual === 'CON_OBSERVACIONES'
                          ? 'error'
                          : 'process'
                        : 'wait'
                  }
                }).filter(Boolean)}
              />
            </div>
          </div>

          {/* Certificado */}
          {solicitud.estado_actual === 'CERTIFICADO' && (
            <>
              <Divider />

              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 0'
                }}
              >
                <CheckCircleOutlined
                  style={{
                    fontSize: 54,
                    color: '#52c41a',
                    display: 'block',
                    marginBottom: 16
                  }}
                />

                <Title
                  level={4}
                  style={{
                    color: '#52c41a'
                  }}
                >
                  ¡Proceso completado!
                </Title>

                <Text type="secondary">
                  Para descargar tu certificado ingresa a{' '}
                  <a
                    href="https://certificados.sena.edu.co"
                    target="_blank"
                    rel="noreferrer"
                  >
                    certificados.sena.edu.co
                  </a>
                </Text>
              </div>
            </>
          )}

          {/* Observaciones */}
          {solicitud.observaciones_generales &&
            solicitud.estado_actual !== 'CERTIFICADO' && (
              <>
                <Divider />

                <Alert
                  message="Observaciones del funcionario"
                  description={solicitud.observaciones_generales}
                  type="warning"
                  showIcon
                  style={{
                    borderRadius: 12
                  }}
                />
              </>
            )}

          {/* Tabla documentos */}
          {solicitud.estado_actual !== 'CERTIFICADO' && (
            <>
              <Divider />

              <Title
                level={4}
                style={{
                  color: '#004A2F',
                  marginBottom: 16
                }}
              >
                Mis documentos
              </Title>

              <Table
                dataSource={solicitud.documentos?.filter(
                  d => d.es_version_activa
                )}
                columns={columnasDocumentos}
                rowKey="id"
                pagination={false}
                size="middle"
                scroll={{ x: 500 }}
              />
            </>
          )}
        </Card>
      )}
    </div>
  )
}