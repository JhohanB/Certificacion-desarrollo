import { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Tag, Button, Select, Input, Card, Typography, Space, message, DatePicker, Skeleton, Modal, Form } from 'antd'
const { RangePicker } = DatePicker
import { SearchOutlined, EyeOutlined, ReloadOutlined, DownloadOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const { Title, Text } = Typography

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDIENTE_REVISION', label: 'Pendiente de revisión' },
  { value: 'CON_OBSERVACIONES', label: 'Con observaciones' },
  { value: 'CORREGIDO', label: 'Corregido' },
  { value: 'PENDIENTE_FIRMAS', label: 'Pendiente de firmas' },
  { value: 'PENDIENTE_CERTIFICACION', label: 'Pendiente de certificación' },
  { value: 'CERTIFICADO', label: 'Certificado' },
]

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

// Función debounce para optimizar búsqueda
const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }
}

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [filtroFicha, setFiltroFicha] = useState('')
  const [filtroFecha, setFiltroFecha] = useState(null) // Cambiado a null para rango [fechaDesde, fechaHasta]
  const [filtroBusquedaDebounced, setFiltroBusquedaDebounced] = useState('')
  const [orden, setOrden] = useState('desc')
  const [agrupar, setAgrupar] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [descargandoCertificados, setDescargandoCertificados] = useState(false)
  const [modoEliminar, setModoEliminar] = useState(false)
  const [seleccionadasEliminar, setSeleccionadasEliminar] = useState([])
  const [modalPasswordVisible, setModalPasswordVisible] = useState(false)
  const [passwordEliminar, setPasswordEliminar] = useState('')
  const [eliminandoDocumentos, setEliminandoDocumentos] = useState(false)
  const [resultadoEliminacion, setResultadoEliminacion] = useState(null)
  const [modalResultadoVisible, setModalResultadoVisible] = useState(false)
  const navigate = useNavigate()
  const { usuario, rolActivo } = useAuth()

  const rolObj = rolActivo ?? usuario?.roles?.[0]

  const esAdmin = !!rolObj?.es_admin
  const esFuncionario = !!rolObj?.es_funcionario_revision
  const esCoordinador = !!rolObj?.es_coordinador
  const esFirmante = !!(rolObj?.requiere_firma && !rolObj?.es_coordinador)
  const tieneAccesoCompleto = esAdmin || esFuncionario
  const puedeDescargar = esAdmin || esFuncionario

  const cargar = async () => {
    setCargando(true)
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      const { data } = await api.get('/solicitudes/', { params })
      setSolicitudes(data)
    } catch {
      setSolicitudes([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [filtroEstado])
  useEffect(() => { setPagina(1) }, [filtroBusqueda, filtroEstado, orden, agrupar, filtroFicha, filtroFecha])

  // Debounce para filtro de búsqueda
  useEffect(() => {
    const debounced = debounce(() => setFiltroBusquedaDebounced(filtroBusqueda), 300)
    debounced()
    return () => clearTimeout(debounced.timeoutId)
  }, [filtroBusqueda])

  // Memoizar solicitudes filtradas para evitar recalculos innecesarios
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes
      .filter(s => {
        // Filtro de búsqueda general (sin ficha ni fecha)
        if (filtroBusquedaDebounced) {
          const busqueda = filtroBusquedaDebounced.toLowerCase()
          const coincide = (
            s.nombre_aprendiz?.toLowerCase().includes(busqueda) ||
            s.numero_documento?.toLowerCase().includes(busqueda) ||
            s.nombre_programa?.toLowerCase().includes(busqueda) ||
            s.nombre_tipo_programa?.toLowerCase().includes(busqueda)
          )
          if (!coincide) return false
        }

        // Filtro específico de número de ficha
        if (filtroFicha && !s.numero_ficha?.toLowerCase().includes(filtroFicha.toLowerCase())) {
          return false
        }

        // Filtro de rango de fechas
        if (filtroFecha && filtroFecha.length === 2) {
          const fechaSolicitud = new Date(s.fecha_solicitud)
          const fechaDesde = new Date(filtroFecha[0])
          const fechaHasta = new Date(filtroFecha[1])
          // Establecer hora final del día para fechaHasta
          fechaHasta.setHours(23, 59, 59, 999)
          if (fechaSolicitud < fechaDesde || fechaSolicitud > fechaHasta) return false
        }

        return true
      })
      .sort((a, b) => {
        const diff = new Date(a.fecha_solicitud) - new Date(b.fecha_solicitud)
        return orden === 'asc' ? diff : -diff
      })
  }, [solicitudes, filtroBusquedaDebounced, filtroFicha, filtroFecha, orden])

  const solicitudesAgrupadas = useMemo(() => {
    if (!agrupar) return null
    return Object.entries(
      solicitudesFiltradas.reduce((acc, s) => {
        const tipo = s.nombre_tipo_programa
        if (!acc[tipo]) acc[tipo] = []
        acc[tipo].push(s)
        return acc
      }, {})
    ).map(([tipo, items]) => ({ tipo, items }))
  }, [solicitudesFiltradas, agrupar])

  const descargarPDF = async (solicitudId) => {
    try {
      const response = await api.get(`/documentos/${solicitudId}/pdf`, { responseType: 'blob' })
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
    } catch {
      message.error('Error al descargar el PDF')
    }
  }

  const certificadosVisibles = useMemo(() => {
    const lista = agrupar
      ? (solicitudesAgrupadas?.flatMap(g => g.items) || [])
      : solicitudesFiltradas

    return lista.filter(
      s =>
        s.estado_actual === 'CERTIFICADO' &&
        !s.documentos_eliminados
    )
  }, [agrupar, solicitudesAgrupadas, solicitudesFiltradas])

  const solicitudesEliminables = useMemo(() => {
    return solicitudesFiltradas.filter(
      s =>
        s.estado_actual === 'CERTIFICADO' &&
        !s.documentos_eliminados
    )
  }, [solicitudesFiltradas])

  const descargarCertificadosMasivo = async () => {
    if (!certificadosVisibles.length) {
      message.warning('No hay certificados para descargar en los resultados actuales')
      return
    }

    setDescargandoCertificados(true)
    try {
      const { data, headers } = await api.post('/documentos/certificados/zip', {
        ids: certificadosVisibles.map(s => s.id)
      }, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      const contentDisposition = headers['content-disposition']
      let nombreArchivo = `certificados_${new Date().toISOString().slice(0,10)}.zip`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/)
        if (match) nombreArchivo = decodeURIComponent(match[1])
      }
      link.setAttribute('download', nombreArchivo)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Error al descargar los certificados')
    } finally {
      setDescargandoCertificados(false)
    }
  }

  const abrirModalEliminar = () => {
    if (!seleccionadasEliminar.length) {
      message.warning('Seleccione al menos una solicitud')
      return
    }

    setModalPasswordVisible(true)
  }

  const confirmarEliminarDocumentos = async () => {
    if (!passwordEliminar.trim()) {
      message.warning('Debe ingresar su contraseña')
      return
    }

    setEliminandoDocumentos(true)

    try {
      const { data } = await api.post('/solicitudes/eliminar-documentos', {
        solicitud_ids: seleccionadasEliminar,
        password: passwordEliminar
      })

      setModalPasswordVisible(false)
      setPasswordEliminar('')
      setModoEliminar(false)
      setSeleccionadasEliminar([])

      setResultadoEliminacion(data)
      setModalResultadoVisible(true)

      await cargar()

    } catch (error) {
      message.error(
        error?.response?.data?.detail ||
        'Error al eliminar documentos'
      )
    } finally {
      setEliminandoDocumentos(false)
    }
  }

  const renderAcciones = useCallback((record) => {
    // ADMIN y FUNCIONARIO_CERTIFICACION — siempre pueden ver
    if (tieneAccesoCompleto || esAdmin) {
      return (
        <Space>
          <Button type="primary" icon={<EyeOutlined />} size="small"
            style={{ background: '#004A2F', borderColor: '#004A2F' }}
            onClick={() => navigate(`/solicitudes/${record.id}`)}>
            Ver
          </Button>
          {puedeDescargar && record.pdf_consolidado_url && (
            <Button size="small" icon={<DownloadOutlined />} onClick={() => descargarPDF(record.id)}>
              PDF
            </Button>
          )}
        </Space>
      )
    }

    // Coordinador — solo si es SU firma específica y no ha firmado
    if (esCoordinador) {
      if (record.estado_actual === 'PENDIENTE_FIRMAS' && record.es_mi_firma && !record.ya_firme) {
        return (
          <Button type="primary" icon={<EyeOutlined />} size="small"
            style={{ background: '#004A2F', borderColor: '#004A2F' }}
            onClick={() => navigate(`/solicitudes/${record.id}`)}>
            Firmar
          </Button>
        )
      }
      if (record.ya_firme) {
        return <Tag color="green">Firmado</Tag>
      }
      return <Text type="secondary">—</Text>
    }

    // Firmantes — solo si está en PENDIENTE_FIRMAS y no han firmado
    if (esFirmante) {
      if (record.estado_actual === 'PENDIENTE_FIRMAS' && !record.ya_firme) {
        return (
          <Button type="primary" icon={<EyeOutlined />} size="small"
            style={{ background: '#004A2F', borderColor: '#004A2F' }}
            onClick={() => navigate(`/solicitudes/${record.id}`)}>
            Firmar
          </Button>
        )
      }
      return <Tag color={record.ya_firme ? 'green' : 'default'}>
        {record.ya_firme ? 'Firmado' : '—'}
      </Tag>
    }

    return null
  }, [tieneAccesoCompleto, esAdmin, puedeDescargar, esCoordinador, esFirmante, navigate])

  const rowSelection = modoEliminar ? {
    selectedRowKeys: seleccionadasEliminar,
    onChange: (selectedRowKeys) => {
      setSeleccionadasEliminar(selectedRowKeys)
    },
    getCheckboxProps: (record) => ({
      disabled: !(
        record.estado_actual === 'CERTIFICADO' &&
        !record.documentos_eliminados
      )
    })
  } : null

  const columnas = [
    {
      title: 'Aprendiz',
      dataIndex: 'nombre_aprendiz',
      key: 'nombre_aprendiz',
      render: (nombre, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{nombre}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{record.numero_documento}</div>
        </div>
      )
    },
    {
      title: 'Programa',
      dataIndex: 'nombre_programa',
      key: 'nombre_programa',
      render: (nombre, record) => (
        <div>
          <div>{nombre}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{record.nombre_tipo_programa}</div>
        </div>
      )
    },
    {
      title: 'Ficha',
      dataIndex: 'numero_ficha',
      key: 'numero_ficha',
    },
    {
      title: 'Correo',
      dataIndex: 'correo_aprendiz',
      key: 'correo_aprendiz',
      render: (correo) => correo || <Text type="secondary">—</Text>
    },
    {
      title: 'Estado',
      dataIndex: 'estado_actual',
      key: 'estado_actual',
      render: (estado) => (
        <Tag color={COLORES_ESTADO[estado]}>{TEXTOS_ESTADO[estado]}</Tag>
      )
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha_solicitud',
      key: 'fecha_solicitud',
      render: (fecha) => new Date(fecha).toLocaleDateString('es-CO')
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => renderAcciones(record)
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 8, flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}>Solicitudes</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={cargar}>
            Actualizar
          </Button>

          {tieneAccesoCompleto && (
            <>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setModoEliminar(!modoEliminar)
                  setSeleccionadasEliminar([])
                }}
              >
                {modoEliminar ? 'Cancelar eliminación' : 'Eliminar documentos'}
              </Button>

              <Button
                icon={<DownloadOutlined />}
                type="primary"
                loading={descargandoCertificados}
                disabled={!certificadosVisibles.length}
                onClick={descargarCertificadosMasivo}
              >
                Descargar certificados ({certificadosVisibles.length})
              </Button>

              {modoEliminar && (
                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!seleccionadasEliminar.length}
                  onClick={abrirModalEliminar}
                >
                  Confirmar eliminación ({seleccionadasEliminar.length})
                </Button>
              )}
            </>
          )}
        </Space>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <form autoComplete="off">
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="Buscar por aprendiz, documento, programa o nivel de formación..."
              prefix={<SearchOutlined />}
              value={filtroBusqueda}
              onChange={e => setFiltroBusqueda(e.target.value)}
              allowClear
              autoComplete="nope"
            />
            <Input
              placeholder="Filtrar por número de ficha..."
              value={filtroFicha}
              onChange={e => setFiltroFicha(e.target.value)}
              allowClear
              autoComplete="nope"
            />
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Fecha desde', 'Fecha hasta']}
              value={filtroFecha}
              onChange={(dates) => setFiltroFecha(dates)}
              format="DD/MM/YYYY"
            />
            <Select style={{ width: '100%' }} value={filtroEstado} onChange={setFiltroEstado} options={ESTADOS} />
            <Select
              style={{ width: '100%' }} value={orden} onChange={setOrden}
              options={[
                { value: 'desc', label: 'Más recientes primero' },
                { value: 'asc', label: 'Más antiguas primero' },
              ]}
            />
            <Button
              type={agrupar ? 'primary' : 'default'}
              onClick={() => setAgrupar(!agrupar)}
              style={agrupar ? { background: '#004A2F', borderColor: '#004A2F' } : {}}
            >
              {agrupar ? 'Agrupado por Nivel de Formación' : 'Agrupar por Nivel de Formación'}
            </Button>
          </Space>
        </form>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        {cargando ? (
          <div style={{ padding: 24 }}>
            <Skeleton active paragraph={{ rows: 4 }} />
            <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 16 }} />
            <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 16 }} />
          </div>
        ) : agrupar ? (
          solicitudesAgrupadas?.map(({ tipo, items }) => (
            <div key={tipo} style={{ marginBottom: 24 }}>
              <div style={{
                background: '#004A2F', color: 'white',
                padding: '8px 16px', borderRadius: '8px 8px 0 0', fontWeight: 600
              }}>
                {tipo} — {items.length} solicitudes
              </div>
              <Table rowSelection={rowSelection} dataSource={items} columns={columnas} rowKey="id" size="small"
                scroll={{ x: 800 }} pagination={{ pageSize: 5 }}
                locale={{ emptyText: 'No hay solicitudes' }} />
            </div>
          ))
        ) : (
          <Table
            rowSelection={rowSelection}
            dataSource={solicitudesFiltradas}
            columns={columnas}
            rowKey="id"
            loading={false}
            scroll={{ x: 800 }}
            pagination={{
              current: pagina,
              pageSize: 10,
              onChange: setPagina,
              showTotal: (total) => `${total} solicitudes`
            }}
            locale={{ emptyText: 'No hay solicitudes' }}
          />
        )}
      </Card>

      <Modal
        title="Confirmar eliminación de documentos"
        open={modalPasswordVisible}
        onCancel={() => setModalPasswordVisible(false)}
        onOk={confirmarEliminarDocumentos}
        confirmLoading={eliminandoDocumentos}
        okText="Eliminar documentos"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            Esta acción eliminará permanentemente los documentos físicos,
            el PDF consolidado y los registros asociados de las solicitudes
            seleccionadas.
          </Text>

          <Text strong>
            Esta acción no se puede deshacer.
          </Text>

          <Input.Password
            placeholder="Ingrese su contraseña"
            value={passwordEliminar}
            onChange={(e) => setPasswordEliminar(e.target.value)}
          />
        </Space>
      </Modal>

      <Modal
        title="Resultado de eliminación"
        open={modalResultadoVisible}
        footer={null}
        onCancel={() => setModalResultadoVisible(false)}
        width={700}
      >
        {resultadoEliminacion && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>{resultadoEliminacion.mensaje_resumen}</Text>

            {resultadoEliminacion.detalles.map((item) => (
              <Card key={item.solicitud_id} size="small">
                <Text strong>{item.nombre_aprendiz}</Text>
                <br />
                <Text>{item.mensaje}</Text>
              </Card>
            ))}
          </Space>
        )}
      </Modal>
    </div>
  )
}