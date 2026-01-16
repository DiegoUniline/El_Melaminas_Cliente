import { 
  Users, 
  UserPlus, 
  CreditCard, 
  BarChart3, 
  Settings, 
  LogOut,
  Home,
  History,
  Wifi,
  Tag,
  CalendarClock,
  Receipt,
  MessageCircle,
  Shield,
  Smartphone
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, type Module } from '@/hooks/usePermissions';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  module: Module;
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', icon: Home, href: '/dashboard', module: 'dashboard' },
  { title: 'Prospectos', icon: UserPlus, href: '/prospects', module: 'prospects' },
  { title: 'Historial Prospectos', icon: History, href: '/prospects/history', module: 'prospects_history' },
  { title: 'Clientes', icon: Users, href: '/clients', module: 'clients' },
  { title: 'Mensualidades', icon: Receipt, href: '/mensualidades', module: 'mensualidades' },
  { title: 'Pagos', icon: CreditCard, href: '/payments', module: 'payments' },
  { title: 'Agenda Servicios', icon: CalendarClock, href: '/services', module: 'services' },
  { title: 'Chat Interno', icon: MessageCircle, href: '/chat', module: 'chat' },
];

const adminNavItems: NavItem[] = [
  { title: 'Catálogos', icon: Tag, href: '/catalogs', module: 'catalogs' },
  { title: 'Reportes', icon: BarChart3, href: '/reports', module: 'reports' },
  { title: 'Configuración', icon: Settings, href: '/settings', module: 'settings' },
];

export function AppSidebar() {
  const { profile, isAdmin, signOut } = useAuth();
  const { canView } = usePermissions();
  const location = useLocation();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Filter nav items based on permissions (admins see all)
  const visibleMainItems = mainNavItems.filter(item => isAdmin || canView(item.module));
  const visibleAdminItems = adminNavItems.filter(item => isAdmin || canView(item.module));

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Wifi className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">Skynet</h1>
            <p className="text-xs text-sidebar-foreground/70">Sistema de Gestión ISP</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href}
                  >
                    <NavLink to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.href}
                    >
                      <NavLink to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {/* Permissions link - admin only */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/permissions'}
                  >
                    <NavLink to="/permissions">
                      <Shield className="h-4 w-4" />
                      <span>Permisos</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* Technician Dashboard link */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/technician'}
                  >
                    <NavLink to="/technician">
                      <Smartphone className="h-4 w-4" />
                      <span>Vista Técnico</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
              {profile?.full_name ? getInitials(profile.full_name) : '??'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || 'Usuario'}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">
              {isAdmin ? 'Administrador' : 'Empleado'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
