import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '@/client/routes/Home';
import Settings from '@/client/routes/Settings';
import Admin from '@/client/routes/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}