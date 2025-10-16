import React, { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup, useMap, FeatureGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import "leaflet.motion/dist/leaflet.motion.js";

// Firebase imports (fixed path)
import { db } from "../../config/firebaseConfig";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "firebase/firestore";

import { FaSearch, FaMapMarkerAlt, FaInfoCircle, FaUser, FaLocationArrow, FaArrowLeft } from "react-icons/fa";
import { ArrowsPointingOutIcon, ArrowsPointingInIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";

// DrawMap Component
const DrawMap = () => {
  const [mapRef, setMapRef] = useState(null);
  const [cursorCoords, setCursorCoords] = useState({ lat: null, lng: null });
  const [userLocation, setUserLocation] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawnShapes, setDrawnShapes] = useState([]);
  const drawnItems = useRef(L.featureGroup());
  const navigate = useNavigate();
  const defaultCenter = [10.3860, 123.2220];
  const defaultZoom = 14;

  // Icon fix (run once)
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  // Load drawn shapes from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "drawnShapes"), (snapshot) => {
      const shapes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDrawnShapes(shapes);
      if (mapRef && drawnItems.current) {
        drawnItems.current.clearLayers();
        shapes.forEach(shape => {
          const layer = L.geoJSON(shape.geojson, {
            onEachFeature: (feature, lyr) => {
              lyr.options.firestoreId = shape.id;
              lyr.options.editable = true;
            }
          });
          if (mapRef) layer.addTo(drawnItems.current);
        });
      }
    }, (err) => console.error("Firestore load error:", err));
    return () => unsubscribe();
  }, [mapRef]);

  // Locate Control (fixed max depth: click-only, stable callback, no auto-call loop)
  const LocateUserControl = ({ userLocation, setUserLocation, errorMessage, setErrorMessage }) => {
    const map = useMap();
    const controlRef = useRef(null);
    const hasLocated = useRef(false);

    const locateUser = useCallback(() => {
      if (!map || hasLocated.current) return;
      setErrorMessage("");
      map.locate({ setView: true, maxZoom: 16, timeout: 10000, enableHighAccuracy: true });
      hasLocated.current = true;
    }, [map]);

    useEffect(() => {
      if (!map) return;

      const LocateControl = L.Control.extend({
        options: { position: "topright" },
        onAdd: () => {
          const container = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
          container.style.backgroundColor = "white";
          container.style.borderRadius = "4px";
          container.style.boxShadow = "0 1px 5px rgba(0,0,0,0.65)";
          container.style.width = "34px";
          container.style.height = "34px";
          container.style.cursor = "pointer";
          container.style.marginTop = "10px";
          container.style.display = "flex";
          container.style.alignItems = "center";
          container.style.justifyContent = "center";
          container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
          container.title = "Locate Me";
          L.DomEvent.on(container, 'click', (e) => { L.DomEvent.stopPropagation(e); locateUser(); });
          return container;
        },
      });

      map.whenReady(() => {
        if (controlRef.current) return;
        const locateControl = new LocateControl();
        map.addControl(locateControl);
        controlRef.current = locateControl;
      });

      const onLocationFound = (e) => {
        setUserLocation(e.latlng);
      };
      const onLocationError = (e) => {
        setErrorMessage(`Location error: ${e.message}`);
        hasLocated.current = false;
      };

      map.on("locationfound", onLocationFound);
      map.on("locationerror", onLocationError);

      // Optional auto-locate on mount (uncomment if needed, but may cause re-renders)
      // if (!userLocation) locateUser();

      return () => {
        map.off("locationfound", onLocationFound);
        map.off("locationerror", onLocationError);
        if (controlRef.current) {
          map.removeControl(controlRef.current);
          controlRef.current = null;
        }
        hasLocated.current = false;
      };
    }, [map, locateUser]);

    return null;
  };

  // Print Control
  const PrintControl = () => {
    const map = useMap();
    const controlRef = useRef(null);

    useEffect(() => {
      if (!map) return;

      const PrintCtrl = L.Control.extend({
        options: { position: "topright" },
        onAdd: () => {
          const container = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
          container.style.backgroundColor = "white";
          container.style.borderRadius = "4px";
          container.style.boxShadow = "0 1px 5px rgba(0,0,0,0.65)";
          container.style.width = "34px";
          container.style.height = "34px";
          container.style.cursor = "pointer";
          container.style.marginTop = "54px";
          container.style.display = "flex";
          container.style.alignItems = "center";
          container.style.justifyContent = "center";
          container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>';
          container.title = "Print Map";
          L.DomEvent.on(container, 'click', (e) => { L.DomEvent.stopPropagation(e); window.print(); });
          return container;
        },
      });

      map.whenReady(() => {
        if (controlRef.current) return;
        const printCtrl = new PrintCtrl();
        map.addControl(printCtrl);
        controlRef.current = printCtrl;
      });

      return () => {
        if (controlRef.current) {
          map.removeControl(controlRef.current);
          controlRef.current = null;
        }
      };
    }, [map]);

    return null;
  };

  // Custom user icon
  const createUserIcon = () => {
    return L.divIcon({
      className: "custom-user-marker",
      html: `<div style="background-color: #3388ff; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    document.body.classList.toggle("fullscreen-mode", !isFullscreen);
  };

  // Cursor coords
  useEffect(() => {
    if (mapRef) {
      const updateCoords = (e) => setCursorCoords({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) });
      mapRef.on("mousemove", updateCoords);
      return () => mapRef.off("mousemove", updateCoords);
    }
  }, [mapRef]);

  // Print and Fullscreen CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body > *:not(.leaflet-container) { display: none !important; }
        .leaflet-container { height: 100vh !important; width: 100vw !important; position: fixed !important; top: 0 !important; left: 0 !important; }
        .leaflet-draw-toolbar, .leaflet-control { display: none !important; }
      }
      .fullscreen-mode .non-map { display: none !important; }
      .fullscreen-mode .leaflet-container {
        position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 p-6 ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      <div className="max-w-6xl mx-auto space-y-6 non-map">
        <header className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-6 flex items-center justify-between gap-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-green-800 hover:text-green-600">
            <FaArrowLeft className="mr-2" /> Back to Map Explorer
          </button>
          <h2 className="text-3xl font-bold text-green-800">Draw Mode - Create & Edit Areas</h2>
          <button onClick={toggleFullscreen} className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 flex items-center">
            {isFullscreen ? <ArrowsPointingInIcon className="h-5 w-5 mr-1" /> : <ArrowsPointingOutIcon className="h-5 w-5 mr-1" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
        </header>

        <div className="bg-white/90 rounded-2xl shadow-2xl overflow-hidden h-[600px] map-container">
          <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ height: "100%", width: "100%" }} whenCreated={setMapRef} zoomControl={true}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            <LocateUserControl userLocation={userLocation} setUserLocation={setUserLocation} errorMessage={errorMessage} setErrorMessage={setErrorMessage} />
            <PrintControl />

            <FeatureGroup ref={drawnItems}>
              <EditControl
                position="topright"
                onCreated={async (e) => {
                  const geojson = e.layer.toGeoJSON();
                  console.log('Created:', geojson);
                  try {
                    const docRef = await addDoc(collection(db, 'drawnShapes'), { geojson, createdAt: new Date() });
                    e.layer.options.firestoreId = docRef.id;
                  } catch (err) {
                    console.error('Save error:', err);
                  }
                }}
                onEdited={async (e) => {
                  e.layers.eachLayer(async (layer) => {
                    const geojson = layer.toGeoJSON();
                    const shapeId = layer.options.firestoreId;
                    if (shapeId) {
                      try {
                        await updateDoc(doc(db, 'drawnShapes', shapeId), { geojson });
                        console.log('Edited:', geojson);
                      } catch (err) {
                        console.error('Update error:', err);
                      }
                    }
                  });
                }}
                onDeleted={async (e) => {
                  e.layers.eachLayer(async (layer) => {
                    const shapeId = layer.options.firestoreId;
                    if (shapeId) {
                      try {
                        await deleteDoc(doc(db, 'drawnShapes', shapeId));
                        console.log('Deleted:', shapeId);
                      } catch (err) {
                        console.error('Delete error:', err);
                      }
                    }
                  });
                }}
                draw={{
                  rectangle: { shapeOptions: { color: '#3388ff', weight: 4, opacity: 0.5, fillOpacity: 0.2 } },
                  polygon: { allowIntersection: false, shapeOptions: { color: '#3388ff', weight: 4, opacity: 0.5, fillOpacity: 0.2 } },
                  marker: { icon: createUserIcon() },
                  polyline: false,
                  circle: false,
                  circlemarker: false,
                }}
                edit={{
                  edit: { selectedPathOptions: { maintainColor: true, opacity: 0.8, weight: 6 } },
                  remove: true,
                  poly: null,
                }}
              />
            </FeatureGroup>

            {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserIcon()}><Popup>You are here</Popup></Marker>}
          </MapContainer>
        </div>

        <div className="flex gap-4 non-map">
          {cursorCoords.lat && <div className="bg-white/90 rounded-xl p-4"><p>Cursor: Lat {cursorCoords.lat}, Lng {cursorCoords.lng}</p></div>}
          {errorMessage && <div className="bg-red-100 rounded-xl p-4 text-red-800">{errorMessage}</div>}
          <div className="bg-white/90 rounded-xl p-4 flex-1">
            <p className="text-sm text-gray-700">Draw rectangles, polygons, or markers. Edits save automatically to database. Use toolbar for CRUD.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawMap;