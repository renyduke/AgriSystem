import React, { useState, useEffect } from "react";
import Sidebar from "../components/adminComponents/Sidebar";
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

  // header height if you have fixed header; 0 if none
  const headerHeight = 0;

  return (
    <div className="min-h-screen">
      {/* If you have a Header, put it here */}
      {/* <Header collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} /> */}

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* main: no page-level scrollbar visible (inner wrapper scrolls) */}
      <main
        className="transition-all duration-200"
        style={{
          marginLeft: "var(--sidebar-width, 240px)",
          padding: "1.5rem",
          minHeight: `calc(100vh - ${headerHeight}px)`,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* inner scrollable area with hidden scrollbar using Tailwind arbitrary selectors */}
        <div className="h-full min-h-[calc(100vh-0px)] overflow-y-scroll [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
