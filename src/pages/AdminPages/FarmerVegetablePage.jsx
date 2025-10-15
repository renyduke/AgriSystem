import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../config/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FaTractor, FaArrowLeft, FaBars } from "react-icons/fa";

// Custom CSS for animations
const customStyles = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .animate-slide-in {
    animation: slideIn 0.5s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in;
  }
`;

const FarmerVegetablePage = () => {
  const [vegetableOptions, setVegetableOptions] = useState([]);
  const [selectedVegetable, setSelectedVegetable] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loadingVegetables, setLoadingVegetables] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVegetables = async () => {
      try {
        setLoadingVegetables(true);
        const veggieSnapshot = await getDocs(collection(db, "vegetables_list"));
        const veggieList = veggieSnapshot.docs.map(doc => doc.data().name);
        setVegetableOptions(veggieList);
        setSelectedVegetable(veggieList[0] || ""); // Default to first vegetable or empty string
      } catch (error) {
        console.error("Error fetching vegetables:", error);
      } finally {
        setLoadingVegetables(false);
      }
    };

    fetchVegetables();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex overflow-hidden">
      <style>{customStyles}</style>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-green-100 to-green-200 shadow-2xl transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out z-40 flex flex-col`}
      >
        <div className="p-6 border-b border-green-300 bg-green-800/10">
          <h2 className="text-2xl font-bold text-green-900 flex items-center">
            <FaTractor className="mr-2 text-green-700" />
            <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Farm Menu
            </span>
          </h2>
        </div>
        {loadingVegetables ? (
          <div className="p-4 text-center text-green-800">Loading vegetables...</div>
        ) : (
          <VegetableSelection
            vegetableOptions={vegetableOptions}
            selectedVegetable={selectedVegetable}
            onSelectVegetable={(veg) => {
              setSelectedVegetable(veg);
              setIsSidebarOpen(false);
            }}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:pl-72 transition-all duration-300 relative z-30">
        {/* Mobile Sidebar Toggle */}
        <button
          className="md:hidden fixed top-4 left-4 z-50 text-green-700 hover:text-green-900 bg-white/80 rounded-full p-2 shadow-md hover:shadow-lg transition-all duration-200"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <FaBars className="text-2xl" />
        </button>

        {/* Back to Main Page Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/home")}
            className="flex items-center space-x-2 text-green-700 hover:text-green-900 bg-white rounded-lg px-4 py-2 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <FaArrowLeft className="text-lg" />
            <span>Back to Main Page</span>
          </button>
        </div>

        {selectedVegetable && (
          <FarmersList
            vegetable={selectedVegetable}
            onBack={() => setIsSidebarOpen(true)}
          />
        )}
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

const VegetableSelection = ({ vegetableOptions, selectedVegetable, onSelectVegetable }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-2">
        {vegetableOptions.length > 0 ? (
          vegetableOptions.map((vegetable) => (
            <button
              key={vegetable}
              onClick={() => onSelectVegetable(vegetable)}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all duration-200 bg-white/90 shadow-sm hover:shadow-md ${
                selectedVegetable === vegetable
                  ? "bg-green-600 text-white"
                  : "text-green-800 hover:bg-green-50"
              }`}
            >
              <FaTractor className={`text-lg ${selectedVegetable === vegetable ? "text-white" : "text-green-600"}`} />
              <span className="font-medium">{vegetable}</span>
            </button>
          ))
        ) : (
          <p className="text-green-800 text-center">No vegetables available</p>
        )}
      </div>
    </div>
  );
};

const FarmersList = ({ vegetable, onBack }) => {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        setLoading(true);
        const vegetablesQuery = query(collection(db, "vegetables"), where("name", "==", vegetable));
        const vegetablesSnapshot = await getDocs(vegetablesQuery);

        const farmerIds = vegetablesSnapshot.docs.map((doc) => doc.data().farmerId);

        if (farmerIds.length === 0) {
          setFarmers([]);
          setLoading(false);
          return;
        }

        const farmersQuery = query(collection(db, "farmers"), where("__name__", "in", farmerIds));
        const farmersSnapshot = await getDocs(farmersQuery);

        const farmersData = farmersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setFarmers(farmersData); // No sorting by experience
      } catch (error) {
        console.error("Error fetching farmers: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFarmers();
  }, [vegetable]);

  return (
    <div className="max-w-5xl mx-auto mt-8 animate-slide-in">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-green-800">
            Farmers Producing <span className="text-green-600">{vegetable}</span>
          </h2>
          <button
            className="md:hidden flex items-center space-x-2 text-green-700 hover:text-green-900"
            onClick={onBack}
          >
            <FaArrowLeft />
            <span>Menu</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent" />
          </div>
        ) : farmers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {farmers.map((farmer) => (
              <div
                key={farmer.id}
                className="bg-gradient-to-br from-green-50 to-white rounded-xl p-5 
                  shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="mb-3">
                  <p className="text-lg font-semibold text-green-800">{farmer.fullName}</p>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">Location:</span> {farmer.farmLocation}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Farm Size:</span> {farmer.farmSizeHectares || farmer.farmSize} hectares
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              No farmers found producing {vegetable} at this time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmerVegetablePage;