import React, { useEffect, useState, useRef } from "react";
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
import { FaSearch, FaMapMarkerAlt, FaInfoCircle } from "react-icons/fa";
import axios from "axios";
import { Link } from "react-router-dom";

// DA Office coordinates
const daOffice = { lat: 10.378622, lng: 123.230062 };

const Maps = () => {
  const [search, setSearch] = useState("");
  const [farmers, setFarmers] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
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
    const unsubscribeFarmers = onSnapshot(collection(db, "farmers"), async (snapshot) => {
      const farmersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const enrichedFarmers = await Promise.all(
        farmersData.map(async (farmer) => {
          const vegetableQuery = query(
            collection(db, "vegetables"),
            where("farmerId", "==", farmer.id)
          );
          const vegetableSnapshot = await getDocs(vegetableQuery);
          const mainCrops = vegetableSnapshot.docs.map((vegDoc) => ({ id: vegDoc.id, ...vegDoc.data() }));

          const name = farmer.fullName || `${farmer.firstName || ""} ${farmer.lastName || ""}`.trim();
          let vegetable = "N/A";
          if (mainCrops.length > 0) {
            vegetable = mainCrops[0].name || "N/A";
          }
          let coordinates = farmer.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(Number.isFinite)) {
            coordinates = farmer.area && Array.isArray(farmer.area) && farmer.area.length >= 2
              ? [farmer.area[0], farmer.area[1]]
              : defaultCenter;
          }

          return {
            id: farmer.id,
            name,
            vegetable,
            coordinates,
            hectares: farmer.hectares || 0,
            season: farmer.season || "Default",
            farmLocation: farmer.farmLocation || "N/A",
            mainCrops,
          };
        })
      );

      setFarmers(enrichedFarmers);
    }, (error) => console.error("Error fetching farmers:", error));

    return () => unsubscribeFarmers();
  }, []);

  // Auto-zoom to fit all markers (without user location)
  useEffect(() => {
    if (isMapReady && mapRef && farmers.length > 0) {
      let boundsArray = [daOffice, ...farmers.map(f => f.coordinates)];
      const bounds = L.latLngBounds(boundsArray);
      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
    }
  }, [isMapReady, mapRef, farmers]); // Removed userLocation dependency

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
      f.name.toLowerCase().includes(lowerTerm) ||
      f.farmLocation.toLowerCase().includes(lowerTerm)
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
      if (!isMapReady) {
        setPendingSearch(search);
        setErrorMessage("Map is loading... Search will apply shortly.");
        return;
      }
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header and Search Bar */}
        <header className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <h2 className="text-3xl font-bold text-green-800 flex items-center">
            <FaMapMarkerAlt className="mr-3 text-green-600" />
            Farm Map Explorer
          </h2>
        </header>

        {/* Map Container */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden h-[600px] transition-all duration-300 hover:shadow-3xl">
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: "100%", width: "100%" }}
            whenCreated={(mapInstance) => {
              setMapRef(mapInstance);
              setIsMapReady(true);
              if (pendingSearch) {
                performSearch(pendingSearch);
                setPendingSearch("");
              }
            }}
            zoomControl={false}
          >
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

        {/* Only Map Insights at the bottom */}
        <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-4">
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