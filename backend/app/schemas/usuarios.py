from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# -------------------------------------------------------
# Base
# -------------------------------------------------------

class UsuarioBase(BaseModel):
    documento: str = Field(min_length=5, max_length=20)
    nombre_completo: str = Field(min_length=3, max_length=150)
    correo: EmailStr
    telefono: Optional[str] = Field(default=None, min_length=7, max_length=20)


# -------------------------------------------------------
# Crear usuario (solo ADMIN)
# La contraseña la genera el sistema automáticamente
# -------------------------------------------------------

class UsuarioCreate(UsuarioBase):
    roles: List[int] = Field(min_length=1, description="Lista de IDs de roles a asignar")


# -------------------------------------------------------
# Actualizar datos básicos del funcionario
# -------------------------------------------------------

class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = Field(default=None, min_length=3, max_length=150)
    correo: Optional[EmailStr] = None
    telefono: Optional[str] = Field(default=None, min_length=7, max_length=20)


# -------------------------------------------------------
# Cambiar contraseña
# Se usa en dos casos:
# 1. Primer login con contraseña temporal (obligatorio)
# 2. Cambio voluntario posterior
# -------------------------------------------------------

class CambiarPassword(BaseModel):
    password_actual: str = Field(min_length=6)
    password_nueva: str = Field(min_length=8)
    password_confirmacion: str = Field(min_length=8)


# -------------------------------------------------------
# Subir firma (solo roles que requieren firma)
# Se maneja como archivo en el endpoint, no en el schema
# -------------------------------------------------------

# -------------------------------------------------------
# Respuesta de usuario (lo que se devuelve al frontend)
# Nunca incluye password_hash
# -------------------------------------------------------

class RolOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    requiere_firma: bool
    es_coordinador: bool = False
    es_funcionario_revision: bool = False
    es_admin: bool = False

    class Config:
        from_attributes = True


class UsuarioOut(UsuarioBase):
    id: int
    firma_registrada: bool
    activo: bool
    debe_cambiar_password: bool
    debe_registrar_firma: bool
    created_at: datetime
    roles: List[RolOut] = []

    class Config:
        from_attributes = True


# -------------------------------------------------------
# Respuesta reducida para listas
# -------------------------------------------------------

class UsuarioListOut(BaseModel):
    id: int
    documento: str
    nombre_completo: str
    correo: str
    activo: bool
    firma_registrada: bool
    telefono: Optional[str] = None
    roles: List[RolOut] = []

    class Config:
        from_attributes = True


# -------------------------------------------------------
# Asignar o revocar rol a un usuario existente
# -------------------------------------------------------

class AsignarRol(BaseModel):
    rol_id: int


# -------------------------------------------------------
# Schemas de autenticación
# -------------------------------------------------------

class LoginRequest(BaseModel):
    correo: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    debe_cambiar_password: bool
    debe_registrar_firma: bool
    usuario: UsuarioOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# -------------------------------------------------------
# Verificar contraseña para firma de documentos
# -------------------------------------------------------

class VerificarPasswordFirma(BaseModel):
    password: str = Field(min_length=1)