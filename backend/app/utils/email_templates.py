"""
Templates HTML para los correos del sistema de certificación SENA.
Todos usan los colores institucionales del SENA.
"""

# -------------------------------------------------------
# Base del template
# -------------------------------------------------------

def _base_template(contenido: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }}
            .header {{
                background-color: #004A2F;
                padding: 24px 32px;
                text-align: center;
            }}
            .header h1 {{
                color: #ffffff;
                margin: 0;
                font-size: 20px;
                letter-spacing: 1px;
            }}
            .header p {{
                color: #a8f0d0;
                margin: 6px 0 0 0;
                font-size: 13px;
            }}
            .body {{
                padding: 32px;
                color: #333333;
            }}
            .body h2 {{
                color: #004A2F;
                margin-top: 0;
                font-size: 18px;
            }}
            .body p {{
                line-height: 1.6;
                margin: 8px 0;
            }}
            .info-box {{
                background-color: #f9f9f9;
                border-left: 4px solid #004A2F;
                padding: 16px 20px;
                margin: 20px 0;
                border-radius: 0 4px 4px 0;
            }}
            .info-box p {{
                margin: 6px 0;
                font-size: 14px;
            }}
            .info-box strong {{
                color: #004A2F;
            }}
            .btn {{
                display: inline-block;
                background-color: #004A2F;
                color: #ffffff !important;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 4px;
                font-size: 15px;
                font-weight: bold;
                margin: 20px 0;
            }}
            .btn:hover {{
                background-color: #006B44;
            }}
            .alert-box {{
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 16px 20px;
                margin: 20px 0;
                border-radius: 0 4px 4px 0;
            }}
            .alert-box p {{
                margin: 6px 0;
                font-size: 14px;
                color: #856404;
            }}
            .success-box {{
                background-color: #d4edda;
                border-left: 4px solid #28a745;
                padding: 16px 20px;
                margin: 20px 0;
                border-radius: 0 4px 4px 0;
            }}
            .success-box p {{
                margin: 6px 0;
                font-size: 14px;
                color: #155724;
            }}
            .footer {{
                background-color: #f4f4f4;
                padding: 20px 32px;
                text-align: center;
                font-size: 12px;
                color: #888888;
                border-top: 1px solid #dddddd;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>SENA</h1>
                <p>Sistema de Gestión de Certificaciones</p>
            </div>
            <div class="body">
                {contenido}
            </div>
            <div class="footer">
                <p>Este es un correo automático, por favor no responda a este mensaje.</p>
                <p>Servicio Nacional de Aprendizaje - SENA</p>
            </div>
        </div>
    </body>
    </html>
    """


# -------------------------------------------------------
# Template: Solicitud recibida
# -------------------------------------------------------

def template_solicitud_recibida(nombre: str, programa: str, ficha: str, tipo_programa: str, frontend_url: str, numero_documento: str = None) -> str:
    contenido = f"""
        <h2>Solicitud de certificación recibida</h2>
        <p>Hola <strong>{nombre} {numero_documento}</strong>,</p>
        <p>Tu solicitud de certificación ha sido recibida correctamente y se encuentra en proceso de revisión.</p>

        <div class="info-box">
            <p><strong>Programa:</strong> {programa}</p>
            <p><strong>Tipo:</strong> {tipo_programa}</p>
            <p><strong>Ficha:</strong> {ficha}</p>
            <p><strong>Estado:</strong> En revisión</p>
        </div>

        <p>Puedes consultar el estado de tu solicitud en cualquier momento haciendo clic en el siguiente botón:</p>
        <a href="{frontend_url}/solicitud/consultar" class="btn">Consultar mi solicitud</a>

        <p>Te notificaremos por este correo cuando haya novedades en tu proceso.</p>
    """
    return _base_template(contenido)


# -------------------------------------------------------
# Template: Observaciones consolidadas (documentos + datos)
# -------------------------------------------------------

NOMBRES_CAMPOS = {
    "tipo_programa_id": "Tipo de programa",
    "nombre_programa": "Nombre del programa",
    "numero_ficha": "Número de ficha",
    "nombre_aprendiz": "Nombre completo",
    "numero_documento": "Número de documento",
}

def template_observaciones_completas(nombre: str, programa: str, docs_observados: list, link_edicion: str, nombre_funcionario: str = None, correo_funcionario: str = None, observaciones_generales: str = None) -> str:
    docs_html = ""
    if docs_observados:
        items = "".join([
            f"<p>📄 <strong>{d['nombre_documento']}:</strong> {d['observaciones']}</p>"
            for d in docs_observados
        ])
        docs_html = f"""
        <div class="alert-box">
            <p><strong>⚠️ Documentos con observaciones:</strong></p>
            {items}
        </div>"""

    obs_generales_html = ""
    if observaciones_generales:
        obs_generales_html = f"""
        <div class="alert-box">
            <p><strong>⚠️ Observaciones generales:</strong></p>
            <p>{observaciones_generales}</p>
        </div>"""

    funcionario_html = ""
    if nombre_funcionario:
        funcionario_html = f"""
        <div class="info-box">
            <p><strong>Funcionario de certificación:</strong></p>
            <p>👤 {nombre_funcionario}</p>
            <p>📧 {correo_funcionario}</p>
        </div>"""

    contenido = f"""
        <h2>Tu solicitud requiere correcciones</h2>
        <p>Hola <strong>{nombre}</strong>,</p>
        <p>El funcionario de certificación ha revisado tu solicitud del programa
        <strong>{programa}</strong> y encontró lo siguiente:</p>
        {docs_html}
        {obs_generales_html}
        <p>Haz clic en el siguiente botón para realizar las correcciones. Este enlace es de un solo uso:</p>
        <a href="{link_edicion}" class="btn">Corregir mi solicitud</a>
        <p><strong>Importante:</strong> Este enlace no tiene fecha de vencimiento pero solo puede usarse una vez.</p>
        {funcionario_html}
        <p>Si tienes dudas comunícate directamente con el funcionario de certificación.</p>
    """
    return _base_template(contenido)


# -------------------------------------------------------
# Template: Solicitud certificada
# -------------------------------------------------------

def template_solicitud_certificada(nombre: str, programa: str, base_url: str) -> str:
    contenido = f"""
        <h2>¡Felicitaciones, fuiste certificado!</h2>
        <p>Hola <strong>{nombre}</strong>,</p>
        <p>Nos complace informarte que tu proceso de certificación del programa
        <strong>{programa}</strong> ha sido completado exitosamente.</p>

        <div class="success-box">
            <p>✅ Tu certificación ha sido procesada en el sistema oficial del SENA.</p>
        </div>

        <p><strong>¿Cómo descargar tu certificado?</strong></p>
        <div class="info-box">
            <p>1. Ingresa al portal del aprendiz SENA: <strong>www.sena.edu.co</strong></p>
            <p>2. Inicia sesión con tu usuario y contraseña</p>
            <p>3. Dirígete a la sección <strong>Certificados</strong></p>
            <p>4. Descarga tu certificado de formación</p>
        </div>

        <p>¡Gracias por tu dedicación y esfuerzo!</p>
    """
    return _base_template(contenido)



# -------------------------------------------------------
# Template: Bienvenida nuevo funcionario
# -------------------------------------------------------

def template_bienvenida_funcionario(nombre: str, correo: str, password_temporal: str, frontend_url: str) -> str:
    contenido = f"""
        <h2>Bienvenido al sistema de certificaciones</h2>
        <p>Hola <strong>{nombre}</strong>,</p>
        <p>Tu cuenta ha sido creada en el Sistema de Gestión de Certificaciones del SENA.</p>

        <div class="info-box">
            <p><strong>Correo:</strong> {correo}</p>
            <p><strong>Contraseña temporal:</strong> {password_temporal}</p>
        </div>

        <div class="alert-box">
            <p>⚠️ Por seguridad deberás cambiar tu contraseña en el primer inicio de sesión.</p>
        </div>

        <p>Ingresa al sistema haciendo clic aquí:</p>
        <a href="{frontend_url}/login" class="btn">Ingresar al sistema</a>

        <p>Si tienes algún problema para acceder comunícate con el administrador del sistema.</p>
    """
    return _base_template(contenido)

def template_restablecer_password(nombre: str, correo: str, password_temporal: str, frontend_url: str) -> str:
    contenido = f"""
        <h2>Restablecimiento de contraseña</h2>
        <p>Hola <strong>{nombre}</strong>,</p>
        <p>El administrador del sistema ha restablecido tu contraseña de acceso.</p>

        <div class="info-box">
            <p><strong>Correo:</strong> {correo}</p>
            <p><strong>Contraseña temporal:</strong> {password_temporal}</p>
        </div>

        <div class="alert-box">
            <p>⚠️ Por seguridad deberás cambiar tu contraseña en el próximo inicio de sesión.</p>
        </div>

        <p>Ingresa al sistema haciendo clic aquí:</p>
        <a href="{frontend_url}/login" class="btn">Ingresar al sistema</a>

        <p>Si no solicitaste este cambio comunícate inmediatamente con el administrador del sistema.</p>
    """
    return _base_template(contenido)