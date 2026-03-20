import { ClearOutlined, SendOutlined } from '@ant-design/icons';
import { App, Button, Card, Flex, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarkdownContent } from '../../components/MarkdownContent';

const { Text, Title, Paragraph } = Typography;

export const ChatPage = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) {
      message.warning('请先输入内容');
      return;
    }

    setIsLoading(true);
    setResult('');
    try {
      const reply = await window.assistantApi.llm.chat(text);
      setResult(reply || '（空回复）');
      setPrompt('');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      setResult(`错误：${errMessage}`);
      message.error('发送失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearMemory = async () => {
    try {
      await window.assistantApi.memory.clear();
      setResult('');
      setPrompt('');
      message.success('已清空本地对话记忆');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(errMessage);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          对话
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          结合<strong>人设</strong>与本地短期记忆：用自然语言描述人设即可保存；说「恢复默认人设」等可还原。提醒可说「下午两点提醒我看书」。
        </Paragraph>
      </div>

      <Card bordered={false} styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入消息…"
            autoSize={{ minRows: 4, maxRows: 10 }}
            onPressEnter={(e) => {
              if (e.shiftKey) return;
              e.preventDefault();
              void handleSend();
            }}
          />
          <Flex wrap="wrap" gap="small" justify="space-between">
            <Button onClick={() => navigate('/page/home')}>回首页</Button>
            <Space wrap>
              <Button icon={<ClearOutlined />} onClick={() => void handleClearMemory()}>
                清空记忆
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={isLoading}
                onClick={() => void handleSend()}
              >
                发送
              </Button>
            </Space>
          </Flex>
        </Space>
      </Card>

      <Card
        size="small"
        title="回复"
        bordered={false}
        styles={{
          body: {
            minHeight: 120,
            background: '#fafafa',
            borderRadius: 8,
          },
        }}
      >
        {result ? <MarkdownContent source={result} /> : <Text type="secondary">尚无回复</Text>}
      </Card>
    </Space>
  );
};
