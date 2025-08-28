// src/App.jsx
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import GlobalNavbar from "./components/GlobalNavbar";

import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Dashboard from "./pages/Dashboard";
import Reset from "./pages/Reset"; // <-- make sure this file exists

function Layout({ children }) {
  const loc = useLocation();
  // Hide the global navbar on the dashboard only (per your earlier setup)
  const hideNavbar = loc.pathname.startsWith("/dashboard");
  return (
    <>
      {!hideNavbar && <GlobalNavbar />}
      {children}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/reset" element={<Reset />} />   {/* <-- This fixes /reset */}
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Optional catch-all */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
