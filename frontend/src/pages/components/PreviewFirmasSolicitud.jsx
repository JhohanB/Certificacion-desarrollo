import React, { useState, useEffect, useRef, useMemo, memo } from 'react'
import { Tag, Spin, Alert } from 'antd'
import { useAuth } from '../../context/AuthContext'

const PreviewFirmasSolicitud = memo(function PreviewFirmasSolicitud({ solicitud, plantilla }) {
  const containerRef = useRef(null)
  const renderTaskRef = useRef(null)
  const isRenderingRef = useRef(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [pdfCache, setPdfCache] = useState(new Map()) // Cache para PDFs

  const { usuario } = useAuth()

  const COLORES_ROL = useMemo(() => ({
    APE: '#fa8c16',
    BIENESTAR: '#eb2f96',
    BIBLIOTECA: '#13c2c2',
    COORDINADOR: '#722ed1',
    INSTRUCTOR_SEGUIMIENTO: '#52c41a',
  }), [])

  const plantillaCoordenadas = useMemo(() => plantilla?.coordenadas ?? [], [plantilla?.coordenadas])
  const primerDoc = useMemo(
    () => solicitud.documentos?.find(d => d.es_version_activa && d.documento_id === 1),
    [solicitud?.documentos]
  )

  const cacheKey = useMemo(() => primerDoc?.archivo_url, [primerDoc?.archivo_url])

  const clearCanvas = () => {
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
  }

  useEffect(() => {
    if (primerDoc?.archivo_url) {
      renderPreview()
    }

    // Cleanup cuando el componente se desmonte
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (e) {
          // Ignorar errores
        }
      }
      isRenderingRef.current = false
      clearCanvas()
    }
  }, [plantillaCoordenadas, primerDoc])

  const renderPreview = async () => {
    // Evitar múltiples renderizados simultáneos
    if (isRenderingRef.current) {
      return
    }
    isRenderingRef.current = true
    setCargando(true)
    setError(null)

    try {
      // Cancelar cualquier renderizado anterior
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (e) {
          // Ignorar errores de cancelación
        }
        renderTaskRef.current = null
      }

      if (!primerDoc?.archivo_url || !containerRef.current) {
        isRenderingRef.current = false
        setCargando(false)
        return
      }

      // Verificar cache primero
      let arrayBuffer = pdfCache.get(cacheKey)
      if (!arrayBuffer) {
        // Lazy load de PDF.js solo cuando sea necesario
        const pdfjsLib = await import('pdfjs-dist')
        const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker?url')
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default

        // En desarrollo usamos ruta relativa para aprovechar el proxy de Vite y evitar CORS.
        let archivoUrl = primerDoc.archivo_url
        if (!archivoUrl.startsWith('/')) {
          archivoUrl = '/' + archivoUrl
        }
        const fullUrl = import.meta.env.DEV ? archivoUrl : `http://localhost:8000${archivoUrl}`

        const response = await fetch(fullUrl, { credentials: 'omit' })
        if (!response.ok) {
          throw new Error(`Error al cargar PDF: ${response.status} ${response.statusText}`)
        }
        arrayBuffer = await response.arrayBuffer()

        // Cachear el PDF
        setPdfCache(prev => new Map(prev).set(cacheKey, arrayBuffer))
      }

      const pdfjsLib = await import('pdfjs-dist')
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const page = await pdf.getPage(1)

      const container = containerRef.current
      if (!container) {
        return
      }
      const containerWidth = container.clientWidth || 700

      // Obtener viewport normalizando la rotación para mostrar siempre derecho
      const viewport = page.getViewport({ scale: 1, rotation: -(page.rotate || 0) })
      const scale = (containerWidth - 16) / viewport.width
      const scaledViewport = page.getViewport({ scale, rotation: -(page.rotate || 0) })

      // Limpiar contenido anterior
      container.innerHTML = ''

      // Crear nuevo canvas estable para render
      const canvas = document.createElement('canvas')
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.setAttribute('aria-label', 'Previsualización de firmas')
      container.appendChild(canvas)

      canvas.width = Math.round(scaledViewport.width)
      canvas.height = Math.round(scaledViewport.height)

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: scaledViewport
      })
      renderTaskRef.current = renderTask

      try {
        await renderTask.promise
      } catch (err) {
        if (err?.name === 'RenderingCancelledException') {
          return
        }
        throw err
      }
      renderTaskRef.current = null

      // Dibujar coordenadas de forma optimizada
      plantillaCoordenadas.forEach(coord => {
        const color = COLORES_ROL[coord.nombre_rol] ?? '#004A2F'

        const x = (coord.x_porcentaje / 100) * canvas.width
        const y = (coord.y_porcentaje / 100) * canvas.height
        const w = (coord.ancho_porcentaje / 100) * canvas.width
        const h = (coord.alto_porcentaje / 100) * canvas.height

        const nx = (coord.nombre_x_porcentaje / 100) * canvas.width
        const ny = (coord.nombre_y_porcentaje / 100) * canvas.height
        const nw = (coord.nombre_ancho_porcentaje / 100) * canvas.width
        const nh = (coord.nombre_alto_porcentaje / 100) * canvas.height

        // Caja firma
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = color + '33'
        ctx.fillRect(x, y, w, h)

        // Caja nombre
        ctx.setLineDash([5, 3])
        ctx.strokeRect(nx, ny, nw, nh)
        ctx.fillStyle = color + '22'
        ctx.fillRect(nx, ny, nw, nh)
        ctx.setLineDash([])

        // Etiqueta
        ctx.fillStyle = color
        ctx.font = 'bold 11px Arial'
        ctx.fillText(coord.nombre_rol, x + 2, y - 4)
      })
    } catch (err) {
      console.error('Error al renderizar preview:', err)
      setError('Error al cargar la previsualización del PDF')
    } finally {
      // Resetear flags de renderizado
      renderTaskRef.current = null
      isRenderingRef.current = false
      setCargando(false)
    }
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Error de carga"
        description={error}
        showIcon
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {plantilla.coordenadas?.map(c => (
          <Tag key={c.id} color={COLORES_ROL[c.nombre_rol] ?? '#004A2F'}>
            {c.nombre_rol}
          </Tag>
        ))}
      </div>
      {cargando && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666' }}>
            Cargando previsualización del PDF...
          </div>
        </div>
      )}
      <div ref={containerRef} style={{
        width: '100%',
        border: '1px solid #d9d9d9',
        minHeight: '600px',
        display: cargando ? 'none' : 'block'
      }}></div>
    </div>
  )
})

export default PreviewFirmasSolicitud