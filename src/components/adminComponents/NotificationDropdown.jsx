import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

const ACTION_META = {
  add:    { label: 'Added',   color: 'bg-green-100 text-green-600',  dot: 'bg-green-500' },
  update: { label: 'Updated', color: 'bg-blue-100 text-blue-600',    dot: 'bg-blue-500'  },
  delete: { label: 'Deleted', color: 'bg-red-100 text-red-600',      dot: 'bg-red-500'   },
};

const formatTimeAgo = (ts) => {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState(() => {
    const stored = localStorage.getItem('notif_last_seen');
    return stored ? parseInt(stored) : 0;
  });
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Realtime listener on activityLogs
  useEffect(() => {
    const q = query(
      collection(db, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map((doc) => {
        const data = doc.data();
        const ts = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
        return { id: doc.id, ...data, ts };
      });
      setNotifications(logs);

      // Count items newer than last seen
      const newCount = logs.filter((n) => n.ts > lastSeenAt).length;
      setUnreadCount(newCount);
    }, (err) => {
      console.error('Notification listener error:', err);
    });

    return () => unsub();
  }, [lastSeenAt]);

  const handleToggle = () => {
    if (!isOpen) {
      // Mark all as read
      const now = Date.now();
      setLastSeenAt(now);
      setUnreadCount(0);
      localStorage.setItem('notif_last_seen', String(now));
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-500 hover:text-green-600 transition-colors focus:outline-none rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Activity Log</h3>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
              {notifications.length} recent
            </span>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-slate-500">
                <svg className="mx-auto h-8 w-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                No activity yet
              </div>
            ) : (
              notifications.map((notif) => {
                const meta = ACTION_META[notif.action] || ACTION_META.update;
                const isNew = notif.ts > lastSeenAt - 1000; // highlight briefly
                return (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isNew && unreadCount > 0 ? 'bg-green-50/40 dark:bg-green-900/10' : ''}`}
                  >
                    {/* Colored dot */}
                    <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                        <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded mr-1 ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="font-medium">{notif.entity}</span>
                        {notif.label ? <span className="text-gray-500 dark:text-slate-400"> — {notif.label}</span> : null}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400 dark:text-slate-500">{formatTimeAgo(notif.ts)}</p>
                        {notif.performedBy && (
                          <p className="text-xs text-gray-400 dark:text-slate-500">by {notif.performedBy}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-center">
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">Synced in realtime</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
