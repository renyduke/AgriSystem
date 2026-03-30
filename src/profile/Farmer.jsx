import React, { useEffect, useState } from "react";
import { db, auth } from "../config/firebaseConfig";
import { useTheme } from "../context/ThemeContext";
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc, addDoc } from "firebase/firestore";
import { logActivity } from "../services/activityLogger";
import { FaSearch, FaUser, FaPhone, FaMapMarkerAlt, FaTractor, FaEdit, FaTrash, FaList, FaTh, FaPlus, FaTimes, FaCalendarAlt, FaInfoCircle, FaSave, FaBan, FaFilter, FaUserCircle, FaLocationArrow, FaCrop } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";
import canlaonLocations from "../data/canlaonLocations";
import axios from 'axios';

const Farmer = () => {
  const { darkMode } = useTheme();
  const { id } = useParams();
  const [farmers, setFarmers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [viewMode, setViewMode] = useState("card");
  const [selectedAddressBarangay, setSelectedAddressBarangay] = useState("");
  const [selectedFarmBarangay, setSelectedFarmBarangay] = useState("");
  const [newCrop, setNewCrop] = useState({ name: "", plantingDate: "", harvestDate: "" });
  const [vegetables, setVegetables] = useState([]);
  const [farmerVegetables, setFarmerVegetables] = useState([]);
  const [originalVegetables, setOriginalVegetables] = useState([]);
  const [originalData, setOriginalData] = useState({});
  const [updateHighlights, setUpdateHighlights] = useState({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredFarmer, setHoveredFarmer] = useState(null);
  const hoverTimeoutRef = React.useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [farmerSnapshot, veggieSnapshot] = await Promise.all([
          getDocs(collection(db, "farmers")),
          getDocs(collection(db, "vegetables_list"))
        ]);

        // Process farmers data
        const farmerList = await Promise.all(
          farmerSnapshot.docs.map(async (doc) => {
            const farmerData = { id: doc.id, ...doc.data() };
            const vegetableQuery = query(
              collection(db, "vegetables"),
              where("farmerId", "==", farmerData.id)
            );
            const vegetableSnapshot = await getDocs(vegetableQuery);
            const farmerCrops = vegetableSnapshot.docs.map((vegDoc) => ({
              id: vegDoc.id,
              ...vegDoc.data()
            }));
            return { ...farmerData, mainCrops: farmerCrops };
          })
        );

        // Process vegetables list
        const veggieList = veggieSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          harvestAfter: doc.data().harvestAfter || 60,
        }));

        setFarmers(farmerList);
        setVegetables(veggieList);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredFarmers = farmers.filter((farmer) => {
    if (id) return farmer.id === id;
    return (
      farmer.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (locationFilter === "" || farmer.farmLocation?.toLowerCase().includes(locationFilter.toLowerCase()))
    );
  });

  const uniqueLocations = [...new Set(farmers.map(farmer => farmer.farmLocation).filter(Boolean))].sort();

  const geocodeAddress = async (address) => {
    try {
      setIsGeocoding(true);
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ', Canlaon City, Philippines')}`
      );
      const data = response.data;
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        return [lat, lon];
      }
      return null;
    } catch (error) {
      console.error('Error in geocoding:', error);
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleEdit = (farmer) => {
    const [addressBarangay, addressSitio] = farmer.address ? farmer.address.split(", ") : ["", ""];
    const [farmBarangay, farmSitio] = farmer.farmLocation ? farmer.farmLocation.split(", ") : ["", ""];

    setSelectedAddressBarangay(addressBarangay);
    setSelectedFarmBarangay(farmBarangay);

    const crops = farmer.mainCrops || [];
    setOriginalVegetables(JSON.parse(JSON.stringify(crops)));
    setFarmerVegetables(JSON.parse(JSON.stringify(crops)));
    setOriginalData({
      fullName: farmer.fullName,
      contact: farmer.contact,
      address: farmer.address,
      farmLocation: farmer.farmLocation,
      coordinates: farmer.coordinates || [10.3860, 123.2220],
      area: farmer.area || [],
      hectares: farmer.hectares || "",
    });

    setEditingFarmer(farmer.id);
    setEditForm({
      fullName: farmer.fullName,
      contact: farmer.contact,
      addressBarangay,
      addressSitio,
      farmBarangay,
      farmSitio,
      hectares: farmer.hectares || "",
      coordinates: farmer.coordinates || [10.3860, 123.2220],
      area: farmer.area || [],
    });
    setUpdateHighlights({});
  };

  const handleEditChange = async (e) => {
    const { name, value } = e.target;
    let updatedValue = value;

    if (name === "contact") {
      updatedValue = value.replace(/[^0-9]/g, "").slice(0, 11);
    }
    if (name === "hectares") {
      updatedValue = value >= 0 ? value : "";
    }

    setEditForm((prev) => {
      const newForm = { ...prev, [name]: updatedValue };
      detectChanges(newForm);
      return newForm;
    });

    if (name === "addressBarangay") {
      setSelectedAddressBarangay(value);
      setEditForm((prev) => ({ ...prev, addressSitio: "" }));
    }
    if (name === "farmBarangay") {
      setSelectedFarmBarangay(value);
      setEditForm((prev) => ({ ...prev, farmSitio: "" }));
    }

    if (["farmBarangay", "farmSitio", "hectares"].includes(name)) {
      const currentForm = { ...editForm, [name]: updatedValue };
      if (currentForm.farmBarangay && currentForm.farmSitio && currentForm.hectares) {
        const barangayData = canlaonLocations[currentForm.farmBarangay];
        let coords = [10.3860, 123.2220];
        if (barangayData) {
          const sitioData = barangayData.sitios.find(s => s.name === currentForm.farmSitio);
          coords = sitioData ? sitioData.coordinates : barangayData.coordinates;
        } else {
          const geocoded = await geocodeAddress(`${currentForm.farmSitio}, ${currentForm.farmBarangay}`);
          if (geocoded) coords = geocoded;
        }
        const offset = Math.sqrt(parseFloat(currentForm.hectares) * 0.0009) / 2;
        const newArea = [
          coords[0] + offset, coords[1] + offset,
          coords[0] + offset, coords[1] - offset,
          coords[0] - offset, coords[1] - offset,
          coords[0] - offset, coords[1] + offset,
        ];
        setEditForm(prev => ({ ...prev, coordinates: coords, area: newArea }));
        detectChanges({ ...currentForm, coordinates: coords, area: newArea });
      }
    }
  };

  const detectChanges = (currentForm) => {
    const highlights = {};
    if (currentForm.fullName !== originalData.fullName) highlights.fullName = true;
    if (currentForm.contact !== originalData.contact) highlights.contact = true;
    const newAddress = `${currentForm.addressBarangay}, ${currentForm.addressSitio}, Canlaon City`;
    if (newAddress !== originalData.address) highlights.address = true;
    const newFarmLocation = `${currentForm.farmBarangay}, ${currentForm.farmSitio}, Canlaon City`;
    if (newFarmLocation !== originalData.farmLocation) highlights.farmLocation = true;
    if (currentForm.hectares !== originalData.hectares) highlights.hectares = true;
    if (JSON.stringify(currentForm.coordinates) !== JSON.stringify(originalData.coordinates)) highlights.coordinates = true;

    const cropChanges = farmerVegetables.some((crop, index) => {
      const oldCrop = originalVegetables[index];
      if (!oldCrop) return true;
      return crop.name !== oldCrop.name || crop.plantingDate !== oldCrop.plantingDate || crop.harvestDate !== oldCrop.harvestDate;
    }) || farmerVegetables.length !== originalVegetables.length;
    if (cropChanges) highlights.crops = true;

    setUpdateHighlights(highlights);
  };

  const handleNewCropChange = (e) => {
    const { name, value } = e.target;
    setNewCrop((prevData) => {
      const updatedCrop = { ...prevData, [name]: value };

      if (name === "plantingDate" && updatedCrop.name && value) {
        const plantingDate = new Date(value);
        const selectedVeggie = vegetables.find(v => v.name === updatedCrop.name);
        if (selectedVeggie && selectedVeggie.harvestAfter) {
          const harvestDate = new Date(plantingDate);
          harvestDate.setDate(plantingDate.getDate() + selectedVeggie.harvestAfter);
          updatedCrop.harvestDate = harvestDate.toISOString().split("T")[0];
        }
      } else if (name === "name" && value && updatedCrop.plantingDate) {
        const plantingDate = new Date(updatedCrop.plantingDate);
        const selectedVeggie = vegetables.find(v => v.name === value);
        if (selectedVeggie && selectedVeggie.harvestAfter) {
          const harvestDate = new Date(plantingDate);
          harvestDate.setDate(plantingDate.getDate() + selectedVeggie.harvestAfter);
          updatedCrop.harvestDate = harvestDate.toISOString().split("T")[0];
        }
      }

      return updatedCrop;
    });
    detectChanges(editForm);
  };

  const calculateDuration = (days) => {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return months > 0 ? `${months} month${months > 1 ? "s" : ""}${remainingDays > 0 ? ` ${remainingDays} day${remainingDays > 1 ? "s" : ""}` : ""}` : `${days} day${days > 1 ? "s" : ""}`;
  };

  const addCrop = () => {
    if (newCrop.name && newCrop.plantingDate && newCrop.harvestDate && vegetables.some(v => v.name === newCrop.name)) {
      setFarmerVegetables((prev) => [...prev, { ...newCrop }]);
      setNewCrop({ name: "", plantingDate: "", harvestDate: "" });
      detectChanges(editForm);
    }
  };

  const removeCrop = async (cropId, index) => {
    if (cropId) {
      await deleteDoc(doc(db, "vegetables", cropId));
    }
    setFarmerVegetables((prev) => prev.filter((_, i) => i !== index));
    detectChanges(editForm);
  };

  const updateCrop = (index, field, value) => {
    setFarmerVegetables((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      if (field === "plantingDate" || field === "name") {
        const crop = updated[index];
        if (crop.name && crop.plantingDate) {
          const plantingDate = new Date(crop.plantingDate);
          const selectedVeggie = vegetables.find(v => v.name === crop.name);
          if (selectedVeggie && selectedVeggie.harvestAfter) {
            const harvestDate = new Date(plantingDate);
            harvestDate.setDate(plantingDate.getDate() + selectedVeggie.harvestAfter);
            updated[index].harvestDate = harvestDate.toISOString().split("T")[0];
          }
        }
      }
      return updated;
    });
    detectChanges(editForm);
  };

  const handleSave = async (farmerId) => {
    if (isGeocoding) {
      alert("Waiting for location geocoding. Please try again shortly.");
      return;
    }
    try {
      const farmerRef = doc(db, "farmers", farmerId);

      const updatedData = {
        fullName: editForm.fullName,
        contact: editForm.contact,
        address: `${editForm.addressBarangay}, ${editForm.addressSitio}, Canlaon City`,
        farmLocation: `${editForm.farmBarangay}, ${editForm.farmSitio}, Canlaon City`,
        coordinates: editForm.coordinates,
        area: editForm.area,
        hectares: parseFloat(editForm.hectares) || 0,
      };

      await updateDoc(farmerRef, updatedData);

      // Sync vegetables
      const vegetableQuery = query(collection(db, "vegetables"), where("farmerId", "==", farmerId));
      const vegetableSnapshot = await getDocs(vegetableQuery);
      const deletePromises = vegetableSnapshot.docs.map((vegDoc) => deleteDoc(vegDoc.ref));
      await Promise.all(deletePromises);

      const addPromises = farmerVegetables.map((crop) =>
        addDoc(collection(db, "vegetables"), {
          name: crop.name,
          farmerId: farmerId,
          plantingDate: crop.plantingDate,
          harvestDate: crop.harvestDate,
        })
      );
      await Promise.all(addPromises);

      setFarmers((prev) =>
        prev.map((farmer) =>
          farmer.id === farmerId
            ? { ...farmer, ...updatedData, mainCrops: farmerVegetables }
            : farmer
        )
      );
      setEditingFarmer(null);
      setFarmerVegetables([]);
      setOriginalVegetables([]);
      setUpdateHighlights({});
      logActivity('update', 'Farmer', editForm.fullName, auth.currentUser?.displayName || 'Admin');
      alert("Farmer updated successfully!");
    } catch (error) {
      console.error("Error updating farmer:", error);
      alert("Error updating farmer.");
    }
  };

  const handleDelete = async (farmerId) => {
    if (window.confirm("Are you sure you want to delete this farmer?")) {
      try {
        await deleteDoc(doc(db, "farmers", farmerId));
        const vegetableQuery = query(
          collection(db, "vegetables"),
          where("farmerId", "==", farmerId)
        );
        const vegetableSnapshot = await getDocs(vegetableQuery);
        const deletePromises = vegetableSnapshot.docs.map((vegDoc) =>
          deleteDoc(doc(db, "vegetables", vegDoc.id))
        );
        await Promise.all(deletePromises);
        setFarmers((prev) => prev.filter((farmer) => farmer.id !== farmerId));
        const deletedFarmer = farmers.find((f) => f.id === farmerId);
        logActivity('delete', 'Farmer', deletedFarmer?.fullName || farmerId, auth.currentUser?.displayName || 'Admin');
        alert("Farmer deleted successfully!");
      } catch (error) {
        console.error("Error deleting farmer:", error);
        alert("Error deleting farmer.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${darkMode ? "bg-slate-950 text-white" : "bg-white text-gray-900"} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`w-16 h-16 border-4 ${darkMode ? "border-slate-800 border-t-green-500" : "border-green-200 border-t-green-600"} rounded-full animate-spin mx-auto mb-4`}></div>
          <p className={darkMode ? "text-slate-400" : "text-gray-600"}>Loading farmer profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? "bg-slate-950" : "bg-gray-50"} transition-colors duration-300`}>
      {/* Header */}
      <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-100"} border-b transition-colors duration-300`}>
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <FaUserCircle className="text-white text-lg" />
              </div>
              <div>
                <h1 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Farmer Profiles</h1>
                <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-500"}`}>{farmers.length} registered farmers</p>
              </div>
            </div>
            <Link
              to="/home/maps"
              className={`px-4 py-2 ${darkMode ? "bg-slate-800 text-green-400 border-slate-700 hover:bg-slate-700" : "bg-white text-green-600 border-green-600 hover:bg-gray-50"} rounded-lg flex items-center border transition-colors`}
            >
              <FaLocationArrow className="mr-2" />
              View Map
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-6 pt-2 pb-8">
        {/* Search and Filter Bar */}
        <div className={`${darkMode ? "bg-slate-900 border-slate-800 shadow-xl" : "bg-white border-gray-200"} rounded-xl border p-6 mb-6 transition-colors duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-700"} mb-2 flex items-center`}>
                <FaSearch className={`mr-2 ${darkMode ? "text-slate-500" : "text-gray-400"}`} />
                Search Farmers
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full px-4 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-green-600" : "bg-white border-gray-300 text-gray-900 focus:ring-green-500"} border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                />
              </div>
            </div>

            <div>
              <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-700"} mb-2 flex items-center`}>
                <FaFilter className={`mr-2 ${darkMode ? "text-slate-500" : "text-gray-400"}`} />
                Filter by Location
              </label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className={`w-full px-4 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-green-600" : "bg-white border-gray-300 text-gray-900 focus:ring-green-500"} border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
              >
                <option value="" className={darkMode ? "bg-slate-800" : ""}>All Locations</option>
                {uniqueLocations.map((location) => (
                  <option key={location} value={location} className={darkMode ? "bg-slate-800" : ""}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-700"} mb-2`}>
                View Mode
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode("card")}
                  className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all ${viewMode === "card"
                    ? "bg-green-600 text-white shadow-lg shadow-green-900/20"
                    : darkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  <FaTh />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all ${viewMode === "list"
                    ? "bg-green-600 text-white shadow-lg shadow-green-900/20"
                    : darkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  <FaList />
                  <span>List</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span className={darkMode ? "text-slate-500" : ""}>
              Showing {filteredFarmers.length} of {farmers.length} farmers
            </span>
            {searchQuery || locationFilter ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setLocationFilter("");
                }}
                className="text-green-600 hover:text-green-700 flex items-center font-medium"
              >
                <FaTimes className="mr-1" />
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Farmers Grid/List */}
        {viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFarmers.map((farmer) => (
              <div
                key={farmer.id}
                className={`${darkMode ? "bg-slate-900 border-slate-800 shadow-xl" : "bg-white border-gray-200"} rounded-xl border overflow-hidden hover:shadow-2xl transition-all duration-300`}
              >
                {/* Profile Header */}
                <div className={`${darkMode ? "bg-slate-800/50 border-slate-700" : "bg-gradient-to-r from-green-50 to-emerald-50 border-gray-100"} p-6 border-b transition-colors duration-300`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-900/10">
                        <FaUser className="text-white text-xl" />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"} text-lg`}>
                          {editingFarmer === farmer.id ? (
                            <input
                              type="text"
                              name="fullName"
                              value={editForm.fullName}
                              onChange={handleEditChange}
                              className={`text-lg font-semibold border rounded px-2 py-1 w-full ${updateHighlights.fullName ? (darkMode ? "bg-yellow-900/20 border-yellow-700 text-yellow-100" : "bg-yellow-50 border-yellow-200") : (darkMode ? "bg-slate-800 border-slate-700 text-white" : "border-gray-300")}`}
                            />
                          ) : (
                            farmer.fullName
                          )}
                        </h3>
                        <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Farmer ID: {farmer.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(farmer)}
                        className={`p-2 ${darkMode ? "text-slate-400 hover:text-green-400 hover:bg-slate-700" : "text-gray-400 hover:text-green-600 hover:bg-green-50"} rounded-lg transition-colors`}
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(farmer.id)}
                        className={`p-2 ${darkMode ? "text-slate-400 hover:text-red-400 hover:bg-slate-700" : "text-gray-400 hover:text-red-600 hover:bg-red-50"} rounded-lg transition-colors`}
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Farmer Details */}
                <div className="p-6">
                  <div className="space-y-4">
                    {/* Contact */}
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 ${darkMode ? "bg-blue-900/20" : "bg-blue-50"} rounded-lg flex items-center justify-center`}>
                        <FaPhone className={darkMode ? "text-blue-400" : "text-blue-600"} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Contact</p>
                        {editingFarmer === farmer.id ? (
                          <input
                            type="text"
                            name="contact"
                            value={editForm.contact}
                            onChange={handleEditChange}
                            className={`w-full border rounded px-3 py-1 ${updateHighlights.contact ? (darkMode ? "bg-yellow-900/20 border-yellow-700 text-yellow-100" : "bg-yellow-50 border-yellow-200") : (darkMode ? "bg-slate-800 border-slate-700 text-white" : "border-gray-300")}`}
                            placeholder="09123456789"
                          />
                        ) : (
                          <p className={darkMode ? "text-slate-200" : "text-gray-900"}>{farmer.contact}</p>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 ${darkMode ? "bg-green-900/20" : "bg-green-50"} rounded-lg flex items-center justify-center`}>
                        <FaMapMarkerAlt className={darkMode ? "text-green-400" : "text-green-600"} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Address</p>
                        {editingFarmer === farmer.id ? (
                          <div className="space-y-2">
                            <select
                              name="addressBarangay"
                              value={editForm.addressBarangay}
                              onChange={handleEditChange}
                              className={`w-full border rounded px-3 py-1 ${updateHighlights.address ? (darkMode ? "bg-yellow-900/20 border-yellow-700 text-yellow-100" : "bg-yellow-50 border-yellow-200") : (darkMode ? "bg-slate-800 border-slate-700 text-white" : "border-gray-300")}`}
                            >
                              <option value="" className={darkMode ? "bg-slate-800" : ""}>Select Barangay</option>
                              {Object.keys(canlaonLocations).map((barangay) => (
                                <option key={barangay} value={barangay} className={darkMode ? "bg-slate-800" : ""}>
                                  {barangay}
                                </option>
                              ))}
                            </select>
                            <select
                              name="addressSitio"
                              value={editForm.addressSitio}
                              onChange={handleEditChange}
                              className={`w-full border rounded px-3 py-1 ${updateHighlights.address ? (darkMode ? "bg-yellow-900/20 border-yellow-700 text-yellow-100" : "bg-yellow-50 border-yellow-200") : (darkMode ? "bg-slate-800 border-slate-700 text-white" : "border-gray-300")}`}
                              disabled={!selectedAddressBarangay}
                            >
                              <option value="" className={darkMode ? "bg-slate-800" : ""}>Select Sitio</option>
                              {selectedAddressBarangay &&
                                canlaonLocations[selectedAddressBarangay].sitios.map((sitio) => (
                                  <option key={sitio.name} value={sitio.name} className={darkMode ? "bg-slate-800" : ""}>
                                    {sitio.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <p className={darkMode ? "text-slate-200" : "text-gray-900"}>{farmer.address}</p>
                        )}
                      </div>
                    </div>

                    {/* Farm Details */}
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 ${darkMode ? "bg-amber-900/20" : "bg-amber-50"} rounded-lg flex items-center justify-center`}>
                        <FaTractor className={darkMode ? "text-amber-400" : "text-amber-600"} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Farm Location</p>
                        {editingFarmer === farmer.id ? (
                          <div className="space-y-2">
                            <select
                              name="farmBarangay"
                              value={editForm.farmBarangay}
                              onChange={handleEditChange}
                              className={`w-full border rounded px-3 py-1 ${updateHighlights.farmLocation ? (darkMode ? "bg-yellow-900/20 border-yellow-700 text-yellow-100" : "bg-yellow-50 border-yellow-200") : (darkMode ? "bg-slate-800 border-slate-700 text-white" : "border-gray-300")}`}
                            >
                              <option value="" className={darkMode ? "bg-slate-800" : ""}>Select Barangay</option>
                              {Object.keys(canlaonLocations).map((barangay) => (
                                <option key={barangay} value={barangay} className={darkMode ? "bg-slate-800" : ""}>
                                  {barangay}
                                </option>
                              ))}
                            </select>
                            <select
                              name="farmSitio"
                              value={editForm.farmSitio}
                              onChange={handleEditChange}
                              className={`w-full border rounded px-3 py-1 ${updateHighlights.farmLocation ? (darkMode ? "bg-yellow-900/20 border-yellow-700 text-yellow-100" : "bg-yellow-50 border-yellow-200") : (darkMode ? "bg-slate-800 border-slate-700 text-white" : "border-gray-300")}`}
                              disabled={!selectedFarmBarangay}
                            >
                              <option value="" className={darkMode ? "bg-slate-800" : ""}>Select Sitio</option>
                              {selectedFarmBarangay &&
                                canlaonLocations[selectedFarmBarangay].sitios.map((sitio) => (
                                  <option key={sitio.name} value={sitio.name} className={darkMode ? "bg-slate-800" : ""}>
                                    {sitio.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <p className={darkMode ? "text-slate-200" : "text-gray-900"}>{farmer.farmLocation}</p>
                        )}
                      </div>
                    </div>

                    {/* Farm Size */}
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 ${darkMode ? "bg-purple-900/20" : "bg-purple-50"} rounded-lg flex items-center justify-center`}>
                        <FaTractor className={darkMode ? "text-purple-400" : "text-purple-600"} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Farm Size</p>
                        {editingFarmer === farmer.id ? (
                          <input
                            type="number"
                            name="hectares"
                            value={editForm.hectares}
                            onChange={handleEditChange}
                            step="0.01"
                            min="0"
                            className={`w-full border rounded px-3 py-1 ${updateHighlights.hectares ? (darkMode ? "bg-yellow-900/20 border-yellow-700 text-yellow-100" : "bg-yellow-50 border-yellow-200") : (darkMode ? "bg-slate-800 border-slate-700 text-white" : "border-gray-300")}`}
                          />
                        ) : (
                          <p className={darkMode ? "text-slate-200" : "text-gray-900"}>{farmer.hectares || "0"} hectares</p>
                        )}
                      </div>
                    </div>

                    {/* Crops Section */}
                    <div className={`${darkMode ? "border-slate-800" : "border-gray-100"} border-t pt-4 mt-4 transition-colors`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"} flex items-center`}>
                          <FaCrop className="mr-2 text-green-600" />
                          Current Crops
                        </p>
                        <span className={`${darkMode ? "bg-green-600/20 text-green-400" : "bg-green-100 text-green-700"} text-xs px-2 py-1 rounded-full font-medium`}>
                          {farmer.mainCrops?.length || 0} crops
                        </span>
                      </div>

                      {editingFarmer === farmer.id ? (
                        <div className={`space-y-3 ${updateHighlights.crops ? (darkMode ? "bg-yellow-900/10 p-3 rounded-lg" : "bg-yellow-50 p-3 rounded-lg") : ""}`}>
                          {farmerVegetables.map((crop, index) => {
                            const oldCrop = originalVegetables[index];
                            const isChanged = oldCrop && (crop.name !== oldCrop.name || crop.plantingDate !== oldCrop.plantingDate || crop.harvestDate !== oldCrop.harvestDate);
                            const isNew = !oldCrop;

                            return (
                              <div key={index} className={`p-3 rounded-lg border ${isChanged || isNew ? (darkMode ? "border-yellow-700 bg-yellow-900/20" : "border-yellow-200 bg-yellow-50") : (darkMode ? "border-slate-700 bg-slate-800" : "border-gray-200")}`}>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Crop</label>
                                    <select
                                      value={crop.name}
                                      onChange={(e) => updateCrop(index, "name", e.target.value)}
                                      className={`w-full text-sm border rounded px-2 py-1 ${darkMode ? "bg-slate-700 border-slate-600 text-white" : "bg-white border-gray-300"}`}
                                    >
                                      <option value="" className={darkMode ? "bg-slate-800" : ""}>Select</option>
                                      {vegetables.map((veg) => (
                                        <option key={veg.id} value={veg.name} className={darkMode ? "bg-slate-800" : ""}>
                                          {veg.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Planting</label>
                                    <input
                                      type="date"
                                      value={crop.plantingDate}
                                      onChange={(e) => updateCrop(index, "plantingDate", e.target.value)}
                                      className={`w-full text-sm border rounded px-2 py-1 ${darkMode ? "bg-slate-700 border-slate-600 text-white fill-white" : "bg-white border-gray-300"}`}
                                    />
                                  </div>
                                  <div>
                                    <label className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Harvest</label>
                                    <input
                                      type="date"
                                      value={crop.harvestDate}
                                      onChange={(e) => updateCrop(index, "harvestDate", e.target.value)}
                                      className={`w-full text-sm border rounded px-2 py-1 ${darkMode ? "bg-slate-700 border-slate-600 text-white fill-white" : "bg-white border-gray-300"}`}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <button
                                    onClick={() => removeCrop(crop.id, index)}
                                    className={`text-xs ${darkMode ? "text-red-400 hover:text-red-300" : "text-red-600 hover:text-red-700"} flex items-center font-medium`}
                                  >
                                    <FaTimes className="mr-1" />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Add New Crop */}
                          <div className={`border border-dashed ${darkMode ? "border-slate-700 bg-slate-800/50" : "border-gray-300 bg-gray-50/50"} rounded-lg p-3 transition-colors`}>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div>
                                <label className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>New Crop</label>
                                <select
                                  name="name"
                                  value={newCrop.name}
                                  onChange={handleNewCropChange}
                                  className={`w-full text-sm border rounded px-2 py-1 ${darkMode ? "bg-slate-700 border-slate-600 text-white" : "bg-white border-gray-300"}`}
                                >
                                  <option value="" className={darkMode ? "bg-slate-800" : ""}>Select</option>
                                  {vegetables.map((veg) => (
                                    <option key={veg.id} value={veg.name} className={darkMode ? "bg-slate-800" : ""}>
                                      {veg.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Planting</label>
                                <input
                                  type="date"
                                  name="plantingDate"
                                  value={newCrop.plantingDate}
                                  onChange={handleNewCropChange}
                                  className={`w-full text-sm border rounded px-2 py-1 ${darkMode ? "bg-slate-700 border-slate-600 text-white fill-white" : "bg-white border-gray-300"}`}
                                />
                              </div>
                              <div>
                                <label className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>Harvest</label>
                                <input
                                  type="date"
                                  name="harvestDate"
                                  value={newCrop.harvestDate}
                                  onChange={handleNewCropChange}
                                  className={`w-full text-sm border rounded px-2 py-1 ${darkMode ? "bg-slate-700 border-slate-600 text-white fill-white" : "bg-white border-gray-300"}`}
                                />
                              </div>
                            </div>
                            <button
                              onClick={addCrop}
                              className={`w-full ${darkMode ? "text-green-400 border-green-400/50 hover:bg-green-400/10" : "text-green-600 border-green-600 hover:bg-green-50"} text-sm flex items-center justify-center border rounded px-3 py-1.5 transition-all font-medium`}
                            >
                              <FaPlus className="mr-2" />
                              Add Crop
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {farmer.mainCrops?.length > 0 ? (
                            farmer.mainCrops.map((crop, index) => (
                              <div key={index} className={`flex items-center justify-between p-2.5 ${darkMode ? "bg-slate-800 shadow-inner" : "bg-gray-50"} rounded-lg transition-colors`}>
                                <div>
                                  <p className={`text-sm font-medium ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{crop.name}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className={`text-sm ${darkMode ? "text-slate-500" : "text-gray-500"} text-center py-2`}>No crops registered</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit Mode Actions */}
                  {editingFarmer === farmer.id && (
                    <div className={`mt-6 pt-6 border-t ${darkMode ? "border-slate-800" : "border-gray-100"} transition-colors`}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          <span className={`px-2 py-1 rounded font-medium ${updateHighlights.fullName || updateHighlights.contact || updateHighlights.address || updateHighlights.farmLocation || updateHighlights.hectares || updateHighlights.crops ? (darkMode ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700") : (darkMode ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-600")}`}>
                            {Object.keys(updateHighlights).filter(key => updateHighlights[key]).length} changes
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSave(farmer.id)}
                            disabled={isGeocoding}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center disabled:opacity-50 shadow-lg shadow-green-900/20"
                          >
                            <FaSave className="mr-2" />
                            {isGeocoding ? "Processing..." : "Save Changes"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingFarmer(null);
                              setUpdateHighlights({});
                            }}
                            className={`px-4 py-2 ${darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"} rounded-lg transition-all flex items-center`}
                          >
                            <FaBan className="mr-2" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-xl border overflow-hidden transition-colors`}>
            <table className="w-full">
              <thead className={`${darkMode ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-100"} border-b`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Farmer</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Contact</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Location</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Crops</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? "divide-slate-800" : "divide-gray-100"}`}>
                {filteredFarmers.map((farmer) => (
                  <tr 
                    key={farmer.id} 
                    className={`${darkMode ? "hover:bg-green-900/10" : "hover:bg-green-50"} transition-colors cursor-help group`}
                    onMouseEnter={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = setTimeout(() => {
                        setHoveredFarmer(farmer);
                      }, 400); // 400ms delay for smoothness
                    }}
                    onMouseLeave={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      setHoveredFarmer(null);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 ${darkMode ? "bg-green-900/20" : "bg-green-100"} rounded-full flex items-center justify-center mr-3`}>
                          <FaUser className={darkMode ? "text-green-400" : "text-green-600"} />
                        </div>
                        <div>
                          <p className={`font-medium ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{farmer.fullName}</p>
                          <p className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>{farmer.hectares || 0} hectares</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className={darkMode ? "text-slate-400" : "text-gray-900"}>{farmer.contact}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className={darkMode ? "text-slate-400" : "text-gray-900"}>{farmer.farmLocation}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {farmer.mainCrops?.slice(0, 3).map((crop, index) => (
                          <span key={index} className={`px-2 py-1 ${darkMode ? "bg-green-900/30 text-green-400 border border-green-800/30" : "bg-green-100 text-green-700"} text-xs rounded-full font-medium`}>
                            {crop.name}
                          </span>
                        ))}
                        {farmer.mainCrops?.length > 3 && (
                          <span className={`px-2 py-1 ${darkMode ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-600"} text-xs rounded-full`}>
                            +{farmer.mainCrops.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(farmer)}
                          className={`${darkMode ? "text-green-400 hover:text-green-300 hover:bg-green-900/20" : "text-green-600 hover:text-green-700 hover:bg-green-50"} p-2 rounded-lg transition-colors`}
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(farmer.id)}
                          className={`${darkMode ? "text-red-400 hover:text-red-300 hover:bg-red-900/20" : "text-red-600 hover:text-red-700 hover:bg-red-50"} p-2 rounded-lg transition-colors`}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {filteredFarmers.length === 0 && !isLoading && (
          <div className={`text-center py-12 ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-xl border transition-colors`}>
            <div className={`w-16 h-16 mx-auto ${darkMode ? "bg-slate-800" : "bg-gray-100"} rounded-full flex items-center justify-center mb-4`}>
              <FaUser className={darkMode ? "text-slate-600" : "text-gray-400"} text-2xl />
            </div>
            <h3 className={`text-lg font-medium ${darkMode ? "text-slate-200" : "text-gray-900"} mb-2`}>No farmers found</h3>
            <p className={`max-w-md mx-auto ${darkMode ? "text-slate-500" : "text-gray-500"}`}>
              {searchQuery || locationFilter
                ? "Try adjusting your search or filter to find what you're looking for."
                : "No farmers have been registered yet."}
            </p>
            {(searchQuery || locationFilter) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setLocationFilter("");
                }}
                className={`mt-4 px-4 py-2 ${darkMode ? "text-green-400 hover:bg-green-900/20" : "text-green-600 hover:bg-green-50"} rounded-lg transition-colors font-medium`}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`${darkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-gray-100"} border-t py-6 mt-8 transition-colors`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className={`${darkMode ? "text-slate-500" : "text-gray-500"} text-sm`}>
              <p>Department of Agriculture - Canlaon City</p>
              <p className="text-xs mt-1">Farmer Management System</p>
            </div>
            <div className={`flex items-center space-x-4 text-sm ${darkMode ? "text-slate-600" : "text-gray-500"} mt-4 md:mt-0`}>
              <span>Total: {farmers.length} farmers</span>
              <span>Active: {farmers.length} registered</span>
            </div>
          </div>
        </div>
      </div>
      {/* Quick Preview Modal Overlay */}
      {hoveredFarmer && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${darkMode ? "bg-black/60" : "bg-slate-900/10"} backdrop-blur-[2px] pointer-events-none`}>
          <div className={`${darkMode ? "bg-slate-900 border-slate-700 shadow-emerald-900/20" : "bg-white border-slate-100 shadow-slate-200/50"} w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in duration-200 pointer-events-auto`}>
            {/* Header */}
            <div className={`bg-gradient-to-br ${darkMode ? "from-green-700 to-emerald-900" : "from-green-600 to-emerald-700"} p-6 text-white relative`}>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 ${darkMode ? "bg-white/10" : "bg-white/20"} rounded-2xl backdrop-blur-md flex items-center justify-center border border-white/30`}>
                  <FaUser className="text-2xl text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">{hoveredFarmer.fullName}</h3>
                  <p className="text-green-100 text-xs font-bold uppercase tracking-widest opacity-80 line-clamp-1">Farmer ID: {hoveredFarmer.id}</p>
                </div>
              </div>
              <div className="absolute top-6 right-6 text-white/20">
                <FaInfoCircle className="text-4xl" />
              </div>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className={`text-[10px] font-black ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-widest mb-2`}>Contact Details</p>
                  <p className={`text-sm font-bold ${darkMode ? "text-slate-200" : "text-slate-700"} flex items-center gap-2`}>
                    <span className={`w-6 h-6 ${darkMode ? "bg-slate-800" : "bg-slate-100"} rounded-full flex items-center justify-center`}><FaPhone className={`text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`} /></span>
                    {hoveredFarmer.contact || "No contact info"}
                  </p>
                </div>
                <div>
                  <p className={`text-[10px] font-black ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-widest mb-2`}>Farm Size</p>
                  <p className={`text-sm font-bold ${darkMode ? "text-slate-200" : "text-slate-700"} flex items-center gap-2`}>
                     <span className={`w-6 h-6 ${darkMode ? "bg-slate-800" : "bg-slate-100"} rounded-full flex items-center justify-center`}><FaTractor className={`text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`} /></span>
                     {hoveredFarmer.hectares || 0} Hectares
                  </p>
                </div>
              </div>

              <div>
                <p className={`text-[10px] font-black ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-widest mb-2`}>Primary Address</p>
                <p className={`text-sm font-bold ${darkMode ? "text-slate-300" : "text-slate-700"} leading-relaxed ${darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100"} p-3 rounded-xl border`}>
                  {hoveredFarmer.address}
                </p>
              </div>

              <div>
                <p className={`text-[10px] font-black ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-widest mb-2`}>Farm Location</p>
                <p className={`text-sm font-bold ${darkMode ? "text-slate-300" : "text-slate-700"} leading-relaxed ${darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100"} p-3 rounded-xl border`}>
                  {hoveredFarmer.farmLocation}
                </p>
              </div>

              {/* Registered Crops */}
              <div className="pt-2">
                <p className={`text-[10px] font-black ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-widest mb-3`}>Registered Crops ({hoveredFarmer.mainCrops?.length || 0})</p>
                <div className="flex flex-wrap gap-2">
                  {hoveredFarmer.mainCrops?.length > 0 ? (
                    hoveredFarmer.mainCrops.map((crop, idx) => (
                      <div key={idx} className={`${darkMode ? "bg-green-900/30 text-green-400 border-green-800/30" : "bg-green-50 text-green-700 border-green-100/50"} text-[10px] font-black uppercase px-3 py-1.5 rounded-full border`}>
                        {crop.name}
                      </div>
                    ))
                  ) : (
                    <p className={`text-xs ${darkMode ? "text-slate-600" : "text-slate-400"} italic`}>No crops registered</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Tip */}
            <div className={`px-8 py-4 ${darkMode ? "bg-slate-800/80 border-slate-700" : "bg-slate-50 border-slate-100"} border-t flex items-center justify-between`}>
              <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"} font-bold uppercase tracking-wider`}>Quick Preview Mode</p>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Farmer;