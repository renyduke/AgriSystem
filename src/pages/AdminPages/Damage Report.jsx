import React, { useState, useEffect } from "react";
import { db } from "../../config/firebaseConfig";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { FaExclamationTriangle, FaMapMarkerAlt, FaUserPlus, FaCalculator, FaFileAlt, FaSpinner, FaListAlt } from "react-icons/fa";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import 'leaflet/dist/leaflet.css';

// Default center for Canlaon City, Negros Oriental (approximate)
const center = [10.3896, 123.1270];

const DisasterReport = () => {
  const [affectedFarmers, setAffectedFarmers] = useState([]);
  const [selectedCalamity, setSelectedCalamity] = useState("Typhoon");
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [damageDetails, setDamageDetails] = useState({ cropLoss: 0, estimatedValue: 0 });
  const [selectedFarmers, setSelectedFarmers] = useState([]); // For specific farmers
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reports, setReports] = useState([]); // To display compiled reports
  const [loadingReports, setLoadingReports] = useState(false);

  // Sample barangays (replace with your canlaonLocations)
  const barangays = ["Bayog", "Binalbagan", "Lumapao", "Pula", "Mabigo (Pob.)"];

  const calamities = ["Typhoon", "Volcanic Eruption", "Flood", "Drought", "Pest Outbreak"];

  const fetchFarmers = async () => {
    try {
      const farmersSnapshot = await getDocs(collection(db, "farmers"));
      const farmers = farmersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAffectedFarmers(farmers.filter(f => f.farmBarangay === selectedBarangay));
    } catch (error) {
      console.error("Error fetching farmers:", error);
    }
  };

  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const reportsSnapshot = await getDocs(collection(db, "disaster_reports"));
      const reportsData = reportsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReports(reportsData.sort((a, b) => b.date.toDate() - a.date.toDate())); // Sort by date descending
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedBarangay) {
      fetchFarmers();
    } else {
      setAffectedFarmers([]);
    }
  }, [selectedBarangay]);

  const handleFarmerSelect = (farmerId) => {
    setSelectedFarmers((prev) =>
      prev.includes(farmerId) ? prev.filter(id => id !== farmerId) : [...prev, farmerId]
    );
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "disaster_reports"), {
        calamity: selectedCalamity,
        barangay: selectedBarangay,
        affectedFarmers: selectedFarmers,
        damageDetails: { ...damageDetails, timestamp: new Date() },
        reportedBy: "Barangay Official", // From user auth
        date: new Date(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchReports(); // Refresh reports after submission
      // Reset form
      setSelectedBarangay("");
      setDamageDetails({ cropLoss: 0, estimatedValue: 0 });
      setSelectedFarmers([]);
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Error submitting report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-red-800 mb-4 flex items-center">
            <FaExclamationTriangle className="mr-2 text-red-600" />
            Disaster Report Registration
          </h2>
          <p className="text-gray-700 mb-6">Register damage data for specific farmers affected by calamities.</p>
          {success && (
            <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-4">
              Report submitted successfully! Assistance will be prioritized.
            </div>
          )}
          <form onSubmit={handleSubmitReport} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calamity Type
              </label>
              <select
                value={selectedCalamity}
                onChange={(e) => setSelectedCalamity(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
              >
                {calamities.map((cal) => (
                  <option key={cal} value={cal}>{cal}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Affected Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select Barangay</option>
                {barangays.map((bar) => (
                  <option key={bar} value={bar}>{bar}</option>
                ))}
              </select>
            </div>
            {selectedBarangay && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Affected Farmers ({selectedFarmers.length} selected)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                  {affectedFarmers.map((farmer) => (
                    <div key={farmer.id} className="flex items-center p-2 bg-white rounded">
                      <input
                        type="checkbox"
                        checked={selectedFarmers.includes(farmer.id)}
                        onChange={() => handleFarmerSelect(farmer.id)}
                        className="mr-2"
                      />
                      <span className="text-sm">{farmer.fullName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crop Loss (%)
              </label>
              <input
                type="number"
                value={damageDetails.cropLoss}
                onChange={(e) => setDamageDetails({ ...damageDetails, cropLoss: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Damage Value (PHP)
              </label>
              <input
                type="number"
                value={damageDetails.estimatedValue}
                onChange={(e) => setDamageDetails({ ...damageDetails, estimatedValue: parseFloat(e.target.value) || 0 })}
                min="0"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? <FaSpinner className="animate-spin" /> : <FaFileAlt />} Submit Report
            </button>
          </form>
        </div>

        {/* Compiled Reports */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center">
            <FaListAlt className="mr-2 text-red-600" />
            Compiled Disaster Reports (For Mayor's Review)
          </h3>
          {loadingReports ? (
            <div className="text-center py-6 text-gray-600">Loading reports...</div>
          ) : reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-red-800">{report.calamity} in {report.barangay}</h4>
                  <p className="text-sm text-gray-600">Date: {report.date.toDate().toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Affected Farmers: {report.affectedFarmers.length}</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600">
                    {report.affectedFarmers.map((farmerId) => {
                      const farmer = affectedFarmers.find(f => f.id === farmerId); // Fetch farmer details if needed
                      return <li key={farmerId}>{farmer ? farmer.fullName : farmerId}</li>;
                    })}
                  </ul>
                  <p className="text-sm text-gray-600">Crop Loss: {report.damageDetails.cropLoss}%</p>
                  <p className="text-sm text-gray-600">Estimated Value: ₱{report.damageDetails.estimatedValue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No reports available yet.</p>
            </div>
          )}
        </div>

        {/* Map of Affected Areas */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-red-800 mb-4">Affected Areas Map</h3>
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: "400px", borderRadius: "8px" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {affectedFarmers.map((farmer) => (
              <Marker
                key={farmer.id}
                position={farmer.coordinates || center}
              >
                <Popup>
                  <div className="p-2">
                    <h4 className="font-semibold text-red-800">{farmer.fullName}</h4>
                    <p className="text-sm text-gray-600">Damage: {damageDetails.cropLoss}% crop loss</p>
                    <p className="text-sm text-gray-600">Estimated Value: ₱{damageDetails.estimatedValue.toLocaleString()}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default DisasterReport;