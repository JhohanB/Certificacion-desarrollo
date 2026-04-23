import React from 'react'
import { Skeleton, Card, Row, Col, Typography } from 'antd'

const { Title } = Typography

const PageSkeleton = ({ title }) => (
  <div style={{ padding: 24 }}>
    {title && <Title level={2} style={{ marginBottom: 24 }}>{title}</Title>}
    <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 24 }} />
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {[...Array(4)].map((_, i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Card style={{ borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Col>
      ))}
    </Row>
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Card title={<Skeleton active paragraph={{ rows: 1, width: '30%' }} />} style={{ borderRadius: 12 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </Col>
    </Row>
  </div>
)

export default PageSkeleton