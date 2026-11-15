import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Communication from './pages/Communication.jsx';
import Recovery from './pages/Recovery.jsx';
import MyTasks from './pages/MyTasks.jsx';
import CustomerStatus from './pages/CustomerStatus.jsx';

const ROLES = ['manager', 'technician', 'customer'];

const ROLE_PAGES = {
  manager: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/communication', label: 'Communication' },
    { path: '/recovery', label: 'Recovery' },
  ],
  technician: [{ path: '/my-tasks', label: 'My Tasks' }],
  customer: [{ path: '/status', label: 'Status page' }],
};

const defaultPath = (role) => ROLE_PAGES[role][0].path;
const isAllowed = (role, path) => ROLE_PAGES[role].some((p) => p.path === path);

export default function App() {
  // Role lives in component state only: not persisted, reset to manager on reload.
  const [role, setRole] = useState('manager');
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  function changeRole(next) {
    setRole(next);
    if (!isAllowed(next, path)) navigate(defaultPath(next), { replace: true });
  }

  // /status is public and always reachable; other pages must match the role.
  const guard = (target, element) =>
    isAllowed(role, target) ? element : <Navigate to={defaultPath(role)} replace />;

  return (
    <div className="app">
      <header className="topbar">
        <h1>CyberRecover</h1>
        <nav className="nav">
          {ROLE_PAGES[role].map((p) => (
            <NavLink key={p.path} to={p.path} className={({ isActive }) => (isActive ? 'active' : '')}>
              {p.label}
            </NavLink>
          ))}
        </nav>
        <label className="role-switcher">
          Role{' '}
          <select value={role} onChange={(e) => changeRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to={defaultPath(role)} replace />} />
          <Route path="/dashboard" element={guard('/dashboard', <Dashboard />)} />
          <Route path="/communication" element={guard('/communication', <Communication />)} />
          <Route path="/recovery" element={guard('/recovery', <Recovery />)} />
          <Route path="/my-tasks" element={guard('/my-tasks', <MyTasks />)} />
          <Route path="/status" element={<CustomerStatus />} />
          <Route path="*" element={<Navigate to={defaultPath(role)} replace />} />
        </Routes>
      </main>
    </div>
  );
}
