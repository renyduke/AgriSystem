import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../config/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { FaTractor, FaArrowLeft } from "react-icons/fa";

/* ------------------------------------------------------------------ */
/*  Custom animation styles (kept in a <style> tag for simplicity)   */
/* ------------------------------------------------------------------ */
const customStyles = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .animate-slide-in { animation: slideIn 0.5s ease-out; }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .animate-fade-in { animation: fadeIn 0.3s ease-in; }
`;

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */
const FarmerVegetablePage = () => {
  const [vegetableOptions, setVegetableOptions] = useState([]);
  const [selectedVegetable, setSelectedVegetable] = useState("");
  const [loadingVegetables, setLoadingVegetables] = useState(true);
  const navigate = useNavigate();

  /* -------------------------------------------------------------- */
  /*  Fetch the list of vegetables from Firestore                  */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const fetchVegetables = async () => {
      try {
        setLoadingVegetables(true);
        const snap = await getDocs(collection(db, "vegetables_list"));
        const list = snap.docs.map((doc) => doc.data().name);
        setVegetableOptions(list);
        setSelectedVegetable(list[0] || "");
      } catch (err) {
        console.error("Error fetching vegetables:", err);
      } finally {
        setLoadingVegetables(false);
      }
    };
    fetchVegetables();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col overflow-hidden">
      <style>{customStyles}</style>

      {/* ---------------------------------------------------------- */}
      {/*  Header area – Back button + Vegetable selector            */}
      {/* ---------------------------------------------------------- */}
      <header className="bg-white/80 backdrop-blur-sm shadow-md p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Back button */}
          <button
            onClick={() => navigate("/home")}
            className="flex items-center space-x-2 text-green-700 hover:text-green-900 bg-white rounded-lg px-4 py-2 shadow hover:shadow-lg transition"
          >
            <FaArrowLeft className="text-lg" />
            <span>Back to Main Page</span>
          </button>

          {/* Vegetable selector */}
          <div className="flex-1 max-w-md">
            {loadingVegetables ? (
              <p className="text-green-800 animate-pulse">Loading vegetables…</p>
            ) : (
              <select
                value={selectedVegetable}
                onChange={(e) => setSelectedVegetable(e.target.value)}
                className="w-full p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-green-800"
              >
                {vegetableOptions.length === 0 ? (
                  <option disabled>No vegetables found</option>
                ) : (
                  vegetableOptions.map((veg) => (
                    <option key={veg} value={veg}>
                      {veg}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- */}
      {/*  Main content – Farmers list (only rendered when a veg   */}
      {/*  has been chosen)                                        */}
      {/* ---------------------------------------------------------- */}
      <main className="flex-1 p-6">
        {selectedVegetable && (
          <FarmersList vegetable={selectedVegetable} />
        )}
      </main>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Farmers list component                                            */
/* ------------------------------------------------------------------ */
const FarmersList = ({ vegetable }) => {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        setLoading(true);

        /* 1. Find vegetable docs that match the selected name */
        const vegQuery = query(
          collection(db, "vegetables"),
          where("name", "==", vegetable)
        );
        const vegSnap = await getDocs(vegQuery);
        const farmerIds = vegSnap.docs.map((d) => d.data().farmerId);

        if (farmerIds.length === 0) {
          setFarmers([]);
          return;
        }

        /* 2. Pull the farmer docs (Firestore "in" query limit = 10) */
        const farmerQuery = query(
          collection(db, "farmers"),
          where("__name__", "in", farmerIds.slice(0, 10)) // adjust if you need pagination
        );
        const farmerSnap = await getDocs(farmerQuery);

        const data = farmerSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setFarmers(data);
      } catch (err) {
        console.error("Error fetching farmers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFarmers();
  }, [vegetable]);

  return (
    <section className="max-w-5xl mx-auto animate-slide-in">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-3xl font-bold text-green-800 mb-6">
          Farmers producing <span className="text-green-600">{vegetable}</span>
        </h2>

        {/* Loading spinner */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent" />
          </div>
        ) : farmers.length > 0 ? (
          /* Grid of farmer cards */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {farmers.map((farmer) => (
              <div
                key={farmer.id}
                className="bg-gradient-to-br from-green-50 to-white rounded-xl p-5 shadow-md hover:shadow-lg transition-transform hover:-translate-y-1"
              >
                <p className="text-lg font-semibold text-green-800">{farmer.fullName}</p>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Location:</span> {farmer.farmLocation}
                  </p>
                  <p>
                    <span className="font-medium">Farm size:</span>{" "}
                    {farmer.farmSizeHectares || farmer.farmSize} ha
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <p className="text-center text-gray-600 py-12">
            No farmers found producing <strong>{vegetable}</strong> at this time.
          </p>
        )}
      </div>
    </section>
  );
};

export default FarmerVegetablePage;