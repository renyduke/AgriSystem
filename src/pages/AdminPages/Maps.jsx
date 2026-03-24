import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, LayersControl, LayerGroup, useMap, FeatureGroup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import "leaflet.motion/dist/leaflet.motion.js";
import { db } from "../../config/firebaseConfig";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { FaSearch, FaMapMarkerAlt, FaInfoCircle, FaUsers, FaExpand, FaCompress } from "react-icons/fa";
import axios from "axios";
import { Link } from "react-router-dom";

// DA Office coordinates
const daOffice = { lat: 10.378622, lng: 123.230062 };

// Inner component — runs inside MapContainer so useMap() works
const MapReadyHandler = ({ onReady }) => {
  const map = useMap();
  useEffect(() => {
    if (map) onReady(map);
  }, [map, onReady]);
  return null;
};

const Maps = () => {
  const { darkMode } = useTheme();
  const [search, setSearch] = useState("");
  const [farmers, setFarmers] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState({ lat: null, lng: null });
  const [geocodedLocation, setGeocodedLocation] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [mapMode, setMapMode] = useState("view");
  const [isMapReady, setIsMapReady] = useState(false);
  const [pendingSearch, setPendingSearch] = useState("");
  const searchRef = useRef(null);
  const drawnItems = useRef(null);
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

  // Fetch farmers data from Firestore...
  useEffect(() => {
    const unsubscribeFarmers = onSnapshot(collection(db, "farmers"), (snapshot) => {
      const enrichedFarmers = snapshot.docs.map((doc) => {
        const farmer = doc.data();
        const name = farmer.fullName || `${farmer.firstName || ""} ${farmer.lastName || ""}`.trim();
        const vegetable = farmer.mainCrops?.crop1?.name || "N/A";

        let coordinates = farmer.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(Number.isFinite)) {
          coordinates = farmer.area && Array.isArray(farmer.area) && farmer.area.length >= 2
            ? [farmer.area[0], farmer.area[1]]
            : defaultCenter;
        }

        return {
          id: doc.id,
          name,
          vegetable,
          coordinates,
          hectares: farmer.hectares || 0,
          season: farmer.season || "Default",
          farmLocation: farmer.farmLocation || farmer.farmBarangay || "N/A",
        };
      });

      setFarmers(enrichedFarmers);
    }, (error) => console.error("Error fetching farmers:", error));

    return () => unsubscribeFarmers();
  }, []);

  // Execute pending search once map is ready
  useEffect(() => {
    if (isMapReady && mapRef && pendingSearch) {
      performSearch(pendingSearch);
      setPendingSearch("");
    }
  }, [isMapReady, mapRef]);

  // Auto-zoom to fit all markers (without user location)
  useEffect(() => {
    if (isMapReady && mapRef && farmers.length > 0) {
      let boundsArray = [daOffice, ...farmers.map(f => f.coordinates)];
      const bounds = L.latLngBounds(boundsArray);
      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
    }
  }, [isMapReady, mapRef, farmers]); // Removed userLocation dependency

  // Handle body scroll locking when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      // Force map to slightly resize to recalculate its bounds
      setTimeout(() => {
        if (mapRef) mapRef.invalidateSize();
      }, 300);
    } else {
      document.body.style.overflow = 'auto';
      setTimeout(() => {
        if (mapRef) mapRef.invalidateSize();
      }, 300);
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFullscreen, mapRef]);

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

  // Update cursor coordinates
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

  // Handle search input
  const handleSearch = (event) => {
    const searchTerm = event.target.value;
    setSearch(searchTerm);
    const lowerTerm = searchTerm.toLowerCase();
    setIsDropdownOpen(true);
    setErrorMessage("");

    const filteredFarmers = farmers.filter((f) =>
      (f.name && f.name.toLowerCase().includes(lowerTerm)) ||
      (f.farmLocation && f.farmLocation.toLowerCase().includes(lowerTerm))
    );
    setSuggestions(filteredFarmers);

    if (searchTerm === "" && mapRef) {
      let boundsArray = [daOffice, ...farmers.map(f => f.coordinates)];
      const bounds = L.latLngBounds(boundsArray);
      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
      setGeocodedLocation(null);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (farmer) => {
    setSearch(farmer.name);
    setIsDropdownOpen(false);
    setErrorMessage("");
    if (isMapReady && mapRef) {
      const markerLatLng = getMarkerPosition(farmer.coordinates);
      mapRef.flyTo(markerLatLng, 18, { duration: 1.5 });
      setGeocodedLocation(null);
    } else {
      setPendingSearch(farmer.name);
    }
  };

  const performSearch = async (searchTerm) => {
    if (!isMapReady || !mapRef) return;

    const lowerTerm = searchTerm.toLowerCase().trim();
    const matchingFarmers = farmers.filter((f) =>
      f.name.toLowerCase().includes(lowerTerm) ||
      f.farmLocation.toLowerCase().includes(lowerTerm)
    );

    if (matchingFarmers.length > 0) {
      const bestMatch = matchingFarmers[0];
      const markerLatLng = getMarkerPosition(bestMatch.coordinates);
      mapRef.flyTo(markerLatLng, 18, { duration: 1.5 });
      setIsDropdownOpen(false);
      setGeocodedLocation(null);
      setErrorMessage("");
    } else {
      const geocodedResults = await geocodeAddress(lowerTerm);
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
        setErrorMessage(`No farmer or location found for "${searchTerm}". Showing all.`);
        let boundsArray = [daOffice, ...farmers.map(f => f.coordinates)];
        const bounds = L.latLngBounds(boundsArray);
        mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
        setGeocodedLocation(null);
      }
    }
    setIsDropdownOpen(false);
  };

  // Handle search submission
  const handleSearchSubmit = async (event) => {
    if (event.type === "click" || (event.key === "Enter" && search.trim() !== "")) {
      await performSearch(search);
    }
  };

  // Handle marker click for smooth zoom
  const handleMarkerClick = (position) => {
    if (mapRef) {
      mapRef.flyTo(position, 18, { duration: 1.5 });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-6 pt-2 pb-6 transition-colors duration-300">
      <div className="w-full space-y-6">
        {/* Header and Search Bar */}
        <header className="py-2 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
          <div className="flex items-center justify-between w-full md:w-auto">
            <h2 className="text-3xl font-bold text-green-800 dark:text-green-500 flex items-center">
              <FaMapMarkerAlt className="mr-3 text-green-600" />
              Farm Map Explorer
            </h2>
          </div>

          {/* Farmer Search Bar */}
          <div className="relative w-full md:w-80" ref={searchRef}>
            <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all">
              <FaSearch className="ml-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                onKeyDown={handleSearchSubmit}
                placeholder="Search farmer or location..."
                className="flex-1 px-3 py-2.5 text-sm bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-slate-500 outline-none"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSuggestions([]);
                    setIsDropdownOpen(false);
                    setErrorMessage("");
                    if (mapRef && farmers.length > 0) {
                      const bounds = L.latLngBounds([daOffice, ...farmers.map(f => f.coordinates)]);
                      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
                    }
                  }}
                  className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Error message */}
            {errorMessage && (
              <p className="absolute top-full mt-1 text-xs text-red-500 dark:text-red-400 px-1">{errorMessage}</p>
            )}

            {/* Suggestions dropdown */}
            {isDropdownOpen && suggestions.length > 0 && (
              <ul className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[500] max-h-60 overflow-y-auto">
                {suggestions.map((farmer) => (
                  <li key={farmer.id}>
                    <button
                      onClick={() => handleSuggestionClick(farmer)}
                      className="w-full text-left px-4 py-2.5 hover:bg-green-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3"
                    >
                      <FaMapMarkerAlt className="text-green-500 flex-shrink-0 text-xs" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{farmer.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{farmer.farmLocation}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* No results hint */}
            {isDropdownOpen && search.trim() && suggestions.length === 0 && (
              <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[500] px-4 py-3 text-sm text-gray-400 dark:text-slate-500">
                No farmers found — press Enter to search by location
              </div>
            )}
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-4 py-2 bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-800 dark:text-green-400 font-semibold rounded-lg flex items-center transition-colors shadow-sm"
          >
            {isFullscreen ? (
              <><FaCompress className="mr-2" /> Exit Fullscreen</>
            ) : (
              <><FaExpand className="mr-2" /> View Fullscreen</>
            )}
          </button>
        </header>

        {/* Map Container */}
        <div className={`transition-all duration-300 ${isFullscreen
            ? 'fixed inset-0 z-[100] m-0 rounded-none bg-emerald-50 dark:bg-slate-950 h-screen w-screen p-4 pb-8 shadow-none'
            : 'relative z-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden h-[600px] hover:shadow-3xl border border-transparent dark:border-slate-800'
          }`}>
          {isFullscreen && (
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 z-[400] bg-white dark:bg-slate-900 text-green-800 dark:text-green-400 font-bold p-3 rounded-full shadow-2xl border-2 border-green-200 dark:border-slate-700 hover:bg-green-100 dark:hover:bg-slate-800 hover:scale-110 transition-all"
              title="Exit Fullscreen"
            >
              <FaCompress className="text-xl" />
            </button>
          )}
          <div className={`w-full h-full ${isFullscreen ? 'rounded-2xl overflow-hidden shadow-2xl border border-green-200/50' : ''}`}>
            <MapContainer
              center={defaultCenter}
              zoom={defaultZoom}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
            >
              <MapReadyHandler onReady={(mapInstance) => {
                setMapRef(mapInstance);
                setIsMapReady(true);
              }} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='<a href="https://www.openstreetmap.org/copyright"></a>'
              />
              <ZoomControl position="topright" />
              {/* LocateUserControl removed here */}

              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="OpenStreetMap">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='<a href="https://www.openstreetmap.org/copyright"></a>'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.Overlay name="DA Office">
                  <LayerGroup>
                    <Marker
                      position={[daOffice.lat, daOffice.lng]}
                      icon={createPinIcon("blue")}
                      eventHandlers={{
                        click: () => handleMarkerClick([daOffice.lat, daOffice.lng])
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold text-green-800">DA Office</h3>
                        </div>
                      </Popup>
                    </Marker>
                  </LayerGroup>
                </LayersControl.Overlay>
                <LayersControl.Overlay checked name="Farmers">
                  <MarkerClusterGroup
                    showCoverageOnHover={false}
                    spiderfyOnMaxZoom={true}
                    zoomToBoundsOnClick={true}
                    maxClusterRadius={50}
                    iconCreateFunction={(cluster) => {
                      const count = cluster.getChildCount();
                      return L.divIcon({
                        html: `<div style="background-color: rgba(51, 136, 255, 0.8); color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);">${count}</div>`,
                        className: "custom-cluster-icon",
                        iconSize: [40, 40],
                      });
                    }}
                  >
                    {farmers.map((farm) => {
                      const position = getMarkerPosition(farm.coordinates);
                      const iconColor = getIconColor(farm.vegetable);
                      return (
                        <Marker
                          key={farm.id}
                          position={position}
                          icon={createPinIcon(iconColor)}
                          eventHandlers={{
                            click: () => handleMarkerClick(position)
                          }}
                        >
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
                                View Profile
                              </Link>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MarkerClusterGroup>
                </LayersControl.Overlay>
                {/* "My Location" layer removed here */}
              </LayersControl>

              <FeatureGroup ref={drawnItems}>
                {mapMode === "draw" && (
                  <EditControl
                    position="topright"
                    draw={{
                      rectangle: true,
                      polygon: true,
                      polyline: false,
                      circle: false,
                      circlemarker: false,
                      marker: true,
                    }}
                    edit={{
                      edit: true,
                      remove: true,
                    }}
                  />
                )}
              </FeatureGroup>

              {geocodedLocation && Array.isArray(geocodedLocation) ? (
                geocodedLocation.map((loc, index) => (
                  <Marker
                    key={`geocoded-${index}`}
                    position={[loc.lat, loc.lng]}
                    icon={createPinIcon("purple")}
                    eventHandlers={{
                      click: () => handleMarkerClick([loc.lat, loc.lng])
                    }}
                  >
                    <Popup>{loc.display_name}</Popup>
                  </Marker>
                ))
              ) : geocodedLocation && (
                <Marker
                  position={[geocodedLocation.lat, geocodedLocation.lng]}
                  icon={createPinIcon("purple")}
                  eventHandlers={{
                    click: () => handleMarkerClick([geocodedLocation.lat, geocodedLocation.lng])
                  }}
                >
                  <Popup>{geocodedLocation.display_name}</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>

        {/* Statistics Panel */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-lg p-6 flex flex-col md:flex-row gap-8 border border-transparent dark:border-slate-800">
          <div className="flex-shrink-0 md:min-w-[180px] flex flex-col justify-center items-center md:items-start border-b md:border-b-0 md:border-r border-green-100 dark:border-slate-800 pb-4 md:pb-0 md:pr-6">
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FaUsers className="text-green-600 dark:text-green-400 text-lg" />
              Total Farmers
            </h3>
            <p className="text-5xl font-extrabold text-green-600 dark:text-green-400">{farmers.length}</p>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaMapMarkerAlt className="text-green-600 dark:text-green-400 text-lg" />
              Farmers per Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-56 overflow-y-auto pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-green-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
              {Object.entries(farmers.reduce((acc, farmer) => {
                const loc = farmer.farmLocation || "Unknown";
                if (!acc[loc]) acc[loc] = [];
                acc[loc].push(farmer);
                return acc;
              }, {}))
                .sort((a, b) => b[1].length - a[1].length)
                .map(([location, farmersInLocation]) => {
                  const isExpanded = expandedLocation === location;
                  return (
                    <div key={location} className="flex flex-col gap-1">
                      <button
                        onClick={() => setExpandedLocation(isExpanded ? null : location)}
                        className={`w-full text-left rounded-lg p-3 flex justify-between items-center border shadow-sm transition-all duration-200 group ${isExpanded
                          ? 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 shadow-md ring-1 ring-green-400 dark:ring-green-600'
                          : 'bg-green-50/70 dark:bg-slate-800/50 hover:bg-green-100 dark:hover:bg-slate-800 border-green-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-slate-600 hover:shadow-md'
                          }`}
                      >
                        <span className="text-sm font-semibold text-green-900 dark:text-green-100 truncate mr-2 flex items-center gap-2">
                          <span className={`transition-transform duration-200 text-green-600 dark:text-green-400 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                          <span title={location}>{location}</span>
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold shadow-sm transition-colors ${isExpanded ? 'bg-green-700 dark:bg-green-600 text-white' : 'bg-green-600 dark:bg-green-700 text-white group-hover:bg-green-700 dark:group-hover:bg-green-600'
                          }`}>
                          {farmersInLocation.length}
                        </span>
                      </button>

                      {/* Dropdown Farmers List */}
                      {isExpanded && (
                        <div className="flex flex-col gap-1 mt-1 pl-4 pr-1 animate-fade-in border-l-2 border-green-300 ml-2 py-1">
                          {farmersInLocation.map(farmer => (
                            <Link
                              key={farmer.id}
                              to={`/home/farmer/${farmer.id}`}
                              className="text-xs bg-white dark:bg-slate-900 hover:bg-green-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 hover:text-green-800 dark:hover:text-green-400 py-2 px-3 rounded-md border border-gray-100 dark:border-slate-800 hover:border-green-200 dark:hover:border-slate-700 shadow-sm transition-all flex justify-between items-center group/link"
                            >
                              <span className="truncate max-w-[120px] font-medium">{farmer.name}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 group-hover/link:text-green-600 dark:group-hover/link:text-green-400 font-semibold uppercase tracking-wider">Profile →</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Only Map Insights at the bottom */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-lg p-4 border border-transparent dark:border-slate-800">
          <button
            onClick={() => setIsInfoOpen((prev) => !prev)}
            className="w-full flex items-center justify-between text-lg font-semibold text-green-800 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 transition-colors"
          >
            <span className="flex items-center">
              <FaInfoCircle className="mr-2 text-green-600" />
              Map Insights
            </span>
            <span>{isInfoOpen ? "▲" : "▼"}</span>
          </button>
          {isInfoOpen && (
            <div className="mt-2 text-gray-700 dark:text-gray-400 animate-fade-in">
              <p className="text-sm">
                This map shows real-time farmer locations in Canlaon City. Click markers for smooth animated zoom. Search by farmer name or address (press Enter to auto-zoom to the first match). Overlapping farmers are clustered—click to expand!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Maps;