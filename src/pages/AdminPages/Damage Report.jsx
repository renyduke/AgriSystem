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
    <div className="min-h-screen bg-gray-50 px-6 pt-2 pb-8 w-full font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Disaster Report Registration</h1>
        <p className="text-sm text-slate-500">
          Register damage data for specific farmers affected by calamities.
        </p>
      </div>

      <div className="w-full space-y-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <FaExclamationTriangle className="text-red-500" />
            Report New Damage
          </h2>
          {success && (
            <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-4">
              Report submitted successfully! Assistance will be prioritized.
            </div>
          )}
          <form onSubmit={handleSubmitReport} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
                  Calamity Type
                </label>
                <select
                  value={selectedCalamity}
                  onChange={(e) => setSelectedCalamity(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-700 appearance-none"
                >
                {calamities.map((cal) => (
                  <option key={cal} value={cal}>{cal}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
                Affected Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-700 appearance-none"
              >
                <option value="">Select Barangay</option>
                {barangays.map((bar) => (
                  <option key={bar} value={bar}>{bar}</option>
                ))}
              </select>
            </div>
              {selectedBarangay && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
                    Affected Farmers ({selectedFarmers.length} selected)
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto p-4 border border-slate-200 rounded-xl bg-slate-50">
                  {affectedFarmers.map((farmer) => (
                    <div key={farmer.id} className="flex items-center p-3 bg-white rounded-xl border border-slate-100 hover:border-red-200 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedFarmers.includes(farmer.id)}
                        onChange={() => handleFarmerSelect(farmer.id)}
                        className="mr-3 w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-slate-700 font-medium">{farmer.fullName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
                  Crop Loss (%)
                </label>
                <input
                  type="number"
                  value={damageDetails.cropLoss}
                  onChange={(e) => setDamageDetails({ ...damageDetails, cropLoss: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
                  Estimated Damage Value (PHP)
                </label>
                <input
                  type="number"
                  value={damageDetails.estimatedValue}
                  onChange={(e) => setDamageDetails({ ...damageDetails, estimatedValue: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-700"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 font-bold flex items-center justify-center gap-2 active:scale-95"
              >
                {loading ? <FaSpinner className="animate-spin" /> : <FaFileAlt />} Submit Report
              </button>
            </div>
          </form>
        </div>

        {/* Compiled Reports */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <FaListAlt className="text-red-500" />
            Damage Reports History
          </h3>
          {loadingReports ? (
            <div className="text-center py-6 text-gray-600">Loading reports...</div>
          ) : reports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.map((report) => (
                <div key={report.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-red-200 transition-colors">
                  <h4 className="font-bold text-slate-800 mb-2">{report.calamity}</h4>
                  <div className="space-y-2 text-sm text-slate-500 mb-4">
                    <p className="flex items-center gap-2">📅 {report.date.toDate().toLocaleDateString()}</p>
                    <p className="flex items-center gap-2">📍 {report.barangay}</p>
                    <p className="flex items-center gap-2 font-bold text-red-600">📉 {report.damageDetails.cropLoss}% Loss</p>
                    <p className="flex items-center gap-2 font-bold text-slate-700">💰 ₱{report.damageDetails.estimatedValue.toLocaleString()}</p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Affected Farmers</p>
                    <div className="flex flex-wrap gap-2">
                      {report.affectedFarmers.map((farmerId) => {
                        const farmer = affectedFarmers.find(f => f.id === farmerId);
                        return (
                          <span key={farmerId} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                            {farmer ? farmer.fullName : "Unknown"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Affected Areas Map</h3>
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: "400px", borderRadius: "16px", border: "1px solid #e2e8f0" }}
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