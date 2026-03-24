import hashlib
import io
import logging
import os
from pypdf import PdfWriter, PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from datetime import datetime

logger = logging.getLogger(__name__)


def generar_pdf_consolidado(solicitud_id: int, documentos: list, upload_dir: str) -> tuple[str, str]:
    """
    Combina todos los documentos aprobados de una solicitud
    en un único PDF consolidado.

    Args:
        solicitud_id: ID de la solicitud.
        documentos: Lista de documentos con su archivo_url.
        upload_dir: Directorio base de uploads.

    Returns:
        tuple: (ruta_pdf, hash_pdf)

    Raises:
        Exception: Si algún archivo no existe o no es un PDF válido.
    """
    writer = PdfWriter()

    for doc in documentos:
        ruta = doc["archivo_url"]
        if not os.path.exists(ruta):
            raise FileNotFoundError(f"Archivo no encontrado: {ruta}")

        try:
            reader = PdfReader(ruta)
            for page in reader.pages:
                writer.add_page(page)
        except Exception as e:
            logger.error(f"Error al leer PDF {ruta}: {e}")
            raise Exception(f"Error al procesar el archivo: {ruta}")

    # Guardar PDF consolidado
    carpeta = f"{upload_dir}/{solicitud_id}"
    os.makedirs(carpeta, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ruta_consolidado = f"{carpeta}/consolidado_{timestamp}.pdf"

    with open(ruta_consolidado, "wb") as f:
        writer.write(f)

    # Calcular hash del PDF para integridad
    with open(ruta_consolidado, "rb") as f:
        contenido = f.read()
        pdf_hash = hashlib.sha256(contenido).hexdigest()

    logger.info(f"PDF consolidado generado para solicitud {solicitud_id}: {ruta_consolidado}")
    return ruta_consolidado, pdf_hash


def incrustar_firmas_en_pdf(
    ruta_pdf_original: str,
    firmas: list,
    coordenadas: list,
    ruta_salida: str
) -> tuple[str, str]:
    """
    Incrusta las imágenes de firma de los funcionarios en el PDF consolidado.
    Las firmas se colocan sobre el paz y salvo usando coordenadas en porcentaje.

    Args:
        ruta_pdf_original: Ruta del PDF consolidado sin firmas.
        firmas: Lista de dicts con {rol_id, firma_url, nombre_completo}.
        coordenadas: Lista de dicts con {rol_id, pagina, x_porcentaje,
                     y_porcentaje, ancho_porcentaje, alto_porcentaje}.
        ruta_salida: Ruta donde guardar el PDF con firmas.

    Returns:
        tuple: (ruta_pdf_firmado, hash_pdf)
    """
    if not os.path.exists(ruta_pdf_original):
        raise FileNotFoundError(f"PDF consolidado no encontrado: {ruta_pdf_original}")

    # Indexar firmas y coordenadas por rol_id para acceso rápido
    firmas_por_rol = {f["rol_id"]: f for f in firmas}
    coords_por_rol = {c["rol_id"]: c for c in coordenadas}

    reader = PdfReader(ruta_pdf_original)
    writer = PdfWriter()

    for page_index, page in enumerate(reader.pages):
        pagina_numero = page_index + 1

        # Obtener dimensiones reales de esta página del PDF del aprendiz
        ancho_pagina = float(page.mediabox.width)
        alto_pagina = float(page.mediabox.height)

        # Buscar firmas que van en esta página
        firmas_en_pagina = [
            c for c in coords_por_rol.values()
            if c["pagina"] == pagina_numero and c["rol_id"] in firmas_por_rol
        ]

        if firmas_en_pagina:
            # Crear overlay con las firmas para esta página
            packet = io.BytesIO()
            c = canvas.Canvas(packet, pagesize=(ancho_pagina, alto_pagina))

            for coord in firmas_en_pagina:
                firma = firmas_por_rol[coord["rol_id"]]
                firma_url = firma.get("firma_url")

                if not firma_url or not os.path.exists(firma_url):
                    logger.warning(f"Firma no encontrada para rol {coord['rol_id']}: {firma_url}")
                    continue

                # Convertir porcentajes a puntos reales
                x = (coord["x_porcentaje"] / 100) * ancho_pagina
                # PDF tiene origen en esquina inferior izquierda, invertir Y
                y_top = (coord["y_porcentaje"] / 100) * alto_pagina
                ancho = (coord["ancho_porcentaje"] / 100) * ancho_pagina
                alto = (coord["alto_porcentaje"] / 100) * alto_pagina
                y = alto_pagina - y_top - alto

                try:
                    # Ajustar proporciones sin distorsionar la imagen
                    from PIL import Image as PILImage
                    pil_img = PILImage.open(firma_url)
                    img_w, img_h = pil_img.size

                    # Calcular escala manteniendo proporción
                    escala = min(ancho / img_w, alto / img_h)
                    ancho_real = img_w * escala
                    alto_real = img_h * escala

                    # Centrar dentro del campo
                    x_centrado = x + (ancho - ancho_real) / 2
                    y_centrado = y + (alto - alto_real) / 2

                    img = ImageReader(firma_url)
                    c.drawImage(img, x_centrado, y_centrado, width=ancho_real, height=alto_real, mask="auto")

                    # Escribir nombre del funcionario en el campo de nombres
                    nombre_x = (coord["nombre_x_porcentaje"] / 100) * ancho_pagina
                    nombre_y_top = (coord["nombre_y_porcentaje"] / 100) * alto_pagina
                    nombre_ancho = (coord["nombre_ancho_porcentaje"] / 100) * ancho_pagina
                    nombre_alto = (coord["nombre_alto_porcentaje"] / 100) * alto_pagina
                    nombre_y = alto_pagina - nombre_y_top - nombre_alto

                    font_size = min(8, nombre_alto * 0.6)
                    c.setFont("Helvetica", font_size)
                    c.setFillColorRGB(0, 0, 0)
                    text_y = nombre_y + (nombre_alto - font_size) / 2
                    c.drawString(nombre_x + 2, text_y, firma.get("nombre_completo", ""))

                except Exception as e:
                    logger.error(f"Error al incrustar firma rol {coord['rol_id']}: {e}")
                    raise Exception(f"Error al procesar la firma de {firma.get('nombre_completo', 'desconocido')}")

            c.save()
            packet.seek(0)

            # Fusionar overlay con la página original
            overlay_reader = PdfReader(packet)
            overlay_page = overlay_reader.pages[0]
            page.merge_page(overlay_page)

        writer.add_page(page)

    # Guardar PDF con firmas
    with open(ruta_salida, "wb") as f:
        writer.write(f)

    # Calcular hash del PDF firmado
    with open(ruta_salida, "rb") as f:
        contenido = f.read()
        pdf_hash = hashlib.sha256(contenido).hexdigest()

    logger.info(f"Firmas incrustadas correctamente en: {ruta_salida}")
    return ruta_salida, pdf_hash