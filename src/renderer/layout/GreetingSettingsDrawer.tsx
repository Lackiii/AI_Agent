import { Alert, App, Drawer, Radio, Space, Switch, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { GreetingIntervalMode, GreetingSettingsDTO } from '../../shared/types/greeting';

const { Paragraph, Text } = Typography;

const INTERVAL_OPTIONS: { value: GreetingIntervalMode; label: string }[] = [
  { value: '5m', label: '每 5 分钟' },
  { value: '10m', label: '每 10 分钟' },
  { value: '30m', label: '每 30 分钟' },
  { value: '1h', label: '每 1 小时' },
  { value: 'random', label: '随机（每次在 5 / 10 / 30 / 60 分钟里抽一档）' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export const GreetingSettingsDrawer = ({ open, onClose }: Props) => {
  const { message } = App.useApp();
  const [settings, setSettings] = useState<GreetingSettingsDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await window.assistantApi.greeting.getSettings();
      setSettings(s);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const persist = async (patch: Partial<GreetingSettingsDTO>) => {
    try {
      const next = await window.assistantApi.greeting.setSettings(patch);
      setSettings(next);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  return (
    <Drawer
      title="定时问候"
      placement="right"
      width={360}
      onClose={onClose}
      open={open}
      destroyOnClose={false}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="关于 Token"
          description="开启后，每到间隔会调用一次大模型生成问候，并弹出系统通知。关闭后不会请求模型。"
        />

        <div>
          <Space align="center" style={{ marginBottom: 12 }}>
            <Text strong>启用定时问候</Text>
            <Switch
              checked={settings?.enabled ?? false}
              loading={loading && settings === null}
              disabled={settings === null}
              onChange={(checked) => void persist({ enabled: checked })}
            />
          </Space>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
            默认关闭；打开后从保存时起算，等待所选间隔后发送第一次问候。
          </Paragraph>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            问候间隔
          </Text>
          <Radio.Group
            value={settings?.intervalMode ?? '30m'}
            disabled={settings === null}
            onChange={(e) => void persist({ intervalMode: e.target.value as GreetingIntervalMode })}
          >
            <Space direction="vertical" size={10}>
              {INTERVAL_OPTIONS.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>
      </Space>
    </Drawer>
  );
};
