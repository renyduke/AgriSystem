import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const Sidebar = () => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showVegetablesDropdown, setShowVegetablesDropdown] = useState(false);
  const [showDashboardsDropdown, setShowDashboardsDropdown] = useState(false); // New
  const [showReportsDropdown, setShowReportsDropdown] = useState(false); // New
  const [tooltip, setTooltip] = useState(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("Loading...");
  const navigate = useNavigate();

  // Load user data on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const fullName = userData.fullName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
            setUserName(fullName || "Admin");
          } else {
            setUserName("Admin");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUserName("Admin");
        }
      } else {
        setUserName("Guest");
      }
    });
    return () => unsubscribe();
  }, []);

  // Load persisted collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved != null) setCollapsed(saved === "true");
  }, []);

  // Update CSS variable for layout
  useEffect(() => {
    const expandedWidth = 240;
    const collapsedWidth = 64;
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

  const expandedWidth = 240;
  const collapsedWidth = 64;

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? collapsedWidth : expandedWidth }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="bg-green-700 dark:bg-slate-900 text-white fixed top-0 left-0 h-screen p-4 flex flex-col border-r border-gray-700 dark:border-slate-800 box-border overflow-visible z-50 transition-colors duration-300"
        aria-expanded={!collapsed}
      >
        {/* Logo & Title */}
        <div className="flex items-center mb-8 h-16">
          <div className="flex items-center gap-4 w-full">
            <div
              className={`flex-shrink-0 ${collapsed ? "w-10 h-10" : "w-14 h-14"} flex items-center justify-center transition-all duration-300 bg-white/10 rounded-xl p-1.5 shadow-lg shadow-green-900/20 border border-white/5`}
            >
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>

            <motion.div
              initial={false}
              animate={{ opacity: collapsed ? 0 : 1 }}
              className="overflow-hidden flex flex-col justify-center whitespace-nowrap"
              style={{ width: collapsed ? 0 : "auto" }}
            >
              <span className="font-bold text-[19px] tracking-tight leading-none text-white drop-shadow-sm">
                AgriMap
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-green-100/70 mt-1 leading-none">
                Canlaon City Agriculture
              </span>
            </motion.div>
          </div>
        </div>

        {/* Collapse/Expand Toggle */}
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.setItem("admin_sidebar_collapsed", String(next));
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className="absolute -right-4 top-4 z-[60] bg-green-700 dark:bg-slate-800 text-white p-1.5 rounded-full shadow-md hover:bg-green-800 dark:hover:bg-slate-700 transition flex items-center justify-center border border-green-600 dark:border-slate-700"
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

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto pt-2 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <ul className="space-y-2">
            <li className="text-xs text-gray-200/70 font-semibold mb-2">HOME</li>

            {/* Home */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`
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

            {/* Dashboards Dropdown */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <div
                className="flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 cursor-pointer select-none"
                onClick={() => setShowDashboardsDropdown((s) => !s)}
                onMouseEnter={() => setTooltip(collapsed ? "dashboards" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
                  Dashboards
                </span>
                <motion.svg
                  className="w-3 h-3 ml-auto flex-shrink-0"
                  animate={{ rotate: showDashboardsDropdown ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>

              <AnimatePresence>
                {showDashboardsDropdown && (
                  <motion.ul
                    className={`ml-6 space-y-1 mt-1 ${collapsed ? "ml-2" : ""}`}
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    {/* Dashboard */}
                    <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink
                        to="/home/analysis"
                        className={({ isActive }) =>
                          `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            variants={itemVariants}
                            animate={isActive ? "active" : "initial"}
                            className="flex items-center gap-2 w-full"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zM9 19V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2" />
                            </svg>
                            <span className="text-xs"> Farmer Dashboard</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>

                    {/* V&P Results */}
                    <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink
                        to="/home/dashboard"
                        className={({ isActive }) =>
                          `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            variants={itemVariants}
                            animate={isActive ? "active" : "initial"}
                            className="flex items-center gap-2 w-full"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-xs">V&P Results</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.li>

            {/* Maps */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/maps"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`
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

            {/* Vegetables Dropdown */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <div
                className="flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 cursor-pointer select-none"
                onClick={() => setShowVegetablesDropdown((s) => !s)}
                onMouseEnter={() => setTooltip(collapsed ? "vegetables" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18z" />
                </svg>
                <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Vegetables</span>
                <motion.svg
                  className="w-3 h-3 ml-auto"
                  animate={{ rotate: showVegetablesDropdown ? 180 : 0 }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
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
                      <NavLink
                        to="/home/vegetables"
                        className={({ isActive }) => `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8" />
                          </svg>
                          <span className="text-xs">Vegetable Management</span>
                        </span>
                      </NavLink>
                    </motion.li>

                    <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink
                        to="/home/suggest-farmer"
                        className={({ isActive }) => `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="text-xs">Farmer Listing</span>
                        </span>
                      </NavLink>
                    </motion.li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.li>

            <li className="text-xs text-gray-200/70 font-semibold mb-2 mt-4">APP</li>

            {/* Farmer Profile */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/farmer"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`
                }
                onMouseEnter={() => setTooltip(collapsed ? "farmer" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                {({ isActive }) => (
                  <motion.div
                    variants={itemVariants}
                    animate={isActive ? "active" : "initial"}
                    className="flex items-center gap-2 w-full"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 2a9 9 0 019 9v3H3v-3a9 9 0 019-9zm0 0c-3.866 0-7 3.134-7 7v3h14v-3c0-3.866-3.134-7-7-7zm0 11v6m-3 0h6"
                      />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
                      Farmer Profile
                    </span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            {/* User Management */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/usermanagement"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`
                }
                onMouseEnter={() => setTooltip(collapsed ? "usermanagement" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
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
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/farmerregister"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`
                }
                onMouseEnter={() => setTooltip(collapsed ? "farmer-registration" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Farmer Registration</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            <li className="text-xs text-gray-200/70 font-semibold mb-2 mt-4">ACCOUNT</li>

            {/* My Account */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <NavLink
                to="/home/account"
                className={({ isActive }) =>
                  `flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 ${isActive ? "bg-green-600" : ""}`
                }
                onMouseEnter={() => setTooltip(collapsed ? "account" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                {({ isActive }) => (
                  <motion.div variants={itemVariants} animate={isActive ? "active" : "initial"} className="flex items-center gap-2 w-full">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>My Account</span>
                  </motion.div>
                )}
              </NavLink>
            </motion.li>

            <li className="text-xs text-gray-200/70 font-semibold mb-2 mt-4">OTHER</li>

            {/* Reports Dropdown */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <div
                className="flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 cursor-pointer select-none"
                onClick={() => setShowReportsDropdown((s) => !s)}
                onMouseEnter={() => setTooltip(collapsed ? "reports" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" />
                </svg>
                <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>
                  Reports
                </span>
                <motion.svg
                  className="w-3 h-3 ml-auto flex-shrink-0"
                  animate={{ rotate: showReportsDropdown ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>

              <AnimatePresence>
                {showReportsDropdown && (
                  <motion.ul
                    className={`ml-6 space-y-1 mt-1 ${collapsed ? "ml-2" : ""}`}
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >

                    {/* <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink
                        to="/home/reports"
                        className={({ isActive }) =>
                          `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            variants={itemVariants}
                            animate={isActive ? "active" : "initial"}
                            className="flex items-center gap-2 w-full"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs">Summary Reports</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li> */}

                    {/* Price Report */}
                    <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink
                        to="/home/price"
                        className={({ isActive }) =>
                          `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            variants={itemVariants}
                            animate={isActive ? "active" : "initial"}
                            className="flex items-center gap-2 w-full"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="text-xs">Price Data</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>

                    {/* Volume Report */}
                    <motion.li variants={itemVariants} initial="initial" whileHover="hover">
                      <NavLink
                        to="/home/volume"
                        className={({ isActive }) =>
                          `block p-1 text-xs hover:bg-green-600 rounded ${isActive ? "bg-green-600" : ""}`
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            variants={itemVariants}
                            animate={isActive ? "active" : "initial"}
                            className="flex items-center gap-2 w-full"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="text-xs">Volume Data</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.li>

            {/* Logout */}
            <motion.li variants={itemVariants} initial="initial" whileHover="hover">
              <div
                className="flex items-center gap-2 p-1.5 rounded text-sm hover:bg-green-800 cursor-pointer select-none"
                onClick={() => setShowLogoutPopup(true)}
                onMouseEnter={() => setTooltip(collapsed ? "logout" : null)}
                onMouseLeave={() => setTooltip(null)}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className={`${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>Logout</span>
              </div>
            </motion.li>
          </ul>
        </div>
      </motion.aside>

      {/* Logout Confirmation Popup */}
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
              className="bg-white dark:bg-slate-900 text-black dark:text-white p-6 rounded-2xl shadow-lg max-w-md w-full mx-4 border border-transparent dark:border-slate-800"
              variants={popupVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <h2 className="text-2xl font-bold mb-4 text-center text-gray-800 dark:text-white">Logout</h2>
              <p className="text-center mb-6 text-gray-600 dark:text-gray-400">Are you sure you want to log out?</p>
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
                  className="bg-gray-100 dark:bg-slate-800 text-black dark:text-white px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition border border-gray-200 dark:border-slate-700"
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