import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import api, { API_URL } from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [rolActivo, setRolActivo] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    const usuarioGuardado = sessionStorage.getItem('usuario')
    const rolGuardado = sessionStorage.getItem('rol_activo')

    if (!token || !usuarioGuardado) {
      setCargando(false)
      return
    }

    // Recargar datos frescos del usuario desde el backend
    api.get('/auth/me')
      .then(({ data }) => {
        sessionStorage.setItem('usuario', JSON.stringify(data))
        setUsuario(data)

        if (rolGuardado) {
          const rolParsed = JSON.parse(rolGuardado)
          // Enriquecer con datos frescos
          const rolCompleto = data.roles?.find(r => r.id === rolParsed.id) ?? rolParsed
          sessionStorage.setItem('rol_activo', JSON.stringify(rolCompleto))
          setRolActivo(rolCompleto)
        }
      })
      .catch(() => {
        // Token inválido — limpiar sesión
        sessionStorage.clear()
      })
      .finally(() => {
        setCargando(false)
      })
  }, [])

  const login = useCallback((datos) => {
    sessionStorage.setItem('access_token', datos.access_token)
    sessionStorage.setItem('refresh_token', datos.refresh_token)
    sessionStorage.setItem('usuario', JSON.stringify(datos.usuario))
    sessionStorage.removeItem('rol_activo')
  }, [])

  const loginCompleto = useCallback((datos) => {
    sessionStorage.setItem('access_token', datos.access_token)
    sessionStorage.setItem('refresh_token', datos.refresh_token)
    sessionStorage.setItem('usuario', JSON.stringify(datos.usuario))
    sessionStorage.removeItem('rol_activo')
    setUsuario(datos.usuario)
    setRolActivo(null)
  }, [])

  const seleccionarRol = useCallback((rol) => {
    const rolCompleto = usuario?.roles?.find(r => r.id === rol.id) ?? rol
    sessionStorage.setItem('rol_activo', JSON.stringify(rolCompleto))
    setRolActivo(rolCompleto)
  }, [usuario])

  const logout = useCallback(async () => {
    try {
      const refreshToken = sessionStorage.getItem('refresh_token')
      if (refreshToken) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        })
      }
    } catch {
      // Si falla igual limpiamos localmente
    } finally {
      sessionStorage.clear()
      setUsuario(null)
      setRolActivo(null)
    }
  }, [])

  const tieneRol = useCallback((rol) => {
    if (rolActivo) return rolActivo.nombre === rol
    return usuario?.roles?.some(r => r.nombre === rol) ?? false
  }, [usuario, rolActivo])

  const esAdmin = useCallback(() => tieneRol('ADMIN'), [tieneRol])

  const debeCambiarPassword = usuario?.debe_cambiar_password ?? false
  const debeRegistrarFirma = usuario?.debe_registrar_firma ?? false
  const debeSeleccionarRol = !rolActivo && (usuario?.roles?.length ?? 0) > 1

  return (
    <AuthContext.Provider value={{
      usuario, rolActivo, cargando,
      login: loginCompleto, logout,
      tieneRol, esAdmin, seleccionarRol,
      debeCambiarPassword, debeRegistrarFirma, debeSeleccionarRol
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}