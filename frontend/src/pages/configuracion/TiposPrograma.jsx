import { useState, useEffect } from 'react'
import {
  Table, Button, Card, Typography, Tag, Space, Modal,
  Form, Input, Select, Popconfirm, message, InputNumber, Divider
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  FileTextOutlined, TeamOutlined, ReloadOutlined
} from '@ant-design/icons'
import api from '../../api/axios'

const { Title, Text } = Typography

export default function TiposPrograma() {
  const [tipos, setTipos] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [roles, setRoles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)

  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalDocumentos, setModalDocumentos] = useState(false)
  const [modalRoles, setModalRoles] = useState(false)
  const [modalCrearDoc, setModalCrearDoc] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [formCrear] = Form.useForm()
  const [formEditar] = Form.useForm()
  const [formDoc] = Form.useForm()

  const cargar = async () => {
    setCargando(true)
    try {
      const [resTipos, resDocs, resRoles] = await Promise.all([
        api.get('/tipo-programas/'),
        api.get('/tipo-programas/documentos/'),
        api.get('/roles/')
      ])
      setTipos(resTipos.data)
      setDocumentos(resDocs.data)
      setRoles(resRoles.data.filter(r => r.requiere_firma))
    } catch {
      message.error('Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const crearTipo = async (values) => {
    setEnviando(true)
    try {
      await api.post('/tipo-programas/', values)
      message.success('Tipo de programa creado')
      setModalCrear(false)
      formCrear.resetFields()
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al crear')
    } finally {
      setEnviando(false)
    }
  }

  const editarTipo = async (values) => {
    setEnviando(true)
    try {
      await api.put(`/tipo-programas/${tipoSeleccionado.id}`, values)
      message.success('Tipo de programa actualizado')
      setModalEditar(false)
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al actualizar')
    } finally {
      setEnviando(false)
    }
  }

  const eliminarTipo = async (id) => {
    try {
      await api.delete(`/tipo-programas/${id}`)
      message.success('Tipo de programa eliminado')
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al eliminar')
    }
  }

  const abrirDocumentos = async (tipo) => {
    setTipoSeleccionado(tipo)
    const { data } = await api.get(`/tipo-programas/${tipo.id}`)
    setTipoSeleccionado(data)
    setModalDocumentos(true)
  }

  const abrirRoles = async (tipo) => {
    const { data } = await api.get(`/tipo-programas/${tipo.id}`)
    setTipoSeleccionado(data)
    setModalRoles(true)
  }

  const agregarDocumento = async (values) => {
    setEnviando(true)
    try {
      await api.post(`/tipo-programas/${tipoSeleccionado.id}/documentos`, {
        documento_id: values.documento_id,
        obligatorio: values.obligatorio ?? true
      })
      message.success('Documento agregado')
      setModalCrearDoc(false)
      formDoc.resetFields()
      const { data } = await api.get(`/tipo-programas/${tipoSeleccionado.id}`)
      setTipoSeleccionado(data)
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al agregar documento')
    } finally {
      setEnviando(false)
    }
  }

  const quitarDocumento = async (relacionId) => {
    try {
      await api.delete(`/tipo-programas/${tipoSeleccionado.id}/documentos/${relacionId}`)
      message.success('Documento removido')
      const { data } = await api.get(`/tipo-programas/${tipoSeleccionado.id}`)
      setTipoSeleccionado(data)
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al remover')
    }
  }

  const agregarRol = async (rolId, ordenFirma) => {
    try {
      await api.post(`/tipo-programas/${tipoSeleccionado.id}/roles`, {
        rol_id: rolId,
        orden_firma: ordenFirma ?? 0,
        obligatorio: true
      })
      message.success('Rol agregado')
      const { data } = await api.get(`/tipo-programas/${tipoSeleccionado.id}`)
      setTipoSeleccionado(data)
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al agregar rol')
    }
  }

  const quitarRol = async (relacionId) => {
    try {
      await api.delete(`/tipo-programas/${tipoSeleccionado.id}/roles/${relacionId}`)
      message.success('Rol removido')
      const { data } = await api.get(`/tipo-programas/${tipoSeleccionado.id}`)
      setTipoSeleccionado(data)
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al remover')
    }
  }

  const crearDocumento = async (values) => {
    setEnviando(true)
    try {
      await api.post('/tipo-programas/documentos/', values)
      message.success('Documento creado')
      setModalCrearDoc(false)
      formDoc.resetFields()
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al crear documento')
    } finally {
      setEnviando(false)
    }
  }

  const rolesAsignados = tipoSeleccionado?.roles_firmantes?.map(r => r.rol_id) ?? []
  const rolesDisponibles = roles.filter(r => !rolesAsignados.includes(r.id))
  const docsAsignados = tipoSeleccionado?.documentos?.map(d => d.documento_id) ?? []
  const docsDisponibles = documentos.filter(d => !docsAsignados.includes(d.id))

  const columnas = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (nombre, record) => (
        <div>
          <Text strong>{nombre}</Text>
          {record.descripcion && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>{record.descripcion}</Text></div>
          )}
        </div>
      )
    },
    {
      title: 'Documentos',
      key: 'documentos',
      render: (_, record) => (
        <Tag color="blue">{record.total_documentos ?? 0} docs</Tag>
      )
    },
    {
      title: 'Roles firmantes',
      key: 'roles',
      render: (_, record) => (
        <Tag color="purple">{record.total_roles ?? 0} roles</Tag>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      key: 'activo',
      render: (activo) => (
        <Tag color={activo ? 'green' : 'red'}>{activo ? 'Activo' : 'Inactivo'}</Tag>
      )
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />}
            onClick={() => {
              setTipoSeleccionado(record)
              formEditar.setFieldsValue({ nombre: record.nombre, descripcion: record.descripcion })
              setModalEditar(true)
            }}>
            Editar
          </Button>
          <Button size="small" icon={<FileTextOutlined />}
            onClick={() => abrirDocumentos(record)}>
            Documentos
          </Button>
          <Button size="small" icon={<TeamOutlined />}
            onClick={() => abrirRoles(record)}>
            Roles
          </Button>
          <Popconfirm
            title={`¿${record.activo ? 'Desactivar' : 'Activar'} este tipo de programa?`}
            onConfirm={async () => {
                await api.put(`/tipo-programas/${record.id}/estado?activo=${!record.activo}`)
                cargar()
            }}
            okText="Sí" cancelText="No"
            >
            <Button size="small" danger={record.activo}>
                {record.activo ? 'Desactivar' : 'Activar'}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Niveles de Formación</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button>
          <Button
            type="primary" icon={<PlusOutlined />}
            onClick={() => setModalCrear(true)}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}
          >
            Nuevo nivel de formación
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={tipos} columns={columnas} rowKey="id"
          loading={cargando} scroll={{ x: 700 }}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No hay niveles de formación' }}
        />
      </Card>

      {/* Modal Crear */}
      <Modal title="Nuevo nivel de formación" open={modalCrear}
        onCancel={() => { setModalCrear(false); formCrear.resetFields() }}
        footer={null}>
        <Form form={formCrear} layout="vertical" onFinish={crearTipo}>
          <Form.Item name="nombre" label="Nombre"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}>
            <Input placeholder="Ej: TÉCNICO" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalCrear(false); formCrear.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={enviando}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}>
              Crear
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Editar */}
      <Modal title="Editar nivel de formación" open={modalEditar}
        onCancel={() => setModalEditar(false)} footer={null}>
        <Form form={formEditar} layout="vertical" onFinish={editarTipo}>
          <Form.Item name="nombre" label="Nombre"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={enviando}
              style={{ background: '#004A2F', borderColor: '#004A2F' }}>
              Guardar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Documentos */}
      <Modal
        title={`Documentos — ${tipoSeleccionado?.nombre}`}
        open={modalDocumentos}
        onCancel={() => setModalDocumentos(false)}
        footer={<Button onClick={() => setModalDocumentos(false)}>Cerrar</Button>}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Documentos asignados:</Text>
          <div style={{ marginTop: 8 }}>
            {tipoSeleccionado?.documentos?.length === 0 && (
              <Text type="secondary">Sin documentos asignados</Text>
            )}
            {tipoSeleccionado?.documentos?.map(doc => (
              <div key={doc.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid #f0f0f0'
              }}>
                <div>
                  <Text>{doc.nombre_documento}</Text>
                  <Tag color={doc.obligatorio ? 'red' : 'default'} style={{ marginLeft: 8 }}>
                    {doc.obligatorio ? 'Obligatorio' : 'Opcional'}
                  </Tag>
                </div>
                <Popconfirm title="¿Quitar este documento?"
                  onConfirm={() => quitarDocumento(doc.id)}
                  okText="Sí" cancelText="No">
                  <Button size="small" danger>Quitar</Button>
                </Popconfirm>
              </div>
            ))}
          </div>
        </div>

        <Divider />

        {docsDisponibles.length > 0 && (
          <div>
            <Text strong>Agregar documento existente:</Text>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {docsDisponibles.map(doc => (
                <Popconfirm key={doc.id}
                  title={`¿Agregar "${doc.nombre}" como obligatorio?`}
                  onConfirm={() => agregarDocumento({ documento_id: doc.id, obligatorio: true })}
                  okText="Obligatorio"
                  cancelText="Opcional"
                  onCancel={() => agregarDocumento({ documento_id: doc.id, obligatorio: false })}
                >
                  <Tag style={{ cursor: 'pointer' }} color="blue">+ {doc.nombre}</Tag>
                </Popconfirm>
              ))}
            </div>
          </div>
        )}

        <Divider />

        <div>
          <Text strong>Crear nuevo documento:</Text>
          <Form layout="inline" style={{ marginTop: 8 }} onFinish={crearDocumento}>
            <Form.Item name="nombre" rules={[{ required: true }]}>
              <Input placeholder="Nombre del documento" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit"
                style={{ background: '#004A2F', borderColor: '#004A2F' }}>
                Crear
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* Modal Roles */}
      <Modal
        title={`Roles firmantes — ${tipoSeleccionado?.nombre}`}
        open={modalRoles}
        onCancel={() => setModalRoles(false)}
        footer={<Button onClick={() => setModalRoles(false)}>Cerrar</Button>}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Roles asignados:</Text>
          <div style={{ marginTop: 8 }}>
            {tipoSeleccionado?.roles?.length === 0 && (
              <Text type="secondary">Sin roles asignados</Text>
            )}
            {tipoSeleccionado?.roles_firmantes?.map(rol => (
                <div key={rol.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: '1px solid #f0f0f0'
                }}>
                    <div>
                    <Tag color="purple">{rol.nombre_rol}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Orden: {rol.orden_firma === 99 ? 'Último (Coordinador)' : rol.orden_firma === 0 ? 'Libre' : rol.orden_firma}
                    </Text>
                    </div>
                    <Popconfirm title="¿Quitar este rol?"
                    onConfirm={() => quitarRol(rol.id)}
                    okText="Sí" cancelText="No">
                    <Button size="small" danger>Quitar</Button>
                    </Popconfirm>
                </div>
            ))}
          </div>
        </div>

        <Divider />

        {rolesDisponibles.length > 0 && (
          <div>
            <Text strong>Agregar rol:</Text>
            <div style={{ marginTop: 8 }}>
              {rolesDisponibles.map(rol => (
                <AgregarRolForm key={rol.id} rol={rol} onAgregar={agregarRol} />
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function AgregarRolForm({ rol, onAgregar }) {
  const [orden, setOrden] = useState(0)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0', borderBottom: '1px solid #f0f0f0'
    }}>
      <Tag color="purple">{rol.nombre}</Tag>
      <Text type="secondary" style={{ fontSize: 12 }}>Orden:</Text>
      <InputNumber
        min={0} max={98} value={orden}
        onChange={v => setOrden(v)}
        size="small" style={{ width: 70 }}
      />
      <Text type="secondary" style={{ fontSize: 11 }}>
        {orden === 0 ? '(libre)' : `(espera orden ${orden - 1})`}
      </Text>
      <Button size="small" type="primary"
        style={{ background: '#004A2F', borderColor: '#004A2F' }}
        onClick={() => onAgregar(rol.id, orden)}>
        Agregar
      </Button>
    </div>
  )
}