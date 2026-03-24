import { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Typography, Input, Select,
  Button, DatePicker, Space, Switch
} from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import api from '../api/axios'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const COLORES_ACCION = {
  LOGIN_EXITOSO: 'green',
  LOGIN_FALLIDO: 'red',
  USUARIO_CREADO: 'blue',
  USUARIO_ACTIVADO: 'green',
  USUARIO_DESACTIVADO: 'orange',
  SOLICITUD_FIRMADA: 'purple',
  SOLICITUD_CERTIFICADA: 'gold',
  DOCUMENTO_OBSERVADO: 'orange',
  FIRMA_REGISTRADA: 'cyan',
  ROL_ACTIVADO: 'green',
  ROL_DESACTIVADO: 'red',
  ROL_ACTUALIZADO: 'blue',
  PERMISO_ASIGNADO: 'geekblue',
  COORDENADAS_GUARDADAS: 'cyan',
}

export default function Auditoria() {
  const [registros, setRegistros] = useState([])
  const [acciones, setAcciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [agrupar, setAgrupar] = useState(false)
  const [porPagina, setPorPagina] = useState(50)

  const [filtros, setFiltros] = useState({
    busqueda: '',
    accion: '',
    fechas: null,
  })

  const cargar = async (pag = 1, pp = porPagina) => {
    setCargando(true)
    try {
        const params = { pagina: pag, por_pagina: pp }
        if (filtros.accion) params.accion = filtros.accion
        if (filtros.fechas) {
        params.fecha_desde = filtros.fechas[0].format('YYYY-MM-DD')
        params.fecha_hasta = filtros.fechas[1].format('YYYY-MM-DD')
        }
        const { data } = await api.get('/auditoria/', { params })
        setRegistros(data.registros)
        setTotal(data.total)
        setPagina(pag)
    } catch {
        setRegistros([])
    } finally {
        setCargando(false)
    }
  }

  const cargarAcciones = async () => {
    try {
      const { data } = await api.get('/auditoria/acciones')
      setAcciones(data.acciones ?? [])
    } catch {}
  }

  useEffect(() => {
    cargarAcciones()
    cargar()
  }, [])

  const registrosFiltrados = registros.filter(r => {
    if (!filtros.busqueda) return true
    const b = filtros.busqueda.toLowerCase()
    return (
      r.descripcion?.toLowerCase().includes(b) ||
      r.nombre_usuario?.toLowerCase().includes(b) ||
      r.correo_usuario?.toLowerCase().includes(b) ||
      r.tabla_afectada?.toLowerCase().includes(b)
    )
  })

  const registrosAgrupados = agrupar
    ? Object.entries(
        registrosFiltrados.reduce((acc, r) => {
          if (!acc[r.accion]) acc[r.accion] = []
          acc[r.accion].push(r)
          return acc
        }, {})
      ).sort((a, b) => b[1].length - a[1].length)
    : null

  const columnas = [
    {
      title: 'Fecha',
      dataIndex: 'fecha_evento',
      key: 'fecha_evento',
      width: 150,
      render: (f) => new Date(f).toLocaleString('es-CO')
    },
    {
      title: 'Acción',
      dataIndex: 'accion',
      key: 'accion',
      width: 200,
      render: (a) => (
        <Tag color={COLORES_ACCION[a] ?? 'default'} style={{ fontSize: 11 }}>
          {a.replace(/_/g, ' ')}
        </Tag>
      )
    },
    {
      title: 'Usuario',
      key: 'usuario',
      width: 180,
      render: (_, r) => r.nombre_usuario ? (
        <div>
          <Text style={{ fontSize: 12 }}>{r.nombre_usuario}</Text>
          <div><Text type="secondary" style={{ fontSize: 11 }}>{r.correo_usuario}</Text></div>
        </div>
      ) : <Text type="secondary">—</Text>
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      render: (d) => <Text style={{ fontSize: 12 }}>{d}</Text>
    },
    {
      title: 'Tabla',
      dataIndex: 'tabla_afectada',
      key: 'tabla_afectada',
      width: 150,
      render: (t) => <Tag>{t}</Tag>
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Auditoría</Title>
        <Button icon={<ReloadOutlined />} onClick={() => cargar(1)}>Actualizar</Button>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="Buscar por descripción, usuario o tabla..."
            prefix={<SearchOutlined />}
            value={filtros.busqueda}
            onChange={e => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
            allowClear
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Select
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Filtrar por acción..."
              value={filtros.accion || undefined}
              allowClear
              onChange={v => setFiltros(prev => ({ ...prev, accion: v ?? '' }))}
              options={acciones.map(a => ({
                value: a,
                label: <Tag color={COLORES_ACCION[a] ?? 'default'}>{a.replace(/_/g, ' ')}</Tag>
              }))}
            />
            <RangePicker
              value={filtros.fechas}
              onChange={v => setFiltros(prev => ({ ...prev, fechas: v }))}
              format="YYYY-MM-DD"
            />
            <Button
              type="primary"
              onClick={() => cargar(1)}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Filtrar
            </Button>
            <Button
              onClick={() => {
                setFiltros({ busqueda: '', accion: '', fechas: null })
                // Llamar cargar directamente sin filtros
                setCargando(true)
                api.get('/auditoria/', { params: { pagina: 1, por_pagina: 50 } })
                    .then(({ data }) => {
                        setRegistros(data.registros)
                        setTotal(data.total)
                        setPagina(1)
                    })
                    .catch(() => setRegistros([]))
                    .finally(() => setCargando(false))
              }}
            >
            Limpiar filtros
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={agrupar} onChange={setAgrupar} />
            <Text>Agrupar por tipo de acción</Text>
          </div>
        </Space>
      </Card>

      {agrupar ? (
        registrosAgrupados?.map(([accion, items]) => (
          <Card
            key={accion}
            style={{ borderRadius: 12, marginBottom: 16 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color={COLORES_ACCION[accion] ?? 'default'}>
                  {accion.replace(/_/g, ' ')}
                </Tag>
                <Text type="secondary">{items.length} registros</Text>
              </div>
            }
          >
            <Table
              dataSource={items}
              columns={columnas.filter(c => c.key !== 'accion')}
              rowKey="id"
              size="small"
              scroll={{ x: 700 }}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        ))
      ) : (
        <Card style={{ borderRadius: 12 }}>
          <Table
            dataSource={registrosFiltrados}
            columns={columnas}
            rowKey="id"
            loading={cargando}
            scroll={{ x: 900 }}
            pagination={{
              current: pagina,
              total: total,
              pageSize: porPagina,
              showSizeChanger: true,
              pageSizeOptions: ['25', '50', '100'],
              onChange: (p, pp) => {
                setPorPagina(pp)
                cargar(p, pp)
              },
              onShowSizeChange: (p, pp) => {
                setPorPagina(pp)
                cargar(1, pp)
              },
              showTotal: (t) => `${t} registros`
            }}
            locale={{ emptyText: 'No hay registros' }}
          />
        </Card>
      )}
    </div>
  )
}