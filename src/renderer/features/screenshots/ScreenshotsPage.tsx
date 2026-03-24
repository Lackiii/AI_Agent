import { Card, Empty, List, Space, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { ScreenshotRecord } from '../../../shared/types/domain';

const { Title, Paragraph, Text } = Typography;

export const ScreenshotsPage = () => {
  const [rows, setRows] = useState<ScreenshotRecord[]>([]);

  const refresh = useCallback(async () => {
    const list = await window.assistantApi.screenshots.list();
    setRows(list);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          截图轨迹
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          定时截图与 OCR 占位模块；接入后将在此展示时间与摘要。
        </Paragraph>
      </div>

      <Card variant="borderless">
        {rows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无截图记录" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <List.Item>
                <List.Item.Meta
                  title={<Text code>{r.capturedAt}</Text>}
                  description={r.ocrText || '（无 OCR 文本）'}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
};
