import { Navigate, Route, Routes } from 'react-router-dom';
import Home from '@/pages/home';
import Room from '@/pages/room';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:sessionId" element={<Room />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
