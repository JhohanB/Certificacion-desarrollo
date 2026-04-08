import { useState, useEffect } from 'react'
import {
  Table, Button, Card, Typography, Tag, Space, Modal,
  Form, Input, Switch, Popconfirm, message, Checkbox, Divider, Tooltip
} from 'antd'
import {
  PlusOutlined, EditOutlined, ReloadOutlined, SettingOutlined
} from '@ant-design/icons'
import api from '../../api/axios'

const { Title, Text } = Typography

// Descripciones de módulos y acciones para mejor comprensión
const DESCRIPCIONES_MODULOS = {
  'SOLICITUDES': 'Acceso al panel de solicitudes de certificación. Permite gestionar y revisar solicitudes.',
  'USUARIOS': 'Acceso al panel de usuarios. Permite administrar cuentas de usuarios.',
  'ROLES': 'Acceso al panel de roles y permisos. Permite configurar roles y asignar permisos.',
  'PLANTILLAS': 'Acceso al panel de plantillas de certificación. Permite crear y editar plantillas.',
  'TIPOS_PROGRAMA': 'Acceso al panel de tipos de programa. Permite gestionar categorías de programas.',
  'DOCUMENTOS': 'Acceso al panel de documentos. Permite subir y gestionar archivos.',
  'REPORTES': 'Acceso al panel de reportes. Permite generar y ver estadísticas.',
  'AUDITORIA': 'Acceso al panel de auditoría. Permite revisar logs de actividades.'
}

