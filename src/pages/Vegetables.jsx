import React, { useState, useEffect } from "react";
import { db } from "../config/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { FaPlus, FaTrash, FaEdit, FaInfoCircle, FaLeaf } from "react-icons/fa";

// Basic Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center p-6 bg-red-100 rounded-lg">
          <h2 className="text-xl font-bold text-red-800">Something went wrong!</h2>
          <p className="text-gray-600 mt-2">Please try refreshing the page or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Vegetables = () => {
  const [vegetables, setVegetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newVeggieName, setNewVeggieName] = useState("");
  const [newVeggieHarvestAfter, setNewVeggieHarvestAfter] = useState("");
  const [editingVeggie, setEditingVeggie] = useState(null);
  const [editVeggieName, setEditVeggieName] = useState(""); // Added missing useState
  const [editVeggieHarvestAfter, setEditVeggieHarvestAfter] = useState(""); // Added missing useState
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchVegetables();
  }, []);

  const fetchVegetables = async () => {
    try {
      setLoading(true);
      const veggieSnapshot = await getDocs(collection(db, "vegetables_list"));
      const veggieList = veggieSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        harvestAfter: doc.data().harvestAfter || 60,
      }));
      setVegetables(veggieList);
    } catch (error) {
      console.error("Error fetching vegetables:", error);
      alert("Error fetching vegetables");
    } finally {
      setLoading(false);
    }
  };

  const handleAddVegetable = async (e) => {
    e.preventDefault();
    if (
      !newVeggieName.trim() ||
      !newVeggieHarvestAfter ||
      isNaN(newVeggieHarvestAfter) ||
      newVeggieHarvestAfter <= 0 ||
      vegetables.some((v) => v.name.toLowerCase() === newVeggieName.trim().toLowerCase())
    ) {
      alert("Please enter a unique vegetable name and a valid harvest duration (positive number of days)");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "vegetables_list"), {
        name: newVeggieName.trim(),
        harvestAfter: parseInt(newVeggieHarvestAfter),
      });
      setNewVeggieName("");
      setNewVeggieHarvestAfter("");
      await fetchVegetables();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error("Error adding vegetable:", error);
      alert("Error adding vegetable");
    } finally {
      setLoading(false);
    }
  };

  const handleEditVegetable = async (veggie) => {
    if (
      editVeggieName.trim() &&
      editVeggieHarvestAfter &&
      !isNaN(editVeggieHarvestAfter) &&
      editVeggieHarvestAfter > 0 &&
      (editVeggieName !== veggie.name || editVeggieHarvestAfter !== veggie.harvestAfter) &&
      !vegetables.some(
        (v) => v.name.toLowerCase() === editVeggieName.trim().toLowerCase() && v.id !== veggie.id
      )
    ) {
      try {
        setLoading(true);
        const veggieDoc = doc(db, "vegetables_list", veggie.id);
        await updateDoc(veggieDoc, {
          name: editVeggieName.trim(),
          harvestAfter: parseInt(editVeggieHarvestAfter),
        });
        setEditingVeggie(null);
        setEditVeggieName("");
        setEditVeggieHarvestAfter("");
        await fetchVegetables();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } catch (error) {
        console.error("Error editing vegetable:", error);
        alert("Error editing vegetable");
      } finally {
        setLoading(false);
      }
    } else {
      alert("Please enter a unique vegetable name and a valid harvest duration");
      setEditingVeggie(null);
      setEditVeggieName("");
      setEditVeggieHarvestAfter("");
    }
  };

  const handleDeleteVegetable = async (veggieId) => {
    if (window.confirm("Are you sure you want to delete this vegetable?")) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, "vegetables_list", veggieId));
        await fetchVegetables();
      } catch (error) {
        console.error("Error deleting vegetable:", error);
        alert("Error deleting vegetable");
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter vegetables based on search term
  const filteredVegetables = vegetables.filter((veg) =>
    veg.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-green-800 flex items-center">
                <FaLeaf className="mr-2 text-green-600" /> Vegetable List Management
              </h2>
              <button
                onClick={() => document.getElementById("addVeggieForm").scrollIntoView({ behavior: "smooth" })}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                disabled={loading}
              >
                <FaPlus /> Add Vegetable
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vegetables..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
                disabled={loading}
              />
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-6 text-gray-600">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-green-100 text-green-800">
                      <th className="p-2 border-b text-left">Vegetable</th>
                      <th className="p-2 border-b text-left">Harvest Duration (days)</th>
                      <th className="p-2 border-b text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVegetables.map((vegetable) => (
                      <tr key={vegetable.id} className="hover:bg-green-50 transition-colors">
                        {editingVeggie?.id === vegetable.id ? (
                          <td colSpan="3" className="p-4 bg-white">
                            <div className="space-y-2">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  Vegetable Name
                                </label>
                                <input
                                  type="text"
                                  value={editVeggieName}
                                  onChange={(e) => setEditVeggieName(e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  Harvest Duration (days)
                                </label>
                                <input
                                  type="number"
                                  value={editVeggieHarvestAfter}
                                  onChange={(e) => setEditVeggieHarvestAfter(e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  min="1"
                                />
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleEditVegetable(vegetable)}
                                  className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingVeggie(null);
                                    setEditVeggieName("");
                                    setEditVeggieHarvestAfter("");
                                  }}
                                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="p-2 border-b">
                              <span className="text-gray-800">{vegetable.name}</span>
                            </td>
                            <td className="p-2 border-b">
                              <span className="text-gray-800">{vegetable.harvestAfter}</span>
                            </td>
                            <td className="p-2 border-b">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingVeggie(vegetable);
                                    setEditVeggieName(vegetable.name);
                                    setEditVeggieHarvestAfter(vegetable.harvestAfter);
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit"
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  onClick={() => handleDeleteVegetable(vegetable.id)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Delete"
                                >
                                  <FaTrash />
                                </button>
                                <button className="text-gray-500 hover:text-gray-700" title="View Info">
                                  <FaInfoCircle />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredVegetables.length === 0 && (
                  <p className="text-center py-4 text-gray-600">No vegetables found.</p>
                )}
              </div>
            )}

            {/* Add Vegetable Form */}
            <div id="addVeggieForm" className="mt-6 p-4 bg-white/80 rounded-lg shadow-inner">
              <form onSubmit={handleAddVegetable} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Vegetable Name
                  </label>
                  <input
                    type="text"
                    value={newVeggieName}
                    onChange={(e) => setNewVeggieName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter vegetable name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Harvest Duration (days)
                  </label>
                  <input
                    type="number"
                    value={newVeggieHarvestAfter}
                    onChange={(e) => setNewVeggieHarvestAfter(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Days to harvest"
                    min="1"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <FaPlus /> Add Vegetable
                </button>
              </form>
              {showSuccess && (
                <div className="mt-2 text-center text-green-600 font-semibold animate-fade-in">
                  Vegetable added successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Vegetables;