"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { UserSession } from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";

interface MobileLayoutContextType {
  isMobileMenuOpen: boolean;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleMobileMenu: () => void;
}

const MobileLayoutContext = createContext<MobileLayoutContextType | undefined>(undefined);

export function useMobileLayout() {
  const context = useContext(MobileLayoutContext);
  if (!context) {
    throw new Error("useMobileLayout must be used within MobileLayout");
  }
  return context;
}

interface MobileLayoutProps {
  children: ReactNode;
  user: UserSession;
  directManager: { id: string; name: string; isActive: boolean } | null;
  users?: Array<{ id: string; name: string; email: string; reportsToUserId?: string | null; department?: { name: string } | null }>;
}

/**
 * MobileLayout wraps the dashboard layout with mobile-friendly behaviour:
 * - Hamburger FAB button on mobile (<lg)
 * - Slide-in drawer for navigation on mobile
 * - Auto-closes drawer on route change, Escape key, or resize to desktop
 * - Body scroll lock when drawer is open
 *
 * The Sidebar component is rendered twice:
 * 1. Inside MobileLayout's drawer (mobile only, lg:hidden)
 * 2. In the layout's normal flow (desktop only, hidden lg:block)
 */
export function MobileLayout({ children, user, directManager, users = [] }: MobileLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, direction } = useI18n();

  // Close drawer on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isMobileMenuOpen]);

  // Close on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openMobileMenu = () => setIsMobileMenuOpen(true);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  return (
    <MobileLayoutContext.Provider
      value={{ isMobileMenuOpen, openMobileMenu, closeMobileMenu, toggleMobileMenu }}
    >
      {/* Mobile Floating Action Button - hamburger menu */}
      <button
        type="button"
        onClick={toggleMobileMenu}
        aria-label={isMobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={isMobileMenuOpen}
        className={`lg:hidden fixed z-40 ${
          isMobileMenuOpen ? "hidden" : "flex"
        } items-center justify-center w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30 transition-all active:scale-95`}
        style={{
          top: "0.875rem",
          [direction === "rtl" ? "right" : "left"]: "0.875rem",
        } as React.CSSProperties}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Drawer - slides in from the side */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div
            className={`lg:hidden fixed top-0 bottom-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-300 ease-out ${
              isMobileMenuOpen ? "translate-x-0" : direction === "rtl" ? "translate-x-full" : "-translate-x-full"
            }`}
            style={{
              [direction === "rtl" ? "right" : "left"]: 0,
            } as React.CSSProperties}
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.navigation")}
          >
            <div className="h-full flex flex-col bg-white dark:bg-slate-900 shadow-xl">
              <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("nav.navigation")}
                </span>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  aria-label={t("nav.closeMenu")}
                  className="p-2.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar
                  user={user}
                  users={users}
                  directManager={directManager}
                  onNavigate={closeMobileMenu}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {children}
    </MobileLayoutContext.Provider>
  );
}
