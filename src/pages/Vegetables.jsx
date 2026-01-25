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
import { FaPlus, FaTrash, FaEdit, FaSearch, FaLeaf } from "react-icons/fa";

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
  const [editingVeggie, setEditingVeggie] = useState(null);
  const [editVeggieName, setEditVeggieName] = useState("");
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
    if (!newVeggieName.trim()) {
      alert("Please enter a vegetable name");
      return;
    }

    if (vegetables.some((v) => v.name.toLowerCase() === newVeggieName.trim().toLowerCase())) {
      alert("This vegetable already exists in the list");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "vegetables_list"), {
        name: newVeggieName.trim(),
      });
      setNewVeggieName("");
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
    if (editVeggieName.trim() && editVeggieName !== veggie.name) {
      if (vegetables.some(
        (v) => v.name.toLowerCase() === editVeggieName.trim().toLowerCase() && v.id !== veggie.id
      )) {
        alert("This vegetable name already exists");
        return;
      }
      
      try {
        setLoading(true);
        const veggieDoc = doc(db, "vegetables_list", veggie.id);
        await updateDoc(veggieDoc, {
          name: editVeggieName.trim(),
        });
        setEditingVeggie(null);
        setEditVeggieName("");
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
      alert("Please enter a valid and unique vegetable name");
      setEditingVeggie(null);
      setEditVeggieName("");
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-green-800 flex items-center">
                <FaLeaf className="mr-2 text-green-600" /> Vegetable List
              </h2>
              
              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search vegetables..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Add Vegetable Form */}
            <div className="mb-6 p-4 bg-green-50 rounded-xl">
              <h3 className="text-lg font-semibold text-green-800 mb-4">Add New Vegetable</h3>
              <form onSubmit={handleAddVegetable} className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newVeggieName}
                    onChange={(e) => setNewVeggieName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter vegetable name"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                >
                  <FaPlus /> Add Vegetable
                </button>
              </form>
              {showSuccess && (
                <div className="mt-3 text-center text-green-600 font-semibold animate-fade-in">
                  Vegetable added successfully!
                </div>
              )}
            </div>

            {/* Vegetables List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-green-800">All Vegetables ({filteredVegetables.length})</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
                  <p className="mt-2 text-gray-600">Loading vegetables...</p>
                </div>
              ) : filteredVegetables.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <p className="text-gray-600">
                    {searchTerm ? "No vegetables match your search" : "No vegetables added yet"}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {filteredVegetables.map((vegetable, index) => (
                    <div key={vegetable.id} className={`flex items-center justify-between p-4 ${index !== 0 ? 'border-t border-gray-100' : ''}`}>
                      {editingVeggie?.id === vegetable.id ? (
                        <div className="flex-1 flex flex-col md:flex-row gap-3">
                          <input
                            type="text"
                            value={editVeggieName}
                            onChange={(e) => setEditVeggieName(e.target.value)}
                            className="flex-1 px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Enter vegetable name"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditVegetable(vegetable)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingVeggie(null);
                                setEditVeggieName("");
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <span className="text-gray-800 font-medium">{vegetable.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingVeggie(vegetable);
                                setEditVeggieName(vegetable.name);
                              }}
                              className="px-3 py-2 text-blue-600 hover:text-blue-800 transition-colors"
                              title="Edit"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteVegetable(vegetable.id)}
                              className="px-3 py-2 text-red-500 hover:text-red-700 transition-colors"
                              title="Delete"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            {!loading && vegetables.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Total vegetables: <span className="font-semibold text-green-700">{vegetables.length}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Vegetables;