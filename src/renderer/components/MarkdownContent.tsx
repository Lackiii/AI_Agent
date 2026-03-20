import { theme, Typography } from 'antd';
import type { Components } from 'react-markdown';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { useToken } = theme;

type CodeProps = React.ComponentPropsWithoutRef<'code'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * 使用 react-markdown + remark-gfm 解析内容，并用 Ant Design 的 Typography / theme token 做样式，
 * 与 ConfigProvider 主题一致（antd 核心无独立 Markdown 组件时的常见做法）。
 */
export const MarkdownContent = ({ source }: { source: string }) => {
  const { token } = useToken();

  const components: Components = {
    h1: ({ children }) => <Typography.Title level={4}>{children}</Typography.Title>,
    h2: ({ children }) => <Typography.Title level={5}>{children}</Typography.Title>,
    h3: ({ children }) => <Typography.Title level={5}>{children}</Typography.Title>,
    h4: ({ children }) => (
      <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXXS }}>
        {children}
      </Typography.Text>
    ),
    p: ({ children }) => (
      <Typography.Paragraph style={{ marginBottom: token.marginXS }}>{children}</Typography.Paragraph>
    ),
    a: ({ href, children }) => (
      <Typography.Link href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Typography.Link>
    ),
    ul: ({ children }) => (
      <ul style={{ margin: `0 0 ${token.marginXS}px`, paddingLeft: token.paddingLG }}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol style={{ margin: `0 0 ${token.marginXS}px`, paddingLeft: token.paddingLG }}>{children}</ol>
    ),
    li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
    blockquote: ({ children }) => (
      <blockquote
        style={{
          margin: `${token.marginSM}px 0`,
          paddingLeft: token.paddingSM,
          borderLeft: `3px solid ${token.colorPrimary}`,
          color: token.colorTextSecondary,
        }}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <div
        role="separator"
        style={{ margin: `${token.marginSM}px 0`, borderTop: `1px solid ${token.colorSplit}` }}
      />
    ),
    table: ({ children }) => (
      <div style={{ overflowX: 'auto', marginBottom: token.marginSM }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          padding: token.paddingXS,
          background: token.colorFillAlter,
          textAlign: 'left' as const,
        }}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: token.paddingXS }}>
        {children}
      </td>
    ),
    pre: ({ children }) => (
      <pre
        style={{
          margin: `0 0 ${token.marginSM}px`,
          padding: token.paddingSM,
          background: token.colorFillTertiary,
          borderRadius: token.borderRadiusLG,
          overflow: 'auto',
          fontSize: token.fontSizeSM,
          fontFamily: token.fontFamilyCode,
        }}
      >
        {children}
      </pre>
    ),
    code: ({ className, children, ...props }: CodeProps) => {
      const isBlock = /language-[\w-]+/.test(className || '');
      if (isBlock) {
        return (
          <code className={className} style={{ fontFamily: 'inherit', whiteSpace: 'pre' }} {...props}>
            {children}
          </code>
        );
      }
      return <Typography.Text code>{children}</Typography.Text>;
    },
  };

  return (
    <div style={{ color: token.colorText, wordBreak: 'break-word' as const }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
};
