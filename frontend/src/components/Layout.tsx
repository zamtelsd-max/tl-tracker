import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bell, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  alertCount?: number;
  rightAction?: ReactNode;
}

export default function Layout({
  children,
  title = 'TL Tracker',
  subtitle,
  showBack = false,
  backTo,
  alertCount = 0,
  rightAction,
}: LayoutProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="zamtel-gradient text-white shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button onClick={handleBack} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                <ArrowLeft size={20} />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                ZT
              </div>
            )}
            <div>
              <h1 className="text-base font-bold leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-green-100">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {rightAction}
            {alertCount > 0 && (
              <button
                onClick={() => navigate('/tl')}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-4 h-4 bg-[#E4007C] text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Role badge */}
        {user && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
              {user.role}
            </span>
            <span className="text-xs text-green-100">{user.name}</span>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-6">{children}</main>
    </div>
  );
}
