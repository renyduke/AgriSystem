import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell
} from "recharts";
import { db } from "../../config/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { FaSpinner, FaDownload, FaChartBar, FaLeaf } from "react-icons/fa";

const COLORS = ["#2E7D32", "#EF6C00", "#1976D2", "#D32F2F", "#689F38", "#E64A19"];

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [farmerCropTrends, setFarmerCropTrends] = useState([]);
  const [productionByBarangay, setProductionByBarangay] = useState([]);

  useEffect(() => {
    // Real-time listener for Farmers collection
    const unsubscribeFarmers = onSnapshot(
      collection(db, "farmers"),
      (snapshot) => {
        const farmersData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
        }));

        // Farmer Crop Trends
        const cropCounts = farmersData.reduce((acc, farmer) => {
          if (Array.isArray(farmer.mainCrops)) {
            farmer.mainCrops.forEach(crop => {
              acc[crop] = (acc[crop] || 0) + 1;
            });
          }
          return acc;
        }, {});
        const cropTrendsData = Object.entries(cropCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        setFarmerCropTrends(cropTrendsData);

        // Production by Barangay
        const barangayProd = farmersData.reduce((acc, farmer) => {
          const barangay = farmer.farmBarangay || "Unknown";
          acc[barangay] = (acc[barangay] || 0) + (Number(farmer.vegetableProduction) || 0);
          return acc;
        }, {});
        const prodData = Object.entries(barangayProd).map(([name, value]) => ({ name, value }));
        setProductionByBarangay(prodData);

        setLoading(false); // Set loading to false after initial data load
      },
      (error) => {
        console.error("Error fetching farmers data:", error);
        setError("Failed to load farmers data: " + error.message);
        setLoading(false);
      }
    );

    // Cleanup listeners on component unmount
    return () => {
      unsubscribeFarmers();
    };
  }, []);

  const downloadCSV = (data, filename) => {
    const csv = [
      Object.keys(data[0]).join(","),
      ...data.map(row => Object.values(row).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl ml-18">
      <h1 className="text-3xl font-bold text-green-900 mb-6 flex items-center">
        <FaChartBar className="mr-2 text-green-600" /> Reports
      </h1>

      {loading && (
        <div className="flex justify-center items-center h-64">
          <FaSpinner className="text-4xl text-green-600 animate-spin" />
        </div>
      )}
      {error && (
        <div className="bg-red-100 p-4 rounded-lg text-red-700 text-center">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {/* Farmer Crop Trends Report */}
          <ReportSection
            title="Farmer Crop Trends"
            description="Number of farmers producing each vegetable (Real-time)"
            data={farmerCropTrends}
            download={() => downloadCSV(farmerCropTrends, "farmer_crop_trends.csv")}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={farmerCropTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip formatter={(value) => [`${value} farmers`, "Count"]} />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </ReportSection>

          {/* Production by Barangay Report */}
          <ReportSection
            title="Production by Barangay"
            description="Total vegetable production by barangay in kg (Real-time)"
            data={productionByBarangay}
            download={() => downloadCSV(productionByBarangay, "production_by_barangay.csv")}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={productionByBarangay}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {productionByBarangay.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} kg`, "Production"]} />
              </PieChart>
            </ResponsiveContainer>
          </ReportSection>
        </div>
      )}
    </div>
  );
};

const ReportSection = ({ title, description, children, data, download }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <div className="flex justify-between items-center mb-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <FaLeaf className="mr-2 text-green-600" /> {title}
        </h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {data.length > 0 && (
        <button
          onClick={download}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          <FaDownload /> Download CSV
        </button>
      )}
    </div>
    {children}
  </div>
);

export default Reports;