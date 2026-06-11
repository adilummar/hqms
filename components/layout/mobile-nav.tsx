"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

interface MobileNavProps {
  role: string;
  username: string;
}

const STORAGE_KEY = "hqms-sidebar-expanded";

export function MobileNav({ role, username }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Start as false to avoid SSR mismatch; corrected on first client effect
  const [isTabletExpanded, setIsTabletExpanded] = useState(false);
  const pathname = usePathname();

  // On mount: read persisted state from localStorage and apply data attribute
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) === "true";
    if (saved) {
      setIsTabletExpanded(true);
      document.documentElement.dataset.sidebarExpanded = "true";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep data attribute + localStorage in sync whenever state changes
  useEffect(() => {
    document.documentElement.dataset.sidebarExpanded = String(isTabletExpanded);
    localStorage.setItem(STORAGE_KEY, String(isTabletExpanded));
  }, [isTabletExpanded]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function toggleTabletSidebar() {
    setIsTabletExpanded((prev) => !prev);
  }

  return (
    <>
      <Sidebar
        role={role}
        username={username}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        isTabletExpanded={isTabletExpanded}
        onTabletToggle={toggleTabletSidebar}
      />

      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <Header
        username={username}
        role={role}
        onMenuToggle={() => setIsOpen((prev) => !prev)}
        isTabletExpanded={isTabletExpanded}
      />
    </>
  );
}
