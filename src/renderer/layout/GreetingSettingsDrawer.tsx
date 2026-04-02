import { Alert, App, Button, Drawer, Radio, Slider, Space, Switch, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { GreetingIntervalMode, GreetingSettingsDTO } from '../../shared/types/greeting';
import type { DesktopPetSettingsDTO } from '../../shared/types/pet';

const { Paragraph, Text } = Typography;

const INTERVAL_OPTIONS: { value: GreetingIntervalMode; label: string }[] = [
  { value: '5m', label: '每 5 分钟' },
  { value: '10m', label: '每 10 分钟' },
  { value: '30m', label: '每 30 分钟' },
  { value: '1h', label: '每 1 小时' },
  { value: 'random', label: '随机（每次在 5 / 10 / 30 / 60 分钟里抽一档）' },
];

const sliderToNumber = (value: number | [number, number]): number =>
  Array.isArray(value) ? value[0] : value;

type Props = {
  open: boolean;
  onClose: () => void;
};

export const GreetingSettingsDrawer = ({ open, onClose }: Props) => {
  const { message } = App.useApp();
  const [settings, setSettings] = useState<GreetingSettingsDTO | null>(null);
  const [petSettings, setPetSettings] = useState<DesktopPetSettingsDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        window.assistantApi.greeting.getSettings(),
        window.assistantApi.pet.getSettings(),
      ]);
      setSettings(s);
      setPetSettings(p);
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

  const persistPet = async (patch: Partial<DesktopPetSettingsDTO>) => {
    try {
      const next = await window.assistantApi.pet.setSettings(patch);
      setPetSettings(next);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存桌宠设置失败');
    }
  };

  const sendTest = async () => {
    setTestSending(true);
    try {
      const r = await window.assistantApi.greeting.sendTestNotification();
      if (r.ok === false) {
        message.error(r.error);
        return;
      }
      message.success('已请求发送测试通知，请看屏幕右下角或通知中心');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送失败');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <Drawer
      title="设置"
      placement="right"
      size={360}
      onClose={onClose}
      open={open}
      destroyOnHidden={false}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="关于 Token"
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
            <Space orientation="vertical" size={10}>
              {INTERVAL_OPTIONS.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>

        <Space orientation="vertical">
          <Text strong style={{ display: 'block', paddingBottom: 8 }}>
            测试系统通知（本机通道）
          </Text>
          <Button loading={testSending} onClick={() => void sendTest()}>
            立即发送测试通知
          </Button>
        </Space>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            桌宠设置
          </Text>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space align="center">
              <Text>开机显示桌宠</Text>
              <Switch
                checked={petSettings?.showOnStartup ?? false}
                disabled={petSettings === null}
                onChange={(checked) => void persistPet({ showOnStartup: checked })}
              />
            </Space>

            <div>
              <Text type="secondary">大小：{petSettings?.size ?? 220}px</Text>
              <Slider
                min={140}
                max={420}
                step={10}
                value={petSettings?.size ?? 220}
                disabled={petSettings === null}
                onChange={(value: number | [number, number]) =>
                  setPetSettings((prev) => (prev ? { ...prev, size: sliderToNumber(value) } : prev))
                }
                onChangeComplete={(value: number | [number, number]): void => {
                  void persistPet({ size: sliderToNumber(value) });
                }}
              />
            </div>

            <div>
              <Text type="secondary">透明度：{Math.round((petSettings?.opacity ?? 1) * 100)}%</Text>
              <Slider
                min={35}
                max={100}
                step={1}
                value={Math.round((petSettings?.opacity ?? 1) * 100)}
                disabled={petSettings === null}
                onChange={(value: number | [number, number]) =>
                  setPetSettings((prev) => (prev ? { ...prev, opacity: sliderToNumber(value) / 100 } : prev))
                }
                onChangeComplete={(value: number | [number, number]): void => {
                  void persistPet({ opacity: sliderToNumber(value) / 100 });
                }}
              />
            </div>
          </Space>
        </div>
      </Space>
    </Drawer>
  );
};
