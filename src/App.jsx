// src/App.jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { bootstrapSession } from "./lib/supabase";

import GlobalNavbar from "./components/GlobalNavbar";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Dashboard from "./pages/Dashboard";

// Layout wrapper so the navbar re-evaluates on every route change
function Shell() {
  const loc = useLocation();
  const hideGlobalOnDashboard = loc.pathname.startsWith("/dashboard"); // keep Dashboard's own header
  return (
    <>
      {!hideGlobalOnDashboard && <GlobalNavbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </>
  );
}

export default function App() {
  useEffect(() => {
    // pulls session from another tab if available
    bootstrapSession();
  }, []);

  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
