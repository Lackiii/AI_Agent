import { ReloadOutlined } from '@ant-design/icons';
import { App, Button, Card, List, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage } from '../../../shared/types/llm';
import { MarkdownContent } from '../../components/MarkdownContent';

const { Title, Paragraph, Text } = Typography;

export const ChatHistoryPage = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.assistantApi.memory.list();
      setRows(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          对话历史
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          只读查看本地已保存的对话轮次（与「对话」页使用的记忆相同）。清空记忆请在对话页操作。
        </Paragraph>
      </div>

      <Card bordered={false} styles={{ body: { padding: 20 } }}>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            刷新
          </Button>
          <Button onClick={() => navigate('/page/chat')}>去对话</Button>
        </Space>

        {!loading && rows.length === 0 ? (
          <Text type="secondary">暂无记录。在「对话」中发送消息后会出现在这里。</Text>
        ) : (
          <List
            loading={loading}
            dataSource={rows}
            renderItem={(item, index) => (
              <List.Item style={{ paddingLeft: 0, paddingRight: 0, borderBlockEnd: '1px solid #f0f0f0' }}>
                <div style={{ width: '100%' }}>
                  <Space size="small" style={{ marginBottom: 8 }}>
                    <Text type="secondary">#{index + 1}</Text>
                    <Tag color={item.role === 'user' ? 'blue' : 'green'}>
                      {item.role === 'user' ? '你' : '助手'}
                    </Tag>
                  </Space>
                  {item.role === 'assistant' ? (
                    <MarkdownContent source={item.content} />
                  ) : (
                    <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                      {item.content}
                    </Paragraph>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
};
