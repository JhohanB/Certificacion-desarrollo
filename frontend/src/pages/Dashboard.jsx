import { Row, Col, Card, Statistic, Typography, Spin, Alert, Table, Tag, Badge } from 'antd'
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, WarningOutlined, SignatureOutlined
} from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const { Title, Text } = Typography

// -------------------------------------------------------
// Dashboard ADMIN
// -------------------------------------------------------
function DashboardAdmin({ data }) {
  const getTotal = (estado) =>
    data?.por_estado?.find(e => e.estado_actual === estado)?.total ?? 0

  const tarjetas = [
    {
      titulo: 'Total solicitudes',
      valor: data?.total_solicitudes ?? 0,
      icono: <FileTextOutlined style={{ fontSize: 28, color: '#004A2F' }} />,
      color: '#f6ffed', borde: '#b7eb8f'
    },
    {
      titulo: 'Certificadas',
      valor: getTotal('CERTIFICADO'),
      icono: <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
      color: '#f6ffed', borde: '#52c41a'
    },
    {
      titulo: 'Pendientes revisión',
      valor: getTotal('PENDIENTE_REVISION'),
      icono: <ClockCircleOutlined style={{ fontSize: 28, color: '#faad14' }} />,
      color: '#fffbe6', borde: '#faad14'
    },
    {
      titulo: 'Con observaciones',
      valor: getTotal('CON_OBSERVACIONES'),
      icono: <ExclamationCircleOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />,
      color: '#fff2f0', borde: '#ff4d4f'
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {tarjetas.map((t, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card style={{ borderRadius: 12, border: `1px solid ${t.borde}`, background: t.color }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Statistic title={t.titulo} value={t.valor} />
                {t.icono}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Por tipo de programa" style={{ borderRadius: 12 }}>
            {data?.por_tipo_programa?.map((t, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < data.por_tipo_programa.length - 1 ? '1px solid #f0f0f0' : 'none'
              }}>
                <Text>{t.tipo_programa}</Text>
                <div style={{ display: 'flex', gap: 16 }}>
                  <Text type="secondary">Total: <strong>{t.total}</strong></Text>
                  <Text style={{ color: '#52c41a' }}>Cert: <strong>{t.certificadas}</strong></Text>
                </div>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Tiempo promedio de certificación" style={{ borderRadius: 12 }}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Statistic
                title="Días promedio desde solicitud hasta certificación"
                value={data?.dias_promedio_certificacion ?? 'Sin datos'}
                suffix={data?.dias_promedio_certificacion ? 'días' : ''}
                valueStyle={{ color: '#004A2F', fontSize: 48 }}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// -------------------------------------------------------
// Dashboard FUNCIONARIO_CERTIFICACION
// -------------------------------------------------------
function DashboardFuncionario({ data, onVerSolicitud }) {
  const columnas = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Tipo', dataIndex: 'tipo_programa', key: 'tipo_programa' },
    {
      title: 'Días esperando',
      dataIndex: 'dias_esperando',
      key: 'dias_esperando',
      render: (dias) => (
        <Tag color={dias > 3 ? 'red' : dias > 1 ? 'orange' : 'green'}>
          {dias} {dias === 1 ? 'día' : 'días'}
        </Tag>
      )
    },
    {
      title: '',
      key: 'accion',
      render: (_, record) => (
        <a onClick={() => onVerSolicitud(record.id)}>Ver</a>
      )
    }
  ]

  const columnasRechazos = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Rechazado por', dataIndex: 'rol_rechazo', key: 'rol_rechazo' },
    { title: 'Funcionario', dataIndex: 'funcionario', key: 'funcionario' },
    { title: 'Motivo', dataIndex: 'motivo_rechazo', key: 'motivo_rechazo' },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #faad14', background: '#fffbe6' }}>
            <Statistic
              title="Pendientes de revisión"
              value={data?.pendientes_revision?.length ?? 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #1677ff', background: '#e6f4ff' }}>
            <Statistic
              title="Corregidas por aprendiz"
              value={data?.corregidas?.length ?? 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #ff4d4f', background: '#fff2f0' }}>
            <Statistic
              title="Solicitudes atrasadas (+3 días)"
              value={data?.total_atrasadas ?? 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Alerta de rechazos */}
      {data?.rechazos_recientes?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${data.rechazos_recientes.length} firma(s) rechazada(s)`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Solicitudes pendientes de revisión" style={{ borderRadius: 12 }}>
            <Table
              dataSource={data?.pendientes_revision}
              columns={columnas}
              rowKey="id"
              size="small"
              scroll={{ x: 600 }}
              pagination={{ pageSize: 5 }}
              locale={{ emptyText: 'No hay solicitudes pendientes' }}
              rowClassName={(record) => record.dias_esperando > 3 ? 'fila-atrasada' : ''}
            />
          </Card>
        </Col>

        {data?.corregidas?.length > 0 && (
          <Col xs={24}>
            <Card title="Solicitudes corregidas por aprendiz" style={{ borderRadius: 12 }}>
              <Table
                dataSource={data?.corregidas}
                columns={columnas}
                rowKey="id"
                size="small"
                scroll={{ x: 600 }}
                pagination={{ pageSize: 5 }}
              />
            </Card>
          </Col>
        )}

        {data?.rechazos_recientes?.length > 0 && (
          <Col xs={24}>
            <Card
              title={<span style={{ color: '#ff4d4f' }}><WarningOutlined /> Firmas rechazadas recientes</span>}
              style={{ borderRadius: 12, border: '1px solid #ffccc7' }}
            >
              <Table
                dataSource={data?.rechazos_recientes}
                columns={columnasRechazos}
                rowKey="solicitud_id"
                size="small"
                scroll={{ x: 600 }}
                pagination={{ pageSize: 5 }}
              />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  )
}

// -------------------------------------------------------
// Dashboard FIRMANTE
// -------------------------------------------------------
function DashboardFirmante({ data, onVerSolicitud }) {
  const columnas = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Tipo', dataIndex: 'tipo_programa', key: 'tipo_programa' },
    {
      title: 'Días esperando',
      dataIndex: 'dias_esperando',
      key: 'dias_esperando',
      render: (dias) => (
        <Tag color={dias > 5 ? 'red' : dias > 2 ? 'orange' : 'green'}>
          {dias} {dias === 1 ? 'día' : 'días'}
        </Tag>
      )
    },
    {
      title: '',
      key: 'accion',
      render: (_, record) => (
        <a onClick={() => onVerSolicitud(record.id)}>Firmar</a>
      )
    }
  ]

  const columnasRechazos = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Tipo', dataIndex: 'tipo_programa', key: 'tipo_programa' },
    { title: 'Motivo', dataIndex: 'motivo_rechazo', key: 'motivo_rechazo' },
    {
      title: 'Fecha',
      dataIndex: 'fecha_rechazo',
      key: 'fecha_rechazo',
      render: (f) => new Date(f).toLocaleDateString('es-CO')
    },
    {
      title: '',
      key: 'accion',
      render: (_, record) => (
        <a onClick={() => onVerSolicitud(record.id)}>Ver</a>
      )
    }
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #faad14', background: '#fffbe6' }}>
            <Statistic
              title="Pendientes de mi firma"
              value={data?.pendientes_firma?.length ?? 0}
              prefix={<SignatureOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #52c41a', background: '#f6ffed' }}>
            <Statistic
              title="Firmadas este mes"
              value={data?.firmadas_este_mes ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #ff4d4f', background: '#fff2f0' }}>
            <Statistic
              title="Rechazadas este mes"
              value={data?.rechazadas_este_mes ?? 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Solicitudes pendientes de mi firma" style={{ borderRadius: 12 }}>
        <Table
          dataSource={data?.pendientes_firma}
          columns={columnas}
          rowKey="id"
          size="small"
          scroll={{ x: 600 }}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'No tienes solicitudes pendientes de firma' }}
        />
      </Card>

      {data?.rechazos_propios?.length > 0 && (
        <Card
          title={<span style={{ color: '#ff4d4f' }}>⚠️ Mis rechazos recientes</span>}
          style={{ borderRadius: 12, marginTop: 16, border: '1px solid #ffccc7' }}
        >
          <Alert
            type="warning"
            showIcon
            message="Estas solicitudes fueron rechazadas por ti. Si ya se corrigieron, comunicate con el encargado de certificación."
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={data.rechazos_propios}
            columns={columnasRechazos}
            rowKey="id"
            size="small"
            scroll={{ x: 600 }}
            pagination={{ pageSize: 5 }}
          />
        </Card>
      )}
    </div>
  )
}

// -------------------------------------------------------
// Dashboard COORDINADOR
// -------------------------------------------------------
function DashboardCoordinador({ data, onVerSolicitud }) {
  const columnas = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Tipo', dataIndex: 'tipo_programa', key: 'tipo_programa' },
    {
      title: 'Días esperando',
      dataIndex: 'dias_esperando',
      key: 'dias_esperando',
      render: (dias) => (
        <Tag color={dias > 5 ? 'red' : dias > 2 ? 'orange' : 'green'}>
          {dias} {dias === 1 ? 'día' : 'días'}
        </Tag>
      )
    },
    {
      title: '',
      key: 'accion',
      render: (_, record) => (
        <a onClick={() => onVerSolicitud(record.id)}>Firmar</a>
      )
    }
  ]

  const columnasRechazos = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Tipo', dataIndex: 'tipo_programa', key: 'tipo_programa' },
    { title: 'Motivo', dataIndex: 'motivo_rechazo', key: 'motivo_rechazo' },
    {
      title: 'Fecha',
      dataIndex: 'fecha_rechazo',
      key: 'fecha_rechazo',
      render: (f) => new Date(f).toLocaleDateString('es-CO')
    },
    {
      title: '',
      key: 'accion',
      render: (_, record) => (
        <a onClick={() => onVerSolicitud(record.id)}>Ver</a>
      )
    }
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #faad14', background: '#fffbe6' }}>
            <Statistic
              title="Pendientes de mi firma"
              value={data?.pendientes_firma?.length ?? 0}
              prefix={<SignatureOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #1677ff', background: '#e6f4ff' }}>
            <Statistic
              title="Esperando solo mi firma"
              value={data?.solo_esperando_coordinador ?? 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #52c41a', background: '#f6ffed' }}>
            <Statistic
              title="Firmadas este mes"
              value={data?.firmadas_este_mes ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #004A2F', background: '#f6ffed' }}>
            <Statistic
              title="Certificadas este mes"
              value={data?.certificadas_este_mes ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#004A2F' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Solicitudes pendientes de mi firma" style={{ borderRadius: 12 }}>
        <Table
          dataSource={data?.pendientes_firma}
          columns={columnas}
          rowKey="id"
          size="small"
          scroll={{ x: 600 }}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'No tienes solicitudes pendientes de firma' }}
        />
      </Card>

      {data?.rechazos_propios?.length > 0 && (
        <Card
          title={<span style={{ color: '#ff4d4f' }}>⚠️ Mis rechazos recientes</span>}
          style={{ borderRadius: 12, marginTop: 16, border: '1px solid #ffccc7' }}
        >
          <Alert
            type="warning"
            showIcon
            message="Estas solicitudes fueron rechazadas por ti. Si ya se corrigieron, comunicate con el encargado de certificación."
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={data.rechazos_propios}
            columns={columnasRechazos}
            rowKey="id"
            size="small"
            scroll={{ x: 600 }}
            pagination={{ pageSize: 5 }}
          />
        </Card>
      )}
    </div>
  )
}

// -------------------------------------------------------
// Componente principal
// -------------------------------------------------------
export default function Dashboard() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const { usuario, rolActivo } = useAuth()

  useEffect(() => {
    const cargar = async () => {
      try {
        const rol = rolActivo?.nombre
        const { data } = await api.get('/reportes/dashboard', {
          params: rolActivo?.nombre ? { rol_forzado: rolActivo.nombre } : {}
        })
        setDatos(data)
      } catch {
        setError('No se pudo cargar el dashboard')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [rolActivo])

  const onVerSolicitud = (id) => navigate(`/solicitudes/${id}`)

  if (cargando) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
  if (error) return <Alert message={error} type="error" showIcon />

  const roles = usuario?.roles?.map(r => r.nombre) ?? []

  const titulo = {
    ADMIN: 'Resumen general del sistema',
    FUNCIONARIO_CERTIFICACION: 'Panel de revisión',
    COORDINADOR: 'Panel del Coordinador',
  }[datos?.rol] ?? 'Mis solicitudes pendientes'

  return (
    <div>
        <Title level={4} style={{ marginBottom: 24 }}>{titulo}</Title>

        {datos?.rol === 'ADMIN' && <DashboardAdmin data={datos} />}
        {datos?.rol === 'FUNCIONARIO_CERTIFICACION' && <DashboardFuncionario data={datos} onVerSolicitud={onVerSolicitud} />}
        {datos?.rol === 'COORDINADOR' && <DashboardCoordinador data={datos} onVerSolicitud={onVerSolicitud} />}
        {!['ADMIN', 'FUNCIONARIO_CERTIFICACION', 'COORDINADOR'].includes(datos?.rol) && datos?.rol !== 'DESCONOCIDO' && (
          <DashboardFirmante data={datos} onVerSolicitud={onVerSolicitud} />
        )}
    </div>
  )
}