-- Índices esenciales para optimizar el dashboard
-- Ejecutar estos comandos en MySQL para mejorar el rendimiento
-- Nota: Si un índice ya existe, CREATE INDEX fallará con "Duplicate key name" - ignóralo

-- Índices para solicitudes (usadas en todos los dashboards)
CREATE INDEX idx_solicitudes_estado_actual ON solicitudes(estado_actual);
CREATE INDEX idx_solicitudes_tipo_programa_id ON solicitudes(tipo_programa_id);
CREATE INDEX idx_solicitudes_fecha_solicitud ON solicitudes(fecha_solicitud);

-- Índices para firmas (usadas en dashboards de firmantes y coordinadores)
CREATE INDEX idx_firmas_estado_firma ON firmas(estado_firma);
CREATE INDEX idx_firmas_usuario_id ON firmas(usuario_id);
CREATE INDEX idx_firmas_rol_id ON firmas(rol_id);
CREATE INDEX idx_firmas_solicitud_id ON firmas(solicitud_id);
CREATE INDEX idx_firmas_fecha_firma ON firmas(fecha_firma);

-- Índices para estados_historial (usado en cálculo de tiempos)
CREATE INDEX idx_estados_historial_solicitud_id ON estados_historial(solicitud_id);
CREATE INDEX idx_estados_historial_estado_nuevo ON estados_historial(estado_nuevo);
CREATE INDEX idx_estados_historial_fecha_cambio ON estados_historial(fecha_cambio);

-- Índices para relaciones de usuarios y roles
CREATE INDEX idx_usuario_roles_usuario_id ON usuario_roles(usuario_id);
CREATE INDEX idx_usuario_roles_rol_id ON usuario_roles(rol_id);

-- Índices para tipo_programa_roles (usado en lógica de firmas)
CREATE INDEX idx_tipo_programa_roles_tipo_programa_id ON tipo_programa_roles(tipo_programa_id);
CREATE INDEX idx_tipo_programa_roles_rol_id ON tipo_programa_roles(rol_id);
CREATE INDEX idx_tipo_programa_roles_orden_firma ON tipo_programa_roles(orden_firma);

-- Índices compuestos para consultas complejas
CREATE INDEX idx_firmas_solicitud_estado ON firmas(solicitud_id, estado_firma);
CREATE INDEX idx_firmas_usuario_fecha ON firmas(usuario_id, fecha_firma);
CREATE INDEX idx_solicitudes_estado_fecha ON solicitudes(estado_actual, fecha_solicitud);