import { NavLink } from "react-router-dom";
import { Home, Library, Search } from "lucide-react";

const items = [
  { to: "/", label: "Home", Icon: Home, end: true },
  { to: "/search", label: "Search", Icon: Search, end: false },
  { to: "/library", label: "Library", Icon: Library, end: false },
];

export function BottomNav() {
  return (
    <nav className="glass pb-safe border-x-0 border-b-0" aria-label="Main">
      <ul className="mx-auto flex max-w-xl justify-around">
        {items.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-w-20 flex-col items-center gap-1 px-4 py-2.5 text-[11px] font-medium transition ${
                  isActive ? "text-fog" : "text-dim hover:text-mist"
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
