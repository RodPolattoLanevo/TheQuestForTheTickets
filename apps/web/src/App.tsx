import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { WorldMap } from "./pages/WorldMap";
import { Shop } from "./pages/Shop";
import { Achievements } from "./pages/Achievements";
import { Quests } from "./pages/Quests";
import { Leaderboard } from "./pages/Leaderboard";
import { Admin } from "./pages/Admin";

function Protected({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <>
      {!loading && user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/world" element={<Protected><WorldMap /></Protected>} />
        <Route path="/shop" element={<Protected><Shop /></Protected>} />
        <Route path="/achievements" element={<Protected><Achievements /></Protected>} />
        <Route path="/quests" element={<Protected><Quests /></Protected>} />
        <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
        <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
