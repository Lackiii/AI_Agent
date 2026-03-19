import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ChatPage = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    const message = prompt.trim();
    if (!message) {
      setResult('Please enter a message first.');
      return;
    }

    setIsLoading(true);
    setResult('Waiting for LLM response...');
    try {
      const reply = await window.deepseekApi.chat(message);
      setResult(reply || '(Empty response)');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      setResult(`Error: ${errMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container">
      <header className="page-header">
        <h1>拉文杜拉</h1>
      </header>

      <section className="panel">
        <p className="hint">有什么可以帮您的吗？</p>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="来和拉文杜拉聊天吧……"
          rows={6}
        />
        <div className="actions">
          <button className="btn-secondary" onClick={() => navigate('/page/home')}>
            返回首页
          </button>
          <button onClick={handleSend} disabled={isLoading}>
            Send
          </button>
        </div>
        <pre className="result">{result}</pre>
      </section>
    </main>
  );
};

export default ChatPage;
