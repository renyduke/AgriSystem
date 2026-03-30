import React, { useState, useEffect } from "react";
import { db, auth } from "../../config/firebaseConfig";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { logActivity } from "../../services/activityLogger";
import { FaUser, FaPhone, FaMapMarkerAlt, FaTractor, FaPlus, FaCalendarAlt, FaTimes, FaInfoCircle, FaSpinner, FaCheckCircle } from "react-icons/fa";
import canlaonLocations from "../../data/canlaonLocations";
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from "../../context/ThemeContext";

const FarmerRegister = () => {
  const { darkMode } = useTheme();
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
    areaInSqm: "", // Added for calculation
    landOwnership: "",
    otherLandOwnership: "",
    mainCrops: [],
    area: [],
    coordinates: [10.3860, 123.2220],
  });
  const [selectedAddressBarangay, setSelectedAddressBarangay] = useState("");
  const [selectedFarmBarangay, setSelectedFarmBarangay] = useState("");
  const [newCrop, setNewCrop] = useState({ name: "" });
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

      // Only allow letters and spaces for first/last name
      if (name === "firstName" || name === "lastName") {
        updatedValue = value.replace(/[^A-Za-z\s]/g, "");
        updatedValue = capitalizeFirstLetter(updatedValue);
      }

      // Only allow numbers for age
      if (name === "age") {
        updatedValue = value.replace(/[^0-9]/g, "");
      }

      if (name === "contact") {
        updatedValue = value.replace(/[^0-9]/g, "").slice(0, 11);
      }

      if (name === "hectares") {
        updatedValue = value >= 0 ? value : "";
        // Calculate square meters (1 hectare = 10,000 sqm)
        if (updatedValue) {
          const sqm = parseFloat(updatedValue) * 10000;
          setFarmerData((prev) => ({ ...prev, areaInSqm: sqm.toFixed(2) }));
        } else {
          setFarmerData((prev) => ({ ...prev, areaInSqm: "" }));
        }
      }

      const updatedData = { ...prevData, [name]: updatedValue };

      if (name === "landOwnership" && value !== "Others") {
        updatedData.otherLandOwnership = "";
      }

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
      return { ...prevData, [name]: value };
    });
    setError("");
  };

  const calculateDuration = (days) => {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return months > 0 ? `~${months} month${months > 1 ? "s" : ""}${remainingDays > 0 ? ` and ${remainingDays} day${remainingDays > 1 ? "s" : ""}` : ""}` : `~${days} day${days > 1 ? "s" : ""}`;
  };

  const addCrop = () => {
    if (newCrop.name && vegetables.some(v => v.name === newCrop.name)) {
      setIsAddingCrop(true);
      setFarmerData((prevData) => ({
        ...prevData,
        mainCrops: [...prevData.mainCrops, { ...newCrop }],
      }));
      setNewCrop({ name: "" });
      setError("");
      setLocalReply({ type: "success", message: "Crop added successfully (Localhost)" });
      setTimeout(() => {
        setIsAddingCrop(false);
        setLocalReply(null);
      }, 2000);
      setError("Please select a vegetable.");
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
      setError("Please add at least one crop.");
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

    if (isGeocoding) {
      setError("Please wait for location data to process.");
      return;
    }

    setIsSubmitting(true);
    try {
      const flattenedCrops = farmerData.mainCrops.reduce((acc, crop, index) => {
        acc[`crop${index + 1}`] = { name: crop.name };
        return acc;
      }, {});

      console.log("Submitting farmer data:", { ...farmerData, mainCrops: flattenedCrops });
      const farmerRef = await addDoc(collection(db, "farmers"), {
        ...farmerData,
        fullName: `${capitalizeFirstLetter(farmerData.firstName)} ${capitalizeFirstLetter(farmerData.lastName)}`,
        address: `${farmerData.addressBarangay}, ${farmerData.addressSitio}, Canlaon City`,
        farmLocation: `${farmerData.farmBarangay}, ${farmerData.farmSitio}, Canlaon City`,
        hectares: parseFloat(farmerData.hectares),
        areaInSqm: parseFloat(farmerData.areaInSqm),
        landOwnership: farmerData.landOwnership === "Others" ? farmerData.otherLandOwnership : farmerData.landOwnership,
        mainCrops: flattenedCrops,
        area: farmerData.area,
      });

      const farmerId = farmerRef.id;
      const vegetablePromises = farmerData.mainCrops.map((crop) =>
        addDoc(collection(db, "vegetables"), {
          name: crop.name,
          farmerId: farmerId,
        })
      );
      await Promise.all(vegetablePromises);

      logActivity('add', 'Farmer', `${capitalizeFirstLetter(farmerData.firstName)} ${capitalizeFirstLetter(farmerData.lastName)}`, auth.currentUser?.displayName || 'Admin');
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
        areaInSqm: "",
        landOwnership: "",
        otherLandOwnership: "",
        mainCrops: [],
        area: [],
        coordinates: [10.3860, 123.2220],
      });
      setSelectedAddressBarangay("");
      setSelectedFarmBarangay("");
      setNewCrop({ name: "" });
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-6 pt-2 pb-6 relative font-sans transition-colors duration-300">
      <div className="w-full">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-gray-100">Farmer Registration</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Submit a new farmer record to the agricultural database.</p>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-2xl mb-8 flex items-center gap-3">
          <FaInfoCircle className="flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>}
        
        {localReply && (
          <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-out z-[100] ${localReply.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {localReply.type === "success" ? <FaCheckCircle className="text-green-600" /> : <FaTimes className="text-red-600" />}
            <span>{localReply.message}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Main Form Area */}
          <form onSubmit={handleSubmit} className="flex-1 space-y-8 order-2 lg:order-1">
            
            {/* Section 1: Personal Information */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
              <div className="flex items-center gap-3 mb-8">
                <FaUser className="text-slate-400 dark:text-slate-500 w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Personal Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">First Name</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800/50 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 transition-all">
                    <input
                      type="text"
                      name="firstName"
                      placeholder="Enter first name"
                      value={farmerData.firstName}
                      onChange={handleChange}
                      className="w-full bg-transparent focus:outline-none text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Last Name</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800/50 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 transition-all">
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Enter last name"
                      value={farmerData.lastName}
                      onChange={handleChange}
                      className="w-full bg-transparent focus:outline-none text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Age</label>
                  <input
                    type="text"
                    name="age"
                    placeholder="Enter age"
                    value={farmerData.age}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Sex</label>
                  <div className="relative">
                    <select
                      name="sex"
                      value={farmerData.sex}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium appearance-none pr-10"
                      required
                    >
                      <option value="">Select Sex</option>
                      <option value="Male" className="bg-white dark:bg-slate-800">Male</option>
                      <option value="Female" className="bg-white dark:bg-slate-800">Female</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Contact Number</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800/50 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 transition-all">
                    <FaPhone className="text-slate-300 dark:text-slate-600 mr-3 w-3 h-3" />
                    <input
                      type="text"
                      name="contact"
                      placeholder="09XXXXXXXXX"
                      value={farmerData.contact}
                      onChange={handleChange}
                      maxLength="11"
                      className="w-full bg-transparent focus:outline-none text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      required
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Location Details */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
              <div className="flex items-center gap-3 mb-8">
                <FaMapMarkerAlt className="text-slate-400 dark:text-slate-500 w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Location Details</h3>
              </div>
              
              <div className="space-y-8">
                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-300 dark:text-slate-600 mb-4 uppercase tracking-[0.2em]">Home Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Barangay</label>
                      <div className="relative">
                        <select
                          name="addressBarangay"
                          value={farmerData.addressBarangay}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium appearance-none pr-10"
                          required
                        >
                          <option value="" className="bg-white dark:bg-slate-800">Select Barangay</option>
                          {Object.keys(canlaonLocations).map((barangay) => (
                            <option key={barangay} value={barangay} className="bg-white dark:bg-slate-800">{barangay}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Sitio/Purok</label>
                      <div className="relative">
                        <select
                          name="addressSitio"
                          value={farmerData.addressSitio}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium appearance-none pr-10 disabled:opacity-50"
                          required
                          disabled={!selectedAddressBarangay}
                        >
                          <option value="" className="bg-white dark:bg-slate-800">Select Sitio</option>
                          {selectedAddressBarangay && canlaonLocations[selectedAddressBarangay].sitios.map((sitio) => (
                            <option key={sitio.name} value={sitio.name} className="bg-white dark:bg-slate-800">{sitio.name}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-extrabold text-slate-300 dark:text-slate-600 mb-4 uppercase tracking-[0.2em]">Farm Location</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Barangay</label>
                      <div className="relative">
                        <select
                          name="farmBarangay"
                          value={farmerData.farmBarangay}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium appearance-none pr-10"
                          required
                        >
                          <option value="" className="bg-white dark:bg-slate-800">Select Barangay</option>
                          {Object.keys(canlaonLocations).map((barangay) => (
                            <option key={barangay} value={barangay} className="bg-white dark:bg-slate-800">{barangay}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Sitio/Purok</label>
                      <div className="relative">
                        <select
                          name="farmSitio"
                          value={farmerData.farmSitio}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium appearance-none pr-10 disabled:opacity-50"
                          required
                          disabled={!selectedFarmBarangay}
                        >
                          <option value="" className="bg-white dark:bg-slate-800">Select Sitio</option>
                          {selectedFarmBarangay && canlaonLocations[selectedFarmBarangay].sitios.map((sitio) => (
                            <option key={sitio.name} value={sitio.name} className="bg-white dark:bg-slate-800">{sitio.name}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Farm Information */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
              <div className="flex items-center gap-3 mb-8">
                <FaTractor className="text-slate-400 dark:text-slate-500 w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Farm Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Farm Size (Hectares)</label>
                  <input
                    type="number"
                    name="hectares"
                    placeholder="0.00"
                    value={farmerData.hectares}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    required
                  />
                  {farmerData.areaInSqm && (
                    <p className="text-[9px] text-green-600/70 dark:text-green-500/70 mt-1.5 ml-1 uppercase tracking-widest font-black">
                      {farmerData.areaInSqm} SQM Area
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ownership Type</label>
                  <div className="relative">
                    <select
                      name="landOwnership"
                      value={farmerData.landOwnership}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium appearance-none pr-10"
                      required
                    >
                      <option value="" className="bg-white dark:bg-slate-800">Select Ownership</option>
                      <option value="Owned" className="bg-white dark:bg-slate-800">Owned</option>
                      <option value="Tenant" className="bg-white dark:bg-slate-800">Tenant</option>
                      <option value="Lessee" className="bg-white dark:bg-slate-800">Lessee</option>
                      <option value="Others" className="bg-white dark:bg-slate-800">Others</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  </div>
                </div>

                {farmerData.landOwnership === "Others" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Specify Ownership</label>
                    <input
                      type="text"
                      name="otherLandOwnership"
                      placeholder="Please specify"
                      value={farmerData.otherLandOwnership}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      required
                    />
                  </div>
                )}
              </div>

              {farmerData.coordinates && showMapPreview && (
                <div className="mt-8 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 p-1">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Location Verify</span>
                    <button type="button" onClick={() => setShowMapPreview(false)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <FaTimes className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <MapContainer center={farmerData.coordinates} zoom={13} style={{ height: '260px', width: '100%', borderRadius: '12px' }}>
                    <TileLayer 
                      url={darkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} 
                      attribution="&copy; OpenStreetMap contributors" 
                    />
                    <Marker position={farmerData.coordinates}>
                      <Popup>
                        <div className="p-1 text-xs">
                          <p className="font-bold text-slate-800">{farmerData.farmSitio}</p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              )}
            </section>

            {/* Section 4: Crop Information */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
              <div className="flex items-center gap-3 mb-8">
                <FaPlus className="text-slate-400 dark:text-slate-500 w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Crop Inventory</h3>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 bg-slate-50/50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Commodity</label>
                    <div className="relative">
                      <select
                        name="name"
                        value={newCrop.name}
                        onChange={handleNewCropChange}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 font-medium appearance-none pr-10"
                        disabled={loadingVegetables}
                      >
                        <option value="">Select Vegetable</option>
                        {vegetables.map((vegetable) => (
                          <option key={vegetable.id} value={vegetable.name}>{vegetable.name}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    </div>
                  </div>


                  
                  <button
                    type="button"
                    onClick={addCrop}
                    disabled={isAddingCrop}
                    className="md:col-span-2 w-full bg-slate-800 text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-900 transition-all font-bold active:scale-[0.98] text-sm"
                  >
                    {isAddingCrop ? <FaSpinner className="animate-spin" /> : <FaPlus className="w-2.5 h-2.5" />} Add Crop
                  </button>
                </div>

                {farmerData.mainCrops.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                    {farmerData.mainCrops.map((crop, index) => (
                      <div key={index} className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm hover:border-green-100 dark:hover:border-green-900 transition-all group">
                        <div className="flex items-center gap-3">
                          <FaCheckCircle className="w-3.5 h-3.5 text-green-500/50 group-hover:text-green-500 transition-colors" />
                          <div>
                            <p className="text-xs font-bold text-slate-700 dark:text-gray-200">{crop.name}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeCrop(index)} className="p-1.5 text-slate-200 hover:text-red-400 transition-all">
                          <FaTimes className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white py-5 rounded-3xl flex items-center justify-center gap-3 hover:bg-green-700 transition-all shadow-xl shadow-green-100 font-bold text-xl active:scale-[0.99]"
              >
                {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} Complete Registration
              </button>
            </div>
          </form>

          {/* Guidelines Sidebar */}
          <aside className="lg:w-80 space-y-6 order-1 lg:order-2 lg:sticky lg:top-8 h-fit">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-8 flex items-center gap-2 uppercase tracking-[0.2em]">
                Guide
              </h3>
              
              <div className="space-y-10">
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex-shrink-0 flex items-center justify-center font-bold text-[10px]">1</div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Identity</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Verified names and contact info only.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex-shrink-0 flex items-center justify-center font-bold text-[10px]">2</div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Geography</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Select correct barangay and sitio for mapping.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex-shrink-0 flex items-center justify-center font-bold text-[10px]">3</div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Metrics</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Land size in hectares for automated calculations.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex-shrink-0 flex items-center justify-center font-bold text-[10px]">4</div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Inventory</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Add commodity for crop tracking.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 transition-colors">
              <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Assistance</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed mb-4 font-medium">Contact City Agriculture for technical support.</p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl transition-colors">
                <FaPhone className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600" />
                <span>(035) 123-4567</span>
              </div>
            </div>
          </aside>
        </div>
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