import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ChatPage } from './features/chat/ChatPage';
import { HomePage } from './features/home/HomePage';
import { RemindersPage } from './features/reminders/RemindersPage';
import { ScreenshotsPage } from './features/screenshots/ScreenshotsPage';

const App = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/page/home" element={<HomePage />} />
        <Route path="/page/chat" element={<ChatPage />} />
        <Route path="/page/reminders" element={<RemindersPage />} />
        <Route path="/page/screenshots" element={<ScreenshotsPage />} />
        <Route path="/" element={<Navigate to="/page/home" replace />} />
        <Route path="*" element={<Navigate to="/page/home" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
