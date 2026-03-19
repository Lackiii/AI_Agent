import { Navigate, Route, Routes } from 'react-router-dom';
import ChatPage from './pages/chat';
import HomePage from './pages/home';

const App = () => {
  return (
    <Routes>
      <Route path="/page/home" element={<HomePage />} />
      <Route path="/page/chat" element={<ChatPage />} />
      <Route path="/" element={<Navigate to="/page/home" replace />} />
      <Route path="*" element={<Navigate to="/page/home" replace />} />
    </Routes>
  );
};

export default App;
