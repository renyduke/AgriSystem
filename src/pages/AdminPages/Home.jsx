import React, { useEffect, useState, useRef } from "react";
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

// DA Office coordinates
const daOffice = { lat: 10.378622, lng: 123.230062 };

const Home = () => {
  const navigate = useNavigate();
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
        const response = await fetch('https://backend-3-fl3e.onrender.com/api/dashboard');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12 font-sans">
      {/* Search Header - Floating & Minimal */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 mb-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Overview of agricultural activities in Canlaon City.
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
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all"
              />
            </div>

            {/* Search Dropdown - Unchanged Logic, Updated Style */}
            {isDropdownOpen && suggestions.length > 0 && (
              <ul className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-96 overflow-y-auto">
                {suggestions.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={`${item.type}-${index}`}
                      onClick={() => handleSuggestionClick(item)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center space-x-3 group transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'farmer' ? 'bg-green-50 text-green-600' :
                        item.type === 'vegetable' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                        <Icon className="text-sm" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.details || item.type}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 space-y-8">

        {/* Welcome Section - Deleted (Combined into Header) */}

        {/* 1. Key Metrics - Clean & Spacious */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaUsers className="text-6xl text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Farmers</p>
              <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{stats.totalFarmers}</h3>
              <div className="mt-4 flex items-center text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></div>
                Active Registered
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaMapMarkerAlt className="text-6xl text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Free Hectares</p>
              <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{stats.totalHectares}</h3>
              <div className="mt-4 flex items-center text-xs font-medium text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                Cultivated Land
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaSeedling className="text-6xl text-amber-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Crop Varieties</p>
              <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{stats.totalVegetables}</h3>
              <div className="mt-4 flex items-center text-xs font-medium text-amber-600 bg-amber-50 w-fit px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></div>
                Monitored Types
              </div>
            </div>


          </div>
        </section>

        {/* 2. Main Grid: Map & Activity/Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Map - Clean Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[500px]">
              <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-white">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FaMap className="text-green-600" />
                  Geospatial Overview
                </h3>
                <button
                  onClick={() => navigate('/home/maps')}
                  className="text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  Expand Map <FaExpand />
                </button>
              </div>
              <div className="flex-1 relative z-0">
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
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
                        <p className="text-xs text-gray-600">Central Office</p>
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
                                className="mt-2 w-full py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100 transition-colors"
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

            {/* Market Analytics - Moved below Map for better flow on large screens */}
            {dashboardData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('/home/dashboard')} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-green-100 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <FaDatabase className="text-blue-600" />
                    </div>
                    <FaArrowRight className="text-gray-300 group-hover:text-blue-500 transition-colors text-sm" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-1">
                    {dashboardData.volume_data?.reduce((sum, item) => sum + item.volume, 0).toLocaleString() || 0}
                    <span className="text-sm font-normal text-gray-400 ml-1">kg</span>
                  </h4>
                  <p className="text-sm text-gray-500">Total Volume Traded</p>
                </div>

                <div onClick={() => navigate('/home/dashboard')} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-green-100 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                      <FaChartBar className="text-green-600" />
                    </div>
                    <FaArrowRight className="text-gray-300 group-hover:text-green-500 transition-colors text-sm" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-1">
                    ₱{(dashboardData.price_data?.length > 0
                      ? (dashboardData.price_data.reduce((sum, item) => sum + item.average_price, 0) / dashboardData.price_data.length)
                      : 0).toFixed(2)}
                  </h4>
                  <p className="text-sm text-gray-500">Average Market Price</p>
                </div>

                <div onClick={() => navigate('/home/vegetables')} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-green-100 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                      <FaLeaf className="text-purple-600" />
                    </div>
                    <FaArrowRight className="text-gray-300 group-hover:text-purple-500 transition-colors text-sm" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-1">
                    {dashboardData.commodities?.length || 0}
                  </h4>
                  <p className="text-sm text-gray-500">Active Commodities</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Quick Actions & Notifications */}
          <div className="space-y-6">

            {/* Quick Actions - Grid of Icon Cards */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.name}
                      onClick={() => navigate(action.path)}
                      className="flex flex-col items-center justify-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 group text-center"
                    >
                      <Icon className={`text-xl mb-2 ${action.color.split(' ')[2]}`} />
                      <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900">{action.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activities - List Style */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Activities</h3>
              </div>

              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No recent activities</p>
                ) : recentActivity.map((activity, index) => (
                  <div key={`${activity.id}-${index}`} className="flex gap-3 items-start p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="mt-1"><FaCheckCircle className="text-green-500" /></div>
                    <div>
                      <p className="text-sm text-gray-800 font-medium leading-tight">{activity.action}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.user} • {activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Crops - List Style */}
            {topCrops.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Top Crops</h3>
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
                      <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
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
