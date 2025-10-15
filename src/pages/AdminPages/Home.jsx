import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, LayersControl, LayerGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.motion/dist/leaflet.motion.js";
import { db } from "../../config/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { FaMapMarkerAlt, FaChartPie, FaLeaf, FaArrowRight, FaSearch, FaInfoCircle, FaUser } from "react-icons/fa";
import { Link } from "react-router-dom";
import axios from "axios";

// DA Office coordinates
const daOffice = { lat: 10.378622, lng: 123.230062 };

const Home = () => {
  const [search, setSearch] = useState("");
  const [farmers, setFarmers] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState({ lat: null, lng: null });
  const [geocodedLocation, setGeocodedLocation] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState({ totalFarmers: 0, totalHectares: 0 });
  const searchRef = useRef(null);
  const defaultCenter = [10.3860, 123.2220];
  const defaultZoom = 14;

  // Icon helpers
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

  // Fetch farmers data from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "farmers"), (snapshot) => {
      const farmersData = snapshot.docs.map((doc) => {
        const data = doc.data();
        const name = data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim();
        let vegetable = "N/A";
        if (data.mainCrops) {
          const cropKeys = Object.keys(data.mainCrops);
          if (cropKeys.length > 0) {
            vegetable = data.mainCrops[cropKeys[0]].name || "N/A";
          }
        }
        let coordinates = data.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(Number.isFinite)) {
          coordinates = data.area && Array.isArray(data.area) && data.area.length >= 2
            ? [data.area[0], data.area[1]]
            : defaultCenter;
        }
        return {
          id: doc.id,
          name,
          vegetable,
          coordinates,
          hectares: data.hectares || 0,
          season: data.season || "Default",
          farmLocation: data.farmLocation || "N/A",
        };
      });
      setFarmers(farmersData);
      setStats({
        totalFarmers: farmersData.length,
        totalHectares: farmersData.reduce((sum, farmer) => sum + (farmer.hectares || 0), 0),
      });
    }, (error) => console.error("Error fetching farmers:", error));
    return () => unsubscribe();
  }, []);

  // Auto-zoom to fit all markers on load
  useEffect(() => {
    if (mapRef && farmers.length > 0) {
      const bounds = L.latLngBounds([daOffice, ...farmers.map(f => f.coordinates)]);
      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
    }
  }, [mapRef, farmers]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update cursor coordinates on map interaction
  useEffect(() => {
    if (mapRef) {
      const updateCoords = (e) => {
        setCursorCoords({
          lat: e.latlng.lat.toFixed(4),
          lng: e.latlng.lng.toFixed(4),
        });
      };
      mapRef.on("mousemove", updateCoords);
      mapRef.on("click", updateCoords);
      return () => {
        mapRef.off("mousemove", updateCoords);
        mapRef.off("click", updateCoords);
      };
    }
  }, [mapRef]);

  const getMarkerPosition = (coords) => {
    if (Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite)) {
      return coords;
    }
    return defaultCenter;
  };

  // Geocode address using Nominatim
  const geocodeAddress = async (query) => {
    try {
      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q: `${query}, Canlaon City, Philippines`,
          format: "jsonv2",
          limit: 5,
          addressdetails: 1,
          countrycodes: "ph",
          email: "renbuenafuerte@gmail.com",
        }
      });
      if (response.data && response.data.length > 0) {
        return response.data.map(result => ({
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          display_name: result.display_name,
        }));
      }
      return [];
    } catch (error) {
      console.error("Geocoding error:", error);
      return [];
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (farmer) => {
    setSearch(farmer.name);
    setIsDropdownOpen(false);
    setErrorMessage("");
    if (mapRef) {
      const markerLatLng = getMarkerPosition(farmer.coordinates);
      mapRef.flyTo(markerLatLng, 16, { duration: 1.5 });
      setGeocodedLocation(null);
    }
  };

  // Handle search submission
  const handleSearchSubmit = async (event) => {
    if (event.type === "click" || event.key === "Enter") {
      if (!mapRef) {
        setErrorMessage("Map is not ready yet. Please try again.");
        return;
      }
      const searchTerm = search.toLowerCase();
      const farm = farmers.find((f) =>
        f.name.toLowerCase().includes(searchTerm) ||
        f.farmLocation.toLowerCase().includes(searchTerm)
      );

      if (farm) {
        const markerLatLng = getMarkerPosition(farm.coordinates);
        mapRef.flyTo(markerLatLng, 16, { duration: 1.5 });
        setIsDropdownOpen(false);
        setGeocodedLocation(null);
        setErrorMessage("");
      } else {
        const geocodedResults = await geocodeAddress(searchTerm);
        if (geocodedResults.length > 0) {
          if (geocodedResults.length === 1) {
            setGeocodedLocation(geocodedResults[0]);
            mapRef.flyTo([geocodedResults[0].lat, geocodedResults[0].lng], 16, { duration: 1.5 });
          } else {
            const bounds = L.latLngBounds(geocodedResults.map(loc => [loc.lat, loc.lng]));
            mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
            setGeocodedLocation(geocodedResults);
          }
          setIsDropdownOpen(false);
          setErrorMessage("");
        } else {
          setErrorMessage(`No results found for "${searchTerm}". Showing all farmers.`);
          const bounds = L.latLngBounds([daOffice, ...farmers.map(f => f.coordinates)]);
          mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
          setGeocodedLocation(null);
          setIsDropdownOpen(false);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 p-6 overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Hero Section */}
        <section className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-extrabold text-green-800 mb-4 flex items-center justify-center">
            <FaLeaf className="mr-3 text-green-600" />
            <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Canlaon Farm Monitor
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-6">
            Real-time farm visualization and management for Canlaon City. Monitor crops, seasons, and areas with ease!
          </p>
          <Link
            to="/home/maps"
            className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-transform transform hover:scale-105"
          >
            Explore Farms <FaArrowRight className="ml-2" />
          </Link>
        </section>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="explore">
          <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-6 text-center hover:shadow-2xl transition-shadow">
            <FaChartPie className="text-green-600 text-3xl mx-auto mb-2" />
            <h3 className="text-xl font-semibold text-gray-800">Total Farmers</h3>
            <p className="text-2xl font-bold text-green-700">{stats.totalFarmers}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-6 text-center hover:shadow-2xl transition-shadow">
            <FaMapMarkerAlt className="text-green-600 text-3xl mx-auto mb-2" />
            <h3 className="text-xl font-semibold text-gray-800">Total Area</h3>
            <p className="text-2xl font-bold text-green-700">{stats.totalHectares.toFixed(1)} ha</p>
          </div>
          <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-6 text-center hover:shadow-2xl transition-shadow">
            <FaLeaf className="text-green-600 text-3xl mx-auto mb-2" />
            <h3 className="text-xl font-semibold text-gray-800">Active Seasons</h3>
            <p className="text-2xl font-bold text-green-700">{[...new Set(farmers.map((f) => f.season))].length}</p>
          </div>
        </div>

        {/* Map Section (Aligned with Maps.jsx) */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden h-[400px] transition-all duration-300 hover:shadow-3xl">
          <div className="p-4">
            <div className="relative w-full max-w-md" ref={searchRef}>
              {isDropdownOpen && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {suggestions.map((farmer) => (
                    <li
                      key={farmer.id}
                      onClick={() => handleSuggestionClick(farmer)}
                      className="px-4 py-2 text-sm text-gray-800 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      {farmer.name} - {farmer.farmLocation}
                    </li>
                  ))}
                </ul>
              )}
              {errorMessage && (
                <div className="absolute z-50 w-full mt-1 bg-red-100 border border-red-200 rounded-lg p-2 text-sm text-red-800">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: "calc(100% - 56px)", width: "100%" }}
            whenCreated={setMapRef}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='<a href="https://www.openstreetmap.org/copyright"></a>'
            />
            <ZoomControl position="topright" />

            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="OpenStreetMap">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='<a href="https://www.openstreetmap.org/copyright"></a>'
                />
              </LayersControl.BaseLayer>
              <LayersControl.Overlay name="DA Office">
                <LayerGroup>
                  <Marker position={[daOffice.lat, daOffice.lng]} icon={createPinIcon("blue")}>
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold text-green-800">DA Office</h3>
                      </div>
                    </Popup>
                  </Marker>
                </LayerGroup>
              </LayersControl.Overlay>
              <LayersControl.Overlay checked name="Farmers">
                <LayerGroup>
                  {farmers.map((farm) => {
                    const position = getMarkerPosition(farm.coordinates);
                    const iconColor = getIconColor(farm.vegetable);
                    return (
                      <Marker key={farm.id} position={position} icon={createPinIcon(iconColor)}>
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-semibold text-green-800">{farm.name}</h3>
                            <p className="text-sm text-gray-600"><strong>Crop:</strong> {farm.vegetable}</p>
                            <p className="text-sm text-gray-600"><strong>Area:</strong> {farm.hectares} hectares</p>
                            <p className="text-sm text-gray-600"><strong>Location:</strong> {farm.farmLocation}</p>
                            <Link
                              to={`/farmer/${farm.id}`}
                              className="mt-2 inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <FaUser className="mr-2" />
                              View Profile
                            </Link>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </LayerGroup>
              </LayersControl.Overlay>
            </LayersControl>

            {geocodedLocation && Array.isArray(geocodedLocation) ? (
              geocodedLocation.map((loc, index) => (
                <Marker key={`geocoded-${index}`} position={[loc.lat, loc.lng]} icon={createPinIcon("purple")}>
                  <Popup>{loc.display_name}</Popup>
                </Marker>
              ))
            ) : geocodedLocation && (
              <Marker position={[geocodedLocation.lat, geocodedLocation.lng]} icon={createPinIcon("purple")}>
                <Popup>{geocodedLocation.display_name}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Coordinate Display and Info */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {cursorCoords.lat && cursorCoords.lng && (
            <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-4 text-sm text-gray-800 flex-1">
              <p><strong>Lat:</strong> {cursorCoords.lat}, <strong>Lng:</strong> {cursorCoords.lng}</p>
            </div>
          )}
          <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-4 flex-1">
            <button
              onClick={() => setIsInfoOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-lg font-semibold text-green-800 hover:text-green-700 transition-colors"
            >
              <span className="flex items-center">
                <FaInfoCircle className="mr-2 text-green-600" />
                Map Insights
              </span>
              <span>{isInfoOpen ? "▲" : "▼"}</span>
            </button>
            {isInfoOpen && (
              <div className="mt-2 text-gray-700 animate-fade-in">
                <p className="text-sm">
                  This map shows real-time farmer locations in Canlaon City. Search by farmer name or address to auto-zoom to specific locations or explore all farmers and the DA Office.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;