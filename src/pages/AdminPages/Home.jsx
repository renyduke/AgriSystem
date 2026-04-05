import React, { useEffect, useState, useRef, useMemo } from "react";
import { OrbitProgress } from 'react-loading-indicators';
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import { db } from "../../config/firebaseConfig";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { FaMapMarkerAlt, FaLeaf, FaSearch, FaUsers, FaMap, FaTractor, FaSeedling, FaChartLine, FaFileAlt, FaArrowRight, FaBell, FaUserPlus, FaClipboardList, FaExclamationTriangle, FaCheckCircle, FaClock, FaUserShield, FaExpand, FaCog, FaChartBar, FaDatabase } from "react-icons/fa";
import API_BASE_URL from "../../config";

// DA Office coordinates
const daOffice = { lat: 10.378622, lng: 123.230062 };

const Home = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [search, setSearch] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mapRef, setMapRef] = useState(null);
  const searchRef = useRef(null);
  const defaultCenter = [10.3860, 123.2220];
  const defaultZoom = 13;

  // Real-time data from Firebase
  const [stats, setStats] = useState({
    totalFarmers: 0,
    totalHectares: 0,
    activeSeasons: 0,
    pendingRegistrations: 0,
    totalVegetables: 0
  });
  const [farmers, setFarmers] = useState([]);
  const [vegetables, setVegetables] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [topCrops, setTopCrops] = useState([]);

  // Icon helpers for map markers
  const createPinIcon = (color) => {
    return L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
  };

  const getIconColor = (crop) => {
    switch (crop) {
      case "Tomato": return "red";
      case "Corn": return "yellow";
      case "Rice": return "green";
      default: return "grey";
    }
  };

  const getMarkerPosition = (coords) => {
    if (Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite)) {
      return coords;
    }
    return defaultCenter;
  };

  // Load user role
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(user.role || "admin");
  }, []);

  // Fetch farmers data from Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "farmers"), async (snapshot) => {
      const farmersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Enrich with vegetable data
      const enrichedFarmers = await Promise.all(
        farmersData.map(async (farmer) => {
          const vegetableQuery = query(
            collection(db, "vegetables"),
            where("farmerId", "==", farmer.id)
          );
          const vegetableSnapshot = await getDocs(vegetableQuery);
          const crops = vegetableSnapshot.docs.map((vegDoc) => ({
            id: vegDoc.id,
            ...vegDoc.data()
          }));

          return {
            ...farmer,
            name: farmer.fullName || `${farmer.firstName || ""} ${farmer.lastName || ""}`.trim(),
            crops: crops,
            mainCrop: crops.length > 0 ? crops[0].name : "N/A",
            location: farmer.farmLocation || "N/A",
            coordinates: Array.isArray(farmer.coordinates) && farmer.coordinates.length === 2
              ? farmer.coordinates
              : (farmer.area && Array.isArray(farmer.area) && farmer.area.length >= 2
                ? [farmer.area[0], farmer.area[1]]
                : defaultCenter)
          };
        })
      );

      setFarmers(enrichedFarmers);

      // Calculate stats
      const totalHectares = enrichedFarmers.reduce((sum, f) => sum + (parseFloat(f.hectares) || 0), 0);
      const seasons = new Set(enrichedFarmers.map(f => f.season).filter(Boolean));
      const pending = enrichedFarmers.filter(f => f.status === "pending").length;

      setStats(prev => ({
        ...prev,
        totalFarmers: enrichedFarmers.length,
        totalHectares: totalHectares.toFixed(1),
        activeSeasons: seasons.size,
        pendingRegistrations: pending
      }));

      // Generate recent activity
      const recent = enrichedFarmers
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 5)
        .map(farmer => ({
          id: farmer.id,
          action: "New farmer registered",
          user: farmer.name,
          time: formatTimeAgo(farmer.createdAt)
        }));
      setRecentActivity(recent);

      // Generate notifications
      if (pending > 0) {
        setNotifications(prev => [
          {
            id: 1,
            type: "warning",
            message: `${pending} farmer registration${pending > 1 ? 's' : ''} pending approval`,
            time: "Now"
          },
          ...prev.filter(n => n.id !== 1)
        ]);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch vegetables data
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "vegetables"), (snapshot) => {
      const vegetablesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVegetables(vegetablesData);

      // Count unique vegetable types
      const uniqueVeggies = new Set(vegetablesData.map(v => v.name));
      setStats(prev => ({ ...prev, totalVegetables: uniqueVeggies.size }));

      // Calculate top crops by count
      const cropCounts = {};
      vegetablesData.forEach(v => {
        const cropName = v.name || 'Unknown';
        cropCounts[cropName] = (cropCounts[cropName] || 0) + 1;
      });

      const topCropsList = Object.entries(cropCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTopCrops(topCropsList);
    });

    return () => unsubscribe();
  }, []);

  // Fetch V&P Dashboard Data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard`);
        const data = await response.json();
        setDashboardData(data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, []);

  // Format timestamp
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Recently";
    const seconds = timestamp.seconds || timestamp._seconds;
    if (!seconds) return "Recently";

    const now = Date.now() / 1000;
    const diff = now - seconds;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // All searchable items
  const searchableItems = [
    // Pages
    { type: "page", name: "Dashboard", path: "/home/analysis", icon: FaChartLine },
    { type: "page", name: "V&P Results", path: "/home/dashboard", icon: FaFileAlt },
    { type: "page", name: "Maps", path: "/home/maps", icon: FaMap },
    { type: "page", name: "Vegetable Management", path: "/home/vegetables", icon: FaLeaf },
    { type: "page", name: "Farmer Profile", path: "/home/farmer", icon: FaUsers },
    { type: "page", name: "User Management", path: "/home/usermanagement", icon: FaUserShield },
    { type: "page", name: "Farmer Registration", path: "/home/farmerregister", icon: FaUserPlus },
    { type: "page", name: "Farmer Listing", path: "/home/suggest-farmer", icon: FaClipboardList },
    // Farmers
    ...farmers.map(f => ({
      type: "farmer",
      name: f.name,
      path: `/home/farmer/${f.id}`,
      icon: FaUsers,
      details: `${f.location} • ${f.mainCrop}`
    })),
    // Vegetables
    ...Array.from(new Set(vegetables.map(v => v.name))).map(vegName => ({
      type: "vegetable",
      name: vegName,
      path: "/home/vegetables",
      icon: FaLeaf,
      details: "Crop type"
    }))
  ];

  useEffect(() => {
    if (search) {
      const filtered = searchableItems.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.details && item.details.toLowerCase().includes(search.toLowerCase()))
      );
      setSuggestions(filtered.slice(0, 10)); // Limit to 10 results
      setIsDropdownOpen(true);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  }, [search, farmers, vegetables]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (item) => {
    setSearch("");
    setIsDropdownOpen(false);
    navigate(item.path);
  };

  const handleSearchSubmit = (event) => {
    if ((event.type === "click" || event.key === "Enter") && suggestions.length > 0) {
      navigate(suggestions[0].path);
      setSearch("");
      setIsDropdownOpen(false);
    }
  };

  // Admin quick actions
  const adminQuickActions = [
    { name: "Register Farmer", icon: FaUserPlus, path: "/home/farmerregister", color: "bg-green-50 border-green-100 text-green-600" },
    { name: "View Reports", icon: FaFileAlt, path: "/home/dashboard", color: "bg-blue-50 border-blue-100 text-blue-600" },
    { name: "Manage Users", icon: FaUserShield, path: "/home/usermanagement", color: "bg-purple-50 border-purple-100 text-purple-600" },
    { name: "View Maps", icon: FaMap, path: "/home/maps", color: "bg-teal-50 border-teal-100 text-teal-600" },
  ];

  // Regular user quick actions
  const userQuickActions = [
    { name: "My Profile", icon: FaUsers, path: "/home/farmer", color: "bg-green-50 border-green-100 text-green-600" },
    { name: "View Maps", icon: FaMap, path: "/home/maps", color: "bg-blue-50 border-blue-100 text-blue-600" },
    { name: "Crop Data", icon: FaLeaf, path: "/home/vegetables", color: "bg-amber-50 border-amber-100 text-amber-600" },
    { name: "Dashboard", icon: FaChartLine, path: "/home/analysis", color: "bg-purple-50 border-purple-100 text-purple-600" },
  ];

  const quickActions = userRole === "admin" ? adminQuickActions : userQuickActions;

  const getNotificationIcon = (type) => {
    switch (type) {
      case "warning": return <FaExclamationTriangle className="text-amber-500" />;
      case "success": return <FaCheckCircle className="text-green-500" />;
      default: return <FaBell className="text-blue-500" />;
    }
  };

  // Market Intelligence Calculations
  const marketStats = useMemo(() => {
    if (!dashboardData) return null;

    const volumeData = dashboardData.volume_data || [];
    const priceData = dashboardData.price_data || [];

    // Calculate total volume across all time
    const totalVolume = volumeData.reduce((sum, item) => sum + (item.volume || 0), 0);

    // Calculate growth (comparing latest month to previous month if possible)
    const sortedVolumes = [...volumeData].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
    const currentMonthVol = sortedVolumes.length > 0 ? sortedVolumes[0].volume : 0;
    const prevMonthVol = sortedVolumes.length > 1 ? sortedVolumes[1].volume : 0;
    const volGrowth = prevMonthVol > 0 ? ((currentMonthVol - prevMonthVol) / prevMonthVol) * 100 : 0;

    // Average price trend
    const sortedPrices = [...priceData].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
    const currentPrice = sortedPrices.length > 0 ? sortedPrices[0].average_price : 0;
    const prevPrice = sortedPrices.length > 1 ? sortedPrices[1].average_price : 0;
    const priceGrowth = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

    // Trending crops (highest volume in latest data)
    const latestMonth = sortedVolumes.length > 0 ? sortedVolumes[0].month : null;
    const latestYear = sortedVolumes.length > 0 ? sortedVolumes[0].year : null;
    const latestCommodities = volumeData
      .filter(v => v.month === latestMonth && v.year === latestYear)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3);

    return {
      totalVolume,
      volGrowth,
      currentPrice,
      priceGrowth,
      latestCommodities,
      status: volGrowth >= 0 ? "Volume Increasing" : "Volume Decreasing"
    };
  }, [dashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <OrbitProgress variant="dotted" color="#32cd32" size="medium" text="" textColor="" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-6 pt-2 pb-8 w-full font-sans transition-colors duration-300">
      {/* Search Header - Floating & Minimal */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 -mx-6 px-6 py-4 mb-4">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Overview
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Overview of System activities.
            </p>
          </div>

          <div className="relative w-full md:w-96" ref={searchRef}>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="text-gray-400 group-focus-within:text-green-600 transition-colors" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchSubmit}
                placeholder="Search farmers, crops, maps..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border-none rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:bg-white dark:focus:bg-slate-700 transition-all"
              />
            </div>

            {/* Search Dropdown - Unchanged Logic, Updated Style */}
            {isDropdownOpen && suggestions.length > 0 && (
              <ul className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl max-h-96 overflow-y-auto">
                {suggestions.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={`${item.type}-${index}`}
                      onClick={() => handleSuggestionClick(item)}
                      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer border-b border-gray-50 dark:border-slate-800 last:border-0 flex items-center space-x-3 group transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'farmer' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                        item.type === 'vegetable' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        }`}>
                        <Icon className="text-sm" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.details || item.type}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
 
      <div className="w-full space-y-8">

        {/* Welcome Section - Deleted (Combined into Header) */}

        {/* 1. Key Metrics - Clean & Spacious */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaUsers className="text-6xl text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Farmers</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.totalFarmers}</h3>
              <div className="mt-4 flex items-center text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 w-fit px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></div>
                Active Registered
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaMapMarkerAlt className="text-6xl text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Free Hectares</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.totalHectares}</h3>
              <div className="mt-4 flex items-center text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 w-fit px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                Cultivated Land
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaSeedling className="text-6xl text-amber-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Crop Varieties</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.totalVegetables}</h3>
              <div className="mt-4 flex items-center text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 w-fit px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></div>
                Monitored Types
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaChartLine className="text-6xl text-purple-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Market Volume Trend</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1 mb-2">Monthly activity basis</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {marketStats ? marketStats.status : "N/A"}
              </h3>
              <div className={`mt-4 flex items-center text-xs font-medium ${marketStats?.volGrowth >= 0 ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'} w-fit px-2 py-1 rounded-full`}>
                <div className={`w-1.5 h-1.5 rounded-full ${marketStats?.volGrowth >= 0 ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
                {marketStats ? `${marketStats.volGrowth >= 0 ? '+' : ''}${marketStats.volGrowth.toFixed(1)}% Volume` : "Calculating..."}
              </div>
            </div>

          </div>
        </section>

        {/* 2. Main Grid: Map & Activity/Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Map - Clean Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FaMap className="text-green-600" />
                  Geospatial Overview
                </h3>
                <button
                  onClick={() => navigate('/home/maps')}
                  className="text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  Expand Map <FaExpand />
                </button>
              </div>
              <div className="h-[420px] relative z-0">
                <MapContainer
                  center={defaultCenter}
                  zoom={defaultZoom}
                  style={{ height: "100%", width: "100%" }}
                  whenCreated={setMapRef}
                  zoomControl={false}
                  scrollWheelZoom={false}
                  className="z-0"
                >
                  <TileLayer
                    url={darkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <ZoomControl position="bottomright" />

                  {/* DA Office Marker */}
                  <Marker
                    position={[daOffice.lat, daOffice.lng]}
                    icon={createPinIcon("blue")}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold text-blue-600 text-sm">DA Office Canlaon</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Central Office</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Farmer Markers */}
                  <MarkerClusterGroup
                    showCoverageOnHover={false}
                    spiderfyOnMaxZoom={true}
                    zoomToBoundsOnClick={true}
                    maxClusterRadius={50}
                    iconCreateFunction={(cluster) => {
                      const count = cluster.getChildCount();
                      return L.divIcon({
                        html: `<div class="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border-2 border-white shadow-md hover:bg-green-700 transition-colors">${count}</div>`,
                        className: "custom-cluster-icon",
                        iconSize: [32, 32],
                      });
                    }}
                  >
                    {farmers.map((farm) => {
                      const position = getMarkerPosition(farm.coordinates);
                      const iconColor = getIconColor(farm.mainCrop);
                      return (
                        <Marker
                          key={farm.id}
                          position={position}
                          icon={createPinIcon(iconColor)}
                        >
                          <Popup>
                            <div className="p-1 min-w-[160px]">
                              <p className="font-bold text-gray-900 text-sm mb-1">{farm.name}</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                <span className="block">{farm.mainCrop}</span>
                                <span className="block truncate">{farm.location}</span>
                              </div>
                              <button
                                onClick={() => navigate(`/home/farmer/${farm.id}`)}
                                className="mt-2 w-full py-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MarkerClusterGroup>
                </MapContainer>
              </div>
            </div>

            {/* Market Intelligence Insights */}
            {marketStats && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <span className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <FaChartLine className="text-purple-600 dark:text-purple-400 text-sm" />
                  </span>
                  Market Performance Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Trending Commodities */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <FaTractor className="text-green-500" /> Trending by Volume
                    </h4>
                    <div className="space-y-4">
                      {marketStats.latestCommodities.map((item, idx) => (
                        <div key={item.commodity} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' : 
                              idx === 1 ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.commodity}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.volume.toLocaleString()} kg total</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">High Demand</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price Alerts/Insights */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <FaChartBar className="text-blue-500" /> Market Price Activity
                    </h4>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Average price trend is</p>
                        <span className={`text-sm font-bold ${marketStats.priceGrowth >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          {marketStats.priceGrowth >= 0 ? 'Increasing' : 'Decreasing'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${marketStats.priceGrowth >= 0 ? 'bg-green-500' : 'bg-amber-500'}`} 
                            style={{ width: `${Math.min(100, Math.abs(marketStats.priceGrowth * 5))}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500">{Math.abs(marketStats.priceGrowth).toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-4 leading-relaxed italic">
                        * Comparison based on the most recent monthly reporting cycles.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Market Analytics - Moved below Map for better flow on large screens */}
            {dashboardData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('/home/dashboard')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-green-100 dark:hover:border-green-900/30 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                      <FaDatabase className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <FaArrowRight className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors text-sm" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {dashboardData.volume_data?.reduce((sum, item) => sum + item.volume, 0).toLocaleString() || 0}
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">kg</span>
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Volume Traded</p>
                </div>

                <div onClick={() => navigate('/home/dashboard')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-green-100 dark:hover:border-green-900/30 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                      <FaChartBar className="text-green-600 dark:text-green-400" />
                    </div>
                    <FaArrowRight className="text-gray-300 dark:text-gray-600 group-hover:text-green-500 transition-colors text-sm" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    ₱{(dashboardData.price_data?.length > 0
                      ? (dashboardData.price_data.reduce((sum, item) => sum + item.average_price, 0) / dashboardData.price_data.length)
                      : 0).toFixed(2)}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Average Market Price</p>
                </div>

                <div onClick={() => navigate('/home/vegetables')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-green-100 dark:hover:border-green-900/30 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                      <FaLeaf className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <FaArrowRight className="text-gray-300 dark:text-gray-600 group-hover:text-purple-500 transition-colors text-sm" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {dashboardData.commodities?.length || 0}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active Commodities</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Quick Actions & Notifications */}
          <div className="space-y-6">

            {/* Quick Actions - Grid of Icon Cards */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.name}
                      onClick={() => navigate(action.path)}
                      className="flex flex-col items-center justify-center p-4 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-700 group text-center"
                    >
                      <Icon className={`text-xl mb-2 ${action.color.split(' ')[2]}`} />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{action.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activities - List Style */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activities</h3>
              </div>

              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No recent activities</p>
                ) : recentActivity.map((activity, index) => (
                  <div key={`${activity.id}-${index}`} className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="mt-1"><FaCheckCircle className="text-green-500" /></div>
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-tight">{activity.action}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.user} • {activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Crops - List Style */}
            {topCrops.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Crops</h3>
                <div className="space-y-4">
                  {topCrops.map((crop, index) => (
                    <div key={crop.name} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-sm font-bold text-gray-300 group-hover:text-green-500 transition-colors">0{index + 1}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{crop.name}</p>
                          <p className="text-xs text-gray-500">{crop.count} farms</p>
                        </div>
                      </div>
                      <div className="w-16 h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${(crop.count / Math.max(...topCrops.map(c => c.count))) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