const DESCRIPCIONES_ACCIONES = {
  'CREAR': 'Permite crear nuevos elementos (ej: nueva solicitud, nuevo usuario, nueva plantilla).',
  'LEER': 'Permite ver y listar elementos existentes en el módulo.',
  'ACTUALIZAR': 'Permite modificar datos y propiedades de elementos existentes (ej: cambiar nombre, estado o configuración).',
  'EDITAR': 'Permite editar contenido detallado de elementos (ej: modificar texto, archivos o formularios). Nota: Similar a "Actualizar", pero enfocado en edición de contenido.',
  'ELIMINAR': 'Permite eliminar elementos del sistema.',
  'APROBAR': 'Permite aprobar o rechazar solicitudes.',
  'FIRMAR': 'Permite firmar documentos digitalmente.',
  'CERTIFICAR': 'Permite emitir certificados finales.',
  'OBSERVAR': 'Permite agregar observaciones o comentarios.',
  'REVISAR': 'Permite marcar como revisado o confirmado.',
  'EXPORTAR': 'Permite descargar datos o reportes.',
  'IMPORTAR': 'Permite subir datos masivos.',
  'ADMINISTRAR': 'Permite configuraciones avanzadas del módulo.'
}

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [modulos, setModulos] = useState([])
  const [acciones, setAcciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [rolSeleccionado, setRolSeleccionado] = useState(null)

  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalPermisos, setModalPermisos] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [formCrear] = Form.useForm()
  const [formEditar] = Form.useForm()

  const cargar = async () => {
    setCargando(true)
    try {
      const [resRoles, resMods, resAcc] = await Promise.all([
        api.get('/roles/'),
        api.get('/roles/modulos'),
        api.get('/roles/acciones')
      ])
      setRoles(resRoles.data)
      setModulos(resMods.data)
      setAcciones(resAcc.data)
    } catch {
      message.error('Error al cargar roles')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const crearRol = async (values) => {
    setEnviando(true)
    try {
      await api.post('/roles/', values)
      message.success('Rol creado')
      setModalCrear(false)
      formCrear.resetFields()
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al crear')
    } finally {
      setEnviando(false)
    }
  }

  const editarRol = async (values) => {
    setEnviando(true)
    try {
      await api.put(`/roles/${rolSeleccionado.id}`, values)
      message.success('Rol actualizado')
      setModalEditar(false)
      cargar()
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al actualizar')
    } finally {
      setEnviando(false)
    }
  }

  const toggleEstado = async (rol) => {
    try {
        await api.put(`/roles/${rol.id}/estado?activo=${!rol.activo}`)
        message.success(`Rol ${!rol.activo ? 'activado' : 'desactivado'}`)
        cargar()
    } catch (err) {
        message.error(err.response?.data?.detail ?? 'Error al cambiar estado')
    }
  }

  const abrirPermisos = async (rol) => {
    const { data } = await api.get(`/roles/${rol.id}`)
    setRolSeleccionado(data)
    setModalPermisos(true)
  }

  const togglePermiso = async (moduloId, accionId, tienePermiso, permisoId) => {
    try {
      if (tienePermiso) {
        await api.delete(`/roles/${rolSeleccionado.id}/permisos/${permisoId}`)
        message.success('Permiso removido')
      } else {
        await api.post(`/roles/${rolSeleccionado.id}/permisos`, {
          modulo_id: moduloId,
          accion_id: accionId
        })
        message.success('Permiso agregado')
      }
      const { data } = await api.get(`/roles/${rolSeleccionado.id}`)
      setRolSeleccionado(data)
    } catch (err) {
      message.error(err.response?.data?.detail ?? 'Error al actualizar permiso')
    }
  }

  const columnas = [
    {
      title: 'Rol',
      key: 'rol',
      render: (_, record) => (
        <div>
          <Text strong>{record.nombre}</Text>
          {record.descripcion && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>{record.descripcion}</Text></div>
          )}
        </div>
      )
    },
    {
      title: 'Firma',
      dataIndex: 'requiere_firma',
      key: 'requiere_firma',
      render: (v) => <Tag color={v ? 'blue' : 'default'}>{v ? 'Requiere firma' : 'Sin firma'}</Tag>
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      key: 'activo',
      render: (activo) => <Tag color={activo ? 'green' : 'red'}>{activo ? 'Activo' : 'Inactivo'}</Tag>
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />}
            onClick={() => {
              setRolSeleccionado(record)
              formEditar.setFieldsValue({
                nombre: record.nombre,
                descripcion: record.descripcion,
                requiere_firma: record.requiere_firma
              })
              setModalEditar(true)
            }}>
            Editar
          </Button>
          <Button size="small" icon={<SettingOutlined />}
            onClick={() => abrirPermisos(record)}>
            Permisos
          </Button>
          <Popconfirm
            title={`¿${record.activo ? 'Desactivar' : 'Activar'} este rol?`}
            onConfirm={() => toggleEstado(record)}
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
        <Title level={4} style={{ margin: 0 }}>Roles y Permisos</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button>
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => setModalCrear(true)}
            style={{ background: '#004A2F', borderColor: '#004A2F' }}>
            Nuevo rol
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={roles} columns={columnas} rowKey="id"
          loading={cargando} scroll={{ x: 600 }}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No hay roles' }}
        />
      </Card>

      {/* Modal Crear */}
      <Modal title="Nuevo rol" open={modalCrear}
        onCancel={() => { setModalCrear(false); formCrear.resetFields() }}
        footer={null}>
        <Form form={formCrear} layout="vertical" onFinish={crearRol}>
          <Form.Item name="nombre" label="Nombre"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}>
            <Input placeholder="Ej: INSTRUCTOR" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="requiere_firma" label="¿Requiere firma?" valuePropName="checked">
            <Switch />
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
      <Modal title="Editar rol" open={modalEditar}
        onCancel={() => setModalEditar(false)} footer={null}>
        <Form form={formEditar} layout="vertical" onFinish={editarRol}>
          <Form.Item name="nombre" label="Nombre"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="requiere_firma" label="¿Requiere firma?" valuePropName="checked">
            <Switch />
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

      {/* Modal Permisos */}
      <Modal
        title={`Permisos — ${rolSeleccionado?.nombre}`}
        open={modalPermisos}
        onCancel={() => setModalPermisos(false)}
        footer={<Button onClick={() => setModalPermisos(false)}>Cerrar</Button>}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Configura los permisos para este rol. Cada módulo representa un panel del sistema, y las acciones determinan qué operaciones puede realizar el usuario.
            Pasa el mouse sobre cada acción para ver una descripción detallada. Nota: Algunos términos como "Editar" y "Actualizar" pueden parecer similares, pero "Editar" se enfoca en modificar contenido, mientras que "Actualizar" cambia propiedades o estado.
          </Text>
        </div>
        {modulos.map(modulo => {
          const permisosDelModulo = rolSeleccionado?.permisos?.filter(p => p.modulo_id === modulo.id) ?? []
          return (
            <div key={modulo.id} style={{ marginBottom: 16 }}>
              <Text strong style={{ textTransform: 'capitalize' }}>{modulo.nombre}</Text>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {DESCRIPCIONES_MODULOS[modulo.nombre.toUpperCase()] || 'Acceso al módulo correspondiente.'}
                </Text>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {acciones.map(accion => {
                  const permiso = permisosDelModulo.find(p => p.accion_id === accion.id)
                  const tienePermiso = !!permiso
                  return (
                    <Tooltip
                      key={accion.id}
                      title={DESCRIPCIONES_ACCIONES[accion.nombre.toUpperCase()] || `Permite realizar la acción ${accion.nombre.toLowerCase()}.`}
                      placement="top"
                    >
                      <Checkbox
                        checked={tienePermiso}
                        onChange={() => togglePermiso(modulo.id, accion.id, tienePermiso, permiso?.id)}
                      >
                        {accion.nombre}
                      </Checkbox>
                    </Tooltip>
                  )
                })}
              </div>
              <Divider style={{ margin: '12px 0' }} />
            </div>
          )
        })}
      </Modal>
    </div>
  )
}