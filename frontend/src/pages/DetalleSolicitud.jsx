import React, { useState, useEffect, useRef, useMemo, memo, Suspense, lazy } from 'react'
import {
  Card, Typography, Tag, Button, Descriptions, Table,
  Modal, Form, Input, Alert, Spin, Space, Popconfirm, message,
  Select
} from 'antd'
import {
  ArrowLeftOutlined, FilePdfOutlined, CheckCircleOutlined, DownloadOutlined, 
  CloseCircleOutlined, ExclamationCircleOutlined, FileTextOutlined,
  SignatureOutlined, LockOutlined, EditOutlined, SwapOutlined, EyeOutlined 
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { API_URL } from '../api/axios'

// Lazy load del componente pesado de preview de firmas
const PreviewFirmasSolicitud = lazy(() => import('./components/PreviewFirmasSolicitud'))

const { Title, Text } = Typography

const COLORES_ESTADO = {
  PENDIENTE_REVISION: 'orange',
  CON_OBSERVACIONES: 'red',
  CORREGIDO: 'blue',
  PENDIENTE_FIRMAS: 'purple',
  PENDIENTE_CERTIFICACION: 'cyan',
  CERTIFICADO: 'green',
}

const TEXTOS_ESTADO = {
  PENDIENTE_REVISION: 'Pendiente revisión',
  CON_OBSERVACIONES: 'Con observaciones',
  CORREGIDO: 'Corregido',
  PENDIENTE_FIRMAS: 'Pendiente firmas',
  PENDIENTE_CERTIFICACION: 'Pendiente certificación',
  CERTIFICADO: 'Certificado',
}

// -------------------------------------------------------
// Componente auxiliar para observar un documento
// -------------------------------------------------------
function ObservarDocumento({ doc, onObservar }) {
  const [visible, setVisible] = useState(false)
  const [obs, setObs] = useState('')

  return (
    <>
      <Button
        size="small"
        danger
        icon={<ExclamationCircleOutlined />}
        onClick={() => { setObs(doc.observaciones || ''); setVisible(true) }}
      >
        Observar
      </Button>
      <Modal
        title={`Observación — ${doc.nombre_documento}`}
        open={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        width={400}
      >
        <Input.TextArea
          rows={3}
          value={obs}
          onChange={e => setObs(e.target.value)}
          placeholder="Describe qué debe corregir el aprendiz..."
          style={{ marginBottom: 12 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setVisible(false)}>Cancelar</Button>
          <Button
            danger type="primary"
            disabled={!obs.trim()}
            onClick={() => { onObservar(doc.id, 'OBSERVADO', obs); setVisible(false) }}
          >
            Guardar observación
          </Button>
        </div>
      </Modal>
    </>
  )
}


// -------------------------------------------------------
// Componente principal
// -------------------------------------------------------
export default function DetalleSolicitud() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, rolActivo } = useAuth()

  const [solicitud, setSolicitud] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [firmas, setFirmas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [todosDocumentos, setTodosDocumentos] = useState([])
  const [coordinadores, setCoordinadores] = useState([])
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [guardandoObservaciones, setGuardandoObservaciones] = useState(false)
  const [tipoRechazoActual, setTipoRechazoActual] = useState(null)

  // Modales
  const [modalFirmar, setModalFirmar] = useState(false)
  const [modalRechazar, setModalRechazar] = useState(false)
  const [modalCertificar, setModalCertificar] = useState(false)
  const [modalReubicar, setModalReubicar] = useState(false)
  const [modalEditarPrograma, setModalEditarPrograma] = useState(false)
  const [modalEditarAprendiz, setModalEditarAprendiz] = useState(false)
  const [modalConfirmarRevision, setModalConfirmarRevision] = useState(false)
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const [modalPreviewFirmas, setModalPreviewFirmas] = useState(false)
  const [plantillaActiva, setPlantillaActiva] = useState(null)

  const [formFirma] = Form.useForm()
  const [formRechazo] = Form.useForm()
  const [formReubicar] = Form.useForm()
  const [formPrograma] = Form.useForm()
  const [formAprendiz] = Form.useForm()
  const [formConfirmar] = Form.useForm()

  const [historialObs, setHistorialObs] = useState(null)
  const [historialEstados, setHistorialEstados] = useState([])

  const hayDocumentosObservados = useMemo(
    () => solicitud?.documentos?.some(d => d.estado_documento === 'OBSERVADO'),
    [solicitud?.documentos]
  )
  const tieneObservacionesParaReenviar = useMemo(
    () => hayDocumentosObservados || !!solicitud?.observaciones_generales,
    [hayDocumentosObservados, solicitud?.observaciones_generales]
  )

  // Roles
  const rolesObjetos = rolActivo ? [rolActivo] : (usuario?.roles ?? [])
  const esAdmin = !!rolesObjetos.some(r => r.es_admin)
  const esFuncionario = !!rolesObjetos.some(r => r.es_funcionario_revision)
  const esCoordinador = !!rolesObjetos.some(r => r.es_coordinador)
  const esFirmante = !!rolesObjetos.some(r => r.requiere_firma && !r.es_coordinador)
  const tieneAccesoCompleto = esAdmin || esFuncionario || esCoordinador

  const yaFirme = firmas.some(f =>
    f.usuario_id === usuario?.id &&
    ['FIRMADO', 'RECHAZADO'].includes(f.estado_firma)
  )

  // -------------------------------------------------------
  // Carga de datos optimizada - combinar requests donde sea posible
  // -------------------------------------------------------
  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      // Combinar requests principales en paralelo
      const [resSolicitud, resFirmas, resHistorial] = await Promise.all([
        api.get(`/solicitudes/${id}`),
        api.get(`/documentos/${id}/firmas`).catch(() => ({ data: [] })),
        api.get(`/solicitudes/${id}/historial-estados`).catch(() => ({ data: [] }))
      ])

      setSolicitud(resSolicitud.data)
      setFirmas(resFirmas.data)
      setHistorialEstados(resHistorial.data)
      setDocumentos(resSolicitud.data.documentos?.filter(d => d.es_version_activa) ?? [])
    } catch {
      setError('No se pudo cargar la solicitud')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  // Cargar datos adicionales después de la solicitud principal
  useEffect(() => {
    if (!solicitud) return

    const cargarDatosAdicionales = async () => {
      const promises = []

      // Cargar documentos requeridos
      promises.push(
        api.get(`/solicitudes/documentos-requeridos/${solicitud.tipo_programa_id}`)
          .then(({ data }) => setTodosDocumentos(data))
          .catch(() => {})
      )

      // Cargar plantilla activa
      promises.push(
        api.get('/plantillas/activa')
          .then(({ data }) => setPlantillaActiva(data))
          .catch(() => {})
      )

      // Cargar coordinadores solo si es necesario
      if (esFuncionario || esAdmin) {
        promises.push(
          api.get('/usuarios/coordinadores')
            .then(({ data }) => setCoordinadores(data))
            .catch(() => setCoordinadores([]))
        )
      }

      await Promise.all(promises)
    }

    cargarDatosAdicionales()
  }, [solicitud, esFuncionario, esAdmin])

  
  useEffect(() => {
    if (modalConfirmarRevision && solicitud?.coordinador_id) {
      formConfirmar.setFieldsValue({ coordinador_id: solicitud.coordinador_id })
    }
  }, [modalConfirmarRevision])

  useEffect(() => {
    if (firmas.length > 0) {
      const firmaRechazada = firmas.find(f => f.estado_firma === 'RECHAZADO')
      if (firmaRechazada) setTipoRechazoActual(firmaRechazada.tipo_rechazo)
    }
  }, [firmas])

  // -------------------------------------------------------
  // Acciones funcionario
  // -------------------------------------------------------
  const revisarDocumento = async (docId, estado, observaciones) => {
    try {
      await api.put(`/documentos/${docId}/revisar`, {
        estado_documento: estado,
        observaciones: observaciones || null
      })
      message.success(estado === 'APROBADO' ? 'Documento aprobado' : 'Observación registrada')
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al revisar documento')
    }
  }

  const reubicarDocumento = async (values) => {
    try {
      await api.put(`/documentos/${documentoSeleccionado.id}/reubicar`, {
        nuevo_documento_id: values.nuevo_documento_id
      })
      message.success('Documento reubicado')
      setModalReubicar(false)
      formReubicar.resetFields()
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al reubicar')
    }
  }

  const guardarObservacionesGenerales = async (valor) => {
    setGuardandoObservaciones(true)
    try {
      await api.put(`/solicitudes/${id}/programa`, { observaciones_generales: valor })
    } catch {}
    finally {
      setGuardandoObservaciones(false)
    }
  }

  const confirmarRevision = async (values) => {
    setEnviando(true)
    try {
      const { data } = await api.post(`/solicitudes/${id}/confirmar-revision`, {
        coordinador_id: values.coordinador_id
      })
      message.success(data.message)
      setModalConfirmarRevision(false)
      formConfirmar.resetFields()
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al confirmar revisión')
    } finally {
      setEnviando(false)
    }
  }

  const editarPrograma = async (values) => {
    try {
      await api.put(`/solicitudes/${id}/programa`, values)
      message.success('Datos del programa actualizados')
      setModalEditarPrograma(false)
      formPrograma.resetFields()
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al actualizar programa')
    }
  }

  const editarDatosAprendiz = async (values) => {
    try {
      await api.put(`/solicitudes/${id}/datos-aprendiz`, values)
      message.success('Datos actualizados')
      setModalEditarAprendiz(false)
      formAprendiz.resetFields()
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al actualizar datos')
    }
  }

  // -------------------------------------------------------
  // Acciones firmantes
  // -------------------------------------------------------
  const firmar = async (values) => {
    setEnviando(true)
    try {
      await api.post(`/documentos/${id}/firmar`, { password: values.password })
      message.success('Firma registrada exitosamente')
      setModalFirmar(false)
      formFirma.resetFields()
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al firmar')
    } finally {
      setEnviando(false)
    }
  }

  const rechazar = async (values) => {
    setEnviando(true)
    try {
      await api.post(`/documentos/${id}/rechazar-firma`, {
        tipo_rechazo: values.tipo_rechazo,
        motivo_rechazo: values.motivo_rechazo,
        password: values.password
      })
      message.success('Rechazo registrado')
      setModalRechazar(false)
      formRechazo.resetFields()
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al rechazar')
    } finally {
      setEnviando(false)
    }
  }

  const certificar = async () => {
    setEnviando(true)
    try {
      await api.put(`/documentos/${id}/certificar`)
      message.success('Solicitud certificada exitosamente')
      setModalCertificar(false)
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      if (msg === 'La solicitud no está en estado de certificación') {
        return
      }
      message.error(typeof msg === 'string' ? msg : 'Error al certificar')
    } finally {
      setEnviando(false)
    }
  }

  const verDocumento = (url) => {
    window.open(`${API_URL}/${url}`, '_blank')
  }

  // -------------------------------------------------------
  // Permisos
  // -------------------------------------------------------
  if (cargando) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
  if (error) return <Alert title={error} type="error" showIcon />
  if (!solicitud) return null

  const puedeVerDocumentos = tieneAccesoCompleto || (esFirmante && !yaFirme) || (esCoordinador && !yaFirme)
  const puedeFirmar = (esFirmante || esCoordinador) &&
    solicitud.estado_actual === 'PENDIENTE_FIRMAS' && !yaFirme
  const puedeConfirmarRevision = esFuncionario &&
    ['PENDIENTE_REVISION', 'CORREGIDO'].includes(solicitud.estado_actual)
  const puedeCertificar = esFuncionario &&
    solicitud.estado_actual === 'PENDIENTE_CERTIFICACION'
  const enRevision = esFuncionario &&
    ['PENDIENTE_REVISION', 'CORREGIDO'].includes(solicitud.estado_actual)

  // -------------------------------------------------------
  // Columnas tabla documentos
  // -------------------------------------------------------
  const columnasDocumentos = [
    {
      title: 'Documento',
      dataIndex: 'nombre_documento',
      key: 'nombre_documento',
      render: (nombre, record) => (
        <div>
          <Text strong>{nombre}</Text>
          {record.observaciones && (
            <div><Text type="danger" style={{ fontSize: 12 }}>{record.observaciones}</Text></div>
          )}
        </div>
      )
    },
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
    ...(puedeVerDocumentos ? [{
      title: 'Archivo',
      key: 'archivo',
      render: (_, record) => (
        record.archivo_url ? (
          <Button icon={<FilePdfOutlined />} size="small"
            onClick={() => verDocumento(record.archivo_url)}>
            Ver PDF
          </Button>
        ) : <Text type="secondary">—</Text>
      )
    }] : []),
    ...(enRevision ? [{
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space wrap>
          {record.estado_documento !== 'APROBADO' && (
            <Popconfirm
              title="¿Aprobar este documento?"
              onConfirm={() => revisarDocumento(record.id, 'APROBADO', null)}
              okText="Sí" cancelText="No"
            >
              <Button size="small" type="primary"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                icon={<CheckCircleOutlined />}>
                Aprobar
              </Button>
            </Popconfirm>
          )}
          {record.estado_documento !== 'OBSERVADO' && (
            <ObservarDocumento doc={record} onObservar={revisarDocumento} />
          )}
          <Button
            size="small"
            icon={<SwapOutlined />}
            onClick={() => {
              setDocumentoSeleccionado(record)
              setModalReubicar(true)
            }}
          >
            Reubicar
          </Button>
        </Space>
      )
    }] : [])
  ]

  // -------------------------------------------------------
  // Columnas tabla firmas
  // -------------------------------------------------------
  const columnasFirmas = [
    { title: 'Rol', dataIndex: 'nombre_rol', key: 'nombre_rol' },
    { title: 'Funcionario', dataIndex: 'nombre_usuario', key: 'nombre_usuario',
      render: (nombre) => nombre || <Text type="secondary">Sin asignar</Text> },
    {
      title: 'Estado',
      dataIndex: 'estado_firma',
      key: 'estado_firma',
      render: (estado) => {
        const colores = { PENDIENTE: 'orange', FIRMADO: 'green', RECHAZADO: 'red' }
        const textos = { PENDIENTE: 'Pendiente', FIRMADO: 'Firmado', RECHAZADO: 'Rechazado' }
        return <Tag color={colores[estado]}>{textos[estado]}</Tag>
      }
    },
    {
      title: 'Motivo rechazo',
      dataIndex: 'motivo_rechazo',
      key: 'motivo_rechazo',
      render: (motivo) => motivo || <Text type="secondary">—</Text>
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha_firma',
      key: 'fecha_firma',
      render: (fecha) => fecha ? new Date(fecha).toLocaleDateString('es-CO') : '—'
    },
  ]

  const descargarPDF = async (solicitudId) => {
    try {
      const response = await api.get(`/documentos/${solicitudId}/pdf`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const contentDisposition = response.headers['content-disposition']
      let nombreArchivo = `solicitud_${solicitudId}.pdf`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/)
        if (match) nombreArchivo = decodeURIComponent(match[1])
      }
      link.setAttribute('download', nombreArchivo)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      message.error('Error al descargar el PDF')
    }
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/solicitudes')}>
          Volver
        </Button>
        <Space wrap>
          {enRevision && plantillaActiva && (
            <Button
              icon={<EyeOutlined />}
              onClick={() => setModalPreviewFirmas(true)}
            >
              Previsualizar firmas
            </Button>
          )}
          {puedeConfirmarRevision && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => setModalConfirmarRevision(true)}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Confirmar revisión
            </Button>
          )}
          {puedeFirmar && (
            <>
              <Button
                icon={<CloseCircleOutlined />}
                danger
                onClick={() => setModalRechazar(true)}
              >
                Rechazar
              </Button>
              <Button
                type="primary"
                icon={<SignatureOutlined />}
                onClick={() => setModalFirmar(true)}
                style={{ background: '#004A2F', borderColor: '#004A2F' }}
              >
                Firmar
              </Button>
            </>
          )}
          {puedeCertificar && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => setModalCertificar(true)}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Certificar
            </Button>
          )}
          {esFuncionario && solicitud.estado_actual === 'PENDIENTE_FIRMAS' && (
            <Popconfirm
              title="¿Devolver a revisión? Todas las firmas serán reiniciadas."
              onConfirm={async () => {
                try {
                  await api.put(`/solicitudes/${id}/devolver-revision`)
                  message.success('Solicitud devuelta a revisión')
                  cargar()
                } catch (err) {
                  message.error(err.response?.data?.detail ?? 'Error al devolver')
                }
              }}
              okText="Sí" cancelText="No"
            >
              <Button danger icon={<ArrowLeftOutlined />}>
                Devolver a revisión
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* Datos de la solicitud */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Title level={5} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            Solicitud #{solicitud.id}
          </Title>
          <Tag
            color={COLORES_ESTADO[solicitud.estado_actual]}
            style={{ fontSize: 14, padding: '4px 12px' }}
          >
            {TEXTOS_ESTADO[solicitud.estado_actual]}
          </Tag>
        </div>

        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Aprendiz">{solicitud.nombre_aprendiz}</Descriptions.Item>
          <Descriptions.Item label="Documento">{solicitud.numero_documento}</Descriptions.Item>
          <Descriptions.Item label="Correo">{solicitud.correo_aprendiz}</Descriptions.Item>
          <Descriptions.Item label="Teléfono">{solicitud.telefono_aprendiz || '—'}</Descriptions.Item>
          <Descriptions.Item label="Programa">{solicitud.nombre_programa}</Descriptions.Item>
          <Descriptions.Item label="Nivel de formación">{solicitud.nombre_tipo_programa}</Descriptions.Item>
          <Descriptions.Item label="Ficha">{solicitud.numero_ficha}</Descriptions.Item>
          <Descriptions.Item label="Fecha solicitud">
            {new Date(solicitud.fecha_solicitud).toLocaleDateString('es-CO')}
          </Descriptions.Item>
        </Descriptions>

        {solicitud.observaciones_generales && !enRevision && (
          <Alert
            title="Observaciones del funcionario"
            description={solicitud.observaciones_generales}
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {esFuncionario && tieneObservacionesParaReenviar && ['PENDIENTE_REVISION', 'CON_OBSERVACIONES'].includes(solicitud.estado_actual) && tipoRechazoActual === null && (
        <Popconfirm
          title="¿Reenviar las observaciones al aprendiz?"
          description={solicitud.observaciones_generales || 'Se reenviarán las observaciones de documentos.'}
          onConfirm={async () => {
            try {
              await api.post(`/solicitudes/${id}/reenviar-observaciones`)
              message.success('Observaciones reenviadas al aprendiz')
              cargar()
            } catch (err) {
              message.error(err.response?.data?.detail ?? 'Error al reenviar observaciones')
            }
          }}
          okText="Sí" cancelText="No"
        >
          <Button icon={<ExclamationCircleOutlined />} style={{ background: '#faad14', borderColor: '#faad14', color: '#fff', marginBottom: 16 }}>
            Reenviar correo
          </Button>
        </Popconfirm>
      )}

      {esFuncionario && tieneObservacionesParaReenviar && ['PENDIENTE_REVISION', 'CON_OBSERVACIONES'].includes(solicitud.estado_actual) && tipoRechazoActual !== null && (
        <Card style={{ borderRadius: 12, marginBottom: 16, border: '1px solid #ff4d4f' }}>
          <Alert
            type="error"
            showIcon
            title="Esta solicitud fue rechazada por un firmante"
            description={solicitud.observaciones_generales}
            style={{ marginBottom: 16 }}
          />
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Tipo de rechazo:
            </Text>
            <Select
              value={tipoRechazoActual}
              onChange={async (valor) => {
                const firmaRechazada = firmas.find(f => f.estado_firma === 'RECHAZADO')
                if (!firmaRechazada) return
                try {
                  await api.put(`/solicitudes/${id}/cambiar-tipo-rechazo`, {
                    firma_id: firmaRechazada.id,
                    tipo_rechazo: valor
                  })
                  setTipoRechazoActual(valor)
                  message.success('Tipo de rechazo actualizado')
                } catch {
                  message.error('Error al actualizar tipo de rechazo')
                }
              }}
              style={{ width: 350 }}
              options={[
                { value: 'POR_DOCUMENTOS', label: 'Por documentos — Se enviará enlace de corrección' },
                { value: 'POR_OTRA_RAZON', label: 'Por otra razón - No se enviará enlace de corrección' },
              ]}
            />
          </div>
          <Space wrap>
            <Popconfirm
              title={tipoRechazoActual === 'POR_OTRA_RAZON'
                ? "¿Enviar notificación informativa al aprendiz? No se enviará enlace de corrección."
                : "¿Enviar correo al aprendiz con enlace para corregir su solicitud?"}
              onConfirm={async () => {
                try {
                  await api.post(`/solicitudes/${id}/enviar-observaciones`)
                  message.success('Notificación enviada al aprendiz')
                  cargar()
                } catch (err) {
                  message.error(err.response?.data?.detail ?? 'Error al enviar')
                }
              }}
              okText="Sí" cancelText="No"
            >
              <Button type="primary" danger icon={<ExclamationCircleOutlined />}>
                {tipoRechazoActual === 'POR_OTRA_RAZON'
                  ? 'Notificar al aprendiz'
                  : 'Enviar correo al aprendiz'}
              </Button>
            </Popconfirm>
            <Popconfirm
              title="¿Quitar las observaciones?"
              onConfirm={async () => {
                try {
                  await api.put(`/solicitudes/${id}/programa`, { observaciones_generales: null })
                  message.success('Observaciones eliminadas')
                  cargar()
                } catch (err) {
                  message.error('Error al quitar observaciones')
                }
              }}
              okText="Sí" cancelText="No"
            >
              <Button icon={<CheckCircleOutlined />}>
                Quitar observaciones
              </Button>
            </Popconfirm>
            
            <Popconfirm
              title="¿Reenviar las observaciones al aprendiz?"
              description="Se enviará nuevamente el correo con las observaciones. Si es por documentos, se generará un nuevo enlace de edición."
              onConfirm={async () => {
                try {
                  await api.post(`/solicitudes/${id}/reenviar-observaciones`)
                  message.success('Observaciones reenviadas al aprendiz')
                  cargar()
                } catch (err) {
                  message.error(err.response?.data?.detail ?? 'Error al reenviar observaciones')
                }
              }}
              okText="Sí" cancelText="No"
            >
              <Button icon={<ExclamationCircleOutlined />} style={{ background: '#faad14', borderColor: '#faad14', color: '#fff' }}>
                Reenviar observaciones
              </Button>
            </Popconfirm>
            
            {tipoRechazoActual === 'POR_OTRA_RAZON' && solicitud.estado_actual === 'CON_OBSERVACIONES' && (
              <Popconfirm
                title="¿Marcar esta solicitud como resuelta?"
                description="La solicitud pasará a estado CORREGIDO y volverá a PENDIENTE_REVISION para revisión final antes de firmas."
                onConfirm={async () => {
                  try {
                    await api.put(`/solicitudes/${id}/marcar-corregido`)
                    message.success('Solicitud marcada como resuelta')
                    cargar()
                  } catch (err) {
                    message.error(err.response?.data?.detail ?? 'Error al marcar como resuelto')
                  }
                }}
                okText="Sí" cancelText="No"
              >
                <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<CheckCircleOutlined />}>
                  Resolver observación
                </Button>
              </Popconfirm>
            )}
          </Space>
          {tipoRechazoActual === 'POR_DOCUMENTOS' && (
            <Alert
              type="warning"
              showIcon
              title="Rechazo por documentos"
              description="El firmante rechazó esta solicitud por problemas en los documentos. Debes revisar cuidadosamente las observaciones anteriores y marcar como OBSERVADO los documentos correspondientes. Luego notifica al aprendiz para que los corrija."
              style={{ marginTop: 12 }}
            />
          )}
          {tipoRechazoActual === 'POR_OTRA_RAZON' && (
            <Alert
              type="info"
              showIcon
              title="Al notificar al aprendiz se le enviará un correo informativo con los datos del firmante que rechazó, sin enlace de corrección."
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      )}

      {tieneAccesoCompleto && historialObs && (
        <Card
          title="Historial de observaciones"
          style={{ borderRadius: 12, marginTop: 16 }}
        >
          {historialObs.rechazos?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Rechazos de firma:</Text>
              {historialObs.rechazos.map((r, i) => (
                <Alert
                  key={i}
                  type="warning"
                  showIcon
                  title={r.descripcion}
                  description={new Date(r.fecha_cambio).toLocaleString('es-CO')}
                  style={{ marginBottom: 8 }}
                />
              ))}
            </div>
          )}

          {historialObs.observaciones_enviadas?.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Observaciones enviadas al aprendiz:</Text>
              {historialObs.observaciones_enviadas.map((o, i) => (
                <Card key={i} size="small" style={{ marginBottom: 8, borderColor: '#faad14' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(o.fecha_envio).toLocaleString('es-CO')}
                  </Text>
                  <div><Text>{o.asunto}</Text></div>
                  <Tag color={o.enviado ? 'green' : 'red'}>
                    {o.enviado ? 'Enviado' : 'Falló'}
                  </Tag>
                </Card>
              ))}
            </div>
          )}

          {!historialObs.rechazos?.length && !historialObs.observaciones_enviadas?.length && (
            <Text type="secondary">Sin historial de observaciones</Text>
          )}
        </Card>
      )}

      {/* Documentos */}
      <Card
        title="Documentos"
        style={{ borderRadius: 12, marginBottom: 16 }}
        extra={
          enRevision && (
            <Space>
              {enRevision && documentos.some(d => d.estado_documento !== 'APROBADO') && (
                <Popconfirm
                  title="¿Aprobar todos los documentos pendientes?"
                  onConfirm={async () => {
                    try {
                      await api.post(`/documentos/${id}/aprobar-todos`)
                      message.success('Todos los documentos aprobados')
                      cargar()
                    } catch (err) {
                      message.error(err.response?.data?.detail ?? 'Error al aprobar')
                    }
                  }}
                  okText="Sí" cancelText="No"
                >
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  >
                    Aprobar todos
                  </Button>
                </Popconfirm>
              )}
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  formPrograma.setFieldsValue({
                    nombre_programa: solicitud.nombre_programa,
                    numero_ficha: solicitud.numero_ficha,
                  })
                  setModalEditarPrograma(true)
                }}
              >
                Editar programa
              </Button>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  formAprendiz.setFieldsValue({
                    nombre_aprendiz: solicitud.nombre_aprendiz,
                    numero_documento: solicitud.numero_documento,
                    correo_aprendiz: solicitud.correo_aprendiz,
                    telefono_aprendiz: solicitud.telefono_aprendiz,
                  })
                  setModalEditarAprendiz(true)
                }}
              >
                Editar aprendiz
              </Button>
            </Space>
          )
        }
      >
        <Table
          dataSource={documentos}
          columns={columnasDocumentos}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
          locale={{ emptyText: 'No hay documentos' }}
        />
      </Card>

      {/* Observaciones generales — solo en revisión */}
      {enRevision && (
        <Card title="Observaciones generales" style={{ borderRadius: 12, marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Si hay datos incorrectos que el aprendiz debe corregir, descríbelos aquí:
          </Text>
          <Input.TextArea
            rows={3}
            value={observacionesGenerales}
            onChange={e => setObservacionesGenerales(e.target.value)}
            onBlur={e => guardarObservacionesGenerales(e.target.value)}
            placeholder="Describe las observaciones generales..."
          />
        </Card>
      )}

      {/* PDF Consolidado */}
      {solicitud.pdf_consolidado_url && (
        <Card
          title="PDF Consolidado"
          style={{ borderRadius: 12, marginBottom: 16 }}
          extra={
            <Space>
              <Button
                icon={<FilePdfOutlined />}
                onClick={() => verDocumento(solicitud.pdf_consolidado_url)}
              >
                {solicitud.estado_actual === 'CERTIFICADO'
                  ? 'Ver PDF certificado'
                  : solicitud.estado_actual === 'PENDIENTE_CERTIFICACION'
                  ? 'Ver PDF firmado'
                  : 'Ver PDF consolidado'}
              </Button>
              {(esFuncionario || esAdmin) && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => descargarPDF(id)}
                  style={{ background: '#004A2F', borderColor: '#004A2F' }}
                >
                  Descargar
                </Button>
              )}
            </Space>
          }
        >
          <Text type="secondary">
            {solicitud.estado_actual === 'CERTIFICADO'
              ? 'Documento final certificado con todas las firmas.'
              : solicitud.estado_actual === 'PENDIENTE_CERTIFICACION'
              ? 'Todas las firmas completadas. Pendiente de certificación.'
              : 'Documento consolidado generado para proceso de firmas.'}
          </Text>
        </Card>
      )}

      {/* Firmas */}
      {tieneAccesoCompleto && firmas.length > 0 && (
        <Card title="Estado de firmas" style={{ borderRadius: 12 }}>
          <Table
            dataSource={firmas}
            columns={columnasFirmas}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 500 }}
          />
        </Card>
      )}

      {(esFuncionario || esAdmin) && historialEstados.length > 0 && (
        <Card title="Historial de estados" style={{ borderRadius: 12, marginTop: 16 }}>
          <Table
            dataSource={historialEstados}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 500 }}
            columns={[
              {
                title: 'Estado anterior',
                dataIndex: 'estado_anterior',
                key: 'estado_anterior',
                render: (e) => e
                  ? <Tag color={COLORES_ESTADO[e]}>{TEXTOS_ESTADO[e]}</Tag>
                  : <Text type="secondary">—</Text>
              },
              {
                title: 'Estado nuevo',
                dataIndex: 'estado_nuevo',
                key: 'estado_nuevo',
                render: (e) => <Tag color={COLORES_ESTADO[e]}>{TEXTOS_ESTADO[e]}</Tag>
              },
              {
                title: 'Usuario',
                dataIndex: 'nombre_usuario',
                key: 'nombre_usuario',
                render: (n) => n || <Text type="secondary">Sistema</Text>
              },
              {
                title: 'Motivo',
                dataIndex: 'motivo',
                key: 'motivo',
                render: (m) => m || <Text type="secondary">—</Text>
              },
              {
                title: 'Fecha',
                dataIndex: 'fecha_cambio',
                key: 'fecha_cambio',
                render: (f) => new Date(f).toLocaleString('es-CO')
              },
            ]}
          />
        </Card>
      )}

      {/* ==================== MODALES ==================== */}

      {/* Modal Confirmar Revisión */}
      <Modal
        title="Confirmar revisión"
        open={modalConfirmarRevision}
        onCancel={() => { setModalConfirmarRevision(false); formConfirmar.resetFields() }}
        footer={null}
        width={500}
      >
        <Form form={formConfirmar} layout="vertical" onFinish={confirmarRevision}>
          <Alert
            type="info"
            showIcon
            title="Si hay documentos observados u observaciones generales, se notificará al aprendiz. Si todo está aprobado, pasará a firmas."
            style={{ marginBottom: 16 }}
          />
          <Alert
            type="info"
            showIcon
            title={
              solicitud.coordinador_id
                ? "El coordinador ya fue asignado anteriormente. Puedes cambiarlo si es necesario."
                : "Selecciona el coordinador que firmará esta solicitud."
            }
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="coordinador_id"
            label="Coordinador que firmará"
            rules={[{ required: true, message: 'Selecciona un coordinador' }]}
          >
            <Select
              placeholder="Selecciona un coordinador..."
              options={coordinadores.map(c => ({
                value: c.id,
                label: `${c.nombre_completo} — ${c.correo}`
              }))}
            />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalConfirmarRevision(false); formConfirmar.resetFields() }}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={enviando}
              icon={<CheckCircleOutlined />}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Confirmar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Firmar */}
      <Modal
        title="Confirmar firma"
        open={modalFirmar}
        onCancel={() => { setModalFirmar(false); formFirma.resetFields() }}
        footer={null}
        width={600}
      >
        <Form form={formFirma} layout="vertical" onFinish={firmar}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Documentos de la solicitud:</Text>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {documentos.map(doc => (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 12px', background: '#f6ffed',
                  borderRadius: 6, border: '1px solid #b7eb8f'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FilePdfOutlined style={{ color: '#52c41a' }} />
                    <Text style={{ fontSize: 13 }}>{doc.nombre_documento}</Text>
                  </div>
                  <Button size="small" type="link" onClick={() => verDocumento(doc.archivo_url)}>
                    Ver PDF
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Alert
            type="warning"
            showIcon
            title="Al firmar confirmas que has revisado todos los documentos"
            style={{ marginBottom: 16 }}
          />
          <Form.Item name="password" label="Confirma tu contraseña para firmar"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Tu contraseña" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalFirmar(false); formFirma.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={enviando}
              icon={<SignatureOutlined />}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}>
              Confirmar firma
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Rechazar */}
      <Modal
        title="Rechazar firma"
        open={modalRechazar}
        onCancel={() => { setModalRechazar(false); formRechazo.resetFields() }}
        footer={null}
        width={500}
      >
        <Form form={formRechazo} layout="vertical" onFinish={rechazar}>
          <Form.Item name="tipo_rechazo" label="Tipo de rechazo"
            rules={[{ required: true, message: 'Selecciona el tipo' }]}>
            <Select
              placeholder="Selecciona..."
              options={[
                { value: 'POR_DOCUMENTOS', label: 'Por documentos — El aprendiz debe corregir los documentos o datos de la solicitud' },
                { value: 'POR_OTRA_RAZON', label: 'Por otra razón' },
              ]}
            />
          </Form.Item>
          <Form.Item name="motivo_rechazo" label="Motivo del rechazo"
            rules={[{ required: true, message: 'Ingresa el motivo del rechazo' },
                    { min: 10, message: 'El motivo debe tener al menos 10 caracteres' }]}>
            <Input.TextArea rows={3} placeholder="Describe el motivo del rechazo..." />
          </Form.Item>
          <Form.Item name="password" label="Confirma tu contraseña"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Tu contraseña" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalRechazar(false); formRechazo.resetFields() }}>Cancelar</Button>
            <Button danger type="primary" htmlType="submit" loading={enviando}>
              Confirmar rechazo
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Certificar */}
      <Modal
        title="Certificar solicitud"
        open={modalCertificar}
        onCancel={() => setModalCertificar(false)}
        footer={[
          <Button key="cancelar" onClick={() => setModalCertificar(false)}>Cancelar</Button>,
          <Button key="certificar" type="primary" loading={enviando}
            icon={<CheckCircleOutlined />} onClick={certificar}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}>
            Confirmar certificación
          </Button>
        ]}
      >
        <Alert
          title="¿Confirmas que deseas certificar esta solicitud?"
          description="Esta acción marcará la solicitud como CERTIFICADA y no podrá revertirse."
          type="warning"
          showIcon
        />
      </Modal>

      {/* Modal Reubicar */}
      <Modal
        title={`Reubicar — ${documentoSeleccionado?.nombre_documento}`}
        open={modalReubicar}
        onCancel={() => { setModalReubicar(false); formReubicar.resetFields() }}
        footer={null}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Selecciona el campo al que pertenece este documento:
        </Text>
        <Form form={formReubicar} layout="vertical" onFinish={reubicarDocumento}>
          <Form.Item name="nuevo_documento_id" label="Tipo de documento"
            rules={[{ required: true, message: 'Selecciona el documento' }]}>
            <Select
              placeholder="Selecciona..."
              options={todosDocumentos
                .filter(d => d.id !== documentoSeleccionado?.documento_id)
                .map(d => ({ value: d.id, label: d.nombre }))
              }
            />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalReubicar(false); formReubicar.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit"
              style={{ background: '#004A2F', borderColor: '#004A2F' }}>
              Reubicar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Editar Programa */}
      <Modal
        title="Editar datos del programa"
        open={modalEditarPrograma}
        onCancel={() => { setModalEditarPrograma(false); formPrograma.resetFields() }}
        footer={null}
      >
        <Form form={formPrograma} layout="vertical" onFinish={editarPrograma}>
          <Form.Item name="nombre_programa" label="Nombre del programa"
            rules={[{ required: true, message: 'Ingresa el nombre del programa' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="numero_ficha" label="Número de ficha"
            rules={[{ required: true, message: 'Ingresa el número de ficha' }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalEditarPrograma(false); formPrograma.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit"
              style={{ background: '#004A2F', borderColor: '#004A2F' }}>
              Guardar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Editar Aprendiz */}
      <Modal
        title="Editar datos del aprendiz"
        open={modalEditarAprendiz}
        onCancel={() => { setModalEditarAprendiz(false); formAprendiz.resetFields() }}
        footer={null}
      >
        <Form form={formAprendiz} layout="vertical" onFinish={editarDatosAprendiz}>
          <Form.Item name="nombre_aprendiz" label="Nombre completo">
            <Input />
          </Form.Item>
          <Form.Item name="numero_documento" label="Número de documento">
            <Input />
          </Form.Item>
          <Form.Item name="correo_aprendiz" label="Correo electrónico"
            rules={[{ type: 'email', message: 'Correo inválido' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="telefono_aprendiz" label="Teléfono">
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalEditarAprendiz(false); formAprendiz.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit"
              style={{ background: '#004A2F', borderColor: '#004A2F' }}>
              Guardar
            </Button>
          </div>
        </Form>
      </Modal>
      {plantillaActiva && (
        <Modal
          title="Previsualización de coordenadas de firma"
          open={modalPreviewFirmas}
          onCancel={() => setModalPreviewFirmas(false)}
          footer={<Button onClick={() => setModalPreviewFirmas(false)}>Cerrar</Button>}
          width="90vw"
          style={{ maxWidth: 900 }}
        >
          <Suspense fallback={
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#666' }}>
                Cargando previsualización...
              </div>
            </div>
          }>
            <PreviewFirmasSolicitud
              key={documentos.map(d => d.id + d.archivo_url).join('-')}
              solicitud={solicitud}
              plantilla={plantillaActiva}
            />
          </Suspense>
        </Modal>
      )}
    </div>
  )
}