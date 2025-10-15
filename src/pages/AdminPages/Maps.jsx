import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, LayersControl, LayerGroup, useMap, FeatureGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import "leaflet.motion/dist/leaflet.motion.js";
import { db } from "../../config/firebaseConfig";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { FaSearch, FaMapMarkerAlt, FaInfoCircle, FaUser, FaLocationArrow } from "react-icons/fa";
import axios from "axios";
import { Link } from "react-router-dom";

// DA Office coordinates
const daOffice = { lat: 10.378622, lng: 123.230062 };

// Component to handle locating and marking user position
const LocateUserControl = ({ userLocation, setUserLocation, errorMessage, setErrorMessage }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const locateUser = () => {
      setErrorMessage("");
      map.locate({ setView: false, maxZoom: 16, timeout: 10000, enableHighAccuracy: true }); // setView: false to control animation manually
    };

    // Create custom control button for Locate Me
    const LocateControl = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
        container.style.backgroundColor = "white";
        container.style.borderRadius = "4px";
        container.style.boxShadow = "0 1px 5px rgba(0,0,0,0.65)";
        container.style.width = "34px";
        container.style.height = "34px";
        container.style.cursor = "pointer";
        container.style.marginTop = "10px"; // Space from zoom controls
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
        container.title = "Locate Me";
        container.onclick = function (e) {
          L.DomEvent.stopPropagation(e);
          locateUser();
        };
        return container;
      },
    });

    // Create custom control button for Print
    const PrintControl = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
        container.style.backgroundColor = "white";
        container.style.borderRadius = "4px";
        container.style.boxShadow = "0 1px 5px rgba(0,0,0,0.65)";
        container.style.width = "34px";
        container.style.height = "34px";
        container.style.cursor = "pointer";
        container.style.marginTop = "54px"; // Space below locate button
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>';
        container.title = "Print Map";
        container.onclick = function (e) {
          L.DomEvent.stopPropagation(e);
          window.print();
        };
        return container;
      },
    });

    const locateControl = new LocateControl();
    map.addControl(locateControl);
    const printControl = new PrintControl();
    map.addControl(printControl);

    const onLocationFound = (e) => {
      const { lat, lng } = e.latlng;
      setUserLocation({ lat, lng });
      // Smooth flyTo animation to user location
      map.flyTo(e.latlng, 16, { duration: 1.5 });
    };

    const onLocationError = (e) => {
      setErrorMessage(`Location access denied or error: ${e.message}. Falling back to default view.`);
      console.error(e);
    };

    map.on("locationfound", onLocationFound);
    map.on("locationerror", onLocationError);

    // Auto-locate on initial load
    locateUser();

    return () => {
      map.off("locationfound", onLocationFound);
      map.off("locationerror", onLocationError);
      map.removeControl(locateControl);
      map.removeControl(printControl);
    };
  }, [map, setUserLocation, setErrorMessage]);

  return null;
};

