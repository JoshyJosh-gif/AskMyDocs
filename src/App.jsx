// src/App.jsx
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import GlobalNavbar from "./components/GlobalNavbar";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Reset from "./pages/Reset";
import Dashboard from "./pages/Dashboard";

function Frame() {
  const loc = useLocation();
  // Hide global navbar on dashboard if you only want the dashboard’s own header
  const hideGlobalOn = ["/dashboard"];
  const showGlobal = !hideGlobalOn.some(p => loc.pathname.startsWith(p));

  return (
    <>
      {showGlobal && <GlobalNavbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Frame />
    </BrowserRouter>
  );
}
