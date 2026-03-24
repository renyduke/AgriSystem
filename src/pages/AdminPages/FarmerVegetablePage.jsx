import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../config/firebaseConfig";
import { useTheme } from "../../context/ThemeContext";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  Tractor,
  ArrowLeft,
  MapPin,
  Ruler,
  Sprout,
  Search,
  Loader2,
  Users
} from "lucide-react";

// Basic Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`flex items-center justify-center min-h-[400px] ${this.props.darkMode ? "bg-red-900/20" : "bg-red-50"} rounded-xl p-8`}>
          <div className="text-center">
            <h2 className={`text-xl font-bold ${this.props.darkMode ? "text-red-400" : "text-red-800"}`}>Something went wrong!</h2>
            <p className={`${this.props.darkMode ? "text-red-300" : "text-red-600"} mt-2`}>Please try refreshing the page.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const FarmerVegetablePage = () => {
  const { darkMode } = useTheme();
  const [vegetableOptions, setVegetableOptions] = useState([]);
  const [selectedVegetable, setSelectedVegetable] = useState("");
  const [loadingVegetables, setLoadingVegetables] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVegetables = async () => {
      try {
        setLoadingVegetables(true);
        const snap = await getDocs(collection(db, "vegetables_list"));
        const list = snap.docs.map((doc) => doc.data().name);
        // Sort alphabetically
        list.sort((a, b) => a.localeCompare(b));
        setVegetableOptions(list);
        if (list.length > 0) setSelectedVegetable(list[0]);
      } catch (err) {
        console.error("Error fetching vegetables:", err);
      } finally {
        setLoadingVegetables(false);
      }
    };
    fetchVegetables();
  }, []);

  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`min-h-screen ${darkMode ? "bg-slate-950 text-slate-200" : "bg-gray-50 text-slate-800"} px-6 pt-2 pb-6 font-sans transition-colors duration-300`}>
        <div className="w-full space-y-8">

          {/* Header Section */}
          <div className="py-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h1 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-slate-800"}`}>
                  Farmer Directory
                </h1>
                <p className={`${darkMode ? "text-slate-400" : "text-slate-500"} mt-2`}>
                  Find farmers based on the crops they produce
                </p>
              </div>

              {/* Vegetable Selector */}
              <div className="w-full md:w-72">
                <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-slate-600"} mb-2`}>Select Vegetable</label>
                <div className="relative">
                  {loadingVegetables ? (
                    <div className={`flex items-center gap-2 px-4 py-3 ${darkMode ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"} border rounded-xl`}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <div className="relative">
                      <Sprout className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? "text-green-500" : "text-green-600"}`} />
                      <select
                        value={selectedVegetable}
                        onChange={(e) => setSelectedVegetable(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 ${darkMode ? "bg-slate-900 border-slate-800 text-slate-200 hover:border-green-800" : "bg-white border-slate-200 text-slate-700 hover:border-green-300"} border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none cursor-pointer transition-colors`}
                      >
                        {vegetableOptions.length === 0 ? (
                          <option disabled>No vegetables found</option>
                        ) : (
                          vegetableOptions.map((veg) => (
                            <option key={veg} value={veg} className={darkMode ? "bg-slate-900" : "bg-white"}>
                              {veg}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className={`w-4 h-4 ${darkMode ? "text-slate-600" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {selectedVegetable ? (
              <FarmersList vegetable={selectedVegetable} navigate={navigate} darkMode={darkMode} />
            ) : (
              !loadingVegetables && (
                <div className={`text-center py-12 ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-2xl border border-dashed`}>
                  <Sprout className={`w-12 h-12 ${darkMode ? "text-slate-700" : "text-slate-300"} mx-auto mb-3`} />
                  <p className={darkMode ? "text-slate-500" : "text-slate-500"}>Please select a vegetable to view farmers</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

const FarmersList = ({ vegetable, navigate, darkMode }) => {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        setLoading(true);
        setFarmers([]);

        const vegQuery = query(
          collection(db, "vegetables"),
          where("name", "==", vegetable)
        );
        const vegSnap = await getDocs(vegQuery);
        const farmerIds = [...new Set(vegSnap.docs.map((d) => d.data().farmerId))]; // Deduplicate IDs

        if (farmerIds.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch farmers in batches (Firestore 'in' limit is 10)
        const chunks = [];
        for (let i = 0; i < farmerIds.length; i += 10) {
          chunks.push(farmerIds.slice(i, i + 10));
        }

        const allFarmers = [];
        for (const chunk of chunks) {
          const farmerQuery = query(
            collection(db, "farmers"),
            where("__name__", "in", chunk)
          );
          const farmerSnap = await getDocs(farmerQuery);
          farmerSnap.forEach((doc) => {
            allFarmers.push({ id: doc.id, ...doc.data() });
          });
        }

        setFarmers(allFarmers);
      } catch (err) {
        console.error("Error fetching farmers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFarmers();
  }, [vegetable]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className={`w-10 h-10 ${darkMode ? "text-green-500" : "text-green-600"} animate-spin mb-4`} />
        <p className={`${darkMode ? "text-slate-400" : "text-slate-500"} font-medium`}>Finding farmers who grow {vegetable}...</p>
      </div>
    );
  }

  if (farmers.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300"} rounded-2xl border border-dashed`}>
        <div className={`p-4 ${darkMode ? "bg-slate-800" : "bg-slate-50"} rounded-full mb-4`}>
          <Tractor className={`w-8 h-8 ${darkMode ? "text-slate-600" : "text-slate-400"}`} />
        </div>
        <h3 className={`text-lg font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>No Farmers Found</h3>
        <p className={`${darkMode ? "text-slate-500" : "text-slate-500"} mt-1 text-center px-4`}>
          There are currently no farmers listed for <span className={`font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{vegetable}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-2">
        <h2 className={`text-lg font-semibold ${darkMode ? "text-slate-400" : "text-slate-700"}`}>
          Showing {farmers.length} Result{farmers.length !== 1 && 's'}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {farmers.map((farmer) => (
          <div
            key={farmer.id}
            className={`group ${darkMode ? "bg-slate-900 border-slate-800 hover:border-green-800" : "bg-white border-slate-100 hover:border-green-200"} rounded-2xl p-6 shadow-sm border transition-all duration-300`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${darkMode ? "bg-green-900/30 text-green-400 border-green-900/50" : "bg-green-50 text-green-600 border-green-100"} flex items-center justify-center font-bold text-xl border`}>
                  {farmer.fullName ? farmer.fullName.charAt(0).toUpperCase() : <Users className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className={`font-bold ${darkMode ? "text-slate-200 group-hover:text-green-400" : "text-slate-800 group-hover:text-green-700"} text-lg transition-colors`}>
                    {farmer.fullName || "Unknown Farmer"}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-800"} mt-1`}>
                    Verified Farmer
                  </span>
                </div>
              </div>
            </div>

            <div className={`space-y-3 pt-4 border-t ${darkMode ? "border-slate-800" : "border-slate-50"}`}>
              <div className={`flex items-start gap-3 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                <MapPin className={`w-5 h-5 ${darkMode ? "text-slate-500" : "text-slate-400"} mt-0.5`} />
                <span className="text-sm">{farmer.farmLocation || "Location not specified"}</span>
              </div>

              <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                <Ruler className={`w-5 h-5 ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
                <span className="text-sm">
                  <span className={`font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{farmer.farmSizeHectares || farmer.farmSize || 0}</span> hectares
                </span>
              </div>

              <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                <Tractor className={`w-5 h-5 ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
                <span className="text-sm">Mixed Farming</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => navigate(`/home/farmer/${farmer.id}`)}
                className={`w-full py-2.5 ${darkMode ? "bg-slate-800 text-slate-300 hover:bg-green-600 hover:text-white" : "bg-slate-50 text-slate-600 hover:bg-green-600 hover:text-white"} font-medium rounded-xl transition-all duration-200 active:scale-95`}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FarmerVegetablePage;