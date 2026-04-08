-- Script de optimización de rendimiento para la base de datos
-- Ejecutar este script en MySQL para mejorar el rendimiento de las consultas

-- Índices para solicitud_documentos
CREATE INDEX idx_solicitud_documentos_solicitud_activa ON solicitud_documentos (solicitud_id, es_version_activa);
CREATE INDEX idx_solicitud_documentos_documento ON solicitud_documentos (documento_id);

-- Índices para firmas
CREATE INDEX idx_firmas_solicitud ON firmas (solicitud_id);
CREATE INDEX idx_firmas_rol ON firmas (rol_id);
CREATE INDEX idx_firmas_usuario ON firmas (usuario_id);
CREATE INDEX idx_firmas_estado ON firmas (estado_firma);

-- Índices para estados_historial
CREATE INDEX idx_estados_historial_solicitud ON estados_historial (solicitud_id);
CREATE INDEX idx_estados_historial_fecha ON estados_historial (fecha_cambio);

-- Índices para solicitudes
CREATE INDEX idx_solicitudes_estado ON solicitudes (estado_actual);
CREATE INDEX idx_solicitudes_tipo_programa ON solicitudes (tipo_programa_id);
CREATE INDEX idx_solicitudes_fecha ON solicitudes (fecha_solicitud DESC);

-- Índices para tipo_programa_roles
CREATE INDEX idx_tipo_programa_roles_tipo_programa ON tipo_programa_roles (tipo_programa_id);
CREATE INDEX idx_tipo_programa_roles_rol ON tipo_programa_roles (rol_id);

-- Índices para usuarios
CREATE INDEX idx_usuarios_activo ON usuarios (activo);
CREATE INDEX idx_usuarios_rol ON usuarios (rol_id);

-- Índices para auditoria
CREATE INDEX idx_auditoria_tabla_id ON auditoria (tabla, registro_id);
CREATE INDEX idx_auditoria_fecha ON auditoria (fecha_accion);

-- Verificar índices existentes
SHOW INDEX FROM solicitud_documentos;
SHOW INDEX FROM firmas;
SHOW INDEX FROM estados_historial;
SHOW INDEX FROM solicitudes;
SHOW INDEX FROM tipo_programa_roles;
SHOW INDEX FROM usuarios;
SHOW INDEX FROM auditoria;