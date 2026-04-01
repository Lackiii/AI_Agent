import { CameraOutlined, ClockCircleFilled, ClockCircleOutlined, DatabaseOutlined, DeleteOutlined, DownOutlined, FullscreenExitOutlined, FullscreenOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Card, Dropdown, Empty, Flex, Input, InputNumber, List, MenuProps, Popconfirm, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { OcrEngineStatus, ScreenshotCaptureStatus, ScreenshotRecord } from '../../../shared/types/domain';
import './ScreenshotsPage.css';

const { Title, Paragraph, Text } = Typography;
const formatLocalDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
};

export const ScreenshotsPage = () => {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState<ScreenshotRecord[]>([]);
  const [status, setStatus] = useState<ScreenshotCaptureStatus>({ running: false });
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [ocrEngine, setOcrEngine] = useState<OcrEngineStatus | null>(null);
  const [isTiming, setIsTiming] = useState(true);
  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [list, s] = await Promise.all([
        window.assistantApi.screenshots.list(),
        window.assistantApi.screenshots.status(),
      ]);
      setRows(list);
      setStatus(s);
      try {
        const ocrStatus = await window.assistantApi.screenshots.ocrStatus();
        setOcrEngine(ocrStatus);
      } catch {
        setOcrEngine({ available: false, engine: 'PaddleOCR', error: 'OCR 状态接口不可用' });
      }
      if (s.intervalMinutes) {
        setIntervalMinutes(s.intervalMinutes);
      }
      setWindowStart(s.windowStart || '');
      setWindowEnd(s.windowEnd || '');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status.running) return;
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [status.running, refresh]);

  const handleCaptureNow = async () => {
    setLoading(true);
    try {
      await window.assistantApi.screenshots.captureNow();
      message.success('截图与 OCR 已提交');
      await refresh();
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`立即截图失败：${errMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePickRegion = async () => {
    setLoading(true);
    try {
      const picked = await window.assistantApi.screenshots.pickRegion();
      if (!picked) {
        message.info('已取消框选');
        return;
      }
      message.success(`已设置截图范围：x=${picked.x}, y=${picked.y}, w=${picked.width}, h=${picked.height}`);
      await refresh({ silent: true });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`框选失败：${errMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearRegion = async () => {
    setLoading(true);
    try {
      await window.assistantApi.screenshots.clearRegion();
      message.success('已清除截图范围（恢复全屏 OCR）');
      await refresh({ silent: true });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`清除失败：${errMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if ((windowStart && !windowEnd) || (!windowStart && windowEnd)) {
      message.warning('采集窗口需同时填写开始和结束时间');
      return;
    }
    setLoading(true);
    try {
      const next = await window.assistantApi.screenshots.start({
        intervalMinutes,
        windowStart: windowStart || undefined,
        windowEnd: windowEnd || undefined,
      });
      setStatus(next);
      const windowText = next.windowStart && next.windowEnd ? `，窗口 ${next.windowStart}-${next.windowEnd}` : '';
      message.success(`已开启定时截图（每 ${next.intervalMinutes || intervalMinutes} 分钟${windowText}）`);
      await refresh({ silent: true });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`启动失败：${errMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const next = await window.assistantApi.screenshots.stop();
      setStatus(next);
      message.success('已停止定时截图');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`停止失败：${errMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const ok = await window.assistantApi.screenshots.remove(id);
      if (ok) {
        message.success('已删除截图记录');
      } else {
        message.warning('未找到该截图记录');
      }
      await refresh();
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`删除失败：${errMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    try {
      const deletedCount = await window.assistantApi.screenshots.removeAll();
      message.success(`已删除 ${deletedCount} 条截图记录`);
      await refresh();
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      message.error(`一键删除失败：${errMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredRows = normalizedKeyword
    ? rows.filter((r) => (r.ocrText || '').toLowerCase().includes(normalizedKeyword))
    : rows;
  const getOcrStatusLabel = (record: ScreenshotRecord): string => {
    if (record.ocrStatus === 'ok') return '识别成功';
    if (record.ocrStatus === 'no_text') return '未识别到文字';
    if (record.ocrStatus === 'engine_unavailable') return 'OCR 未安装';
    if (record.ocrStatus === 'backend_unreachable') return '后端不可达';
    if (record.ocrStatus === 'ocr_error') return 'OCR 报错';
    return '状态未知';
  };
  const getOcrStatusColor = (record: ScreenshotRecord): 'success' | 'warning' | 'error' | 'default' => {
    if (record.ocrStatus === 'ok') return 'success';
    if (record.ocrStatus === 'no_text') return 'warning';
    if (record.ocrStatus === 'engine_unavailable' || record.ocrStatus === 'backend_unreachable' || record.ocrStatus === 'ocr_error') return 'error';
    return 'default';
  };

  const handleDeleteAllConfirm = () => {
    modal.confirm({
      title: '确定清空所有截图记录？',
      content: '清空后不可恢复。',
      okText: '清空',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleDeleteAll(),
    });
  };

  const toolMenuItems: MenuProps['items'] = [{
    key: 'vault',
    label: '框选范围',
    icon: <FullscreenExitOutlined />,
    onClick: () => void handlePickRegion(),
    disabled: loading
  },
  {
    key: 'clear',
    label: '清除范围',
    icon: <FullscreenOutlined />,
    disabled: !status.captureRegion || loading,
    onClick: () => void handleClearRegion(),
  },
  {
    key: 'time',
    label: '定时截图',
    icon: isTiming ? <ClockCircleFilled /> : <ClockCircleOutlined />,
    onClick: () => setIsTiming(!isTiming)
  },
  {
    key: 'delete',
    label: '一键删除',
    icon: <DeleteOutlined />,
    onClick: () => void handleDeleteAllConfirm(),
    disabled: loading,
    danger: true,
  }
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          截图轨迹
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          支持定时截图、OCR 入库与按 OCR 文本检索轨迹。
        </Paragraph>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          OCR 引擎：
          {ocrEngine?.available ? (
            <Tag color="success" style={{ marginInlineStart: 8 }}>
              {ocrEngine.engine} 可用
            </Tag>
          ) : (
            <Tag color="error" style={{ marginInlineStart: 8 }}>
              {ocrEngine?.engine || 'PaddleOCR'} 不可用
            </Tag>
          )}
          {!ocrEngine?.available && ocrEngine?.error ? `（${ocrEngine.error}）` : ''}
        </Paragraph>
      </div>

      <Card variant="borderless">
        <Flex wrap="wrap" gap="small" justify="space-between">
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>
            刷新
          </Button>
          <Space>
            <Dropdown
              menu={{ items: toolMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button icon={<DatabaseOutlined />}>
                工具箱 <DownOutlined />
              </Button>
            </Dropdown>
            <Button icon={<CameraOutlined />} onClick={() => void handleCaptureNow()} loading={loading}>
              立即截图
            </Button>
          </Space>
        </Flex>
        <Space style={{ paddingTop: 8 }}>
        <Text type="secondary">
          状态：
          {status.running
            ? `运行中（每 ${status.intervalMinutes || 5} 分钟${status.windowStart && status.windowEnd ? `，${status.windowStart}-${status.windowEnd}` : ''
            }）`
            : '已停止'}
          {status.captureRegion
            ? `，范围 x=${status.captureRegion.x} y=${status.captureRegion.y} w=${status.captureRegion.width} h=${status.captureRegion.height}`
            : '，范围=全屏'}
        </Text>
        </Space>
      </Card>

      {isTiming && (
        <Card variant="borderless">
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <InputNumber
                min={1}
                max={240}
                value={intervalMinutes}
                onChange={(v) => setIntervalMinutes(Number(v || 5))}
                addonAfter="分钟"
                style={{ width: 160 }}
              />
              <Input
                placeholder="开始时间 HH:mm（可选）"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                style={{ width: 180 }}
              />
              <Input
                placeholder="结束时间 HH:mm（可选）"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                style={{ width: 180 }}
              />
            </Space>
            <Input
              allowClear
              placeholder="按 OCR 文本检索轨迹（关键词）"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            {status.lastCapturedAt ? (
              <Text type="secondary">
                最近截图：{formatLocalDateTime(status.lastCapturedAt)}
              </Text>
            ) : null}
          </Space>
          <Flex justify="end" style={{ marginTop: 8 }}>
            {status.running ? (
              <Button danger icon={<PauseCircleOutlined />} onClick={() => void handleStop()} loading={loading}>
                停止定时截图
              </Button>
            ) : (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => void handleStart()} loading={loading}>
                开启定时截图
              </Button>
            )}
          </Flex>
        </Card>)
      }

      <Card variant="borderless">
        {filteredRows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无截图记录" />
        ) : (
          <List
            dataSource={filteredRows}
            renderItem={(r) => (
              <List.Item
                className="screenshots-list-item"
                actions={[
                  <span key="delete" className="screenshots-delete-wrap" style={{ flexShrink: 0 }}>
                    <Popconfirm
                      title="删除这条截图记录？"
                      description="删除后不可恢复"
                      okText="删除"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => void handleDelete(r.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        className="screenshots-delete-btn"
                        aria-label="删除截图记录"
                        icon={<DeleteOutlined className="screenshots-delete-icon" />}
                      />
                    </Popconfirm>
                  </span>,
                ]}
              >
                <List.Item.Meta
                  title={<Text code>{formatLocalDateTime(r.capturedAt)}</Text>}
                  description={
                    <Space direction="vertical" size={2}>
                      <Tag color={getOcrStatusColor(r)} style={{ width: 'fit-content' }}>
                        {getOcrStatusLabel(r)}
                      </Tag>
                      <Text>{r.ocrText || '（无 OCR 文本）'}</Text>
                      {r.ocrError ? <Text type="danger">错误：{r.ocrError}</Text> : null}
                      {r.filePath ? <Text type="secondary">文件：{r.filePath}</Text> : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
};
