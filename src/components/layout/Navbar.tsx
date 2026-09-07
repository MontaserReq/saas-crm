'use client';

import { UserSession } from '@/types';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationDropdown } from './NotificationDropdown';
import { Search, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { logoutAction } from '@/server/actions/auth';
import Link from 'next/link';
import { useDialog } from '@/lib/dialog/context';

interface NavbarProps {
  user: UserSession;
  notifications?: any[];
}

export function Navbar({ user, notifications = [] }: NavbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const router = useRouter();
  const { t } = useI18n();
  const { confirm } = useDialog();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (searchQuery.trim().length < 2) { setResults([]); return; }
      const response = await fetch(`/api/global-search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (response.ok) setResults((await response.json()).results || []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tickets?search=${encodeURIComponent(searchQuery.trim())}`);
      setResults([]);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: t('nav.logout'),
      message: 'Are you sure you want to log out? / هل أنت متأكد أنك تريد تسجيل الخروج؟',
      confirmText: t('nav.logout'),
      cancelText: t('common.cancel'),
      isDestructive: true,
    });
    if (!confirmed) return;
    await logoutAction();
    router.push('/login');
    router.refresh();
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-20">
      {/* Global Search Bar */}
      <form onSubmit={handleSearch} className="relative w-48 sm:w-72 lg:w-96">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('tickets.searchPlaceholder')}
          className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
        />
      </form>
      {results.length > 0 && <div className="absolute top-14 start-4 w-[min(24rem,calc(100vw-2rem))] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">{results.map(result => <Link key={`${result.type}-${result.id}`} href={result.href} onClick={() => setResults([])} className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"><span className="text-[10px] text-brand-600 font-bold uppercase">{result.type}</span><span className="block text-sm font-semibold truncate">{result.title}</span><span className="block text-xs text-slate-400 truncate">{result.subtitle}</span></Link>)}</div>}

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationDropdown initialNotifications={notifications} />

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* User Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 rtl:pl-0 rtl:pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
              {user.name.charAt(0)}
            </div>
            <div className="text-left rtl:text-right">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-400 block">{user.departmentName}</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-52 rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden z-50">
              {/* User info header */}
              <div className="px-4 py-3 bg-brand-50 dark:bg-brand-950/30 border-b border-brand-100 dark:border-brand-900/40">
                <p className="text-xs font-bold text-brand-800 dark:text-brand-200">{user.name}</p>
                <p className="text-[10px] text-brand-600 dark:text-brand-400">{user.email}</p>
              </div>

              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <User className="w-4 h-4 text-brand-500" />
                  <span>{t('nav.profile')}</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Settings className="w-4 h-4 text-brand-500" />
                  <span>{t('nav.settings')}</span>
                </Link>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
