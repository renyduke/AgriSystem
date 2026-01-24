import React, { useState, useEffect } from "react";
import { db } from "../../config/firebaseConfig";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { FaUser, FaPhone, FaMapMarkerAlt, FaTractor, FaPlus, FaCalendarAlt, FaTimes, FaInfoCircle, FaSpinner, FaCheckCircle } from "react-icons/fa";
import canlaonLocations from "../../data/canlaonLocations";
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const FarmerRegister = () => {
  const [farmerData, setFarmerData] = useState({
    firstName: "",
    lastName: "",
    age: "",
    sex: "",
    contact: "",
    addressBarangay: "",
    addressSitio: "",
    farmBarangay: "",
    farmSitio: "",
    hectares: "",
    season: "Default",
    landOwnership: "", // Added Land Ownership
    farmType: "", // Added Farm Type
    mainCrops: [],
    area: [],
    coordinates: [10.3860, 123.2220],
  });
  const [selectedAddressBarangay, setSelectedAddressBarangay] = useState("");
  const [selectedFarmBarangay, setSelectedFarmBarangay] = useState("");
  const [newCrop, setNewCrop] = useState({ name: "", plantingDate: "", harvestDate: "" });
  const [error, setError] = useState("");
  const [vegetables, setVegetables] = useState([]);
  const [loadingVegetables, setLoadingVegetables] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingCrop, setIsAddingCrop] = useState(false);
  const [localReply, setLocalReply] = useState(null);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    const fetchVegetables = async () => {
      try {
        setLoadingVegetables(true);
        const veggieSnapshot = await getDocs(collection(db, "vegetables_list"));
        const veggieList = veggieSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          harvestAfter: doc.data().harvestAfter || 60,
        }));
        setVegetables(veggieList);
      } catch (error) {
        console.error("Error fetching vegetables:", error);
        setError("Failed to load vegetables. Please try again.");
      } finally {
        setLoadingVegetables(false);
      }
    };
    fetchVegetables();
  }, []);

  const geocodeAddress = async (address) => {
    try {
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
    }
  };

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFarmerData((prevData) => {
      let updatedValue = value;

      if (name === "firstName" || name === "lastName") {
        updatedValue = capitalizeFirstLetter(value);
      }

      if (name === "contact") {
        updatedValue = value.replace(/[^0-9]/g, "").slice(0, 11);
      }

      if (name === "hectares") {
        updatedValue = value >= 0 ? value : "";
      }

      const updatedData = { ...prevData, [name]: updatedValue };

      if ((name === "farmBarangay" || name === "farmSitio" || name === "hectares") && updatedData.farmBarangay && updatedData.farmSitio && updatedData.hectares) {
        const barangayData = canlaonLocations[updatedData.farmBarangay];
        if (barangayData) {
          const sitioData = barangayData.sitios.find(s => s.name === updatedData.farmSitio);
          const coords = sitioData ? sitioData.coordinates : barangayData.coordinates;
          setFarmerData((prev) => {
            const newData = { ...prev, coordinates: coords };
            const offset = Math.sqrt(parseFloat(updatedData.hectares) * 0.0009) / 2;
            newData.area = [
              coords[0] + offset, coords[1] + offset,
              coords[0] + offset, coords[1] - offset,
              coords[0] - offset, coords[1] - offset,
              coords[0] - offset, coords[1] + offset,
            ];
            return newData;
          });
        } else {
          setIsGeocoding(true);
          geocodeAddress(`${updatedData.farmSitio}, ${updatedData.farmBarangay}`).then((coords) => {
            setIsGeocoding(false);
            if (coords) {
              setFarmerData((prev) => {
                const newData = { ...prev, coordinates: coords };
                const offset = Math.sqrt(parseFloat(updatedData.hectares) * 0.0009) / 2;
                newData.area = [
                  coords[0] + offset, coords[1] + offset,
                  coords[0] + offset, coords[1] - offset,
                  coords[0] - offset, coords[1] - offset,
                  coords[0] - offset, coords[1] + offset,
                ];
                return newData;
              });
            }
          });
        }
      }

      return updatedData;
    });

    if (name === "addressBarangay") {
      setSelectedAddressBarangay(value);
      setFarmerData((prev) => ({ ...prev, addressSitio: "" }));
    }
    if (name === "farmBarangay") {
      setSelectedFarmBarangay(value);
      setFarmerData((prev) => ({ ...prev, farmSitio: "" }));
    }
    setError("");
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
    setError("");
  };

  const calculateDuration = (days) => {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return months > 0 ? `~${months} month${months > 1 ? "s" : ""}${remainingDays > 0 ? ` and ${remainingDays} day${remainingDays > 1 ? "s" : ""}` : ""}` : `~${days} day${days > 1 ? "s" : ""}`;
  };

  const addCrop = () => {
    if (newCrop.name && newCrop.plantingDate && newCrop.harvestDate && vegetables.some(v => v.name === newCrop.name)) {
      const plantingDate = new Date(newCrop.plantingDate);
      const harvestDate = new Date(newCrop.harvestDate);

      if (plantingDate >= harvestDate) {
        setError("Harvest date must be after planting date.");
        return;
      }

      setIsAddingCrop(true);
      setFarmerData((prevData) => ({
        ...prevData,
        mainCrops: [...prevData.mainCrops, { ...newCrop }],
      }));
      setNewCrop({ name: "", plantingDate: "", harvestDate: "" });
      setError("");
      setLocalReply({ type: "success", message: "Crop added successfully (Localhost)" });
      setTimeout(() => {
        setIsAddingCrop(false);
        setLocalReply(null);
      }, 2000);
    } else {
      setError("Please fill out all fields for the crop, and ensure the vegetable is from the predefined list.");
    }
  };

  const removeCrop = (index) => {
    setFarmerData((prevData) => ({
      ...prevData,
      mainCrops: prevData.mainCrops.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (farmerData.mainCrops.length === 0) {
      setError("Please add at least one crop with its timeline.");
      return;
    }

    if (farmerData.contact.length !== 11) {
      setError("Contact number must be exactly 11 digits.");
      return;
    }

    if (!farmerData.hectares || farmerData.hectares <= 0) {
      setError("Please enter a valid farm size in hectares.");
      return;
    }

    if (farmerData.farmBarangay && farmerData.farmSitio && farmerData.hectares && farmerData.area.length < 4) {
      setError("Farm area coordinates are invalid. Please ensure valid barangay, sitio, and farm size are selected.");
      return;
    }

    if (!farmerData.addressBarangay || !farmerData.addressSitio) {
      setError("Please select both address barangay and sitio.");
      return;
    }

    if (!farmerData.farmBarangay || !farmerData.farmSitio) {
      setError("Please select both farm barangay and sitio.");
      return;
    }

    if (!farmerData.landOwnership) {
      setError("Please select land ownership type.");
      return;
    }

    if (!farmerData.farmType) {
      setError("Please select farm type.");
      return;
    }

    if (isGeocoding) {
      setError("Please wait for location data to process.");
      return;
    }

    setIsSubmitting(true);
    try {
      const flattenedCrops = farmerData.mainCrops.reduce((acc, crop, index) => {
        acc[`crop${index + 1}`] = { name: crop.name, plantingDate: crop.plantingDate, harvestDate: crop.harvestDate };
        return acc;
      }, {});

      console.log("Submitting farmer data:", { ...farmerData, mainCrops: flattenedCrops });
      const farmerRef = await addDoc(collection(db, "farmers"), {
        ...farmerData,
        fullName: `${capitalizeFirstLetter(farmerData.firstName)} ${capitalizeFirstLetter(farmerData.lastName)}`,
        address: `${farmerData.addressBarangay}, ${farmerData.addressSitio}, Canlaon City`,
        farmLocation: `${farmerData.farmBarangay}, ${farmerData.farmSitio}, Canlaon City`,
        hectares: parseFloat(farmerData.hectares),
        landOwnership: farmerData.landOwnership, // Added to Firestore
        farmType: farmerData.farmType, // Added to Firestore
        mainCrops: flattenedCrops,
        area: farmerData.area,
      });

      const farmerId = farmerRef.id;
      const vegetablePromises = farmerData.mainCrops.map((crop) =>
        addDoc(collection(db, "vegetables"), {
          name: crop.name,
          farmerId: farmerId,
          plantingDate: crop.plantingDate,
          harvestDate: crop.harvestDate,
        })
      );
      await Promise.all(vegetablePromises);

      setLocalReply({ type: "success", message: "Farmer registered successfully (Localhost)" });
      setShowMapPreview(true);
      setFarmerData({
        firstName: "",
        lastName: "",
        age: "",
        sex: "",
        contact: "",
        addressBarangay: "",
        addressSitio: "",
        farmBarangay: "",
        farmSitio: "",
        hectares: "",
        season: "Default",
        landOwnership: "",
        farmType: "",
        mainCrops: [],
        area: [],
        coordinates: [10.3860, 123.2220],
      });
      setSelectedAddressBarangay("");
      setSelectedFarmBarangay("");
      setNewCrop({ name: "", plantingDate: "", harvestDate: "" });
      setError("");
      setTimeout(() => {
        setLocalReply(null);
        setShowMapPreview(false);
      }, 5000);
    } catch (error) {
      console.error("Error adding farmer: ", error);
      setLocalReply({ type: "error", message: "Error registering farmer (Localhost)" });
      setTimeout(() => setLocalReply(null), 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-green-50 to-teal-100 flex items-center justify-center p-4 md:p-6 ">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-auto p-6 md:p-8 relative">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900 mb-6 text-center flex items-center justify-center">
          <FaUser className="mr-2 text-green-600" /> Farmer Registration
        </h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4 text-center">{error}</div>}
        {localReply && (
          <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-out ${localReply.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {localReply.type === "success" ? <FaCheckCircle className="text-green-600" /> : <FaTimes className="text-red-600" />}
            <span>{localReply.message}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center border rounded-xl p-3 bg-green-50">
              <FaUser className="text-green-700 mx-2" />
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={farmerData.firstName}
                onChange={handleChange}
                className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>
            <div className="flex items-center border rounded-xl p-3 bg-green-50">
              <FaUser className="text-green-700 mx-2" />
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={farmerData.lastName}
                onChange={handleChange}
                className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              name="age"
              placeholder="Age"
              value={farmerData.age}
              onChange={handleChange}
              min="0"
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
            />
            <select
              name="sex"
              value={farmerData.sex}
              onChange={handleChange}
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
            >
              <option value="">Select Sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="flex items-center border rounded-xl p-3 bg-green-50">
            <FaPhone className="text-green-700 mx-2" />
            <input
              type="text"
              name="contact"
              placeholder="Contact Number (11 digits)"
              value={farmerData.contact}
              onChange={handleChange}
              maxLength="11"
              className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center border rounded-xl p-3 bg-green-50">
              <FaMapMarkerAlt className="text-green-700 mx-2" />
              <select
                name="addressBarangay"
                value={farmerData.addressBarangay}
                onChange={handleChange}
                className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                required
              >
                <option value="">Select Barangay (Address)</option>
                {Object.keys(canlaonLocations).map((barangay) => (
                  <option key={barangay} value={barangay}>{barangay}</option>
                ))}
              </select>
            </div>
            <select
              name="addressSitio"
              value={farmerData.addressSitio}
              onChange={handleChange}
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
              disabled={!selectedAddressBarangay}
            >
              <option value="">Select Sitio/Purok</option>
              {selectedAddressBarangay && canlaonLocations[selectedAddressBarangay].sitios.map((sitio) => (
                <option key={sitio.name} value={sitio.name}>{sitio.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center border rounded-xl p-3 bg-green-50">
              <FaMapMarkerAlt className="text-green-700 mx-2" />
              <select
                name="farmBarangay"
                value={farmerData.farmBarangay}
                onChange={handleChange}
                className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                required
              >
                <option value="">Select Barangay (Farm)</option>
                {Object.keys(canlaonLocations).map((barangay) => (
                  <option key={barangay} value={barangay}>{barangay}</option>
                ))}
              </select>
            </div>
            <select
              name="farmSitio"
              value={farmerData.farmSitio}
              onChange={handleChange}
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
              disabled={!selectedFarmBarangay}
            >
              <option value="">Select Sitio/Purok</option>
              {selectedFarmBarangay && canlaonLocations[selectedFarmBarangay].sitios.map((sitio) => (
                <option key={sitio.name} value={sitio.name}>{sitio.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              name="hectares"
              placeholder="Farm Size (Hectares)"
              value={farmerData.hectares}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
            />
            <select
              name="season"
              value={farmerData.season}
              onChange={handleChange}
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
            >
              <option value="Default">Select Season</option>
              <option value="Dry">Dry</option>
              <option value="Wet">Wet</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              name="landOwnership"
              value={farmerData.landOwnership}
              onChange={handleChange}
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
            >
              <option value="">Select Land Ownership</option>
              <option value="Owned">Owned</option>
              <option value="Tenant">Tenant</option>
              <option value="Lessee">Lessee</option>
            </select>
            <select
              name="farmType"
              value={farmerData.farmType}
              onChange={handleChange}
              className="w-full p-3 border rounded-xl bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              required
            >
              <option value="">Select Farm Type</option>
              <option value="Irrigated">Irrigated</option>
              <option value="Rainfed">Rainfed</option>
              <option value="Upland">Upland</option>
              <option value="Lowland">Lowland</option>
            </select>
          </div>

          {farmerData.coordinates && showMapPreview && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Map Preview (Verify Coordinates)</h3>
              <MapContainer center={farmerData.coordinates} zoom={13} style={{ height: '300px', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                <Marker position={farmerData.coordinates}>
                  <Popup>
                    Farm Location: {farmerData.farmSitio}, {farmerData.farmBarangay}, Canlaon City <br />
                    Coordinates: {farmerData.coordinates[0]}, {farmerData.coordinates[1]} <br />
                    Land Ownership: {farmerData.landOwnership} <br />
                    Farm Type: {farmerData.farmType} <br />
                    (Check if this matches the expected location.)
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-green-800 flex items-center">
              <FaTractor className="mr-2" /> Crop Harvest Timeline
            </h3>
            <div className="space-y-4 border rounded-xl p-4 bg-green-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  name="name"
                  value={newCrop.name}
                  onChange={handleNewCropChange}
                  className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                  disabled={loadingVegetables}
                >
                  <option value="">Select a Vegetable</option>
                  {vegetables.map((vegetable) => (
                    <option key={vegetable.id} value={vegetable.name}>{vegetable.name}</option>
                  ))}
                </select>
                {newCrop.name && vegetables.find(v => v.name === newCrop.name)?.harvestAfter && (
                  <p className="text-sm text-gray-600 flex items-center">
                    <FaInfoCircle className="mr-1" />
                    Expected harvest in {calculateDuration(vegetables.find(v => v.name === newCrop.name).harvestAfter)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center border rounded-xl p-3 bg-white relative">
                  <FaCalendarAlt className="text-green-700 mx-2" />
                  <input
                    type="date"
                    name="plantingDate"
                    value={newCrop.plantingDate}
                    onChange={handleNewCropChange}
                    className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                    title="Select the date when you plan to plant the crop."
                  />
                </div>
                <div className="flex items-center border rounded-xl p-3 bg-white relative">
                  <FaCalendarAlt className="text-green-700 mx-2" />
                  <input
                    type="date"
                    name="harvestDate"
                    value={newCrop.harvestDate}
                    onChange={handleNewCropChange}
                    className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                    title={`Harvest is typically ${newCrop.name && vegetables.find(v => v.name === newCrop.name)?.harvestAfter ? calculateDuration(vegetables.find(v => v.name === newCrop.name).harvestAfter) : "~1-4 months"} after planting.`}
                  />
                </div>
              </div>  
              <button
                type="button"
                onClick={addCrop}
                disabled={isAddingCrop}
                className={`w-full bg-green-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${isAddingCrop ? "opacity-75 cursor-not-allowed" : "hover:bg-green-700"}`}
              >
                {isAddingCrop ? <><FaSpinner className="animate-spin mr-2" /> Adding...</> : <><FaPlus /> Add Crop</>}
              </button>
            </div>

            {farmerData.mainCrops.length > 0 && (
              <div className="space-y-2">
                {farmerData.mainCrops.map((crop, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-100 rounded-xl shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-green-700">{crop.name}</p>
                      <p className="text-xs text-gray-600">Planting: {crop.plantingDate} | Harvest: {crop.harvestDate}</p>
                    </div>
                    <button type="button" onClick={() => removeCrop(index)} className="text-red-500 hover:text-red-700">
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full bg-green-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${isSubmitting ? "opacity-75 cursor-not-allowed" : "hover:bg-green-700"}`}
          >
            {isSubmitting ? <><FaSpinner className="animate-spin mr-2" /> Registering...</> : "Register Farmer"}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-10px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
  .animate-fade-in-out { animation: fadeInOut 2s ease-in-out forwards; }
`;

if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default FarmerRegister;