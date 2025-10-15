import React, { useEffect, useState, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db } from "../../config/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { FaSpinner, FaTractor, FaChartBar, FaChartLine, FaLeaf, FaChartPie, FaArrowLeft, FaArrowRight, FaUser } from "react-icons/fa";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Custom red marker
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const center = [10.3903, 123.2224]; // Canlaon City coordinates

const COLORS = ["#2E7D32", "#EF6C00", "#1976D2", "#D32F2F", "#689F38", "#E64A19"];

const AgriDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [totalVegetables, setTotalVegetables] = useState(0);
  const [productionByBarangay, setProductionByBarangay] = useState([]);
  const [highDemandVeggies, setHighDemandVeggies] = useState([]);
  const [vegProductionShare, setVegProductionShare] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [farmerCropTrends, setFarmerCropTrends] = useState([]);
  const [farmersData, setFarmersData] = useState([]);
  const [currentFarmerIndex, setCurrentFarmerIndex] = useState(0);

  // New analytics
  const [totalProduction, setTotalProduction] = useState(0);
  const [averageFarmSize, setAverageFarmSize] = useState(0);
  const [seasonDistribution, setSeasonDistribution] = useState([]);
  const [topProducingFarmers, setTopProducingFarmers] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const farmersSnapshot = await getDocs(collection(db, "farmers"));
        const farmers = farmersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: "farmer",
          timestamp: doc.data().timestamp || new Date().toISOString(),
          name: doc.data().fullName || `${doc.data().firstName || ''} ${doc.data().lastName || ''}`,
          vegetable: doc.data().mainCrops?.crop1?.name || "N/A",
          coordinates: doc.data().coordinates || [10.3903, 123.2224],
        }));
        setFarmersData(farmers);
        setTotalFarmers(farmersSnapshot.size);

        const vegetablesListSnapshot = await getDocs(collection(db, "vegetables_list"));
        const vegetablesList = vegetablesListSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          harvestAfter: doc.data().harvestAfter || 60,
        }));
        setTotalVegetables(vegetablesListSnapshot.size);

        const allActivities = [
          ...farmers.map(farmer => ({
            id: farmer.id,
            type: "farmer",
            name: farmer.name,
            timestamp: farmer.timestamp,
          })),
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
         .slice(0, 5);
        setRecentActivities(allActivities);

        const barangayProd = farmers.reduce((acc, farmer) => {
          const barangay = farmer.farmBarangay || "Unknown";
          acc[barangay] = (acc[barangay] || 0) + (Number(farmer.hectares) || 0);
          return acc;
        }, {});
        const prodData = Object.entries(barangayProd).map(([name, value]) => ({ name, value }));
        setProductionByBarangay(prodData);
        setVegProductionShare(prodData);

        const veggieDemand = farmers.reduce((acc, farmer) => {
          if (farmer.vegetable && farmer.hectares) {
            acc[farmer.vegetable] = (acc[farmer.vegetable] || 0) + Number(farmer.hectares);
          }
          return acc;
        }, {});
        const demandData = Object.entries(veggieDemand)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
        setHighDemandVeggies(demandData.slice(0, 5));

        const cropCounts = farmers.reduce((acc, farmer) => {
          if (farmer.mainCrops) {
            Object.values(farmer.mainCrops).forEach(crop => {
              if (crop.name) {
                acc[crop.name] = (acc[crop.name] || 0) + 1;
              }
            });
          }
          return acc;
        }, {});
        const cropTrendsData = Object.entries(cropCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        setFarmerCropTrends(cropTrendsData);

        const totalProd = farmers.reduce((sum, farmer) => sum + Number(farmer.hectares) || 0, 0);
        setTotalProduction(totalProd);

        const avgFarmSize = totalFarmers > 0 ? totalProd / totalFarmers : 0;
        setAverageFarmSize(avgFarmSize.toFixed(2));

        const seasonDist = farmers.reduce((acc, farmer) => {
          const season = farmer.season || "Default";
          acc[season] = (acc[season] || 0) + 1;
          return acc;
        }, {});
        const seasonData = Object.entries(seasonDist).map(([season, count]) => ({ season, count }));
        setSeasonDistribution(seasonData);

        const topFarmers = farmers
          .map(farmer => ({
            name: farmer.name,
            production: Number(farmer.hectares) || 0,
          }))
          .sort((a, b) => b.production - a.production)
          .slice(0, 5);
        setTopProducingFarmers(topFarmers);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setError("Failed to load dashboard data: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case "farmer": return <FaTractor className="text-green-600" />;
      default: return <FaLeaf className="text-gray-600" />;
    }
  };

  const handleSwipe = (direction) => {
    setCurrentFarmerIndex(prev => {
      if (direction === 'next') {
        return prev === farmersData.length - 1 ? 0 : prev + 1;
      } else {
        return prev === 0 ? farmersData.length - 1 : prev - 1;
      }
    });
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
  };

  const handleTouchMove = (e) => {
    if (!startX.current) return;
    const touch = e.touches[0];
    const diff = touch.clientX - startX.current;
    if (Math.abs(diff) > 50) {
      handleSwipe(diff > 0 ? 'prev' : 'next');
      startX.current = null;
    }
  };

  const startX = useRef(null);

  const currentFarmer = farmersData[currentFarmerIndex] || {};

  return (
    <div className="p-6 ml">
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OverviewCard title="Farmers" value={totalFarmers} change="+3.49%" changeColor="text-green-500" bgColor="bg-yellow-100" />
            <OverviewCard title="Vegetable Types" value={totalVegetables} change="+3.49%" changeColor="text-green-500" bgColor="bg-blue-100" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <DashboardCard title="Recent Activities">
                <div className="space-y-1 h-[120px] overflow-y-auto">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-1 bg-gray-50 rounded-sm text-xs hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-1 flex-1 truncate">
                        {getActivityIcon(activity.type)}
                        <span className="truncate">{activity.name}</span>
                      </div>
                      <span className="text-gray-500 ml-2 whitespace-nowrap">
                        {new Date(activity.timestamp).toLocaleString([], { 
                          year: 'numeric', 
                          month: '2-digit', 
                          day: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </DashboardCard>

              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-2xl font-bold text-green-900 mb-2 flex items-center">
                  <FaChartBar className="mr-2 text-green-600" /> Farmer Crop Trends 🌾
                </h2>
                <p className="text-sm text-gray-500 mb-6">Number of farmers producing each vegetable</p>
                {farmerCropTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={farmerCropTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" opacity={0.5} />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 14, fill: "#374151" }} />
                      <YAxis tick={{ fontSize: 14, fill: "#374151" }} label={{ value: "Number of Farmers", angle: -90, position: "insideLeft", offset: -5, fill: "#374151" }} />
                      <Tooltip formatter={(value) => [`${value} farmers`, "Count"]} labelFormatter={(label) => `Vegetable: ${label}`} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="count" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-10">No farmer crop data available yet</p>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-2xl font-bold text-green-900 mb-2 flex items-center">
                  <FaChartLine className="mr-2 text-green-600" /> Vegetable Production Trends 📈
                </h2>
                <p className="text-sm text-gray-500 mb-6">Most produced vegetables based on farmer data</p>
                {highDemandVeggies.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={highDemandVeggies}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" opacity={0.5} />
                      <XAxis dataKey="name" angle={0} textAnchor="middle" height={50} tick={{ fontSize: 14, fill: "#374151" }} padding={{ left: 20, right: 20 }} />
                      <YAxis tick={{ fontSize: 14, fill: "#374151" }} label={{ value: "Quantity (ha)", angle: -90, position: "insideLeft", offset: -5, fill: "#374151" }} />
                      <Tooltip formatter={(value) => [`${value} ha`, "Quantity"]} labelFormatter={(label) => `Vegetable: ${label}`} />
                      <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", r: 6 }} activeDot={{ r: 8 }} />
                      <Legend verticalAlign="top" height={36} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-10">No production data available yet</p>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-2xl font-bold text-green-900 mb-2 flex items-center">
                  <FaChartPie className="mr-2 text-green-600" /> Season Distribution 📊
                </h2>
                <p className="text-sm text-gray-500 mb-6">Number of farmers by season</p>
                {seasonDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={seasonDistribution}
                        dataKey="count"
                        nameKey="season"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {seasonDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-10">No season data available yet</p>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-2xl font-bold text-green-900 mb-2 flex items-center">
                  <FaChartBar className="mr-2 text-green-600" /> Top Producing Farmers 🏆
                </h2>
                <p className="text-sm text-gray-500 mb-6">Farmers ranked by production area</p>
                {topProducingFarmers.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProducingFarmers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" opacity={0.5} />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 14, fill: "#374151" }} />
                      <YAxis tick={{ fontSize: 14, fill: "#374151" }} label={{ value: "Production (ha)", angle: -90, position: "insideLeft", offset: -5, fill: "#374151" }} />
                      <Tooltip formatter={(value) => [`${value} ha`, "Production"]} labelFormatter={(label) => `Farmer: ${label}`} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="production" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-10">No production data available yet</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <DashboardCard title="Production Map">
                {farmersData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <MapContainer
                      center={center}
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution=""
                      />
                      {farmersData
                        .filter((farm) => farm.coordinates && farm.coordinates.length === 2)
                        .map((farm) => (
                          <Marker
                            key={farm.id}
                            position={farm.coordinates}
                            icon={redIcon}
                          >
                            <Popup>
                              <div className="p-2">
                                <h3 className="font-semibold text-green-800">{farm.name}</h3>
                                <p className="text-sm text-gray-600">Barangay: {farm.farmBarangay || "Unknown"}</p>
                                <p className="text-sm text-gray-600">
                                  Production: {farm.hectares || 0} ha
                                </p>
                                <p className="text-sm text-gray-600">Crop: {farm.vegetable}</p>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                    </MapContainer>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-10">No farmer location data available</p>
                )}
                <div className="text-right mt-2">
                  <button className="text-gray-500 hover:text-gray-700 text-sm">View Details</button>
                </div>
              </DashboardCard>

              <DashboardCard title="Farmer Profile">
                {farmersData.length > 0 ? (
                  <div
                    className="relative w-full h-64 bg-white rounded-xl shadow-lg p-4 border border-gray-100 overflow-hidden"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => handleSwipe('prev')}
                        className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                        disabled={currentFarmerIndex === 0}
                      >
                        <FaArrowLeft />
                      </button>
                      <h2 className="text-xl font-bold text-green-900 flex items-center">
                        <FaUser className="mr-2" /> {currentFarmer.name}
                      </h2>
                      <button
                        onClick={() => handleSwipe('next')}
                        className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                        disabled={currentFarmerIndex === farmersData.length - 1}
                      >
                        <FaArrowRight />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <p><strong>Contact:</strong> {currentFarmer.contact || "N/A"}</p>
                      <p><strong>Barangay:</strong> {currentFarmer.farmBarangay || "Unknown"}</p>
                      <p><strong>Sitio:</strong> {currentFarmer.farmSitio || "N/A"}</p>
                      <p><strong>Hectares:</strong> {currentFarmer.hectares || 0} ha</p>
                      <p><strong>Main Crop:</strong> {currentFarmer.vegetable}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Farmer {currentFarmerIndex + 1} of {farmersData.length}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-10">No farmer data available</p>
                )}
              </DashboardCard>

              <DashboardCard title="Overall Analysis">
                <div className="space-y-3 text-sm text-gray-700 max-h-[200px] overflow-y-auto">
                  <p>
                    This dashboard provides a comprehensive overview of agricultural activities in Canlaon City. Currently, there are <strong>{totalFarmers}</strong> registered farmers cultivating <strong>{totalVegetables}</strong> distinct vegetable types, contributing to a vibrant local food ecosystem.
                  </p>
                  <p>
                    The system tracks farmer production trends, with {highDemandVeggies.length > 0 ? highDemandVeggies[0].name : "no data yet"} leading at {highDemandVeggies.length > 0 ? highDemandVeggies[0].value : 0} ha.
                  </p>
                  <p>
                    Farmer production trends show {farmerCropTrends.length > 0 ? farmerCropTrends[0].name : "no data yet"} as the most cultivated crop, with <strong>{farmerCropTrends.length > 0 ? farmerCropTrends[0].count : 0}</strong> farmers involved. The "Production Map" visualizes farm locations, with significant activity in barangays like {productionByBarangay.length > 0 ? productionByBarangay[0].name : "Unknown"}.
                  </p>
                  <p>
                    Recent activities indicate ongoing engagement, with the latest being {recentActivities.length > 0 ? recentActivities[0].name : "none recorded"} at {recentActivities.length > 0 ? new Date(recentActivities[0].timestamp).toLocaleString() : "N/A"}. This data suggests a dynamic agricultural economy with opportunities for targeted growth in high-demand crops.
                  </p>
                </div>
              </DashboardCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardCard = ({ title, children }) => (
  <div className="bg-white p-4 rounded-lg shadow-md">
    <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
    {children}
  </div>
);

const OverviewCard = ({ title, value, change, changeColor, bgColor }) => (
  <div className={`p-4 rounded-lg shadow-md ${bgColor}`}>
    <h3 className="text-sm font-medium text-gray-600">{title}</h3>
    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    <p className={`text-sm ${changeColor} mt-1`}>{change}</p>
  </div>
);

export default AgriDashboard;