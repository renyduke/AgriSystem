import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaUser, FaEnvelope, FaDollarSign, FaGlobe, FaBell, FaPlus, FaTrash, FaSync, FaLeaf, FaMoon, FaSun } from "react-icons/fa";
import { useTheme } from '../../hook/useTheme';

// Error Boundary 
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center p-6 bg-red-100 dark:bg-red-900 rounded-lg">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-200">Error Loading Settings!</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Please try refreshing the page or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Settings = () => {
  const { isDark, toggleTheme } = useTheme();
  const [formData, setFormData] = useState(() => {
    const savedData = localStorage.getItem("settings");
    return savedData
      ? JSON.parse(savedData)
      : {
          username: "currentuser",
          email: "user@example.com",
          currency: "USD",
          language: "English",
          notifications: true,
          newVegetable: "",
        };
  });

  const [vegetables, setVegetables] = useState(() => {
    const savedVeggies = localStorage.getItem("vegetables");
    return savedVeggies ? JSON.parse(savedVeggies) : ["Tomato", "Cucumber", "Carrot", "Potato"];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem("vegetables", JSON.stringify(vegetables));
  }, [vegetables]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Please enter a valid email address");
    } else {
      setError("");
    }
  };

  const handleAddVegetable = (e) => {
    e.preventDefault();
    const newVeg = formData.newVegetable.trim();
    if (newVeg && !vegetables.includes(newVeg)) {
      setVegetables((prev) => [...prev, newVeg]);
      setFormData((prev) => ({ ...prev, newVegetable: "" }));
    } else if (vegetables.includes(newVeg)) {
      setError("Vegetable already exists!");
    } else {
      setError("Please enter a vegetable name");
    }
  };

  const handleRemoveVegetable = (vegetable) => {
    if (window.confirm(`Are you sure you want to remove ${vegetable}?`)) {
      setVegetables((prev) => prev.filter((v) => v !== vegetable));
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all settings?")) {
      setFormData({
        username: "currentuser",
        email: "user@example.com",
        currency: "USD",
        language: "English",
        notifications: true,
        newVegetable: "",
      });
      setVegetables(["Tomato", "Cucumber", "Carrot", "Potato"]);
      localStorage.removeItem("settings");
      localStorage.removeItem("vegetables");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (error) return;
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      console.log("Settings saved:", formData);
      console.log("Vegetable list:", vegetables);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <ErrorBoundary>
      <motion.div
        className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          className="text-4xl font-bold text-green-800 dark:text-green-200 mb-8 flex items-center"
          variants={itemVariants}
        >
          <FaUser className="mr-2 text-green-600 dark:text-green-400" />
          Settings
        </motion.h1>

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-8">
          {/* Account Settings */}
          <motion.section variants={itemVariants} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-5 border-b pb-2 border-green-200 dark:border-green-600">
              <FaUser className="inline mr-2 text-green-600 dark:text-green-400" /> Account Settings
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow shadow-sm dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow shadow-sm dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                  />
                  {error && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{error}</p>}
                </div>
              </div>
            </div>
          </motion.section>

          {/* System Preferences */}
          <motion.section variants={itemVariants} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-5 border-b pb-2 border-green-200 dark:border-green-600">
              <FaGlobe className="inline mr-2 text-green-600 dark:text-green-400" /> System Preferences
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Currency
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow shadow-sm dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Language
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow shadow-sm dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="notifications"
                  checked={formData.notifications}
                  onChange={handleInputChange}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label className="ml-3 text-sm text-gray-700 dark:text-gray-300">Enable Notifications</label>
              </div>
            </div>
          </motion.section>

          {/* Appearance Settings */}
          <motion.section variants={itemVariants} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-5 border-b pb-2 border-green-200 dark:border-green-600">
              <FaMoon className="inline mr-2 text-green-600 dark:text-green-400" /> Appearance
            </h2>
            <div className="space-y-5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Night Mode
                </span>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={isDark}
                    onChange={toggleTheme}
                    className="sr-only"
                    aria-label="Toggle Night Mode"
                  />
                  <div
                    className={`w-12 h-6 rounded-full transition-colors duration-300 ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-300 ${
                        isDark ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    ></div>
                  </div>
                  <FaMoon className={`ml-2 text-sm ${isDark ? 'text-yellow-500' : 'text-gray-400'}`} />
                  <FaSun className={`ml-2 text-sm ${!isDark ? 'text-yellow-500' : 'text-gray-400'}`} />
                </div>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isDark ? 'Switch to light mode' : 'Switch to night mode for better low-light viewing'}
              </p>
            </div>
          </motion.section>

          {/* Vegetable List Management */}
          <motion.section variants={itemVariants} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-5 border-b pb-2 border-green-200 dark:border-green-600">
              <FaLeaf className="inline mr-2 text-green-600 dark:text-green-400" /> Vegetable Management
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add New Vegetable
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    name="newVegetable"
                    value={formData.newVegetable}
                    onChange={handleInputChange}
                    className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow shadow-sm dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                    placeholder="Enter vegetable name"
                  />
                  <button
                    type="button"
                    onClick={handleAddVegetable}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-500 transition-all duration-200 flex items-center gap-2"
                  >
                    <FaPlus /> Add
                  </button>
                </div>
                {error && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{error}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {vegetables.map((vegetable) => (
                  <div
                    key={vegetable}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/50 rounded-lg shadow-sm hover:bg-green-100 dark:hover:bg-green-800 transition-all duration-200"
                  >
                    <span className="text-sm text-green-800 dark:text-green-200">{vegetable}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVegetable(vegetable)}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                      title="Remove Vegetable"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Controls */}
          <motion.div variants={itemVariants} className="flex gap-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 dark:hover:bg-green-600 transition-all duration-200 font-semibold disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                "Save Settings"
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <FaSync /> Reset
            </button>
          </motion.div>
        </form>

        {showSuccess && (
          <motion.div
            className="fixed top-4 right-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-3 rounded-lg shadow-md"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            Settings saved successfully!
          </motion.div>
        )}
      </motion.div>
    </ErrorBoundary>
  );
};

export default Settings;