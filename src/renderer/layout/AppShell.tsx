import {
  BellOutlined,
  CameraOutlined,
  CommentOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;

const menuKeys = ['/page/home', '/page/chat', '/page/reminders', '/page/screenshots'] as const;

export const AppShell = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (menuKeys.includes(path as (typeof menuKeys)[number])) {
      return path;
    }
    return '/page/home';
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={216}
        theme="light"
        style={{
          borderRight: '1px solid rgba(0,0,0,0.06)',
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
          style={{ borderInlineEnd: 'none' }}
          items={[
            { key: '/page/home', icon: <HomeOutlined />, label: '首页' },
            { key: '/page/chat', icon: <CommentOutlined />, label: '对话' },
            { key: '/page/reminders', icon: <BellOutlined />, label: '提醒' },
            { key: '/page/screenshots', icon: <CameraOutlined />, label: '截图轨迹' },
          ]}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Content
          style={{
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
