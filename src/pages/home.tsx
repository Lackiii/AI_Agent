import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <main className="container">
      <header className="page-header">
        <h1>首页</h1>
        <p className="hint">主人，欢迎回家！拉文杜拉等您好久啦~</p>
      </header>

      <section className="panel center-panel">
        <p className="hint">今天怎么样，Balsam？</p>
        <button onClick={() => navigate('/page/chat')}>开始对话</button>
      </section>
    </main>
  );
};

export default HomePage;
