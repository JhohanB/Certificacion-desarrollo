import { useState, useEffect } from 'react'
import {
  Card, Row, Col, Statistic, Typography, Table, Tag,
  DatePicker, Button, Spin, Progress, Tabs, Space, Dropdown
} from 'antd'
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ReloadOutlined, DownloadOutlined
} from '@ant-design/icons'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../api/axios'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const COLORES_ESTADO = {
  PENDIENTE_REVISION: '#faad14',
  CON_OBSERVACIONES: '#ff4d4f',
  CORREGIDO: '#1677ff',
  PENDIENTE_FIRMAS: '#722ed1',
  PENDIENTE_CERTIFICACION: '#13c2c2',
  CERTIFICADO: '#52c41a',
}

const TEXTOS_ESTADO = {
  PENDIENTE_REVISION: 'Pend. Revisión',
  CON_OBSERVACIONES: 'Con Obs.',
  CORREGIDO: 'Corregido',
  PENDIENTE_FIRMAS: 'Pend. Firmas',
  PENDIENTE_CERTIFICACION: 'Pend. Cert.',
  CERTIFICADO: 'Certificado',
}

export default function Reportes() {
  const [resumen, setResumen] = useState(null)
  const [periodo, setPeriodo] = useState(null)
  const [actividad, setActividad] = useState(null)
  const [firmas, setFirmas] = useState(null)
  const [documentos, setDocumentos] = useState(null)
  const [notificaciones, setNotificaciones] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false)
  const [fechas, setFechas] = useState([dayjs().subtract(30, 'day'), dayjs()])
  const [activeTab, setActiveTab] = useState('resumen')

  const cargar = async () => {
    setCargando(true)
    try {
      const desde = fechas[0].format('YYYY-MM-DD')
      const hasta = fechas[1].format('YYYY-MM-DD')
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        api.get('/reportes/resumen-general'),
        api.get(`/reportes/solicitudes-por-periodo?fecha_desde=${desde}&fecha_hasta=${hasta}`),
        api.get('/reportes/actividad-funcionarios'),
        api.get('/reportes/estado-firmas'),
        api.get('/reportes/documentos-observados'),
        api.get('/reportes/notificaciones'),
      ])
      setResumen(r1.data)
      setPeriodo(r2.data)
      setActividad(r3.data)
      setFirmas(r4.data)
      setDocumentos(r5.data)
      setNotificaciones(r6.data)
    } catch {}
    finally { setCargando(false) }
  }

  const cargarPeriodo = async () => {
    setCargandoPeriodo(true)
    try {
      const desde = fechas[0].format('YYYY-MM-DD')
      const hasta = fechas[1].format('YYYY-MM-DD')
      const { data } = await api.get(`/reportes/solicitudes-por-periodo?fecha_desde=${desde}&fecha_hasta=${hasta}`)
      setPeriodo(data)
    } catch {}
    finally { setCargandoPeriodo(false) }
  }

  useEffect(() => { cargar() }, [])

  // -------------------------------------------------------
  // Descarga Excel general
  // -------------------------------------------------------
  const descargarExcelGeneral = () => {
    const wb = XLSX.utils.book_new()
    const fecha = new Date().toLocaleDateString('es-CO')

    // Hoja 1: Resumen
    const resumenData = [
      ['SENA - Reporte General del Sistema'],
      [`Generado: ${fecha}`],
      [],
      ['RESUMEN GENERAL'],
      ['Estado', 'Total'],
      ...(resumen?.por_estado?.map(e => [
        TEXTOS_ESTADO[e.estado_actual] ?? e.estado_actual, e.total
      ]) ?? []),
      [],
      ['Por nivel de formación'],
      ['Nivel', 'Total', 'Certificadas'],
      ...(resumen?.por_tipo_programa?.map(t => [t.tipo_programa, t.total, t.certificadas]) ?? []),
      [],
      ['Total solicitudes', resumen?.total_solicitudes ?? 0],
      ['Días promedio certificación', resumen?.dias_promedio_certificacion ?? 'N/A'],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(resumenData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen General')

    // Hoja 2: Solicitudes del período
    const periodoData = [
      ['SOLICITUDES DEL PERÍODO'],
      [`Desde: ${fechas[0].format('DD/MM/YYYY')} — Hasta: ${fechas[1].format('DD/MM/YYYY')}`],
      [],
      ['Total', periodo?.resumen?.total ?? 0],
      ['Certificadas', periodo?.resumen?.certificadas ?? 0],
      ['Con observaciones', periodo?.resumen?.con_observaciones ?? 0],
      ['Pendientes revisión', periodo?.resumen?.pendientes_revision ?? 0],
      [],
      ['Aprendiz', 'Documento', 'Programa', 'Nivel de formación', 'Estado', 'Fecha solicitud', 'Fecha certificación'],
      ...(periodo?.solicitudes?.map(s => [
        s.nombre_aprendiz,
        s.numero_documento,
        s.nombre_programa,
        s.tipo_programa,
        TEXTOS_ESTADO[s.estado_actual] ?? s.estado_actual,
        new Date(s.fecha_solicitud).toLocaleDateString('es-CO'),
        s.fecha_certificacion ? new Date(s.fecha_certificacion).toLocaleDateString('es-CO') : '—',
      ]) ?? []),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(periodoData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Solicitudes Período')

    // Hoja 3: Actividad funcionarios
    const actividadData = [
      ['ACTIVIDAD DE FUNCIONARIOS'],
      [],
      ['Revisión de documentos'],
      ['Funcionario', 'Docs aprobados', 'Docs observados'],
      ...(actividad?.revision_documentos?.map(f => [
        f.nombre_completo, f.documentos_aprobados, f.documentos_observados
      ]) ?? []),
      [],
      ['Actividad de firmas'],
      ['Funcionario', 'Rol', 'Firmadas', 'Rechazadas'],
      ...(actividad?.firmas?.map(f => [
        f.nombre_completo, f.rol, f.firmas_completadas, f.firmas_rechazadas
      ]) ?? []),
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(actividadData)
    XLSX.utils.book_append_sheet(wb, ws3, 'Actividad Funcionarios')

    // Hoja 4: Estado firmas
    const firmasData = [
      ['ESTADO DE FIRMAS POR ROL'],
      [],
      ['Rol', 'Total asignadas', 'Firmadas', 'Pendientes', 'Rechazadas', '% Firmado'],
      ...(firmas?.por_rol?.map(r => [
        r.rol, r.total_asignadas, r.firmadas, r.pendientes, r.rechazadas, `${r.porcentaje_firmado}%`
      ]) ?? []),
      [],
      ['SOLICITUDES ATRASADAS EN FIRMAS'],
      ['Aprendiz', 'Programa', 'Rol pendiente', 'Días en proceso'],
      ...(firmas?.solicitudes_atrasadas?.map(s => [
        s.nombre_aprendiz, s.nombre_programa, s.rol_pendiente, s.dias_en_proceso
      ]) ?? []),
    ]
    const ws4 = XLSX.utils.aoa_to_sheet(firmasData)
    XLSX.utils.book_append_sheet(wb, ws4, 'Estado Firmas')

    // Hoja 5: Documentos
    const docsData = [
      ['ESTADO DE DOCUMENTOS'],
      [],
      ['Documento', 'Subidos', 'Aprobados', 'Observados', '% Observado'],
      ...(documentos?.documentos?.map(d => [
        d.documento, d.total_subidos, d.aprobados, d.observados, `${d.porcentaje_observado}%`
      ]) ?? []),
    ]
    const ws5 = XLSX.utils.aoa_to_sheet(docsData)
    XLSX.utils.book_append_sheet(wb, ws5, 'Documentos')

    // Hoja 6: Notificaciones
    const notiData = [
      ['NOTIFICACIONES'],
      [],
      ['Tipo', 'Total', 'Enviados', 'Fallidos', '% Éxito'],
      ...(notificaciones?.por_tipo?.map(n => [
        n.tipo_notificacion.replace(/_/g, ' '),
        n.total, n.enviados, n.fallidos, `${n.porcentaje_exito}%`
      ]) ?? []),
    ]
    const ws6 = XLSX.utils.aoa_to_sheet(notiData)
    XLSX.utils.book_append_sheet(wb, ws6, 'Notificaciones')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }),
      `Reporte General SENA ${fecha.replace(/\//g, '-')}.xlsx`)
  }

  // -------------------------------------------------------
  // Descarga PDF general
  // -------------------------------------------------------
  const descargarPDFGeneral = () => {
    const doc = new jsPDF()
    const fecha = new Date().toLocaleDateString('es-CO')

    const titulo = (texto, y) => {
      doc.setFontSize(13)
      doc.setTextColor(0, 74, 47)
      doc.text(texto, 14, y)
    }

    // Portada
    doc.setFontSize(20)
    doc.setTextColor(0, 74, 47)
    doc.text('SENA', 105, 80, { align: 'center' })
    doc.setFontSize(16)
    doc.text('Reporte General del Sistema', 105, 92, { align: 'center' })
    doc.setFontSize(11)
    doc.setTextColor(100, 100, 100)
    doc.text('Sistema de Gestión de Certificaciones', 105, 102, { align: 'center' })
    doc.text(`Generado: ${fecha}`, 105, 112, { align: 'center' })

    // Página 2: Resumen
    doc.addPage()
    titulo('1. Resumen General', 15)
    autoTable(doc, {
      startY: 20,
      head: [['Estado', 'Total']],
      body: resumen?.por_estado?.map(e => [
        TEXTOS_ESTADO[e.estado_actual] ?? e.estado_actual, e.total
      ]) ?? [],
      headStyles: { fillColor: [0, 74, 47] }
    })

    let y = doc.lastAutoTable.finalY + 10
    titulo('Por nivel de formación', y)
    autoTable(doc, {
      startY: y + 5,
      head: [['Nivel de formación', 'Total', 'Certificadas']],
      body: resumen?.por_tipo_programa?.map(t => [t.tipo_programa, t.total, t.certificadas]) ?? [],
      headStyles: { fillColor: [0, 74, 47] }
    })

    // Página 3: Solicitudes del período
    doc.addPage()
    titulo(`2. Solicitudes del Período (${fechas[0].format('DD/MM/YYYY')} — ${fechas[1].format('DD/MM/YYYY')})`, 15)
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(`Total: ${periodo?.resumen?.total ?? 0}  |  Certificadas: ${periodo?.resumen?.certificadas ?? 0}  |  Con obs.: ${periodo?.resumen?.con_observaciones ?? 0}`, 14, 23)
    autoTable(doc, {
      startY: 28,
      head: [['Aprendiz', 'Programa', 'Nivel de formación', 'Estado', 'Fecha']],
      body: periodo?.solicitudes?.map(s => [
        s.nombre_aprendiz,
        s.nombre_programa,
        s.tipo_programa,
        TEXTOS_ESTADO[s.estado_actual] ?? s.estado_actual,
        new Date(s.fecha_solicitud).toLocaleDateString('es-CO'),
      ]) ?? [],
      headStyles: { fillColor: [0, 74, 47] },
      styles: { fontSize: 8 }
    })

    // Página 4: Actividad funcionarios
    doc.addPage()
    titulo('3. Actividad de Funcionarios — Revisión de documentos', 15)
    autoTable(doc, {
      startY: 20,
      head: [['Funcionario', 'Docs aprobados', 'Docs observados']],
      body: actividad?.revision_documentos?.map(f => [
        f.nombre_completo, f.documentos_aprobados, f.documentos_observados
      ]) ?? [],
      headStyles: { fillColor: [0, 74, 47] }
    })

    y = doc.lastAutoTable.finalY + 10
    titulo('Actividad de Funcionarios — Firmas', y)
    autoTable(doc, {
      startY: y + 5,
      head: [['Funcionario', 'Rol', 'Firmadas', 'Rechazadas']],
      body: actividad?.firmas?.map(f => [
        f.nombre_completo, f.rol, f.firmas_completadas, f.firmas_rechazadas
      ]) ?? [],
      headStyles: { fillColor: [0, 74, 47] }
    })

    // Página 5: Estado firmas
    doc.addPage()
    titulo('4. Estado de Firmas por Rol', 15)
    autoTable(doc, {
      startY: 20,
      head: [['Rol', 'Total', 'Firmadas', 'Pendientes', 'Rechazadas', '% Firmado']],
      body: firmas?.por_rol?.map(r => [
        r.rol, r.total_asignadas, r.firmadas, r.pendientes, r.rechazadas, `${r.porcentaje_firmado}%`
      ]) ?? [],
      headStyles: { fillColor: [0, 74, 47] }
    })

    if (firmas?.solicitudes_atrasadas?.length > 0) {
      y = doc.lastAutoTable.finalY + 10
      titulo('Solicitudes atrasadas en firmas', y)
      autoTable(doc, {
        startY: y + 5,
        head: [['Aprendiz', 'Programa', 'Rol pendiente', 'Días']],
        body: firmas.solicitudes_atrasadas.map(s => [
          s.nombre_aprendiz, s.nombre_programa, s.rol_pendiente, s.dias_en_proceso
        ]),
        headStyles: { fillColor: [180, 0, 0] }
      })
    }

    // Página 6: Documentos y Notificaciones
    doc.addPage()
    titulo('5. Estado de Documentos', 15)
    autoTable(doc, {
      startY: 20,
      head: [['Documento', 'Subidos', 'Aprobados', 'Observados', '% Obs.']],
      body: documentos?.documentos?.map(d => [
        d.documento, d.total_subidos, d.aprobados, d.observados, `${d.porcentaje_observado}%`
      ]) ?? [],
      headStyles: { fillColor: [0, 74, 47] }
    })

    y = doc.lastAutoTable.finalY + 10
    titulo('6. Notificaciones', y)
    autoTable(doc, {
      startY: y + 5,
      head: [['Tipo', 'Total', 'Enviados', 'Fallidos', '% Éxito']],
      body: notificaciones?.por_tipo?.map(n => [
        n.tipo_notificacion.replace(/_/g, ' '),
        n.total, n.enviados, n.fallidos, `${n.porcentaje_exito}%`
      ]) ?? [],
      headStyles: { fillColor: [0, 74, 47] }
    })

    doc.save(`Reporte General SENA ${fecha.replace(/\//g, '-')}.pdf`)
  }

  if (cargando) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />

  const dataPie = resumen?.por_estado?.map(e => ({
    name: TEXTOS_ESTADO[e.estado_actual] ?? e.estado_actual,
    value: e.total,
    color: COLORES_ESTADO[e.estado_actual]
  })) ?? []

  const dataTipos = resumen?.por_tipo_programa?.map(t => ({
    name: t.tipo_programa, Total: t.total, Certificadas: t.certificadas
  })) ?? []

  const dataFirmasPorRol = firmas?.por_rol?.map(r => ({
    name: r.rol, Firmadas: r.firmadas, Pendientes: r.pendientes, Rechazadas: r.rechazadas,
  })) ?? []

  const dataDocumentos = documentos?.documentos?.map(d => ({
    name: d.documento.length > 15 ? d.documento.substring(0, 15) + '...' : d.documento,
    nombreCompleto: d.documento,
    Subidos: d.total_subidos, Aprobados: d.aprobados, Observados: d.observados,
  })) ?? []

  const columnasAtrasadas = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Rol pendiente', dataIndex: 'rol_pendiente', key: 'rol_pendiente',
      render: (r) => <Tag color="orange">{r}</Tag> },
    { title: 'Días', dataIndex: 'dias_en_proceso', key: 'dias_en_proceso',
      render: (d) => <Tag color={d > 5 ? 'red' : 'orange'}>{d} días</Tag> },
  ]

  const columnasSolicitudes = [
    { title: 'Aprendiz', dataIndex: 'nombre_aprendiz', key: 'nombre_aprendiz' },
    { title: 'Programa', dataIndex: 'nombre_programa', key: 'nombre_programa' },
    { title: 'Nivel de formación', dataIndex: 'tipo_programa', key: 'tipo_programa' },
    { title: 'Estado', dataIndex: 'estado_actual', key: 'estado_actual',
      render: (e) => <Tag color={COLORES_ESTADO[e]}>{TEXTOS_ESTADO[e]}</Tag> },
    { title: 'Fecha', dataIndex: 'fecha_solicitud', key: 'fecha_solicitud',
      render: (f) => new Date(f).toLocaleDateString('es-CO') },
  ]

  const columnasActividad = [
    { title: 'Funcionario', dataIndex: 'nombre_completo', key: 'nombre_completo' },
    { title: 'Docs aprobados', dataIndex: 'documentos_aprobados', key: 'documentos_aprobados',
      render: (v) => <Tag color="green">{v}</Tag> },
    { title: 'Docs observados', dataIndex: 'documentos_observados', key: 'documentos_observados',
      render: (v) => <Tag color="orange">{v}</Tag> },
  ]

  const columnasFirmasActividad = [
    { title: 'Funcionario', dataIndex: 'nombre_completo', key: 'nombre_completo' },
    { title: 'Rol', dataIndex: 'rol', key: 'rol', render: (r) => <Tag color="purple">{r}</Tag> },
    { title: 'Firmadas', dataIndex: 'firmas_completadas', key: 'firmas_completadas',
      render: (v) => <Tag color="green">{v}</Tag> },
    { title: 'Rechazadas', dataIndex: 'firmas_rechazadas', key: 'firmas_rechazadas',
      render: (v) => <Tag color={v > 0 ? 'red' : 'default'}>{v}</Tag> },
  ]

  const menuDescarga = {
    items: [
      {
        key: 'excel',
        label: 'Descargar Excel',
        icon: <DownloadOutlined style={{ color: '#217346' }} />,
        onClick: descargarExcelGeneral
      },
      {
        key: 'pdf',
        label: 'Descargar PDF',
        icon: <DownloadOutlined style={{ color: '#ff4d4f' }} />,
        onClick: descargarPDFGeneral
      },
    ]
  }

  const items = [
    {
      key: 'resumen',
      label: 'Resumen general',
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, border: '1px solid #b7eb8f', background: '#f6ffed' }}>
                <Statistic title="Total solicitudes" value={resumen?.total_solicitudes ?? 0}
                  prefix={<FileTextOutlined />} valueStyle={{ color: '#004A2F' }} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, border: '1px solid #52c41a', background: '#f6ffed' }}>
                <Statistic title="Certificadas"
                  value={resumen?.por_estado?.find(e => e.estado_actual === 'CERTIFICADO')?.total ?? 0}
                  prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, border: '1px solid #1677ff', background: '#e6f4ff' }}>
                <Statistic title="Días promedio certificación"
                  value={resumen?.dias_promedio_certificacion ?? 'N/A'}
                  suffix={resumen?.dias_promedio_certificacion ? 'días' : ''}
                  prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Solicitudes por estado" style={{ borderRadius: 12 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={dataPie} cx="50%" cy="50%" outerRadius={80}
                      dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {dataPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Por nivel de formación" style={{ borderRadius: 12 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dataTipos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Total" fill="#004A2F" />
                    <Bar dataKey="Certificadas" fill="#52c41a" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: 'periodo',
      label: 'Por período',
      children: (
        <div>
          <Card style={{ borderRadius: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <RangePicker value={fechas} onChange={setFechas} format="YYYY-MM-DD" />
              <Button type="primary" onClick={cargarPeriodo} loading={cargandoPeriodo}
                style={{ background: '#004A2F', borderColor: '#004A2F' }}>
                Consultar
              </Button>
            </div>
          </Card>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {[
              { label: 'Total', value: periodo?.resumen?.total ?? 0, color: '#004A2F' },
              { label: 'Certificadas', value: periodo?.resumen?.certificadas ?? 0, color: '#52c41a' },
              { label: 'Con observaciones', value: periodo?.resumen?.con_observaciones ?? 0, color: '#ff4d4f' },
              { label: 'Pend. revisión', value: periodo?.resumen?.pendientes_revision ?? 0, color: '#faad14' },
            ].map(({ label, value, color }) => (
              <Col xs={12} sm={6} key={label}>
                <Card style={{ borderRadius: 12, textAlign: 'center' }}>
                  <Statistic title={label} value={value} valueStyle={{ color }} />
                </Card>
              </Col>
            ))}
          </Row>
          <Card title="Solicitudes del período" style={{ borderRadius: 12 }}>
            <Table dataSource={periodo?.solicitudes} columns={columnasSolicitudes}
              rowKey="id" size="small" scroll={{ x: 600 }} pagination={{ pageSize: 10 }} />
          </Card>
        </div>
      )
    },
    {
      key: 'actividad',
      label: 'Actividad funcionarios',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card title="Revisión de documentos" style={{ borderRadius: 12, marginBottom: 16 }}>
              <Table dataSource={actividad?.revision_documentos} columns={columnasActividad}
                rowKey="usuario_id" size="small" pagination={false} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card title="Actividad de firmas" style={{ borderRadius: 12 }}>
              <Table dataSource={actividad?.firmas} columns={columnasFirmasActividad}
                rowKey="usuario_id" size="small" pagination={false} />
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: 'firmas',
      label: 'Estado de firmas',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card title="Firmas por rol" style={{ borderRadius: 12, marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dataFirmasPorRol}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Firmadas" fill="#52c41a" />
                  <Bar dataKey="Pendientes" fill="#faad14" />
                  <Bar dataKey="Rechazadas" fill="#ff4d4f" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 16 }}>
                {firmas?.por_rol?.map(r => (
                  <div key={r.rol} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{r.rol}</Text>
                      <Text type="secondary">{r.porcentaje_firmado}%</Text>
                    </div>
                    <Progress percent={r.porcentaje_firmado} strokeColor="#52c41a" size="small" />
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          {firmas?.solicitudes_atrasadas?.length > 0 && (
            <Col xs={24}>
              <Card title={<span style={{ color: '#ff4d4f' }}>⚠️ Solicitudes atrasadas</span>}
                style={{ borderRadius: 12, border: '1px solid #ffccc7' }}>
                <Table dataSource={firmas.solicitudes_atrasadas} columns={columnasAtrasadas}
                  rowKey={(r) => `${r.solicitud_id}-${r.rol_pendiente}`}
                  size="small" pagination={false} scroll={{ x: 500 }} />
              </Card>
            </Col>
          )}
        </Row>
      )
    },
    {
      key: 'documentos',
      label: 'Documentos',
      children: (
        <Card title="Estado de documentos por tipo" style={{ borderRadius: 12 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dataDocumentos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [value, name]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.nombreCompleto ?? label}
              />
              <Legend />
              <Bar dataKey="Subidos" fill="#004A2F" />
              <Bar dataKey="Aprobados" fill="#52c41a" />
              <Bar dataKey="Observados" fill="#ff4d4f" />
            </BarChart>
          </ResponsiveContainer>
          <Table
            dataSource={documentos?.documentos}
            columns={[
              { title: 'Documento', dataIndex: 'documento', key: 'documento' },
              { title: 'Subidos', dataIndex: 'total_subidos', key: 'total_subidos' },
              { title: 'Aprobados', dataIndex: 'aprobados', key: 'aprobados',
                render: (v) => <Tag color="green">{v}</Tag> },
              { title: 'Observados', dataIndex: 'observados', key: 'observados',
                render: (v) => <Tag color={v > 0 ? 'red' : 'default'}>{v}</Tag> },
              { title: '% Observado', dataIndex: 'porcentaje_observado', key: 'porcentaje_observado',
                render: (v) => <Progress percent={v} size="small" strokeColor="#ff4d4f" style={{ width: 100 }} /> },
            ]}
            rowKey="documento" size="small" pagination={false}
            scroll={{ x: 500 }} style={{ marginTop: 16 }}
          />
        </Card>
      )
    },
    {
      key: 'notificaciones',
      label: 'Notificaciones',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card title="Correos por tipo" style={{ borderRadius: 12, marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                {notificaciones?.por_tipo?.map(n => (
                  <Col xs={24} sm={12} lg={8} key={n.tipo_notificacion}>
                    <Card size="small" style={{ borderRadius: 8 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                        {n.tipo_notificacion.replace(/_/g, ' ')}
                      </Text>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <Tag color="green">{n.enviados} enviados</Tag>
                          {n.fallidos > 0 && <Tag color="red">{n.fallidos} fallidos</Tag>}
                        </div>
                        <Text type="secondary">{n.porcentaje_exito}%</Text>
                      </div>
                      <Progress percent={n.porcentaje_exito} strokeColor="#52c41a"
                        size="small" style={{ marginTop: 8 }} />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
          {notificaciones?.correos_fallidos_recientes?.length > 0 && (
            <Col xs={24}>
              <Card title="Correos fallidos recientes" style={{ borderRadius: 12 }}>
                <Table dataSource={notificaciones.correos_fallidos_recientes}
                  rowKey="id" size="small" pagination={false} />
              </Card>
            </Col>
          )}
        </Row>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Reportes</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button>
          <Dropdown menu={menuDescarga} placement="bottomRight">
            <Button type="primary" icon={<DownloadOutlined />}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}>
              Descargar reporte
            </Button>
          </Dropdown>
        </Space>
      </div>
      <Tabs items={items} activeKey={activeTab} onChange={setActiveTab} />
    </div>
  )
}