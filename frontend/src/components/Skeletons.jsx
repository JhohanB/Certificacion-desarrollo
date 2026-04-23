import React from 'react'
import { Spin, Typography } from 'antd'

const { Text } = Typography

export const PageSkeleton = ({ title = 'Cargando...' }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: 16
  }}>
    <Spin size="large" />
    <Text type="secondary">{title}</Text>
  </div>
)

export const TableSkeleton = () => (
  <div style={{ padding: 24 }}>
    <div style={{ marginBottom: 16 }}>
      <div style={{ height: 32, background: '#f0f0f0', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 20, background: '#f0f0f0', borderRadius: 4, width: '60%' }} />
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} style={{
        display: 'flex',
        gap: 16,
        marginBottom: 12,
        padding: 12,
        border: '1px solid #f0f0f0',
        borderRadius: 6
      }}>
        <div style={{ height: 16, background: '#f0f0f0', borderRadius: 4, flex: 1 }} />
        <div style={{ height: 16, background: '#f0f0f0', borderRadius: 4, flex: 1 }} />
        <div style={{ height: 16, background: '#f0f0f0', borderRadius: 4, flex: 1 }} />
        <div style={{ height: 16, background: '#f0f0f0', borderRadius: 4, width: 80 }} />
      </div>
    ))}
  </div>
)