// Custom blue circle icon for user location
const createUserIcon = () => {
  return L.divIcon({
    className: "custom-user-marker",
    html: `<div style="background-color: #3388ff; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

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
  const [userLocation, setUserLocation] = useState(null);
  const [mapMode, setMapMode] = useState("view");
  const searchRef = useRef(null);
  const drawnItems = useRef(null);
  const defaultCenter = [10.3860, 123.2220];
  const defaultZoom = 14;

  // Add print media query styles
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body > *:not(.leaflet-container) {
          display: none !important;
        }
        .leaflet-container {
          height: 100vh !important;
          width: 100vw !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

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

  // Fetch farmers data from Firestore with enriched mainCrops from vegetables collection
  useEffect(() => {
    const unsubscribeFarmers = onSnapshot(collection(db, "farmers"), async (snapshot) => {
      const farmersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Enrich each farmer with actual mainCrops array from vegetables
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
            mainCrops, // Attach full crops for potential future use
          };
        })
      );

      setFarmers(enrichedFarmers);
    }, (error) => console.error("Error fetching farmers:", error));

    return () => unsubscribeFarmers();
  }, []);

  // Auto-zoom to fit all markers on load or update
  useEffect(() => {
    if (mapRef && farmers.length > 0) {
      let boundsArray = [daOffice, ...farmers.map(f => f.coordinates)];
      if (userLocation) {
        boundsArray.push(userLocation);
      }
      const bounds = L.latLngBounds(boundsArray);
      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
    }
  }, [mapRef, farmers, userLocation]);

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

  // Handle search input
  const handleSearch = (event) => {
    const searchTerm = event.target.value.toLowerCase();
    setSearch(searchTerm);
    setIsDropdownOpen(true);
    setErrorMessage("");
    const filteredFarmers = farmers.filter((f) =>
      f.name.toLowerCase().includes(searchTerm) ||
      f.farmLocation.toLowerCase().includes(searchTerm)
    );
    setSuggestions(filteredFarmers);
    if (searchTerm === "" && mapRef) {
      let boundsArray = [daOffice, ...farmers.map(f => f.coordinates)];
      if (userLocation) boundsArray.push(userLocation);
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
          let boundsArray = [daOffice, ...farmers.map(f => f.coordinates)];
          if (userLocation) boundsArray.push(userLocation);
          const bounds = L.latLngBounds(boundsArray);
          mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16, duration: 1.5 });
          setGeocodedLocation(null);
          setIsDropdownOpen(false);
        }
      }
    }
  };

  // Handle marker click for smooth zoom
  const handleMarkerClick = (position) => {
    if (mapRef) {
      mapRef.flyTo(position, 16, { duration: 1.5 });
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
          <div className="relative w-full md:w-1/3" ref={searchRef}>
            <div className="flex items-center bg-white rounded-full shadow-md p-2">
              <FaSearch className="text-gray-500 mx-3" />
              <input
                type="text"
                placeholder="Search by farmer name or address..."
                value={search}
                onChange={handleSearch}
                onKeyDown={handleSearchSubmit}
                className="w-full bg-transparent focus:outline-none text-gray-700 placeholder-gray-400 text-sm font-sans"
              />
              <button
                onClick={handleSearchSubmit}
                className="ml-2 p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              >
                <FaSearch />
              </button>
            </div>
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
          <div className="flex gap-4">
            <button
              onClick={() => setMapMode("view")}
              className={`px-4 py-2 rounded-full font-semibold transition-colors ${mapMode === "view" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
            >
              View Mode
            </button>
           <Link
  to="/home/drawmap"
  className={`px-4 py-2 rounded-full font-semibold transition-colors inline-block text-center ${
    mapMode === "draw" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
  }`}
>
  Draw Mode
</Link>
          </div>
        </header>

        {/* Map Container */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden h-[600px] transition-all duration-300 hover:shadow-3xl">
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: "100%", width: "100%" }}
            whenCreated={setMapRef}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='<a href="https://www.openstreetmap.org/copyright"></a>'
            />
            <ZoomControl position="topright" />
            <LocateUserControl userLocation={userLocation} setUserLocation={setUserLocation} errorMessage={errorMessage} setErrorMessage={setErrorMessage} />

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
                <LayerGroup>
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
              <LayersControl.Overlay checked name="My Location">
                <LayerGroup>
                  {userLocation && (
                    <Marker 
                      position={[userLocation.lat, userLocation.lng]} 
                      icon={createUserIcon()}
                      eventHandlers={{
                        click: () => handleMarkerClick([userLocation.lat, userLocation.lng])
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold text-blue-800">You are here</h3>
                          <p className="text-sm text-gray-600">Lat: {userLocation.lat.toFixed(4)}, Lng: {userLocation.lng.toFixed(4)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </LayerGroup>
              </LayersControl.Overlay>
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

        {/* Coordinate Display and Info */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {cursorCoords.lat && cursorCoords.lng && (
            <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-4 text-sm text-gray-800 flex-1">
              <p><strong>Cursor Lat:</strong> {cursorCoords.lat}, <strong>Lng:</strong> {cursorCoords.lng}</p>
            </div>
          )}
          {userLocation && (
            <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-4 text-sm text-gray-800 flex-1">
              <p className="flex items-center"><FaLocationArrow className="mr-2 text-blue-600" /><strong>Your Location:</strong> Lat: {userLocation.lat.toFixed(4)}, Lng: {userLocation.lng.toFixed(4)}</p>
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
                  This map shows real-time farmer locations in Canlaon City. Your location is automatically detected and shown on the map (blue marker). Click markers or the locate button for smooth animated zoom. Search by farmer name or address to auto-zoom to specific locations or explore all farmers and the DA Office. Switch to Draw Mode to draw rectangles, polygons, or markers for pinpointing areas with CRUD operations via the toolbar.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maps;