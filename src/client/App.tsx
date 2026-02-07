import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '@/client/routes/Home';
import Settings from '@/client/routes/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* トップページにアクセスしたら Home を表示 */}
        <Route path="/" element={<Home />} />
        
        {/* /settings にアクセスしたら Settings を表示 */}
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}