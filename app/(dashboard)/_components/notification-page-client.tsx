"use client";

import { useState, useEffect } from "react";
import { getPaginatedNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/actions/notifications";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function NotificationPageClient() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: any[], total: number, totalPages: number }>({
    items: [], total: 0, totalPages: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData(page, filter);
  }, [page, filter]);

  async function loadData(p: number, f: "all" | "unread") {
    setLoading(true);
    try {
      const res = await getPaginatedNotifications(p, f);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllAsRead() {
    await markAllNotificationsAsRead();
    if (filter === "unread") {
      setPage(1);
    }
    loadData(page, filter);
  }

  async function handleNotificationClick(n: any) {
    if (!n.isRead) {
      setData(prev => ({
        ...prev,
        items: prev.items.map(x => x.id === n.id ? { ...x, isRead: true } : x)
      }));
      await markNotificationAsRead(n.id);
    }
    if (n.deepLink) {
      router.push(n.deepLink);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bell className="text-teal" size={24} />
            Notifications
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stay updated with your latest alerts and announcements.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-lg flex text-sm font-medium">
            <button
              onClick={() => { setFilter("all"); setPage(1); }}
              className={cn(
                "px-4 py-1.5 rounded-md transition-all",
                filter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              All
            </button>
            <button
              onClick={() => { setFilter("unread"); setPage(1); }}
              className={cn(
                "px-4 py-1.5 rounded-md transition-all",
                filter === "unread" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Unread
            </button>
          </div>
          
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-sm font-medium transition-colors"
          >
            <Check size={16} />
            <span className="hidden sm:inline">Mark all as read</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading && data.items.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Loading notifications...</div>
        ) : data.items.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-3">
            <CheckCircle2 size={48} className="text-slate-300" />
            <p className="text-lg font-medium text-slate-700">You're all caught up!</p>
            <p className="text-sm">You have no {filter === "unread" ? "unread " : ""}notifications at this time.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "w-full text-left p-4 sm:p-6 hover:bg-slate-50 transition-colors block group",
                  !n.isRead ? "bg-blue-50/30" : ""
                )}
              >
                <div className="flex gap-4">
                  <div className="mt-1">
                    {!n.isRead ? (
                      <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 block" />
                    ) : (
                      <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-slate-200 block" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <p className={cn("text-base text-slate-900", !n.isRead ? "font-semibold" : "font-medium")}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-400 font-medium whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {n.body}
                    </p>
                    
                    {n.deepLink && (
                      <div className="mt-3 flex items-center gap-1 text-sm font-medium text-teal opacity-0 group-hover:opacity-100 transition-opacity">
                        View details <ChevronRight size={14} />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Pagination Footer */}
        {data.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-slate-500 font-medium">
              Showing page {page} of {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
