import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Card, Flex, List, Popconfirm, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage } from '../../../shared/types/llm';
import { MarkdownContent } from '../../components/MarkdownContent';
import './ChatHistoryPage.css';

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

  const removeMessage = useCallback(
    async (messageId: string) => {
      try {
        const ok = await window.assistantApi.memory.remove(messageId);
        if (ok) {
          message.success('已删除');
          void load();
        } else {
          message.warning('未找到该条，可能已删除');
          void load();
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败');
      }
    },
    [message, load],
  );

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          对话历史
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          与「对话」页共用同一份本地记忆。可删除单条；桌面通知触发的内容会带「桌面通知」标记。清空全部请在对话页操作。
        </Paragraph>
      </div>

      <Card variant="borderless" styles={{ body: { padding: 20 } }}>
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
              <List.Item
                key={item.id ?? index}
                className="chat-history-list-item"
                style={{ paddingLeft: 0, paddingRight: 0, borderBlockEnd: '1px solid #f0f0f0' }}
              >
                <div style={{ width: '100%' }}>
                  <Flex justify="space-between" align="flex-start" gap={8}>
                    <Space size="small" style={{ marginBottom: 8, flex: 1, minWidth: 0 }}>
                      <Text type="secondary">#{index + 1}</Text>
                      <Tag color={item.role === 'user' ? 'blue' : 'green'}>
                        {item.role === 'user' ? '你' : '助手'}
                      </Tag>
                    </Space>
                    {item.id ? (
                      <span className="chat-history-delete-wrap" style={{ flexShrink: 0 }}>
                        <Popconfirm
                          title="从记忆中删除这一条？"
                          okText="删除"
                          cancelText="取消"
                          onConfirm={() => void removeMessage(item.id as string)}
                        >
                          <Button
                            type="text"
                            size="small"
                            className="chat-history-delete-btn"
                            aria-label="删除此条记忆"
                            icon={<DeleteOutlined className="chat-history-delete-icon" />}
                          />
                        </Popconfirm>
                      </span>
                    ) : null}
                  </Flex>
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
