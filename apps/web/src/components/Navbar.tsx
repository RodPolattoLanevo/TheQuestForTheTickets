import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/world", label: "World Map" },
  { to: "/shop", label: "Shop" },
  { to: "/achievements", label: "Achievements" },
  { to: "/quests", label: "Quests" },
  { to: "/leaderboard", label: "Leaderboard" },
];

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-40 border-b-[3px] border-black bg-ink-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4 lg:gap-6">
          <span className="whitespace-nowrap font-display text-[10px] text-gold-400 lg:text-xs">
            <span className="lg:hidden">⚔ HUNT</span>
            <span className="hidden lg:inline">⚔ The Hunt for the Tickets</span>
          </span>
          <div className="hidden gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                    isActive ? "bg-ink-700 text-gold-400" : "text-slate-300 hover:bg-ink-800 hover:text-slate-100"
                  }`
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    {isActive ? "▶ " : ""}
                    {l.label}
                  </>
                )}
              </NavLink>
            ))}
            {user?.role === "ADMIN" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                    isActive ? "bg-ink-700 text-ember-400" : "text-ember-400/80 hover:bg-ink-800"
                  }`
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    {isActive ? "▶ " : ""}
                    Admin
                  </>
                )}
              </NavLink>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-400 sm:inline">{user?.displayName}</span>
          <button className="btn-secondary !px-3 !py-1 text-[10px]" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
