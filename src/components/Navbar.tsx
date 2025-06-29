import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, Users, Settings, ListChecks, KanbanSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import UserMenu from './UserMenu';

interface NavItemProps {
  to: string;
  children: React.ReactNode;
  exact?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, children, exact }) => {
  const location = useLocation();
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
        hover:bg-sidebar-hover hover:text-sidebar-foreground
        ${isActive ? 'bg-sidebar-hover text-sidebar-foreground' : 'text-sidebar-foreground/80'}`}
    >
      {children}
    </NavLink>
  );
};

const Navbar: React.FC = () => {
  const { currentEmployee } = useAuth();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header with logo and user menu */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold">KitchenPro</h1>
        </div>
        <UserMenu />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto">
        <NavItem to="/" exact>
          <Home className="w-4 h-4" />
          <span>Dashboard</span>
        </NavItem>
        <NavItem to="/projects">
          <ListChecks className="w-4 h-4" />
          <span>Projects</span>
        </NavItem>
        <NavItem to="/tasks">
          <KanbanSquare className="w-4 h-4" />
          <span>Tasks</span>
        </NavItem>
        {currentEmployee?.role === 'admin' && (
          <NavItem to="/employees">
            <Users className="w-4 h-4" />
            <span>Employees</span>
          </NavItem>
        )}
        {currentEmployee?.role === 'admin' && (
          <NavItem to="/settings">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </NavItem>
        )}
        {currentEmployee?.role === 'manager' && (
          <NavItem to="/employees">
            <Users className="w-4 h-4" />
            <span>Employees</span>
          </NavItem>
        )}
        {currentEmployee?.role === 'manager' && (
          <NavItem to="/settings">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </NavItem>
        )}
        {currentEmployee?.role === 'teamleader' && (
          <NavItem to="/tasks">
            <KanbanSquare className="w-4 h-4" />
            <span>Tasks</span>
          </NavItem>
        )}
        {currentEmployee?.role === 'installation_team' && (
          <NavItem to="/tasks">
            <KanbanSquare className="w-4 h-4" />
            <span>Tasks</span>
          </NavItem>
        )}
        {currentEmployee?.role === 'workstation' && (
          <NavItem to="/tasks">
            <KanbanSquare className="w-4 h-4" />
            <span>Tasks</span>
          </NavItem>
        )}
        {currentEmployee?.role === 'worker' && (
          <NavItem to="/tasks">
            <KanbanSquare className="w-4 h-4" />
            <span>Tasks</span>
          </NavItem>
        )}
        <NavItem to="/calendar">
          <Calendar className="w-4 h-4" />
          <span>Calendar</span>
        </NavItem>
      </nav>

      {/* User info at bottom */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar-accent">
        <div className="text-sm">
          <p className="font-medium">{currentEmployee?.name}</p>
          <p className="text-sidebar-foreground/70 capitalize">{currentEmployee?.role}</p>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
