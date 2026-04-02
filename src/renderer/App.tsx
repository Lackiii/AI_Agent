import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ChatHistoryPage } from './features/chat/ChatHistoryPage';
import { ChatPage } from './features/chat/ChatPage';
import { HomePage } from './features/home/HomePage';
import { DesktopPetPage } from './features/pet/DesktopPetPage';
import { RemindersPage } from './features/reminders/RemindersPage';
import { RegionPickerPage } from './features/screenshots/RegionPickerPage';
import { ScreenshotsPage } from './features/screenshots/ScreenshotsPage';

const App = () => {
  return (
    <Routes>
      <Route path="/page/region-picker" element={<RegionPickerPage />} />
      <Route path="/page/pet" element={<DesktopPetPage />} />
      <Route element={<AppShell />}>
        <Route path="/page/home" element={<HomePage />} />
        <Route path="/page/chat" element={<ChatPage />} />
        <Route path="/page/chat-history" element={<ChatHistoryPage />} />
        <Route path="/page/reminders" element={<RemindersPage />} />
        <Route path="/page/screenshots" element={<ScreenshotsPage />} />
        <Route path="/" element={<Navigate to="/page/home" replace />} />
        <Route path="*" element={<Navigate to="/page/home" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
