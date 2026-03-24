import { Button, Typography, Card, Row, Col } from 'antd'
import { FileAddOutlined, SearchOutlined, LoginOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

export default function Inicio() {
  const navigate = useNavigate()

  const opciones = [
    {
      icono: <FileAddOutlined style={{ fontSize: 40, color: '#004A2F' }} />,
      titulo: 'Realizar solicitud',
      descripcion: 'Inicia tu proceso de certificación subiendo los documentos requeridos.',
      boton: 'Iniciar solicitud',
      onClick: () => navigate('/solicitud/nueva'),
      color: '#f6ffed',
      borde: '#b7eb8f'
    },
    {
      icono: <SearchOutlined style={{ fontSize: 40, color: '#1677ff' }} />,
      titulo: 'Consultar solicitud',
      descripcion: 'Revisa el estado de tu solicitud con tu número de documento y ficha.',
      boton: 'Consultar',
      onClick: () => navigate('/solicitud/consultar'),
      color: '#f6ffed',
      borde: '#b7eb8f'
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #004A2F 0%, #007A4D 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      {/* Logo y título */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <img
          src="/src/assets/logo_sena.png"
          alt="SENA"
          style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 16 }}
        />
        <Title level={2} style={{ color: 'white', margin: 0 }}>
          Sistema de Certificación
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>
          Servicio Nacional de Aprendizaje — SENA
        </Text>
      </div>

      {/* Tarjetas de opciones */}
      <Row gutter={[24, 24]} style={{ maxWidth: 800, width: '100%', marginBottom: 32 }}>
        {opciones.map((op, i) => (
          <Col xs={24} sm={12} key={i}>
            <Card
              style={{
                borderRadius: 16,
                border: `2px solid ${op.borde}`,
                background: op.color,
                textAlign: 'center',
              }}
            >
              <div style={{ marginBottom: 16 }}>{op.icono}</div>
              <Title level={4} style={{ marginBottom: 8 }}>{op.titulo}</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                {op.descripcion}
              </Text>
              <Button
                type="primary"
                size="large"
                style={{ background: '#004A2F', borderColor: '#004A2F' }}
                onClick={(e) => { e.stopPropagation(); op.onClick() }}
              >
                {op.boton}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Acceso funcionarios */}
      <Button
        icon={<LoginOutlined />}
        onClick={() => navigate('/login')}
        style={{
          background: 'rgba(255,255,255,0.15)',
          borderColor: 'rgba(255,255,255,0.4)',
          color: 'white',
        }}
        size="large"
      >
        Acceso funcionarios
      </Button>
    </div>
  )
}