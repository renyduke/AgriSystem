import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";

const Sidebar = () => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showVegetablesDropdown, setShowVegetablesDropdown] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved != null) setCollapsed(saved === "true");
  }, []);

  // Update CSS variable used by AdminLayout
  useEffect(() => {
    const expandedWidth = 240; // px
    const collapsedWidth = 64; // px
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${collapsed ? collapsedWidth : expandedWidth}px`
    );
  }, [collapsed]);

  const dropdownVariants = {
    hidden: { opacity: 0, height: 0, transition: { duration: 0.18 } },
    visible: { opacity: 1, height: "auto", transition: { duration: 0.18 } },
  };

  const itemVariants = {
    initial: { opacity: 0.95, scale: 1 },
    active: { opacity: 1, scale: 1.03, transition: { duration: 0.12 } },
    hover: { scale: 1.03, transition: { duration: 0.10 } },
  };

  const popupVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
    setShowLogoutPopup(false);
  };
  const handleCancelLogout = () => setShowLogoutPopup(false);

  // Widths in px
  const expandedWidth = 240;
  const collapsedWidth = 64;

  return (
    <>
      {/* Fixed sidebar: top 0, full viewport height */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? collapsedWidth : expandedWidth }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="bg-green-700 text-white fixed top-0 left-0 h-screen p-4 flex flex-col border-r border-gray-700 box-border overflow-visible z-40"
        aria-expanded={!collapsed}
      >
        {/* Top area: logo + title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div
              className={`bg-white/10 rounded-md p-1 flex-shrink-0 ${
                collapsed ? "w-8 h-8" : "w-10 h-10"
              } flex items-center justify-center`}
            >
              <img
                src="/logo.png"
                alt="Logo"
                className={`${collapsed ? "w-6 h-6" : "w-8 h-8"} object-cover`}
              />
            </div>

            <motion.span
              initial={false}
              animate={{ opacity: collapsed ? 0 : 1 }}
              className={`ml-2 font-semibold text-sm overflow-hidden whitespace-nowrap`}
              style={{ width: collapsed ? 0 : "auto" }}
            >
              Admin
            </motion.span>
          </div>
        </div>

        {/* Single absolute toggle (chevrons) */}
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.setItem("admin_sidebar_collapsed", String(next));
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className="absolute -right-4 top-4 z-50 bg-green-700 text-white p-1.5 rounded-full shadow-md hover:bg-green-800 transition flex items-center justify-center"
          style={{ width: 36, height: 36 }}
        >
          {collapsed ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>

        {/* Scrollable nav container inside fixed sidebar */}
        <div className="flex-1 overflow-y-auto pt-2 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <ul className="space-y-2">
            <li className="text-xs text-gray-200/70 font-semibold mb-2">HOME</li>

            {/* Home */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${
                    isActive ? "bg-green-600" : ""
                  }`
                }
                onMouseEnter={() => setTooltip(collapsed ? "home" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                {({ isActive }) => (
                  <motion.div
                    variants={itemVariants}
                    animate={isActive ? "active" : "initial"}
                    className="flex items-center gap-2 w-full"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>

                    <span className={`transition-all duration-150 ${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
                      Home
                    </span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* Dashboard */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/analysis"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${
                    isActive ? "bg-green-600" : ""
                  }`
                }
                onMouseEnter={() => setTooltip(collapsed ? "dashboard" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zM9 19V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Dashboard</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* Maps */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/maps"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${
                    isActive ? "bg-green-600" : ""
                  }`
                }
                onMouseEnter={() => setTooltip(collapsed ? "maps" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 0V7m6 10l5.553 2.776A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>

                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Maps</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* Vegetables dropdown */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <div
                className="flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 cursor-pointer"
                onClick={() => setShowVegetablesDropdown((s) => !s)}
                onMouseEnter={() => setTooltip(collapsed ? "vegetables" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18z" />
                </svg>
                <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Vegetables</span>
              </div>

              <AnimatePresence>
                {showVegetablesDropdown && (
                  <motion.ul
                    className={`ml-6 space-y-1 mt-1 ${collapsed ? "ml-2" : ""}`}
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink to="/home/vegetables" className={({ isActive }) => `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`}>
                        {({ isActive }) => (
                          <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8" />
                            </svg>
                            <span className="text-xs">Vegetable Management</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>

                    <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink to="/home/suggest-farmer" className={({ isActive }) => `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`}>
                        {({ isActive }) => (
                          <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span className="text-xs">Farmer Listing</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.li>

            <li className="text-xs text-gray-200/70 font-semibold mb-2 mt-4">APPS</li>

            {/* Farmer Profile */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink to="/home/farmer" className={({ isActive }) => `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`} onMouseEnter={() => setTooltip(collapsed ? "farmer" : null)} onMouseLeave={() => setTooltip(null)}>
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Farmer Profile</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* User Management */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink to="/home/usermanagement" className={({ isActive }) => `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`} onMouseEnter={() => setTooltip(collapsed ? "usermanagement" : null)} onMouseLeave={() => setTooltip(null)}>
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>User Management</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* Farmer Registration */}
            <motion.li className="relative" variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink to="/home/farmerregister" className={({ isActive }) => `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`} onMouseEnter={() => setTooltip(collapsed ? "farmer-registration" : null)} onMouseLeave={() => setTooltip(null)}>
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Farmer Registration</span>
                  </motion.div>
                )}
              </NavLink>
              <AnimatePresence>
                {tooltip === "farmer-registration" && collapsed && (
                  <motion.div className="absolute left-full top-0 mt-1 ml-2 bg-gray-800 text-white text-xs p-2 rounded w-48 z-10" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
                    Register new farmers to the system, capturing their details and crops.
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>

            {/* Disaster Report */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink to="/home/desaster" className={({ isActive }) => `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`} onMouseEnter={() => setTooltip(collapsed ? "desaster" : null)} onMouseLeave={() => setTooltip(null)}>
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Disaster Report</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            <li className="text-xs text-gray-200/70 font-semibold mb-2 mt-4">OTHER</li>

            {/* Reports */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink to="/home/reports" className={({ isActive }) => `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`} onMouseEnter={() => setTooltip(collapsed ? "reports" : null)} onMouseLeave={() => setTooltip(null)}>
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Reports</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* Settings */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/settings"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`
                }
                onMouseEnter={() => setTooltip(collapsed ? "settings" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Settings</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* Logout */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <div
                className="flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 cursor-pointer"
                onClick={() => setShowLogoutPopup(true)}
                onMouseEnter={() => setTooltip(collapsed ? "logout" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                <motion.div variants={itemVariants} className="flex items-center gap-2 w-full">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Logout</span>
                </motion.div>
              </div>
            </motion.li>
          </ul>
        </div>
      </motion.aside>

      {/* Tooltips placeholder */}
      <AnimatePresence>
        {tooltip && collapsed && (
          <motion.div
            key={tooltip}
            className="fixed z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Logout Pop-up */}
      <AnimatePresence>
        {showLogoutPopup && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-white bg-opacity-95 text-black p-6 rounded-2xl shadow-lg max-w-md w-full mx-4"
              variants={popupVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <h2 className="text-2xl font-bold mb-4 text-center">Logout</h2>
              <p className="text-center mb-6">Are you sure you want to log out?</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                >
                  <LogOut className="w-5 h-5" />
                  Confirm Logout
                </button>
                <button
                  onClick={handleCancelLogout}
                  className="bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;