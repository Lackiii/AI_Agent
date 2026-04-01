import { Button, Card, Space, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

const { Text } = Typography;

type Region = { x: number; y: number; width: number; height: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const normalizeRect = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, width: right - left, height: bottom - top };
};

export const RegionPickerPage = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);

  const rect = useMemo(() => {
    if (!start || !end) return null;
    return normalizeRect(start, end);
  }, [start, end]);

  const toRegionInThumbnailSpace = (r: { left: number; top: number; width: number; height: number }): Region => {
    // Must match `desktopCapturer.thumbnailSize` in main process.
    const THUMB_W = 1600;
    const THUMB_H = 900;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const sx = THUMB_W / vw;
    const sy = THUMB_H / vh;

    const x = Math.round(clamp(r.left * sx, 0, THUMB_W - 1));
    const y = Math.round(clamp(r.top * sy, 0, THUMB_H - 1));
    const width = Math.round(clamp(r.width * sx, 0, THUMB_W - x));
    const height = Math.round(clamp(r.height * sy, 0, THUMB_H - y));
    return { x, y, width, height };
  };

  const cancel = async () => {
    await window.assistantApi.screenshots.cancelPickRegion();
  };

  const confirm = async () => {
    if (!rect || rect.width < 10 || rect.height < 10) {
      await window.assistantApi.screenshots.submitPickRegion(null);
      return;
    }
    const region = toRegionInThumbnailSpace(rect);
    await window.assistantApi.screenshots.submitPickRegion(region);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void cancel();
      if (e.key === 'Enter') void confirm();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const getLocalPoint = (clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return { x: clientX, y: clientY };
    const box = el.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.20)',
        cursor: dragging ? 'crosshair' : 'default',
        userSelect: 'none',
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        const p = getLocalPoint(e.clientX, e.clientY);
        setStart(p);
        setEnd(p);
        setDragging(true);
      }}
      onMouseMove={(e) => {
        if (!dragging) return;
        const p = getLocalPoint(e.clientX, e.clientY);
        setEnd(p);
      }}
      onMouseUp={(e) => {
        if (!dragging) return;
        const p = getLocalPoint(e.clientX, e.clientY);
        setEnd(p);
        setDragging(false);
      }}
    >
      {rect ? (
        <div
          style={{
            position: 'absolute',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            border: '2px solid rgba(255,255,255,0.95)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            background: 'rgba(255,255,255,0.03)',
          }}
        />
      ) : null}

      <div
        style={{ position: 'absolute', top: 16, left: 16, right: 16 }}
        // Prevent clicks on the toolbar from resetting the selection.
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        <Card
          size="small"
          bordered={false}
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(6px)',
            maxWidth: 760,
          }}
        >
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Text strong>拖拽框选要进行 OCR 的屏幕区域</Text>
            <Text type="secondary">
              提示：尽量避开浏览器标签栏/地址栏。按 Enter 确认，Esc 取消。
            </Text>
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onMouseDown={(e) => e.stopPropagation()} onClick={() => void cancel()}>
                取消
              </Button>
              <Button onMouseDown={(e) => e.stopPropagation()} type="primary" onClick={() => void confirm()}>
                确认使用该范围
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    </div>
  );
};

