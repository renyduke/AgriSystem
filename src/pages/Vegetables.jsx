import React, { useState, useEffect } from "react";
import { OrbitProgress } from 'react-loading-indicators';
import { useTheme } from "../context/ThemeContext";
import { db, auth } from "../config/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { logActivity } from "../services/activityLogger";
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
  const { darkMode } = useTheme();
  const [vegetables, setVegetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newVeggieName, setNewVeggieName] = useState("");
  const [editingVeggie, setEditingVeggie] = useState(null);
  const [editVeggieName, setEditVeggieName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const validateVegetableName = (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return "Name is too short (minimum 2 characters).";
    if (trimmed.length > 30) return "Name is too long (maximum 30 characters).";
    
    // Only letters, spaces, and hyphens
    if (!/^[A-Za-z\s-]+$/.test(trimmed)) {
      return "Name can only contain letters, spaces, and hyphens.";
    }

    // Check for vowels (basic gibberish check)
    if (!/[aeiou]/i.test(trimmed)) {
      return "Please enter a valid vegetable name (missing vowels).";
    }

    // Check for excessive repetitive characters (e.g., "aaa")
    if (/(.)\1\1/.test(trimmed)) {
      return "Name contains too many repetitive characters.";
    }

    return null; // Valid
  };

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
    const error = validateVegetableName(newVeggieName);
    if (error) {
      alert(error);
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
      logActivity('add', 'Vegetable', newVeggieName.trim(), auth.currentUser?.displayName || 'Admin');
      showNotification("Vegetable added successfully!");
    } catch (error) {
      console.error("Error adding vegetable:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditVegetable = async (veggie) => {
    if (editVeggieName.trim() && editVeggieName !== veggie.name) {
      const error = validateVegetableName(editVeggieName);
      if (error) {
        alert(error);
        return;
      }

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
        logActivity('update', 'Vegetable', editVeggieName.trim(), auth.currentUser?.displayName || 'Admin');
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
        const deletedVeg = vegetables.find((v) => v.id === veggieId);
        await deleteDoc(doc(db, "vegetables_list", veggieId));
        await fetchVegetables();
        logActivity('delete', 'Vegetable', deletedVeg?.name || veggieId, auth.currentUser?.displayName || 'Admin');
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
      <div className="h-screen bg-gray-50 dark:bg-slate-950 px-6 pt-2 pb-6 font-sans transition-colors duration-300 overflow-hidden flex flex-col">
        <div className="w-full space-y-6 flex-1 flex flex-col overflow-hidden">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Leaf className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                Vegetable Management
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm md:text-base">
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

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl w-full md:w-auto focus-within:ring-2 focus-within:ring-green-500 transition-all">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vegetables..."
                className="bg-transparent border-none outline-none w-full md:w-64 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">

            {/* Add New Vegetable Card */}
            <div className="lg:col-span-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <Sprout className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Add New Item</h3>
                </div>

                <form onSubmit={handleAddVegetable} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Vegetable Name</label>
                    <input
                      type="text"
                      value={newVeggieName}
                      onChange={(e) => setNewVeggieName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="E.g., Tomato"
                      disabled={loading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !newVeggieName.trim()}
                    className="w-full py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 font-semibold shadow-md shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <OrbitProgress variant="dotted" color="#ffffff" size="small" text="" textColor="" /> : <Plus className="w-5 h-5" />}
                    Add Vegetable
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
                    <span>Total Items</span>
                    <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{vegetables.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vegetable Grid */}
            <div className="lg:col-span-2 overflow-y-auto pr-2 custom-scrollbar">
              {loading && vegetables.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <OrbitProgress variant="dotted" color="#32cd32" size="medium" text="" textColor="" />
                </div>
              ) : filteredVegetables.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                  <Leaf className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-lg font-medium">{searchTerm ? "No results found" : "Your list is empty"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredVegetables.map((vegetable) => (
                    <div
                      key={vegetable.id}
                      className="group bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-green-500"
                    >
                      {editingVeggie?.id === vegetable.id ? (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <input
                            type="text"
                            value={editVeggieName}
                            onChange={(e) => setEditVeggieName(e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-green-500 text-slate-700 dark:text-slate-200"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditVegetable(vegetable);
                              if (e.key === 'Escape') setEditingVeggie(null);
                            }}
                          />
                          <button
                            onClick={() => handleEditVegetable(vegetable)}
                            className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingVeggie(null)}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-lg select-none">
                              {vegetable.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[150px]">
                              {vegetable.name}
                            </span>
                          </div>

                          <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingVeggie(vegetable);
                                setEditVeggieName(vegetable.name);
                              }}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteVegetable(vegetable.id)}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
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
        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
          }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #334155;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
          }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #475569;
          }
        `}</style>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Vegetables;