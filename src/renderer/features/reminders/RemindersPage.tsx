import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, List, Space, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { Reminder } from '../../../shared/types/domain';

const { Title, Paragraph, Text } = Typography;

export const RemindersPage = () => {
  const { message } = App.useApp();
  const [items, setItems] = useState<Reminder[]>([]);
  const [form] = Form.useForm();

  const refresh = useCallback(async () => {
    const list = await window.assistantApi.reminders.list();
    setItems(list);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onFinish = async (values: { title: string; dueAt?: string }) => {
    const title = values.title?.trim();
    if (!title) {
      message.warning('请填写提醒内容');
      return;
    }
    try {
      await window.assistantApi.reminders.create({
        title,
        dueAt: values.dueAt?.trim() || undefined,
        rawText: title,
      });
      form.resetFields();
      message.success('已添加');
      await refresh();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '添加失败');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await window.assistantApi.reminders.remove(id);
      message.success('已删除');
      await refresh();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          提醒
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          本地 JSON 存储；后续可对接 SQLite / 后端。
        </Paragraph>
      </div>

      <Card bordered={false} title="新建" styles={{ body: { paddingBottom: 8 } }}>
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="title" label="内容" rules={[{ required: true, message: '请输入提醒内容' }]}>
            <Input placeholder="例如：下午开会" allowClear />
          </Form.Item>
          <Form.Item name="dueAt" label="时间（可选）" extra="ISO 格式，如 2026-03-20T09:00:00">
            <Input placeholder="留空则仅作备忘" allowClear />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card bordered={false} title="列表">
        <List
          locale={{ emptyText: '暂无提醒' }}
          dataSource={items}
          renderItem={(r) => (
            <List.Item
              actions={[
                <Button key="del" type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => void handleRemove(r.id)}>
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={r.title}
                description={
                  r.dueAt ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {r.dueAt}
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      无定时
                    </Text>
                  )
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
};
