SET FOREIGN_KEY_CHECKS = 0;

-- ---------------- Acciones ----------------------------
DROP TABLE IF EXISTS `acciones`;
CREATE TABLE `acciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Modulos ----------------------------
DROP TABLE IF EXISTS `modulos`;
CREATE TABLE `modulos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Roles ----------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` text,
  `requiere_firma` tinyint(1) DEFAULT '0',
  `activo` tinyint(1) DEFAULT '1',
  `es_coordinador` tinyint(1) NOT NULL DEFAULT '0',
  `es_funcionario_revision` tinyint(1) NOT NULL DEFAULT '0',
  `es_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Usuarios ----------------------------
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `documento` varchar(20) NOT NULL,
  `nombre_completo` varchar(150) NOT NULL,
  `correo` varchar(120) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `password_hash` text NOT NULL,
  `firma_url` varchar(255) DEFAULT NULL,
  `firma_registrada` tinyint(1) DEFAULT '0',
  `activo` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `debe_cambiar_password` tinyint(1) DEFAULT '0',
  `debe_registrar_firma` tinyint(1) DEFAULT '0',
  `intentos_fallidos` int DEFAULT '0',
  `bloqueado_hasta` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `documento` (`documento`),
  UNIQUE KEY `correo` (`correo`),
  KEY `idx_usuarios_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Documentos_requeridos ----------------------------
DROP TABLE IF EXISTS `documentos_requeridos`;
CREATE TABLE `documentos_requeridos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Tipo_Programas ----------------------------
DROP TABLE IF EXISTS `tipo_programas`;
CREATE TABLE `tipo_programas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Plantillas_formato ----------------------------
DROP TABLE IF EXISTS `plantillas_formato`;
CREATE TABLE `plantillas_formato` (
  `id` int NOT NULL AUTO_INCREMENT,
  `version` varchar(20) NOT NULL,
  `archivo_url` varchar(500) NOT NULL,
  `activa` tinyint(1) DEFAULT '0',
  `creado_por` int DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `version` (`version`),
  KEY `creado_por` (`creado_por`),
  CONSTRAINT `plantillas_formato_ibfk_1` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Rol_Permisos ----------------------------
DROP TABLE IF EXISTS `rol_permisos`;
CREATE TABLE `rol_permisos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rol_id` int NOT NULL,
  `modulo_id` int NOT NULL,
  `accion_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_permiso` (`rol_id`,`modulo_id`,`accion_id`),
  KEY `modulo_id` (`modulo_id`),
  KEY `accion_id` (`accion_id`),
  CONSTRAINT `rol_permisos_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rol_permisos_ibfk_2` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rol_permisos_ibfk_3` FOREIGN KEY (`accion_id`) REFERENCES `acciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------- Usuario_Roles ----------------------------
DROP TABLE IF EXISTS `usuario_roles`;
CREATE TABLE `usuario_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `rol_id` int NOT NULL,
  `activo` tinyint(1) DEFAULT '1',
  `asignado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_usuario_rol` (`usuario_id`,`rol_id`),
  KEY `idx_usuario_roles_usuario_id` (`usuario_id`),
  KEY `idx_usuario_roles_rol_id` (`rol_id`),
  CONSTRAINT `usuario_roles_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usuario_roles_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Tipo_Programa_Documentos ----------------------------
DROP TABLE IF EXISTS `tipo_programa_documentos`;
CREATE TABLE `tipo_programa_documentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_programa_id` int NOT NULL,
  `documento_id` int NOT NULL,
  `obligatorio` tinyint(1) DEFAULT '1',
  `orden_documento` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tipo_doc` (`tipo_programa_id`,`documento_id`),
  KEY `documento_id` (`documento_id`),
  CONSTRAINT `tipo_programa_documentos_ibfk_1` FOREIGN KEY (`tipo_programa_id`) REFERENCES `tipo_programas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tipo_programa_documentos_ibfk_2` FOREIGN KEY (`documento_id`) REFERENCES `documentos_requeridos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Tipo_Programa_Roles ----------------------------
DROP TABLE IF EXISTS `tipo_programa_roles`;
CREATE TABLE `tipo_programa_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_programa_id` int NOT NULL,
  `rol_id` int NOT NULL,
  `orden_firma` int DEFAULT NULL,
  `obligatorio` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tipo_rol` (`tipo_programa_id`,`rol_id`),
  KEY `idx_tipo_programa_roles_rol_id` (`rol_id`),
  KEY `idx_tipo_programa_roles_orden_firma` (`orden_firma`),
  KEY `idx_tipo_programa_roles_tipo_programa` (`tipo_programa_id`),
  CONSTRAINT `tipo_programa_roles_ibfk_1` FOREIGN KEY (`tipo_programa_id`) REFERENCES `tipo_programas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tipo_programa_roles_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Solicitudes ----------------------------
DROP TABLE IF EXISTS `solicitudes`;
CREATE TABLE `solicitudes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero_documento` varchar(20) NOT NULL,
  `numero_ficha` varchar(30) NOT NULL,
  `nombre_aprendiz` varchar(150) NOT NULL,
  `correo_aprendiz` varchar(120) DEFAULT NULL,
  `telefono_aprendiz` varchar(20) DEFAULT NULL,
  `tipo_programa_id` int NOT NULL,
  `nombre_programa` varchar(150) NOT NULL,
  `estado_actual` enum('PENDIENTE_REVISION','CON_OBSERVACIONES','CORREGIDO','PENDIENTE_FIRMAS','PENDIENTE_CERTIFICACION','CERTIFICADO') NOT NULL DEFAULT 'PENDIENTE_REVISION',
  `pdf_consolidado_url` varchar(255) DEFAULT NULL,
  `pdf_hash` varchar(255) DEFAULT NULL,
  `fecha_generacion_pdf` timestamp NULL DEFAULT NULL,
  `fecha_solicitud` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `observaciones_generales` text,
  `plantilla_id` int DEFAULT NULL,
  `documentos_eliminados` tinyint(1) DEFAULT '0',
  `fecha_eliminacion_documentos` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_doc_ficha` (`numero_documento`,`numero_ficha`),
  KEY `idx_estado` (`estado_actual`),
  KEY `idx_tipo_programa` (`tipo_programa_id`),
  KEY `idx_fecha_solicitud` (`fecha_solicitud`),
  KEY `plantilla_id` (`plantilla_id`),
  KEY `idx_solicitudes_estado_fecha` (`estado_actual`,`fecha_solicitud`),
  CONSTRAINT `solicitudes_ibfk_1` FOREIGN KEY (`tipo_programa_id`) REFERENCES `tipo_programas` (`id`),
  CONSTRAINT `solicitudes_ibfk_2` FOREIGN KEY (`plantilla_id`) REFERENCES `plantillas_formato` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Solicitud_Documentos ----------------------------
