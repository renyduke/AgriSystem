import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, LayersControl, LayerGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { FaMapMarkerAlt, FaChartPie, FaLeaf, FaArrowRight, FaSearch, FaUsers, FaMap, FaTractor, FaSeedling, FaChartLine } from "react-icons/fa";

// Mock data for demo
const mockFarmers = [
  { id: 1, name: "Juan Dela Cruz", vegetable: "Tomato", coordinates: [10.3860, 123.2220], hectares: 2.5, season: "Dry", farmLocation: "Barangay Pula" },
  { id: 2, name: "Maria Santos", vegetable: "Corn", coordinates: [10.3900, 123.2250], hectares: 3.2, season: "Wet", farmLocation: "Barangay Mabigo" },
  { id: 3, name: "Pedro Reyes", vegetable: "Rice", coordinates: [10.3820, 123.2180], hectares: 1.8, season: "Dry", farmLocation: "Barangay Linothangan" },
];

const daOffice = { lat: 10.378622, lng: 123.230062 };

const Home = () => {
  const [search, setSearch] = useState("");
  const [farmers, setFarmers] = useState(mockFarmers);
  const [mapRef, setMapRef] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [stats, setStats] = useState({ totalFarmers: 3, totalHectares: 7.5, activeSeasons: 2 });
  const searchRef = useRef(null);
  const defaultCenter = [10.3860, 123.2220];
  const defaultZoom = 14;

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

  useEffect(() => {
    if (search) {
      const filteredSuggestions = farmers.filter(
        (farmer) =>
          farmer.name.toLowerCase().includes(search.toLowerCase()) ||
          farmer.farmLocation.toLowerCase().includes(search.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setIsDropdownOpen(true);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  }, [search, farmers]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (farmer) => {
    setSearch(farmer.name);
    setIsDropdownOpen(false);
    if (mapRef) {
      mapRef.flyTo(farmer.coordinates, 16, { duration: 1.5 });
    }
  };

  const handleSearchSubmit = (event) => {
    if (event.type === "click" || event.key === "Enter") {
      const searchTerm = search.toLowerCase();
      const farm = farmers.find(
        (f) =>
          f.name.toLowerCase().includes(searchTerm) ||
          f.farmLocation.toLowerCase().includes(searchTerm)
      );

      if (farm && mapRef) {
        mapRef.flyTo(farm.coordinates, 16, { duration: 1.5 });
        setIsDropdownOpen(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50">
      {/* Hero Section with Background Pattern */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-600 to-emerald-700">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center space-x-3 mb-4">
              <FaTractor className="text-white text-5xl md:text-6xl animate-bounce" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">
              Canlaon Farm Monitor
            </h1>
            <p className="text-xl md:text-2xl text-green-50 max-w-3xl mx-auto font-light">
              Empowering agricultural growth through real-time farm visualization and data-driven insights
            </p>
            
            {/* Search Bar in Hero */}
            <div className="max-w-2xl mx-auto mt-10" ref={searchRef}>
              <div className="relative">
                <div className="flex items-center bg-white rounded-2xl shadow-2xl p-2 transition-all duration-300 hover:shadow-3xl">
                  <FaSearch className="text-gray-400 ml-4 text-xl" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchSubmit}
                    placeholder="Search farmers, locations, or crops..."
                    className="flex-1 px-4 py-4 text-gray-800 bg-transparent outline-none text-lg"
                  />
                  <button
                    onClick={handleSearchSubmit}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105"
                  >
                    Search
                  </button>
                </div>
                {isDropdownOpen && suggestions.length > 0 && (
                  <ul className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                    {suggestions.map((farmer) => (
                      <li
                        key={farmer.id}
                        onClick={() => handleSuggestionClick(farmer)}
                        className="px-6 py-4 text-gray-800 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between"
                      >
                        <span>
                          <span className="font-semibold">{farmer.name}</span>
                          <span className="text-gray-500 text-sm ml-2">• {farmer.farmLocation}</span>
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                          {farmer.vegetable}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        {/* Stats Dashboard - Enhanced Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 -mt-20 relative z-10">
          <div className="group bg-white rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-t-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-4 bg-green-100 rounded-2xl group-hover:bg-green-200 transition-colors">
                <FaUsers className="text-green-600 text-4xl" />
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-gray-800">{stats.totalFarmers}</p>
                <p className="text-sm text-gray-500 font-medium">Registered</p>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800">Total Farmers</h3>
            <p className="text-gray-500 text-sm mt-2">Active farming community</p>
          </div>

          <div className="group bg-white rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-t-4 border-emerald-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-4 bg-emerald-100 rounded-2xl group-hover:bg-emerald-200 transition-colors">
                <FaMapMarkerAlt className="text-emerald-600 text-4xl" />
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-gray-800">{stats.totalHectares.toFixed(1)}</p>
                <p className="text-sm text-gray-500 font-medium">Hectares</p>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800">Total Farm Area</h3>
            <p className="text-gray-500 text-sm mt-2">Under cultivation</p>
          </div>

          <div className="group bg-white rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-t-4 border-teal-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-4 bg-teal-100 rounded-2xl group-hover:bg-teal-200 transition-colors">
                <FaSeedling className="text-teal-600 text-4xl" />
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-gray-800">{stats.activeSeasons}</p>
                <p className="text-sm text-gray-500 font-medium">Active</p>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800">Crop Seasons</h3>
            <p className="text-gray-500 text-sm mt-2">Currently farming</p>
          </div>
        </div>

        {/* Interactive Map Section - Modern Design */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 bg-gradient-to-r from-green-600 to-emerald-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <FaMap className="text-white text-3xl" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Live Farm Locations</h2>
                  <p className="text-green-50">Real-time monitoring across Canlaon City</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="h-[600px] relative">
            <MapContainer
              center={defaultCenter}
              zoom={defaultZoom}
              style={{ height: "100%", width: "100%" }}
              whenCreated={setMapRef}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <ZoomControl position="topright" />
              
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Street Map">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
                
                <LayersControl.Overlay name="DA Office" checked>
                  <LayerGroup>
                    <Marker position={[daOffice.lat, daOffice.lng]} icon={createPinIcon("blue")}>
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-blue-600">DA Office Canlaon</h3>
                          <p className="text-sm text-gray-600">Department of Agriculture</p>
                        </div>
                      </Popup>
                    </Marker>
                  </LayerGroup>
                </LayersControl.Overlay>
                
                <LayersControl.Overlay checked name="Farms">
                  <LayerGroup>
                    {farmers.map((farm) => (
                      <Marker
                        key={farm.id}
                        position={farm.coordinates}
                        icon={createPinIcon(getIconColor(farm.vegetable))}
                      >
                        <Popup>
                          <div className="p-3 min-w-[200px]">
                            <h3 className="font-bold text-lg text-green-700 mb-2">{farm.name}</h3>
                            <div className="space-y-1 text-sm">
                              <p className="flex justify-between">
                                <span className="text-gray-600">Crop:</span>
                                <span className="font-semibold">{farm.vegetable}</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-gray-600">Area:</span>
                                <span className="font-semibold">{farm.hectares} ha</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-gray-600">Location:</span>
                                <span className="font-semibold">{farm.farmLocation}</span>
                              </p>
                            </div>
                            <button className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold">
                              View Profile
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </LayerGroup>
                </LayersControl.Overlay>
              </LayersControl>
            </MapContainer>
          </div>
        </div>

        {/* Feature Cards - Modern Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="group bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
            <div className="mb-6">
              <div className="inline-block p-4 bg-white/20 rounded-2xl mb-4">
                <FaChartLine className="text-5xl" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Analytics & Reports</h3>
              <p className="text-green-50">
                Comprehensive agricultural data analysis with real-time charts and downloadable reports
              </p>
            </div>
            <button className="flex items-center space-x-2 text-white font-semibold group-hover:translate-x-2 transition-transform">
              <span>Explore Reports</span>
              <FaArrowRight />
            </button>
          </div>

          <div className="group bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
            <div className="mb-6">
              <div className="inline-block p-4 bg-white/20 rounded-2xl mb-4">
                <FaUsers className="text-5xl" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Farmer Directory</h3>
              <p className="text-emerald-50">
                Complete database of registered farmers with detailed profiles and contact information
              </p>
            </div>
            <button className="flex items-center space-x-2 text-white font-semibold group-hover:translate-x-2 transition-transform">
              <span>View Directory</span>
              <FaArrowRight />
            </button>
          </div>

          <div className="group bg-gradient-to-br from-teal-500 to-cyan-600 rounded-3xl p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
            <div className="mb-6">
              <div className="inline-block p-4 bg-white/20 rounded-2xl mb-4">
                <FaLeaf className="text-5xl" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Crop Insights</h3>
              <p className="text-teal-50">
                Track crop distribution, seasonal patterns, and agricultural productivity metrics
              </p>
            </div>
            <button className="flex items-center space-x-2 text-white font-semibold group-hover:translate-x-2 transition-transform">
              <span>View Insights</span>
              <FaArrowRight />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-8 text-white shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-4xl font-black mb-2">100%</p>
              <p className="text-green-50">System Uptime</p>
            </div>
            <div>
              <p className="text-4xl font-black mb-2">Real-time</p>
              <p className="text-green-50">Data Updates</p>
            </div>
            <div>
              <p className="text-4xl font-black mb-2">24/7</p>
              <p className="text-green-50">Monitoring</p>
            </div>
            <div>
              <p className="text-4xl font-black mb-2">Secure</p>
              <p className="text-green-50">Cloud Storage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex justify-center items-center space-x-3 mb-4">
            <FaTractor className="text-4xl text-green-400" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Canlaon Farm Monitor</h3>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Empowering agricultural communities through technology and data-driven insights
          </p>
          <p className="text-gray-500 text-sm mt-6">
            © 2026 Department of Agriculture - Canlaon City. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;