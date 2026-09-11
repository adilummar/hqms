"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCircle2, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBellNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/actions/notifications";

interface NotificationBellProps {
  role: string;
}

export function NotificationBell({ role }: NotificationBellProps) {
  // Only parents and students get notifications in Phase 1
  if (role !== "parent" && role !== "student") return null;

  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadData() {
    try {
      const data = await getBellNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }

  async function handleNotificationClick(n: any) {
    if (!n.isRead) {
      // Optimistic update
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await markNotificationAsRead(n.id);
    }
    
    setIsOpen(false);
    if (n.deepLink) {
      router.push(n.deepLink);
    }
  }

  async function handleMarkAllAsRead(e: React.MouseEvent) {
    e.stopPropagation();
    setNotifications(prev => prev.map(x => ({ ...x, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsAsRead();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold border border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-medium text-teal hover:text-teal-700 transition-colors flex items-center gap-1"
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center flex flex-col items-center justify-center text-slate-500 gap-2">
                <CheckCircle2 size={32} className="text-slate-300" />
                <p className="text-sm font-medium">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-slate-50 transition-colors block",
                      !n.isRead && "bg-blue-50/40"
                    )}
                  >
                    <div className="flex gap-3">
                      {!n.isRead && (
                        <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                      )}
                      <div className={cn("flex-1", n.isRead ? "pl-5" : "")}>
                        <p className={cn("text-sm mb-1 text-slate-900", !n.isRead ? "font-semibold" : "font-medium")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wider">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <Link
              href={`/${role}/notifications`}
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1 w-full p-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              View all notifications
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
