import React, { useEffect, useState } from "react";
import { db } from "../config/firebaseConfig";
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc, addDoc } from "firebase/firestore";
import { FaSearch, FaUser, FaPhone, FaMapMarkerAlt, FaTractor, FaEdit, FaTrash, FaList, FaTh, FaMapMarkerAlt as FaMapIcon, FaPlus, FaTimes, FaCalendarAlt, FaInfoCircle } from "react-icons/fa";
import { Link } from "react-router-dom";
import canlaonLocations from "../data/canlaonLocations";
import axios from 'axios';

const Farmer = () => {
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
  const [farmerVegetables, setFarmerVegetables] = useState([]); // Current editing crops
  const [originalVegetables, setOriginalVegetables] = useState([]); // Snapshot for comparison
  const [originalData, setOriginalData] = useState({}); // For other fields comparison
  const [updateHighlights, setUpdateHighlights] = useState({}); // Track changes for highlighting
  const [isGeocoding, setIsGeocoding] = useState(false); // For async geocoding

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const farmerSnapshot = await getDocs(collection(db, "farmers"));
        const farmerList = await Promise.all(
          farmerSnapshot.docs.map(async (doc) => {
            const farmerData = { id: doc.id, ...doc.data() };
            const vegetableQuery = query(
              collection(db, "vegetables"),
              where("farmerId", "==", farmerData.id)
            );
            const vegetableSnapshot = await getDocs(vegetableQuery);
            const farmerCrops = vegetableSnapshot.docs.map((vegDoc) => ({ id: vegDoc.id, ...vegDoc.data() }));
            return { ...farmerData, mainCrops: farmerCrops };
          })
        );
        setFarmers(farmerList);
      } catch (error) {
        console.error("Error fetching farmers:", error);
      }
    };

    const fetchVegetables = async () => {
      try {
        const veggieSnapshot = await getDocs(collection(db, "vegetables_list"));
        const veggieList = veggieSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          harvestAfter: doc.data().harvestAfter || 60,
        }));
        setVegetables(veggieList);
      } catch (error) {
        console.error("Error fetching vegetables:", error);
      }
    };

    fetchFarmers();
    fetchVegetables();
  }, []);

  const filteredFarmers = farmers.filter((farmer) =>
    farmer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (locationFilter === "" || farmer.farmLocation.toLowerCase().includes(locationFilter.toLowerCase()))
  );

  const uniqueLocations = [...new Set(farmers.map(farmer => farmer.farmLocation))].sort();

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
    setOriginalVegetables(JSON.parse(JSON.stringify(crops))); // Deep copy for old values
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
    setUpdateHighlights({}); // Reset highlights
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

    // Auto-update coordinates and area on farm location or hectares change
    if (["farmBarangay", "farmSitio", "hectares"].includes(name)) {
      const currentForm = { ...editForm, [name]: updatedValue };
      if (currentForm.farmBarangay && currentForm.farmSitio && currentForm.hectares) {
        const barangayData = canlaonLocations[currentForm.farmBarangay];
        let coords = [10.3860, 123.2220]; // default
        if (barangayData) {
          const sitioData = barangayData.sitios.find(s => s.name === currentForm.farmSitio);
          coords = sitioData ? sitioData.coordinates : barangayData.coordinates;
        } else {
          // Fallback to geocode if not in local data
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

    // For crops
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
    return months > 0 ? `~${months} month${months > 1 ? "s" : ""}${remainingDays > 0 ? ` and ${remainingDays} day${remainingDays > 1 ? "s" : ""}` : ""}` : `~${days} day${days > 1 ? "s" : ""}`;
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
      const flattenedCrops = farmerVegetables.reduce((acc, crop, index) => {
        acc[`crop${index + 1}`] = { name: crop.name, plantingDate: crop.plantingDate, harvestDate: crop.harvestDate };
        return acc;
      }, {});

      const updatedData = {
        fullName: editForm.fullName,
        contact: editForm.contact,
        address: `${editForm.addressBarangay}, ${editForm.addressSitio}, Canlaon City`,
        farmLocation: `${editForm.farmBarangay}, ${editForm.farmSitio}, Canlaon City`,
        mainCrops: flattenedCrops,
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
        alert("Farmer deleted successfully!");
      } catch (error) {
        console.error("Error deleting farmer:", error);
        alert("Error deleting farmer.");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-green-700 text-center mb-6 flex items-center justify-center">
        Farmer Profiles
      </h2>

      {/* Filters, View Mode Toggle, and Back to Map Button */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center border rounded-full p-2 bg-gray-100 shadow-sm">
            <FaSearch className="text-gray-500 mx-2" />
            <input
              type="text"
              placeholder="Search farmers by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-gray-700"
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center border rounded-full p-2 bg-gray-100 shadow-sm">
            <FaMapMarkerAlt className="text-gray-500 mx-2" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-gray-700"
            >
              <option value="">Filter by Location</option>
              {uniqueLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("card")}
            className={`p-2 rounded-full ${viewMode === "card" ? "bg-green-600 text-white" : "bg-gray-200"}`}
            title="Card View"
          >
            <FaTh />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-full ${viewMode === "list" ? "bg-green-600 text-white" : "bg-gray-200"}`}
            title="List View"
          >
            <FaList />
          </button>
          <Link
            to="/home/maps"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
          >
            <FaMapIcon className="mr-2" />
            Back to Map
          </Link>
        </div>
      </div>

      {/* Farmer Profiles */}
      {viewMode === "card" ? (
        <div className="space-y-8">
          {filteredFarmers.length > 0 ? (
            filteredFarmers.map((farmer) => (
              <div
                key={farmer.id}
                className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 hover:border-green-300 transition-all duration-300"
              >
                <div className="h-32 bg-green-200 relative">
                  <div className="absolute -bottom-16 left-6">
                    <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center border-4 border-white shadow-md">
                      <FaUser className="text-gray-600 text-4xl" />
                    </div>
                  </div>
                </div>
                <div className="pt-16 pb-6 px-6">
                  <div className="flex justify-between items-start">
                    <div className="ml-32">
                      {editingFarmer === farmer.id ? (
                        <input
                          type="text"
                          name="fullName"
                          value={editForm.fullName}
                          onChange={handleEditChange}
                          className={`text-2xl font-bold text-gray-800 border rounded p-2 w-full mb-2 ${updateHighlights.fullName ? "bg-yellow-100" : ""}`}
                        />
                      ) : (
                        <h3 className="text-2xl font-bold text-gray-800">{farmer.fullName}</h3>
                      )}
                      <p className="text-gray-500 text-sm">Farmer in Canlaon City</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(farmer)}
                        className="text-blue-500 hover:text-blue-700 p-2 rounded-full bg-blue-50"
                        title="Edit Profile"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(farmer.id)}
                        className="text-red-500 hover:text-red-700 p-2 rounded-full bg-red-50"
                        title="Delete Profile"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  <hr className="my-4 border-gray-200" />

                  {editingFarmer === farmer.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <FaPhone className="text-green-700 mr-3" />
                        <input
                          type="text"
                          name="contact"
                          value={editForm.contact}
                          onChange={handleEditChange}
                          className={`w-full border rounded p-2 text-gray-700 ${updateHighlights.contact ? "bg-yellow-100" : ""}`}
                          placeholder="Contact (11 digits)"
                        />
                      </div>
                      <div className="flex items-center">
                        <FaTractor className="text-green-700 mr-3" />
                        <input
                          type="number"
                          name="hectares"
                          value={editForm.hectares}
                          onChange={handleEditChange}
                          step="0.01"
                          min="0"
                          className={`w-full border rounded p-2 text-gray-700 ${updateHighlights.hectares ? "bg-yellow-100" : ""}`}
                          placeholder="Farm Size (Hectares)"
                        />
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-green-700 mr-3" />
                        <select
                          name="addressBarangay"
                          value={editForm.addressBarangay}
                          onChange={handleEditChange}
                          className={`w-full border rounded p-2 text-gray-700 ${updateHighlights.address ? "bg-yellow-100" : ""}`}
                        >
                          <option value="">Select Barangay (Address)</option>
                          {Object.keys(canlaonLocations).map((barangay) => (
                            <option key={barangay} value={barangay}>
                              {barangay}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-green-700 mr-3" />
                        <select
                          name="addressSitio"
                          value={editForm.addressSitio}
                          onChange={handleEditChange}
                          className={`w-full border rounded p-2 text-gray-700 ${updateHighlights.address ? "bg-yellow-100" : ""}`}
                          disabled={!selectedAddressBarangay}
                        >
                          <option value="">Select Sitio (Address)</option>
                          {selectedAddressBarangay &&
                            canlaonLocations[selectedAddressBarangay].sitios.map((sitio) => (
                              <option key={sitio.name} value={sitio.name}>
                                {sitio.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-green-700 mr-3" />
                        <select
                          name="farmBarangay"
                          value={editForm.farmBarangay}
                          onChange={handleEditChange}
                          className={`w-full border rounded p-2 text-gray-700 ${updateHighlights.farmLocation ? "bg-yellow-100" : ""}`}
                        >
                          <option value="">Select Barangay (Farm)</option>
                          {Object.keys(canlaonLocations).map((barangay) => (
                            <option key={barangay} value={barangay}>
                              {barangay}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-green-700 mr-3" />
                        <select
                          name="farmSitio"
                          value={editForm.farmSitio}
                          onChange={handleEditChange}
                          className={`w-full border rounded p-2 text-gray-700 ${updateHighlights.farmLocation ? "bg-yellow-100" : ""}`}
                          disabled={!selectedFarmBarangay}
                        >
                          <option value="">Select Sitio (Farm)</option>
                          {selectedFarmBarangay &&
                            canlaonLocations[selectedFarmBarangay].sitios.map((sitio) => (
                              <option key={sitio.name} value={sitio.name}>
                                {sitio.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <div className={`space-y-4 p-4 rounded ${updateHighlights.crops ? "bg-yellow-50" : "bg-gray-50"}`}>
                          <h4 className="text-lg font-semibold text-green-700 flex items-center">
                            <FaTractor className="mr-2" /> Crops (Changes highlighted)
                          </h4>
                          <div className="space-y-2">
                            {farmerVegetables.map((crop, index) => {
                              const oldCrop = originalVegetables[index];
                              const isChanged = oldCrop && (crop.name !== oldCrop.name || crop.plantingDate !== oldCrop.plantingDate || crop.harvestDate !== oldCrop.harvestDate);
                              const isNew = !oldCrop;
                              return (
                                <div key={index} className={`grid grid-cols-4 gap-2 items-center p-2 rounded ${isChanged || isNew ? "bg-yellow-100" : ""}`}>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-gray-500">Crop</span>
                                    <select
                                      value={crop.name}
                                      onChange={(e) => updateCrop(index, "name", e.target.value)}
                                      className="border rounded p-1"
                                    >
                                      <option value="">Select Vegetable</option>
                                      {vegetables.map((veg) => (
                                        <option key={veg.id} value={veg.name}>
                                          {veg.name}
                                        </option>
                                      ))}
                                    </select>
                                    {crop.name && vegetables.find(v => v.name === crop.name)?.harvestAfter && (
                                      <p className="text-xs text-gray-600 flex items-center">
                                        <FaInfoCircle className="mr-1" /> {calculateDuration(vegetables.find(v => v.name === crop.name).harvestAfter)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-gray-500">Planting</span>
                                    <input
                                      type="date"
                                      value={crop.plantingDate}
                                      onChange={(e) => updateCrop(index, "plantingDate", e.target.value)}
                                      className="border rounded p-1"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-gray-500">Harvest</span>
                                    <input
                                      type="date"
                                      value={crop.harvestDate}
                                      onChange={(e) => updateCrop(index, "harvestDate", e.target.value)}
                                      className="border rounded p-1"
                                    />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <button
                                      onClick={() => removeCrop(crop.id, index)}
                                      className="text-red-500 mt-4"
                                    >
                                      <FaTimes />
                                    </button>
                                  </div>
                                  {oldCrop && (
                                    <div className="col-span-4 text-xs text-gray-500 mt-1">
                                      Old: {oldCrop.name} (Plant: {oldCrop.plantingDate}, Harvest: {oldCrop.harvestDate})
                                    </div>
                                  )}
                                  {isNew && <div className="col-span-4 text-xs text-blue-500">New crop added</div>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="grid grid-cols-4 gap-2 items-center mt-4">
                            <select
                              name="name"
                              value={newCrop.name}
                              onChange={handleNewCropChange}
                              className="border rounded p-2"
                            >
                              <option value="">Select Vegetable</option>
                              {vegetables.map((veg) => (
                                <option key={veg.id} value={veg.name}>
                                  {veg.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              name="plantingDate"
                              value={newCrop.plantingDate}
                              onChange={handleNewCropChange}
                              className="border rounded p-2"
                            />
                            <input
                              type="date"
                              name="harvestDate"
                              value={newCrop.harvestDate}
                              onChange={handleNewCropChange}
                              className="border rounded p-2"
                            />
                            <button onClick={addCrop} className="text-green-500 border rounded p-2">
                              <FaPlus />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 flex space-x-2 mt-2">
                        <button
                          onClick={() => handleSave(farmer.id)}
                          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 transition"
                          disabled={isGeocoding}
                        >
                          {isGeocoding ? "Geocoding..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingFarmer(null);
                            setUpdateHighlights({});
                          }}
                          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <FaPhone className="text-green-700 mr-3" />
                        <span className="text-gray-700">{farmer.contact}</span>
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-green-700 mr-3" />
                        <span className="text-gray-700">{farmer.address}</span>
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-green-700 mr-3" />
                        <span className="text-gray-700">{farmer.farmLocation}</span>
                      </div>
                      <div className="flex items-center">
                        <FaTractor className="text-green-700 mr-3" />
                        <span className="text-gray-700">
                          {farmer.mainCrops.length > 0 ? farmer.mainCrops.map(c => c.name).join(", ") : "No crops listed"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-6 bg-white rounded-lg shadow-lg">
              <p className="text-gray-500">No farmers found.</p>
            </div>
          )}
        </div>
      ) : (
        /* List view - similar edits can be applied */
        <div className="overflow-x-auto">
          {/* Implement list view with similar editing logic if needed */}
          <p>List view not fully implemented.</p>
        </div>
      )}
    </div>
  );
};

export default Farmer;