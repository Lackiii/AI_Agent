import { ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          欢迎回来
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          主人，拉文杜拉在这儿。从对话开始，或使用侧栏进入提醒与截图轨迹。
        </Paragraph>
      </div>

      <Card bordered={false} styles={{ body: { padding: 24 } }}>
        <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
          <Text type="secondary">今天怎么样？</Text>
          <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => navigate('/page/chat')}>
            开始对话
          </Button>
        </Space>
      </Card>
    </Space>
  );
};
