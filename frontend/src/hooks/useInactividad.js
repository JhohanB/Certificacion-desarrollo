import { useEffect, useRef, useCallback } from 'react'

const TIEMPO_INACTIVIDAD = 20 * 60 * 1000 // 20 minutos en milisegundos

export function useInactividad(onInactivo) {
  const timerRef = useRef(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onInactivo, TIEMPO_INACTIVIDAD)
  }, [onInactivo])

  useEffect(() => {
    // Eventos que se consideran actividad del usuario
    const eventos = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ]

    eventos.forEach(evento => window.addEventListener(evento, resetTimer))
    resetTimer() // Iniciar el timer al montar

    return () => {
      eventos.forEach(evento => window.removeEventListener(evento, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])
}