import magic
import logging
from typing import Tuple
from pypdf import PdfReader
from io import BytesIO

logger = logging.getLogger(__name__)

# Tipos MIME permitidos
MIME_TYPES_PERMITIDOS = {
    "application/pdf": [".pdf"],
}

# Firmas de archivo peligrosas (bytes iniciales)
FIRMAS_PELIGROSAS = [
    b"PK\x03\x04",      # ZIP
    b"Rar!\x1a\x07",    # RAR
    b"\x7fELF",         # ELF ejecutable
    b"MZ",              # EXE
    b"#!/",             # Script shell
    b"<?php",           # PHP
    b"<%",              # ASP/JSP
    b"<script",         # JavaScript/HTML peligroso
]


def validar_archivo_seguro(
    contenido: bytes,
    nombre_archivo: str
) -> Tuple[bool, str]:
    """
    Valida que un archivo sea seguro y del tipo correcto.

    Args:
        contenido: Bytes del archivo
        nombre_archivo: Nombre original del archivo

    Returns:
        Tuple[bool, str]: (es_valido, mensaje_error)
    """
    try:
        # 1. Verificar tamaño mínimo
        if len(contenido) < 100:
            return False, "Archivo demasiado pequeño o vacío"

        # 2. Verificar MIME type real usando python-magic
        mime_type = magic.from_buffer(contenido, mime=True)
        logger.info(
            f"Archivo {nombre_archivo}: MIME type detectado = {mime_type}"
        )

        # 3. Verificar que el MIME type esté permitido
        if mime_type not in MIME_TYPES_PERMITIDOS:
            logger.warning(
                f"Archivo {nombre_archivo} rechazado por MIME: {mime_type}"
            )
            return False, (
                "El archivo no parece ser un PDF válido. "
                "Por favor guarda el documento nuevamente en formato PDF."
            )

        # 4. Verificar extensión del archivo
        extension_correcta = False
        for ext in MIME_TYPES_PERMITIDOS[mime_type]:
            if nombre_archivo.lower().endswith(ext):
                extension_correcta = True
                break

        if not extension_correcta:
            return False, (
                f"Extensión del archivo no coincide con el tipo detectado "
                f"({mime_type})"
            )

        # 5. Verificar que no tenga firmas peligrosas
        for firma in FIRMAS_PELIGROSAS:
            if contenido.startswith(firma):
                logger.warning(
                    f"Archivo {nombre_archivo} contiene firma peligrosa"
                )
                return False, (
                    "El archivo no es válido para subir al sistema. "
                    "Por favor utiliza un documento PDF generado desde una fuente confiable."
                )

        # 6. Validación básica PDF
        if mime_type == "application/pdf":
            if not contenido.startswith(b"%PDF"):
                return False, "No es un archivo PDF válido"

        return True, "Archivo válido"

    except Exception as e:
        logger.error(
            f"Error validando archivo {nombre_archivo}: {str(e)}"
        )
        return False, f"Error al validar archivo: {str(e)}"


def validar_archivo_pdf(
    contenido: bytes,
    nombre_archivo: str
) -> Tuple[bool, str]:
    """
    Validación específica para PDFs:
    - verifica que sea realmente un PDF
    - valida que pueda abrirse correctamente
    - bloquea JavaScript embebido
    - bloquea acciones automáticas peligrosas
    """
    es_valido, mensaje = validar_archivo_seguro(
        contenido,
        nombre_archivo
    )

    if not es_valido:
        return False, mensaje

    try:
        # Validar que realmente pueda abrirse como PDF
        PdfReader(BytesIO(contenido))

        # Convertir a texto para inspección básica
        contenido_str = contenido.decode(
            "latin-1",
            errors="ignore"
        )

        # Bloquear JavaScript embebido
        if "/JavaScript" in contenido_str or "/JS" in contenido_str:
            return False, (
                "El PDF contiene elementos no permitidos. "
                "Por favor genera nuevamente el archivo e intenta otra vez."
            )

        # Bloquear acciones automáticas sospechosas
        acciones_sospechosas = [
            "/Launch",
            "/SubmitForm",
            "/ImportData",
        ]

        for accion in acciones_sospechosas:
            if accion in contenido_str:
                return False, (
                    f"PDF contiene acción potencialmente "
                    f"peligrosa: {accion}"
                )

        return True, "PDF válido y seguro"

    except Exception as e:
        logger.error(
            f"Error validando PDF {nombre_archivo}: {str(e)}"
        )
        return False, (
            "No fue posible abrir el archivo PDF. "
            "Verifica que el documento no esté dañado y vuelve a guardarlo como PDF."
        )