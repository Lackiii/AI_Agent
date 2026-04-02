import { ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import mascotImage from '../../assets/mascot.png';

const { Title, Paragraph, Text } = Typography;

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          欢迎回来
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          主人，拉文杜拉在这儿。从对话开始，或使用侧栏进入提醒与截图轨迹。
        </Paragraph>
      </div>

      <Card variant="borderless" styles={{ body: { padding: 24, height: '100%' } }}>
        <Space orientation="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
          <img
            src={mascotImage}
            alt="拉文杜拉看板娘"
            style={{
              width: 180,
              height: 180,
              borderRadius: 16,
              objectFit: 'cover',
              margin: '0 auto',
              boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
            }}
          />
          <Text type="secondary">今天怎么样？</Text>
          <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => navigate('/page/chat')}>
            开始对话
          </Button>
        </Space>
      </Card>
    </Space>
  );
};
