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
        const response = await fetch('http://localhost:8000/api/dashboard');
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
    <div className="min-h-screen bg-white">
      {/* Minimalist Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <FaTractor className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">DA Canlaon</h1>
                
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {userRole === "admin" && (
                <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
                  Administrator
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome and Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome{userRole === "admin" ? ", Admin" : ""}
            </h2>
            <p className="text-gray-600 mb-6">
              {userRole === "admin" 
                ? "Manage Data and forecasts"
                : "Access your farming information and resources"}
            </p>
            
            {/* Universal Search Bar */}
            <div className="max-w-xl" ref={searchRef}>
              <div className="relative">
                <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-100 transition-all">
                  <FaSearch className="text-gray-400 ml-4 text-sm" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchSubmit}
                    placeholder="Search farmers, crops, locations..."
                    className="flex-1 px-4 py-3 text-gray-900 bg-transparent outline-none placeholder-gray-400"
                  />
                  {search && (
                    <button
                      onClick={handleSearchSubmit}
                      className="px-6 py-3 bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                    >
                      Search
                    </button>
                  )}
                </div>
                {isDropdownOpen && suggestions.length > 0 && (
                  <ul className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {suggestions.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <li
                          key={`${item.type}-${index}`}
                          onClick={() => handleSuggestionClick(item)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 flex items-center space-x-3 group"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            item.type === 'farmer' ? 'bg-green-50' : 
                            item.type === 'vegetable' ? 'bg-amber-50' : 'bg-blue-50'
                          }`}>
                            <Icon className={`text-sm ${
                              item.type === 'farmer' ? 'text-green-600' : 
                              item.type === 'vegetable' ? 'text-amber-600' : 'text-blue-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.name}</p>
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
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                  <FaUsers className="text-green-600 text-lg" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalFarmers}</h3>
                <p className="text-sm text-gray-600">Farmers</p>
              </div>
              <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                Active
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <FaMapMarkerAlt className="text-blue-600 text-lg" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalHectares}</h3>
                <p className="text-sm text-gray-600">Hectares</p>
              </div>
              <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                Cultivated
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center mb-4">
                  <FaSeedling className="text-amber-600 text-lg" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalVegetables}</h3>
                <p className="text-sm text-gray-600">Crop Types</p>
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                Cultivated
              </div>
            </div>
          </div>

          {userRole === "admin" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mb-4">
                    <FaClipboardList className="text-red-600 text-lg" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.pendingRegistrations}</h3>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
                <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  Action Required
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Quick Actions and Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.name}
                      onClick={() => navigate(action.path)}
                      className={`${action.color} border rounded-xl p-4 text-left hover:shadow-sm transition-all group`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <Icon className="text-lg" />
                        </div>
                        <span className="font-medium text-gray-900">{action.name}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Click to open</span>
                        <FaArrowRight className="text-gray-400 text-xs group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map Overview */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Farm Locations</h3>
                  <button
                    onClick={() => navigate('/home/maps')}
                    className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center space-x-2"
                  >
                    <span>Full Map</span>
                    <FaExpand className="text-xs" />
                  </button>
                </div>
              </div>
              <div className="h-[400px]">
                <MapContainer
                  center={defaultCenter}
                  zoom={defaultZoom}
                  style={{ height: "100%", width: "100%" }}
                  whenCreated={setMapRef}
                  zoomControl={false}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <ZoomControl position="topright" />

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

                  {/* Farmer Markers with Clustering */}
                  <MarkerClusterGroup
                    showCoverageOnHover={false}
                    spiderfyOnMaxZoom={true}
                    zoomToBoundsOnClick={true}
                    maxClusterRadius={50}
                    iconCreateFunction={(cluster) => {
                      const count = cluster.getChildCount();
                      return L.divIcon({
                        html: `<div class="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold border-2 border-white shadow-md">${count}</div>`,
                        className: "custom-cluster-icon",
                        iconSize: [40, 40],
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
                            <div className="p-2 min-w-[180px]">
                              <h3 className="font-semibold text-gray-900 mb-2 text-sm">{farm.name}</h3>
                              <div className="space-y-1 text-xs">
                                <p className="flex items-center space-x-2">
                                  <FaLeaf className="text-green-500" />
                                  <span>{farm.mainCrop}</span>
                                </p>
                                <p className="flex items-center space-x-2">
                                  <FaMapMarkerAlt className="text-blue-500" />
                                  <span>{farm.location}</span>
                                </p>
                              </div>
                              <button
                                onClick={() => navigate(`/home/farmer/${farm.id}`)}
                                className="mt-3 w-full px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                              >
                                View Profile
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MarkerClusterGroup>
                </MapContainer>
              </div>
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{farmers.length} farms registered</span>
                  <span className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>DA Office</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Recent Activity & Top Crops */}
          <div className="space-y-6">
            {/* Notifications */}
            {userRole === "admin" && notifications.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <FaBell className="text-gray-600" />
                  <span>Notifications</span>
                </h3>
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      {getNotificationIcon(notif.type)}
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 mb-1">{notif.message}</p>
                        <p className="text-xs text-gray-500 flex items-center space-x-1">
                          <FaClock className="text-xs" />
                          <span>{notif.time}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Crops */}
            {topCrops.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Crops</h3>
                <div className="space-y-4">
                  {topCrops.map((crop, index) => (
                    <div key={crop.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                          <span className="text-green-600 font-semibold">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{crop.name}</p>
                          <p className="text-xs text-gray-500">{crop.count} farms</p>
                        </div>
                      </div>
                      <div className="w-16 bg-gray-100 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(crop.count / Math.max(...topCrops.map(c => c.count))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className="text-sm font-semibold text-green-600 flex items-center space-x-1">
                    <FaCheckCircle />
                    <span>Online</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Sync Status</span>
                  <span className="text-sm font-semibold text-green-600">Real-time</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Updated</span>
                  <span className="text-sm text-gray-500">Just now</span>
                </div>
              </div>
            </div>

            {/* Recent Farmers Preview */}
            {userRole === "admin" && farmers.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Farmers</h3>
                <div className="space-y-3">
                  {farmers.slice(0, 3).map((farmer) => (
                    <div
                      key={farmer.id}
                      onClick={() => navigate(`/home/farmer`)}
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FaUsers className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{farmer.name}</p>
                        <p className="text-xs text-gray-500">{farmer.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* V&P Data Summary */}
        {dashboardData && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Market Analytics</h3>
              <button
                onClick={() => navigate('/home/dashboard')}
                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center space-x-2"
              >
                <span>View Full Report</span>
                <FaArrowRight className="text-xs" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FaDatabase className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.volume_data?.reduce((sum, item) => sum + item.volume, 0).toFixed(0) || 0}
                    </p>
                    <p className="text-sm text-gray-600">Total Volume (Kg)</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <FaChartBar className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      ₱{dashboardData.price_data?.length > 0
                        ? (dashboardData.price_data.reduce((sum, item) => sum + item.average_price, 0) / dashboardData.price_data.length).toFixed(2)
                        : 0}
                    </p>
                    <p className="text-sm text-gray-600">Avg Price</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <FaCog className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.commodities?.length || 0}
                    </p>
                    <p className="text-sm text-gray-600">Commodities</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Minimalist Footer */}
      <div className="bg-white border-t border-gray-100 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <FaTractor className="text-white text-sm" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">DA Canlaon</p>
                <p className="text-xs text-gray-500">Agricultural Monitoring</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              © 2024 Department of Agriculture - Canlaon City
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;