import { useState, useEffect } from 'react'
import {
  Table, Button, Card, Typography, Tag, Space, Modal,
  Form, Input, Select, Switch, Popconfirm, message, Alert
} from 'antd'
import {
  PlusOutlined, EditOutlined, StopOutlined, CheckOutlined,
  KeyOutlined, UserOutlined, ReloadOutlined
} from '@ant-design/icons'
import api from '../api/axios'

const { Title, Text } = Typography

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  // Modales
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalRoles, setModalRoles] = useState(false)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const [formCrear] = Form.useForm()
  const [formEditar] = Form.useForm()

  const cargar = async () => {
    setCargando(true)
    try {
      const [resUsuarios, resRoles] = await Promise.all([
        api.get('/usuarios/'),
        api.get('/roles/')
      ])
      setUsuarios(resUsuarios.data)
      setRoles(resRoles.data)
    } catch {
      message.error('Error al cargar usuarios')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])
  useEffect(() => { setPagina(1) }, [busqueda])

  const usuariosFiltrados = usuarios.filter(u => {
    if (!busqueda) return true
    const b = busqueda.toLowerCase()
    return (
      u.nombre_completo?.toLowerCase().includes(b) ||
      u.correo?.toLowerCase().includes(b) ||
      u.documento?.toLowerCase().includes(b)
    )
  })

  const crearUsuario = async (values) => {
    setEnviando(true)
    try {
      await api.post('/usuarios/', {
        nombre_completo: values.nombre_completo,
        correo: values.correo,
        documento: values.documento,
        telefono: values.telefono || null,
        roles: values.roles
      })
      message.success('Usuario creado. Se enviaron las credenciales al correo.')
      setModalCrear(false)
      formCrear.resetFields()
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al crear usuario')
    } finally {
      setEnviando(false)
    }
  }

  const editarUsuario = async (values) => {
    setEnviando(true)
    try {
      await api.put(`/usuarios/${usuarioSeleccionado.id}`, {
        nombre_completo: values.nombre_completo,
        telefono: values.telefono || null,
      })
      message.success('Usuario actualizado')
      setModalEditar(false)
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al actualizar')
    } finally {
      setEnviando(false)
    }
  }

  const toggleEstado = async (usuario) => {
    try {
      await api.put(`/usuarios/${usuario.id}/estado?activo=${!usuario.activo}`)
      message.success(`Usuario ${!usuario.activo ? 'activado' : 'desactivado'}`)
      cargar()
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al cambiar estado')
    }
  }

  const restablecerPassword = async (usuario) => {
    try {
      await api.post(`/usuarios/${usuario.id}/restablecer-password`)
      message.success('Contraseña restablecida. Se envió al correo del usuario.')
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al restablecer')
    }
  }

  const abrirEditar = (usuario) => {
    setUsuarioSeleccionado(usuario)
    formEditar.setFieldsValue({
      nombre_completo: usuario.nombre_completo,
      telefono: usuario.telefono,
    })
    setModalEditar(true)
  }

  const abrirRoles = (usuario) => {
    setUsuarioSeleccionado(usuario)
    setModalRoles(true)
  }

  const agregarRol = async (rolId) => {
    try {
      await api.post(`/usuarios/${usuarioSeleccionado.id}/roles`, { rol_id: rolId })
      message.success('Rol asignado')
      cargar()
      // Actualizar usuario seleccionado
      const { data } = await api.get(`/usuarios/${usuarioSeleccionado.id}`)
      setUsuarioSeleccionado(data)
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al asignar rol')
    }
  }

  const quitarRol = async (rolId) => {
    try {
      await api.delete(`/usuarios/${usuarioSeleccionado.id}/roles/${rolId}`)
      message.success('Rol removido')
      cargar()
      const { data } = await api.get(`/usuarios/${usuarioSeleccionado.id}`)
      setUsuarioSeleccionado(data)
    } catch (err) {
      const msg = err.response?.data?.detail
      message.error(typeof msg === 'string' ? msg : 'Error al quitar rol')
    }
  }

  const rolesAsignados = usuarioSeleccionado?.roles?.map(r => r.id) ?? []
  const rolesDisponibles = roles.filter(r => !rolesAsignados.includes(r.id))

  const columnas = [
    {
      title: 'Usuario',
      key: 'usuario',
      render: (_, u) => (
        <div>
          <div style={{ fontWeight: 600 }}>{u.nombre_completo}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{u.correo}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{u.documento}</div>
        </div>
      )
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_, u) => (
        <Space wrap>
          {u.roles?.map(r => (
            <Tag key={r.id} color="green">{r.nombre}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'Estado',
      key: 'estado',
      render: (_, u) => (
        <Space direction="vertical" size={2}>
          <Tag color={u.activo ? 'green' : 'red'}>
            {u.activo ? 'Activo' : 'Inactivo'}
          </Tag>
          {u.firma_registrada
            ? <Tag color="blue">Firma ✓</Tag>
            : <Tag color="orange">Sin firma</Tag>
          }
        </Space>
      )
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, u) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => abrirEditar(u)}
          >
            Editar
          </Button>
          <Button
            size="small"
            icon={<UserOutlined />}
            onClick={() => abrirRoles(u)}
          >
            Roles
          </Button>
          <Popconfirm
            title={`¿${u.activo ? 'Desactivar' : 'Activar'} este usuario?`}
            onConfirm={() => toggleEstado(u)}
            okText="Sí"
            cancelText="No"
          >
            <Button
              size="small"
              icon={u.activo ? <StopOutlined /> : <CheckOutlined />}
              danger={u.activo}
            >
              {u.activo ? 'Desactivar' : 'Activar'}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="¿Restablecer contraseña? Se enviará una clave temporal al correo."
            onConfirm={() => restablecerPassword(u)}
            okText="Sí"
            cancelText="No"
          >
            <Button size="small" icon={<KeyOutlined />}>
              Restablecer
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Usuarios</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalCrear(true)}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}
          >
            Nuevo usuario
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Input
          placeholder="Buscar por nombre, correo o documento..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          allowClear
          style={{ maxWidth: 400 }}
        />
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={usuariosFiltrados}
          columns={columnas}
          rowKey="id"
          loading={cargando}
          scroll={{ x: 700 }}
          pagination={{
            current: pagina,
            pageSize: 10,
            onChange: setPagina,
            showTotal: (total) => `${total} usuarios`
          }}
          locale={{ emptyText: 'No hay usuarios' }}
        />
      </Card>

      {/* Modal Crear */}
      <Modal
        title="Nuevo usuario"
        open={modalCrear}
        onCancel={() => { setModalCrear(false); formCrear.resetFields() }}
        footer={null}
        width={500}
      >
        <Form form={formCrear} layout="vertical" onFinish={crearUsuario}>
          <Form.Item name="nombre_completo" label="Nombre completo"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}>
            <Input placeholder="Nombres y apellidos" />
          </Form.Item>
          <Form.Item name="documento" label="Documento"
            rules={[{ required: true, message: 'Ingresa el documento' }]}>
            <Input placeholder="Ej: 1234567890" />
          </Form.Item>
          <Form.Item name="correo" label="Correo electrónico"
            rules={[
              { required: true, message: 'Ingresa el correo' },
              { type: 'email', message: 'Correo inválido' }
            ]}>
            <Input placeholder="correo@sena.edu.co" />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono (opcional)">
            <Input placeholder="Ej: 3001234567" />
          </Form.Item>
          <Form.Item name="roles" label="Roles"
            rules={[{ required: true, message: 'Asigna al menos un rol' }]}>
            <Select
              mode="multiple"
              placeholder="Selecciona roles..."
              options={roles.map(r => ({ value: r.id, label: r.nombre }))}
            />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="Se generará una contraseña temporal y se enviará al correo del usuario."
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalCrear(false); formCrear.resetFields() }}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={enviando}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Crear usuario
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Editar */}
      <Modal
        title="Editar usuario"
        open={modalEditar}
        onCancel={() => setModalEditar(false)}
        footer={null}
      >
        <Form form={formEditar} layout="vertical" onFinish={editarUsuario}>
          <Form.Item name="nombre_completo" label="Nombre completo"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono (opcional)">
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={enviando}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}
            >
              Guardar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Roles */}
      <Modal
        title={`Roles de ${usuarioSeleccionado?.nombre_completo}`}
        open={modalRoles}
        onCancel={() => setModalRoles(false)}
        footer={<Button onClick={() => setModalRoles(false)}>Cerrar</Button>}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Roles asignados:</Text>
          <div style={{ marginTop: 8 }}>
            {usuarioSeleccionado?.roles?.length === 0 && (
              <Text type="secondary">Sin roles asignados</Text>
            )}
            <Space wrap>
              {usuarioSeleccionado?.roles?.map(r => (
                <Tag
                  key={r.id}
                  color="green"
                  closable
                  onClose={() => quitarRol(r.id)}
                >
                  {r.nombre}
                </Tag>
              ))}
            </Space>
          </div>
        </div>

        {rolesDisponibles.length > 0 && (
          <div>
            <Text strong>Agregar rol:</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                {rolesDisponibles.map(r => (
                  <Tag
                    key={r.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => agregarRol(r.id)}
                  >
                    + {r.nombre}
                  </Tag>
                ))}
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}