import {
  BellOutlined,
  CameraOutlined,
  CommentOutlined,
  HistoryOutlined,
  HomeOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { GreetingSettingsDrawer } from './GreetingSettingsDrawer';

const { Sider, Content } = Layout;

const menuKeys = [
  '/page/home',
  '/page/chat',
  '/page/chat-history',
  '/page/reminders',
  '/page/screenshots',
] as const;

export const AppShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [greetingDrawerOpen, setGreetingDrawerOpen] = useState(false);

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (menuKeys.includes(path as (typeof menuKeys)[number])) {
      return path;
    }
    return '/page/home';
  }, [location.pathname]);

  useEffect(() => {
    const off = window.assistantApi.navigation.onAppNavigate((path) => {
      navigate(path);
    });
    return off;
  }, [navigate]);

  return (
    <Layout
      style={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      <Sider
        width={216}
        theme="light"
        style={{
          borderRight: '1px solid rgba(0,0,0,0.06)',
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
          }}
        >
          <div style={{ padding: '20px 16px 12px' }}>
            <Typography.Title level={5} style={{ margin: 0, fontWeight: 600 }}>
              拉文杜拉
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              智能记忆助手
            </Typography.Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ borderInlineEnd: 'none', flex: 1 }}
            items={[
              { key: '/page/home', icon: <HomeOutlined />, label: '首页' },
              { key: '/page/chat', icon: <CommentOutlined />, label: '对话' },
              { key: '/page/chat-history', icon: <HistoryOutlined />, label: '对话历史' },
              { key: '/page/reminders', icon: <BellOutlined />, label: '提醒' },
              { key: '/page/screenshots', icon: <CameraOutlined />, label: '截图轨迹' },
            ]}
            onClick={({ key }) => navigate(key)}
          />
          <div style={{ padding: '12px 16px 16px' }}>
            <Button
              type="text"
              block
              icon={<SmileOutlined />}
              onClick={() => setGreetingDrawerOpen(true)}
              style={{ textAlign: 'left', height: 'auto', padding: '8px 12px', whiteSpace: 'normal' }}
            >
              设置
            </Button>
          </div>
        </div>
      </Sider>
      <GreetingSettingsDrawer open={greetingDrawerOpen} onClose={() => setGreetingDrawerOpen(false)} />
      <Layout
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        <Content
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            margin: 0,
            padding: 24,
            maxWidth: 880,
            width: '100%',
            marginInline: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
