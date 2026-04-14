import { useState, useEffect } from 'react'
import { Table, Tag, Button, Select, Input, Card, Typography, Space, message } from 'antd'
import { SearchOutlined, EyeOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
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

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [orden, setOrden] = useState('desc')
  const [agrupar, setAgrupar] = useState(false)
  const [pagina, setPagina] = useState(1)
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
  useEffect(() => { setPagina(1) }, [filtroBusqueda, filtroEstado, orden, agrupar])

  const solicitudesFiltradas = solicitudes
    .filter(s => {
      if (!filtroBusqueda) return true
      const busqueda = filtroBusqueda.toLowerCase()
      return (
        s.nombre_aprendiz?.toLowerCase().includes(busqueda) ||
        s.numero_documento?.toLowerCase().includes(busqueda) ||
        s.numero_ficha?.toLowerCase().includes(busqueda) ||
        s.nombre_programa?.toLowerCase().includes(busqueda)
      )
    })
    .sort((a, b) => {
      const diff = new Date(a.fecha_solicitud) - new Date(b.fecha_solicitud)
      return orden === 'asc' ? diff : -diff
    })

  const solicitudesAgrupadas = agrupar
    ? Object.entries(
        solicitudesFiltradas.reduce((acc, s) => {
          const tipo = s.nombre_tipo_programa
          if (!acc[tipo]) acc[tipo] = []
          acc[tipo].push(s)
          return acc
        }, {})
      ).map(([tipo, items]) => ({ tipo, items }))
    : null

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

  const renderAcciones = (record) => {
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
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Solicitudes</Title>
        <Button icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="Buscar por aprendiz, documento, ficha o programa..."
            prefix={<SearchOutlined />}
            value={filtroBusqueda}
            onChange={e => setFiltroBusqueda(e.target.value)}
            allowClear
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
      </Card>

      <Card style={{ borderRadius: 12 }}>
        {agrupar ? (
          solicitudesAgrupadas?.map(({ tipo, items }) => (
            <div key={tipo} style={{ marginBottom: 24 }}>
              <div style={{
                background: '#004A2F', color: 'white',
                padding: '8px 16px', borderRadius: '8px 8px 0 0', fontWeight: 600
              }}>
                {tipo} — {items.length} solicitudes
              </div>
              <Table dataSource={items} columns={columnas} rowKey="id" size="small"
                scroll={{ x: 800 }} pagination={{ pageSize: 5 }}
                locale={{ emptyText: 'No hay solicitudes' }} />
            </div>
          ))
        ) : (
          <Table
            dataSource={solicitudesFiltradas}
            columns={columnas}
            rowKey="id"
            loading={cargando}
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
    </div>
  )
}