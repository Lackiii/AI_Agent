import { App, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';

/**
 * 简约风：紧凑密度 + 低饱和主色 + 浅灰背景（对齐 Ant Design 主题定制能力）
 * @see docs/llms.txt → customize-theme / ConfigProvider
 */
export const AppTheme = ({ children }: { children: ReactNode }) => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.compactAlgorithm,
        token: {
          colorPrimary: '#64748b',
          borderRadius: 8,
          colorBgLayout: '#f4f4f5',
          colorBgContainer: '#ffffff',
          fontSize: 14,
        },
        components: {
          Layout: {
            bodyBg: '#f4f4f5',
            headerBg: '#ffffff',
            siderBg: '#fafafa',
          },
          Menu: {
            itemBorderRadius: 8,
            iconSize: 16,
          },
          Card: {
            paddingLG: 20,
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
};