DROP TABLE IF EXISTS `solicitud_documentos`;
CREATE TABLE `solicitud_documentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `documento_id` int NOT NULL,
  `archivo_url` varchar(255) NOT NULL,
  `version` int DEFAULT '1',
  `es_version_activa` tinyint(1) DEFAULT '1',
  `estado_documento` enum('PENDIENTE','OBSERVADO','APROBADO') DEFAULT 'PENDIENTE',
  `observaciones` text,
  `aprobado_por` int DEFAULT NULL,
  `fecha_revision` timestamp NULL DEFAULT NULL,
  `bloqueado` tinyint(1) DEFAULT '0',
  `fecha_subida` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_solicitud_documento` (`solicitud_id`,`documento_id`),
  KEY `idx_version_activa` (`solicitud_id`,`documento_id`,`es_version_activa`),
  KEY `aprobado_por` (`aprobado_por`),
  KEY `idx_solicitud_documentos_solicitud_activa` (`solicitud_id`,`es_version_activa`),
  KEY `idx_solicitud_documentos_documento` (`documento_id`),
  CONSTRAINT `solicitud_documentos_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitud_documentos_ibfk_2` FOREIGN KEY (`documento_id`) REFERENCES `documentos_requeridos` (`id`),
  CONSTRAINT `solicitud_documentos_ibfk_3` FOREIGN KEY (`aprobado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Firmas ----------------------------
DROP TABLE IF EXISTS `firmas`;
CREATE TABLE `firmas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `rol_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `estado_firma` enum('PENDIENTE','FIRMADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
  `fecha_firma` timestamp NULL DEFAULT NULL,
  `ip_origen` varchar(45) DEFAULT NULL,
  `motivo_rechazo` text,
  `tipo_rechazo` enum('POR_DOCUMENTOS','POR_OTRA_RAZON') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_firma` (`solicitud_id`,`rol_id`),
  KEY `idx_estado_firma` (`estado_firma`),
  KEY `idx_firmas_fecha_firma` (`fecha_firma`),
  KEY `idx_firmas_solicitud_estado` (`solicitud_id`,`estado_firma`),
  KEY `idx_firmas_usuario_fecha` (`usuario_id`,`fecha_firma`),
  KEY `idx_firmas_solicitud` (`solicitud_id`),
  KEY `idx_firmas_rol` (`rol_id`),
  KEY `idx_firmas_usuario` (`usuario_id`),
  CONSTRAINT `firmas_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `firmas_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `firmas_ibfk_3` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Estados_historial ----------------------------
DROP TABLE IF EXISTS `estados_historial`;
CREATE TABLE `estados_historial` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `estado_anterior` enum('PENDIENTE_REVISION','CON_OBSERVACIONES','CORREGIDO','PENDIENTE_FIRMAS','PENDIENTE_CERTIFICACION','CERTIFICADO') DEFAULT NULL,
  `estado_nuevo` enum('PENDIENTE_REVISION','CON_OBSERVACIONES','CORREGIDO','PENDIENTE_FIRMAS','PENDIENTE_CERTIFICACION','CERTIFICADO') NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `motivo` text,
  `fecha_cambio` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `idx_estados_historial_estado_nuevo` (`estado_nuevo`),
  KEY `idx_estados_historial_fecha_cambio` (`fecha_cambio`),
  KEY `idx_estados_historial_solicitud` (`solicitud_id`),
  CONSTRAINT `estados_historial_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `estados_historial_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Tokens_Edicion ----------------------------
DROP TABLE IF EXISTS `tokens_edicion`;
CREATE TABLE `tokens_edicion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `usado` tinyint(1) DEFAULT '0',
  `fecha_expiracion` timestamp NULL DEFAULT NULL,
  `fecha_uso` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `solicitud_id` (`solicitud_id`),
  CONSTRAINT `tokens_edicion_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Notificaciones_email ----------------------------
DROP TABLE IF EXISTS `notificaciones_email`;
CREATE TABLE `notificaciones_email` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `destinatario` varchar(120) NOT NULL,
  `tipo_notificacion` varchar(80) NOT NULL,
  `asunto` varchar(255) DEFAULT NULL,
  `enviado` tinyint(1) DEFAULT '0',
  `fecha_envio` timestamp NULL DEFAULT NULL,
  `error_mensaje` text,
  PRIMARY KEY (`id`),
  KEY `idx_solicitud_notif` (`solicitud_id`),
  KEY `idx_tipo_notif` (`tipo_notificacion`),
  CONSTRAINT `notificaciones_email_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Refresh_Tokens ----------------------------
DROP TABLE IF EXISTS `refresh_tokens`;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `token` varchar(500) NOT NULL,
  `expira_en` datetime NOT NULL,
  `revocado` tinyint(1) DEFAULT '0',
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Auditoria ----------------------------
DROP TABLE IF EXISTS `auditoria`;
CREATE TABLE `auditoria` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int DEFAULT NULL,
  `accion` varchar(100) NOT NULL,
  `tabla_afectada` varchar(100) NOT NULL,
  `registro_id` bigint DEFAULT NULL,
  `descripcion` text,
  `ip_origen` varchar(45) DEFAULT NULL,
  `fecha_evento` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_usuario_auditoria` (`usuario_id`),
  KEY `idx_fecha_auditoria` (`fecha_evento`),
  KEY `idx_tabla_auditoria` (`tabla_afectada`),
  CONSTRAINT `auditoria_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Coordenadas_firma ----------------------------
DROP TABLE IF EXISTS `coordenadas_firma`;
CREATE TABLE `coordenadas_firma` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plantilla_id` int NOT NULL,
  `rol_id` int NOT NULL,
  `pagina` int NOT NULL DEFAULT '1',
  `x_porcentaje` float NOT NULL,
  `y_porcentaje` float NOT NULL,
  `ancho_porcentaje` float NOT NULL,
  `alto_porcentaje` float NOT NULL,
  `nombre_x_porcentaje` float NOT NULL DEFAULT '0',
  `nombre_y_porcentaje` float NOT NULL DEFAULT '0',
  `nombre_ancho_porcentaje` float NOT NULL DEFAULT '10',
  `nombre_alto_porcentaje` float NOT NULL DEFAULT '5',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plantilla_rol` (`plantilla_id`,`rol_id`),
  KEY `rol_id` (`rol_id`),
  CONSTRAINT `coordenadas_firma_ibfk_1` FOREIGN KEY (`plantilla_id`) REFERENCES `plantillas_formato` (`id`),
  CONSTRAINT `coordenadas_firma_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ---------- Triggers ------------------------
DELIMITER //
CREATE TRIGGER `tr_asignar_plantilla` BEFORE INSERT ON `solicitudes` FOR EACH ROW BEGIN
    SET NEW.plantilla_id = (
        SELECT id FROM plantillas_formato WHERE activa = TRUE LIMIT 1
    );
END //
DELIMITER ;


SET FOREIGN_KEY_CHECKS = 1;