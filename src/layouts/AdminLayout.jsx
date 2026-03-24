import React, { useState, useEffect } from "react";
import Sidebar from "../components/adminComponents/Sidebar";
import Header from "../components/adminComponents/Header";
import { Outlet } from "react-router-dom";

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved != null) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    const expandedWidth = 240;
    const collapsedWidth = 64;
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${collapsed ? collapsedWidth : expandedWidth}px`
    );
  }, [collapsed]);

  // header height if you have fixed header; 64 for h-16
  const headerHeight = 64;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main content wrapper pushes right based on sidebar width */}
      <div 
        className="flex-1 flex flex-col transition-all duration-200"
        style={{ marginLeft: "var(--sidebar-width, 240px)" }}
      >
        <Header />

        {/* main: no page-level scrollbar visible (inner wrapper scrolls) */}
        <main
          className="flex-1"
          style={{
            padding: "0",
            height: `calc(100vh - ${headerHeight}px)`,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {/* inner scrollable area with hidden scrollbar using Tailwind arbitrary selectors */}
          <div className="h-full overflow-y-scroll [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
