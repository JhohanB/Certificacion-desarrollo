import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Table, Button, Card, Typography, Tag, Space, Modal,
  message, Alert, Divider, Popconfirm, Select
} from 'antd'
import {
  PlusOutlined, EyeOutlined, SettingOutlined,
  CheckCircleOutlined, FilePdfOutlined, ReloadOutlined, DeleteOutlined
} from '@ant-design/icons'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url'
import api, { API_URL } from '../../api/axios'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const { Title, Text } = Typography

const COLORES_ROL = {
  APE: '#fa8c16',
  BIENESTAR: '#eb2f96',
  BIBLIOTECA: '#13c2c2',
  COORDINADOR: '#722ed1',
  INSTRUCTOR_SEGUIMIENTO: '#52c41a',
}

const COLOR_DEFAULT = '#004A2F'

export default function Plantillas() {
  const [plantillas, setPlantillas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null)
  const [modalSubir, setModalSubir] = useState(false)
  const [modalEditor, setModalEditor] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [version, setVersion] = useState('')

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/plantillas/')
      setPlantillas(data)
    } catch {
      message.error('Error al cargar plantillas')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const subirPlantilla = async () => {
    if (!archivo || !version) {
      message.error('Selecciona un archivo y escribe la versión')
      return
    }
    setEnviando(true)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('version', version)
      await api.post('/plantillas/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      message.success('Plantilla subida. Configura las coordenadas antes de activarla.')
      setModalSubir(false)
      setArchivo(null)
      setVersion('')
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al subir')
    } finally {
      setEnviando(false)
    }
  }

  const activar = async (id) => {
    try {
      await api.post(`/plantillas/${id}/activar`)
      message.success('Plantilla activada')
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al activar')
    }
  }

  const abrirEditor = async (plantilla) => {
    const { data } = await api.get(`/plantillas/${plantilla.id}`)
    setPlantillaSeleccionada(data)
    setModalEditor(true)
  }

  const columnas = [
    {
      title: 'Versión',
      dataIndex: 'version',
      key: 'version',
      render: (v) => <Text strong>v{v}</Text>
    },
    {
      title: 'Estado',
      dataIndex: 'activa',
      key: 'activa',
      render: (activa) => (
        <Tag color={activa ? 'green' : 'default'}>
          {activa ? '✓ Activa' : 'Inactiva'}
        </Tag>
      )
    },
    {
      title: 'Fecha',
      dataIndex: 'creado_en',
      key: 'creado_en',
      render: (fecha) => new Date(fecha).toLocaleDateString('es-CO')
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<SettingOutlined />} onClick={() => abrirEditor(record)}>
            Editar coordenadas
          </Button>
          {!record.activa && (
            <Popconfirm
              title="¿Activar esta plantilla? La actual quedará inactiva."
              onConfirm={() => activar(record.id)}
              okText="Sí" cancelText="No"
            >
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#004A2F', borderColor: '#004A2F' }}>
                Activar
              </Button>
            </Popconfirm>
          )}
          <Button size="small" icon={<FilePdfOutlined />}
            onClick={() => window.open(`${API_URL}/${record.archivo_url}`, '_blank')}>
            Ver PDF
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Plantillas</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalSubir(true)}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}>
            Subir plantilla
          </Button>
        </Space>
      </div>

      <Alert type="info" showIcon
        message="La plantilla activa se usa como base para el paz y salvo en todas las nuevas solicitudes."
        style={{ marginBottom: 16 }} />

      <Card style={{ borderRadius: 12 }}>
        <Table dataSource={plantillas} columns={columnas} rowKey="id"
          loading={cargando} scroll={{ x: 600 }}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No hay plantillas' }} />
      </Card>

      {/* Modal Subir */}
      <Modal title="Subir nueva plantilla" open={modalSubir}
        onCancel={() => { setModalSubir(false); setArchivo(null); setVersion('') }}
        footer={null}>
        <Alert type="warning" showIcon
          message="La plantilla debe ser el PDF base del paz y salvo sin firmas."
          style={{ marginBottom: 16 }} />
        <div style={{ marginBottom: 16 }}>
          <Text strong>Versión:</Text>
          <input
            type="text" placeholder="Ej: 2.0" value={version}
            onChange={e => setVersion(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 8, padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <Text strong>Archivo PDF:</Text>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: 12,
            border: `2px dashed ${archivo ? '#52c41a' : '#d9d9d9'}`,
            borderRadius: 8, cursor: 'pointer', marginTop: 8,
            background: archivo ? '#f6ffed' : '#fafafa'
          }}>
            <FilePdfOutlined style={{ color: archivo ? '#52c41a' : '#004A2F', fontSize: 20 }} />
            <Text>{archivo ? archivo.name : 'Haz clic para seleccionar el PDF'}</Text>
            <input type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => setArchivo(e.target.files[0])} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => { setModalSubir(false); setArchivo(null); setVersion('') }}>Cancelar</Button>
          <Button type="primary" loading={enviando} onClick={subirPlantilla}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}>
            Subir
          </Button>
        </div>
      </Modal>

      {/* Modal Editor de coordenadas */}
      {plantillaSeleccionada && (
        <EditorCoordenadas
          plantilla={plantillaSeleccionada}
          open={modalEditor}
          onClose={() => setModalEditor(false)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------
// Editor de coordenadas interactivo
// -------------------------------------------------------
function EditorCoordenadas({ plantilla, open, onClose, onGuardado }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [pdfPage, setPdfPage] = useState(null)
  const [scale, setScale] = useState(1)
  const [coordenadas, setCoordenadas] = useState([])
  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [campoSeleccionado, setCampoSeleccionado] = useState('firma') // 'firma' o 'nombre'
  const [dibujando, setDibujando] = useState(false)
  const [inicio, setInicio] = useState(null)
  const [rectActual, setRectActual] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [roles, setRoles] = useState([])

  useEffect(() => {
    if (!open) return
    cargarRoles()
    cargarPDF()
    setCoordenadas(plantilla.coordenadas?.map(c => ({ ...c })) ?? [])
  }, [open, plantilla])

  const cargarRoles = async () => {
    try {
      const { data } = await api.get('/roles/')
      setRoles(data.filter(r => r.requiere_firma && r.activo))
    } catch {}
  }

  const cargarPDF = async () => {
    try {
      const url = `${API_URL}/${plantilla.archivo_url}`
      const pdf = await pdfjsLib.getDocument(url).promise
      const page = await pdf.getPage(1)
      setPdfPage(page)
    } catch (err) {
      message.error('Error al cargar el PDF')
    }
  }

  useEffect(() => {
    if (!pdfPage || !canvasRef.current) return
    renderPDF()
  }, [pdfPage, coordenadas])

  const renderTaskRef = useRef(null)
  const pdfImageDataRef = useRef(null)

  const drawCoords = (ctx) => {
    coordenadas.forEach(coord => {
      const color = COLORES_ROL[coord.nombre_rol] ?? COLOR_DEFAULT
      dibujarRect(ctx, coord.x_porcentaje, coord.y_porcentaje,
        coord.ancho_porcentaje, coord.alto_porcentaje,
        canvasRef.current.width, canvasRef.current.height, color, `${coord.nombre_rol} - firma`)
      dibujarRect(ctx, coord.nombre_x_porcentaje, coord.nombre_y_porcentaje,
        coord.nombre_ancho_porcentaje, coord.nombre_alto_porcentaje,
        canvasRef.current.width, canvasRef.current.height, color, `${coord.nombre_rol} - nombre`, true)
    })
  }

  const drawCurrentRect = (ctx, rect) => {
    if (!rect) return
    const x = rect.w < 0 ? rect.x + rect.w : rect.x
    const y = rect.h < 0 ? rect.y + rect.h : rect.y
    const w = Math.abs(rect.w)
    const h = Math.abs(rect.h)
    const color = COLORES_ROL[rolSeleccionado] ?? COLOR_DEFAULT
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash([4, 2])
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = color + '22'
    ctx.fillRect(x, y, w, h)
    ctx.setLineDash([])
  }

  const renderPDF = useCallback(async () => {
    if (!pdfPage || !canvasRef.current) return

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
      renderTaskRef.current = null
    }

    const container = containerRef.current
    const containerWidth = container?.clientWidth ?? 600
    const viewport = pdfPage.getViewport({ scale: 1 })
    const newScale = (containerWidth - 32) / viewport.width
    setScale(newScale)

    const scaledViewport = pdfPage.getViewport({ scale: newScale })
    const canvas = canvasRef.current
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height
 
    const ctx = canvas.getContext('2d')
    const renderTask = pdfPage.render({ canvasContext: ctx, viewport: scaledViewport })
    renderTaskRef.current = renderTask
 
    try {
      await renderTask.promise
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return
      throw err
    }
    renderTaskRef.current = null

    pdfImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    drawCoords(ctx)
  }, [pdfPage, coordenadas])

  const dibujarRect = (ctx, xPct, yPct, wPct, hPct, canvasW, canvasH, color, label, esNombre = false) => {
    const x = (xPct / 100) * canvasW
    const y = (yPct / 100) * canvasH
    const w = (wPct / 100) * canvasW
    const h = (hPct / 100) * canvasH

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash(esNombre ? [5, 3] : [])
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = color + '33'
    ctx.fillRect(x, y, w, h)

    ctx.fillStyle = color
    ctx.font = 'bold 10px Arial'
    ctx.setLineDash([])
    ctx.fillText(label, x + 2, y - 3)
  }

  const getPosCanvas = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    }
    }

  const onMouseDown = (e) => {
    if (!rolSeleccionado) {
      message.warning('Selecciona un rol primero')
      return
    }
    setDibujando(true)
    setInicio(getPosCanvas(e))
  }

  const onMouseMove = (e) => {
    if (!dibujando || !inicio) return
    const pos = getPosCanvas(e)
    const rect = { x: inicio.x, y: inicio.y, w: pos.x - inicio.x, h: pos.y - inicio.y }
    setRectActual(rect)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (pdfImageDataRef.current) {
      ctx.putImageData(pdfImageDataRef.current, 0, 0)
    }
    drawCoords(ctx)
    drawCurrentRect(ctx, rect)
  }

  const onMouseLeave = () => {
    if (!dibujando) return
    setDibujando(false)
    setInicio(null)
    setRectActual(null)
  }

  const onMouseUp = (e) => {
    if (!dibujando || !inicio) return
    setDibujando(false)
    const canvas = canvasRef.current
    const pos = getPosCanvas(e)

    const x = Math.min(inicio.x, pos.x)
    const y = Math.min(inicio.y, pos.y)
    const w = Math.abs(pos.x - inicio.x)
    const h = Math.abs(pos.y - inicio.y)

    if (w < 5 || h < 5) return

    const xPct = (x / canvas.width) * 100
    const yPct = (y / canvas.height) * 100
    const wPct = (w / canvas.width) * 100
    const hPct = (h / canvas.height) * 100

    setCoordenadas(prev => {
      const existente = prev.find(c => c.nombre_rol === rolSeleccionado)
      if (existente) {
        return prev.map(c => {
          if (c.nombre_rol !== rolSeleccionado) return c
          if (campoSeleccionado === 'firma') {
            return { ...c, x_porcentaje: xPct, y_porcentaje: yPct, ancho_porcentaje: wPct, alto_porcentaje: hPct }
          } else {
            return { ...c, nombre_x_porcentaje: xPct, nombre_y_porcentaje: yPct, nombre_ancho_porcentaje: wPct, nombre_alto_porcentaje: hPct }
          }
        })
      } else {
        const rol = roles.find(r => r.nombre === rolSeleccionado)
        const nueva = {
          id: Date.now(),
          rol_id: rol?.id,
          nombre_rol: rolSeleccionado,
          pagina: 1,
          x_porcentaje: campoSeleccionado === 'firma' ? xPct : 0,
          y_porcentaje: campoSeleccionado === 'firma' ? yPct : 0,
          ancho_porcentaje: campoSeleccionado === 'firma' ? wPct : 0,
          alto_porcentaje: campoSeleccionado === 'firma' ? hPct : 0,
          nombre_x_porcentaje: campoSeleccionado === 'nombre' ? xPct : 0,
          nombre_y_porcentaje: campoSeleccionado === 'nombre' ? yPct : 0,
          nombre_ancho_porcentaje: campoSeleccionado === 'nombre' ? wPct : 0,
          nombre_alto_porcentaje: campoSeleccionado === 'nombre' ? hPct : 0,
        }
        return [...prev, nueva]
      }
    })
    setInicio(null)
    setRectActual(null)
  }

  const eliminarCoordenada = (nombreRol) => {
    setCoordenadas(prev => prev.filter(c => c.nombre_rol !== nombreRol))
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const payload = coordenadas.map(c => ({
        rol_id: c.rol_id,
        pagina: c.pagina ?? 1,
        x_porcentaje: parseFloat(c.x_porcentaje.toFixed(2)),
        y_porcentaje: parseFloat(c.y_porcentaje.toFixed(2)),
        ancho_porcentaje: parseFloat(c.ancho_porcentaje.toFixed(2)),
        alto_porcentaje: parseFloat(c.alto_porcentaje.toFixed(2)),
        nombre_x_porcentaje: parseFloat(c.nombre_x_porcentaje.toFixed(2)),
        nombre_y_porcentaje: parseFloat(c.nombre_y_porcentaje.toFixed(2)),
        nombre_ancho_porcentaje: parseFloat(c.nombre_ancho_porcentaje.toFixed(2)),
        nombre_alto_porcentaje: parseFloat(c.nombre_alto_porcentaje.toFixed(2)),
      }))
      await api.put(`/plantillas/${plantilla.id}/coordenadas`, payload)
      message.success('Coordenadas guardadas')
      onGuardado()
      onClose()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={`Editor de coordenadas — Plantilla v${plantilla.version}`}
      open={open}
      onCancel={onClose}
      width="90vw"
      style={{ maxWidth: 1000 }}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancelar</Button>,
        <Button key="save" type="primary" loading={guardando} onClick={guardar}
          style={{ background: '#004A2F', borderColor: '#004A2F' }}>
          Guardar coordenadas
        </Button>
      ]}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Panel izquierdo — controles */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>1. Selecciona el rol:</Text>
          <Select
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="Selecciona rol..."
            value={rolSeleccionado}
            onChange={setRolSeleccionado}
            options={roles.map(r => ({ value: r.nombre, label: r.nombre }))}
          />

          <Text strong style={{ display: 'block', marginBottom: 8 }}>2. Selecciona el campo:</Text>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button
              type={campoSeleccionado === 'firma' ? 'primary' : 'default'}
              size="small" onClick={() => setCampoSeleccionado('firma')}
              style={campoSeleccionado === 'firma' ? { background: '#004A2F', borderColor: '#004A2F' } : {}}>
              Firma
            </Button>
            <Button
              type={campoSeleccionado === 'nombre' ? 'primary' : 'default'}
              size="small" onClick={() => setCampoSeleccionado('nombre')}
              style={campoSeleccionado === 'nombre' ? { background: '#004A2F', borderColor: '#004A2F' } : {}}>
              Nombre
            </Button>
          </div>

          <Alert
            type="info" showIcon
            message="3. Dibuja el rectángulo en el PDF arrastrando el mouse."
            style={{ marginBottom: 16, fontSize: 12 }}
          />

          <Text strong style={{ display: 'block', marginBottom: 8 }}>Coordenadas definidas:</Text>
          {coordenadas.length === 0 && <Text type="secondary">Sin coordenadas</Text>}
          {coordenadas.map(coord => (
            <div key={coord.nombre_rol} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 0', borderBottom: '1px solid #f0f0f0'
            }}>
              <Tag color={COLORES_ROL[coord.nombre_rol] ?? COLOR_DEFAULT} style={{ fontSize: 11 }}>
                {coord.nombre_rol}
              </Tag>
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => eliminarCoordenada(coord.nombre_rol)} />
            </div>
          ))}
        </div>

        {/* Panel derecho — PDF canvas */}
        <div ref={containerRef} style={{ flex: 1, minWidth: 0 }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%', border: '1px solid #d9d9d9',
              cursor: rolSeleccionado ? 'crosshair' : 'default'
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          />
        </div>
      </div>
    </Modal>
  )
}