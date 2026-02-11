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
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Leaf,
  Save,
  X,
  Sprout,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import Loading from "../components/Loading";


// Basic Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-red-50 rounded-xl p-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-800">Something went wrong!</h2>
            <p className="text-red-600 mt-2">Please try refreshing the page.</p>
          </div>
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
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchVegetables();
  }, []);

  const showNotification = (msg) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const fetchVegetables = async () => {
    try {
      setLoading(true);
      const veggieSnapshot = await getDocs(collection(db, "vegetables_list"));
      const veggieList = veggieSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      }));
      setVegetables(veggieList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching vegetables:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVegetable = async (e) => {
    e.preventDefault();
    if (!newVeggieName.trim()) return;

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
      showNotification("Vegetable added successfully!");
    } catch (error) {
      console.error("Error adding vegetable:", error);
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
        showNotification("Vegetable updated successfully!");
      } catch (error) {
        console.error("Error editing vegetable:", error);
      } finally {
        setLoading(false);
      }
    } else {
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
        showNotification("Vegetable deleted successfully");
      } catch (error) {
        console.error("Error deleting vegetable:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredVegetables = vegetables.filter((veg) =>
    veg.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Leaf className="w-8 h-8 text-green-600" />
                </div>
                Vegetable Management
              </h1>
              <p className="text-slate-500 mt-2 text-sm md:text-base">
                Manage your vegetable inventory efficiently
              </p>
            </div>

            {/* Success Toast */}
            {showSuccess && (
              <div className="absolute top-4 right-4 md:right-8 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-slide-in-right z-50">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl w-full md:w-auto focus-within:ring-2 focus-within:ring-green-500 transition-all">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vegetables..."
                className="bg-transparent border-none outline-none w-full md:w-64 text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Add New Vegetable Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Sprout className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Add New Item</h3>
                </div>

                <form onSubmit={handleAddVegetable} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Vegetable Name</label>
                    <input
                      type="text"
                      value={newVeggieName}
                      onChange={(e) => setNewVeggieName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                      placeholder="E.g., Tomato"
                      disabled={loading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !newVeggieName.trim()}
                    className="w-full py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 font-semibold shadow-md shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
                    Add Vegetable
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-center text-sm text-slate-500">
                    <span>Total Items</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full">{vegetables.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vegetable Grid */}
            <div className="lg:col-span-2">
              {loading && vegetables.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <Loading fullScreen={false} />
                </div>
              ) : filteredVegetables.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                  <Leaf className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-lg font-medium">{searchTerm ? "No results found" : "Your list is empty"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredVegetables.map((vegetable) => (
                    <div
                      key={vegetable.id}
                      className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-green-500"
                    >
                      {editingVeggie?.id === vegetable.id ? (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <input
                            type="text"
                            value={editVeggieName}
                            onChange={(e) => setEditVeggieName(e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditVegetable(vegetable);
                              if (e.key === 'Escape') setEditingVeggie(null);
                            }}
                          />
                          <button
                            onClick={() => handleEditVegetable(vegetable)}
                            className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingVeggie(null)}
                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center text-green-600 font-bold text-lg select-none">
                              {vegetable.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-700 truncate max-w-[120px] sm:max-w-[150px]">
                              {vegetable.name}
                            </span>
                          </div>

                          <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingVeggie(vegetable);
                                setEditVeggieName(vegetable.name);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteVegetable(vegetable.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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