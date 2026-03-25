import {
  ClearOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownOutlined,
  FileSearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { App, Button, Card, Dropdown, Empty, Flex, Input, List, Modal, Popconfirm, Space, Spin, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarkdownContent } from '../../components/MarkdownContent';

import './ChatPage.css';

const { Text, Title, Paragraph } = Typography;

export const ChatPage = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultFiles, setVaultFiles] = useState<string[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPath, setPreviewPath] = useState('');
  const [previewContent, setPreviewContent] = useState('');

  const [vaultDeleteConfirmPath, setVaultDeleteConfirmPath] = useState<string | null>(null);

  const loadVaultList = useCallback(async () => {
    setVaultLoading(true);
    try {
      const files = await window.assistantApi.vault.list();
      setVaultFiles(files);
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`加载已存资料失败：${errMessage}`);
    } finally {
      setVaultLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (vaultOpen) {
      void loadVaultList();
    }
  }, [vaultOpen, loadVaultList]);

  const openVaultPreview = async (relPath: string) => {
    setPreviewPath(relPath);
    setPreviewContent('');
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const r = await window.assistantApi.vault.read(relPath);
      setPreviewContent(r.content);
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`读取失败：${errMessage}`);
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeleteVaultFile = useCallback(
    async (relPath: string) => {
      try {
        await window.assistantApi.vault.delete(relPath);
        message.success('已删除文件');
        if (previewPath === relPath) {
          setPreviewOpen(false);
          setPreviewPath('');
          setPreviewContent('');
        }
        await loadVaultList();
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        message.error(`删除失败：${errMessage}`);
      }
    },
    [message, previewPath, loadVaultList],
  );

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

  const memoryMenuItems: MenuProps['items'] = [
    {
      key: 'vault',
      label: '查看已存资料',
      icon: <FileSearchOutlined />,
      onClick: () => setVaultOpen(true),
    },
    {
      key: 'clear',
      label: '清空记忆',
      icon: <ClearOutlined />,
      danger: true,
      onClick: () => void handleClearMemory(),
    },
  ];

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          对话
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          结合<strong>人设</strong>与本地短期记忆：用自然语言描述人设即可保存；说「恢复默认人设」等可还原。提醒可说「下午两点提醒我看书」。可让助手把随笔存入资料夹。
        </Paragraph>
      </div>

      <Card variant="borderless" styles={{ body: { padding: 20 } }}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
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
              <Dropdown menu={{ items: memoryMenuItems }} placement="bottomRight" trigger={['click']}>
                <Button icon={<DatabaseOutlined />}>
                  记忆与资料 <DownOutlined />
                </Button>
              </Dropdown>
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
        variant="borderless"
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

      <Modal
        title="已存储的资料（AI 资料夹）"
        open={vaultOpen}
        onCancel={() => setVaultOpen(false)}
        footer={[
          <Button key="refresh" onClick={() => void loadVaultList()} loading={vaultLoading}>
            刷新
          </Button>,
          <Button key="close" type="primary" onClick={() => setVaultOpen(false)}>
            关闭
          </Button>,
        ]}
        width={520}
        destroyOnHidden
      >
        <Spin spinning={vaultLoading}>
          {vaultFiles.length === 0 ? (
            <Empty description="暂无文件，可在对话中让助手保存随笔" />
          ) : (
            <List
              size="small"
              dataSource={vaultFiles}
              renderItem={(item) => (
                <List.Item
                  className={`chatPageVaultRow${
                    vaultDeleteConfirmPath === item ? ' chatPageVaultRow--confirmOpen' : ''
                  }`}
                  actions={[
                    <span key="delete" className="chatPageVaultDeleteWrap">
                      <Popconfirm
                        title="确定删除此文件？"
                        description={item}
                        okText="删除"
                        okButtonProps={{ danger: true }}
                        cancelText="取消"
                        onOpenChange={(open) => setVaultDeleteConfirmPath(open ? item : null)}
                        onConfirm={() => void handleDeleteVaultFile(item)}
                      >
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </span>,
                  ]}
                >
                  <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => void openVaultPreview(item)}>
                    {item}
                  </Button>
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Modal>

      <Modal
        title={previewPath || '内容预览'}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={
          <Space>
            <Popconfirm
              title="确定删除此文件？"
              description={previewPath}
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              disabled={!previewPath || previewLoading}
              onConfirm={() => void handleDeleteVaultFile(previewPath)}
            >
              <Button danger disabled={!previewPath || previewLoading}>
                删除文件
              </Button>
            </Popconfirm>
            <Button type="primary" onClick={() => setPreviewOpen(false)}>
              关闭
            </Button>
          </Space>
        }
        width={720}
        destroyOnHidden
        zIndex={1100}
      >
        <Spin spinning={previewLoading}>
          <Paragraph
            style={{
              marginBottom: 0,
              maxHeight: '60vh',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
            }}
          >
            {previewContent || (previewLoading ? '' : '（空）')}
          </Paragraph>
        </Spin>
      </Modal>
    </Space>
  );
};
