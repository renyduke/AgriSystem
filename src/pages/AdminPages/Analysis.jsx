import React, { useEffect, useState, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db } from "../../config/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { FaSpinner, FaTractor, FaChartBar, FaChartLine, FaLeaf, FaChartPie, FaArrowLeft, FaArrowRight, FaUser, FaSeedling, FaMapMarkedAlt } from "react-icons/fa";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const center = [10.3903, 123.2224];
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const AgriDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [totalVegetables, setTotalVegetables] = useState(0);
  const [productionByBarangay, setProductionByBarangay] = useState([]);
  const [highDemandVeggies, setHighDemandVeggies] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [farmerCropTrends, setFarmerCropTrends] = useState([]);
  const [farmersData, setFarmersData] = useState([]);
  const [currentFarmerIndex, setCurrentFarmerIndex] = useState(0);
  const [totalProduction, setTotalProduction] = useState(0);
  const [averageFarmSize, setAverageFarmSize] = useState(0);
  const [topProducingFarmers, setTopProducingFarmers] = useState([]);
  const [landOwnershipDistribution, setLandOwnershipDistribution] = useState([]);
  const startX = useRef(null);

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
          landOwnership: doc.data().landOwnership || "Unknown",
          farmType: doc.data().farmType || "Unknown",
        }));
        setFarmersData(farmers);
        setTotalFarmers(farmersSnapshot.size);

        const vegetablesListSnapshot = await getDocs(collection(db, "vegetables_list"));
        setTotalVegetables(vegetablesListSnapshot.size);

        const allActivities = farmers.map(farmer => ({
          id: farmer.id,
          type: "farmer",
          name: farmer.name,
          timestamp: farmer.timestamp,
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
        setRecentActivities(allActivities);

        const barangayProd = farmers.reduce((acc, farmer) => {
          const barangay = farmer.farmBarangay || "Unknown";
          acc[barangay] = (acc[barangay] || 0) + (Number(farmer.hectares) || 0);
          return acc;
        }, {});
        const prodData = Object.entries(barangayProd).map(([name, value]) => ({ name, value }));
        setProductionByBarangay(prodData);

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

        const landOwnershipDist = farmers.reduce((acc, farmer) => {
          const ownership = farmer.landOwnership || "Unknown";
          acc[ownership] = (acc[ownership] || 0) + 1;
          return acc;
        }, {});
        setLandOwnershipDistribution(Object.entries(landOwnershipDist).map(([ownership, count]) => ({ ownership, count })));

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
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (!startX.current) return;
    const diff = e.touches[0].clientX - startX.current;
    if (Math.abs(diff) > 50) {
      handleSwipe(diff > 0 ? 'prev' : 'next');
      startX.current = null;
    }
  };

  const currentFarmer = farmersData[currentFarmerIndex] || {};

  // ApexCharts Options
  const cropTrendsOptions = {
    chart: { type: 'bar', toolbar: { show: true }, animations: { enabled: true } },
    colors: COLORS,
    plotOptions: { bar: { borderRadius: 8, distributed: true } },
    dataLabels: { enabled: false },
    xaxis: { categories: farmerCropTrends.map(item => item.name), labels: { rotate: -45, style: { fontSize: '12px' } } },
    yaxis: { title: { text: 'Number of Farmers' } },
    title: { text: 'Farmer Crop Trends 🌾', align: 'left', style: { fontSize: '18px', fontWeight: 'bold', color: '#166534' } },
    legend: { show: false },
  };

  const prodTrendsOptions = {
    chart: { type: 'line', toolbar: { show: true }, animations: { enabled: true } },
    colors: ['#10b981'],
    stroke: { curve: 'smooth', width: 3 },
    markers: { size: 6 },
    xaxis: { categories: highDemandVeggies.map(item => item.name) },
    yaxis: { title: { text: 'Quantity (ha)' } },
    title: { text: 'Vegetable Production Trends 📈', align: 'left', style: { fontSize: '18px', fontWeight: 'bold', color: '#166534' } },
  };

  const topFarmersOptions = {
    chart: { type: 'bar', toolbar: { show: true }, animations: { enabled: true } },
    colors: COLORS,
    plotOptions: { bar: { borderRadius: 8, distributed: true, horizontal: false } },
    dataLabels: { enabled: false },
    xaxis: { categories: topProducingFarmers.map(item => item.name), labels: { rotate: -45, style: { fontSize: '12px' } } },
    yaxis: { title: { text: 'Production (ha)' } },
    title: { text: 'Top Producing Farmers 🏆', align: 'left', style: { fontSize: '18px', fontWeight: 'bold', color: '#166534' } },
    legend: { show: false },
  };

  const landOwnershipOptions = {
    chart: { type: 'donut', animations: { enabled: true } },
    labels: landOwnershipDistribution.map(item => item.ownership),
    colors: COLORS,
    title: { 
      text: 'Land Ownership Distribution',
      align: 'left',
      style: { fontSize: '18px', fontWeight: 'bold', color: '#166534' }
    },
    legend: { position: 'bottom' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="text-6xl text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-green-800 font-semibold text-lg">Loading agricultural data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center border-4 border-red-200">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Error Loading Data</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/50">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl shadow-lg">
              <FaSeedling className="text-white text-3xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Agricultural Dashboard
              </h1>
              <p className="text-gray-600 text-sm mt-1">Comprehensive farming analytics for Canlaon City</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Total Farmers" value={totalFarmers} icon="👨‍🌾" color="from-green-400 to-emerald-500" />
            <StatCard title="Vegetable Types" value={totalVegetables} icon="🥬" color="from-blue-400 to-cyan-500" />
            <StatCard title="Total Production" value={`${totalProduction.toFixed(1)} ha`} icon="📏" color="from-yellow-400 to-orange-500" />
            <StatCard title="Avg Farm Size" value={`${averageFarmSize} ha`} icon="📊" color="from-purple-400 to-pink-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Activities */}
            <DashboardCard title="Recent Activities" icon={<FaTractor />}>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all">
                    <div className="flex items-center space-x-3">
                      {getActivityIcon(activity.type)}
                      <span className="font-medium text-gray-800">{activity.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </DashboardCard>

            {/* Farmer Crop Trends */}
            <DashboardCard>
              <ReactApexChart options={cropTrendsOptions} series={[{ data: farmerCropTrends.map(item => item.count) }]} type="bar" height={320} />
            </DashboardCard>

            {/* Production Trends */}
            <DashboardCard>
              <ReactApexChart options={prodTrendsOptions} series={[{ name: 'Production', data: highDemandVeggies.map(item => item.value) }]} type="line" height={320} />
            </DashboardCard>

            {/* Top Producing Farmers */}
            <DashboardCard>
              <ReactApexChart options={topFarmersOptions} series={[{ data: topProducingFarmers.map(item => item.production) }]} type="bar" height={320} />
            </DashboardCard>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* Production Map */}
            <DashboardCard title="Production Map" icon={<FaMapMarkedAlt />}>
              <div className="h-64 rounded-xl overflow-hidden border-2 border-gray-200">
                <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {farmersData
                    .filter((farm) => farm.coordinates && farm.coordinates.length === 2)
                    .map((farm) => (
                      <Marker key={farm.id} position={farm.coordinates} icon={redIcon}>
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-green-700">{farm.name}</h3>
                            <p className="text-xs"><strong>Barangay:</strong> {farm.farmBarangay || "Unknown"}</p>
                            <p className="text-xs"><strong>Production:</strong> {farm.hectares || 0} ha</p>
                            <p className="text-xs"><strong>Crop:</strong> {farm.vegetable}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                </MapContainer>
              </div>
            </DashboardCard>

            {/* Land Ownership Distribution */}
            <DashboardCard title="Land Ownership" icon={<FaChartPie />}>
              <ReactApexChart
                options={landOwnershipOptions}
                series={landOwnershipDistribution.map(item => item.count)}
                type="donut"
                height={280}
              />
            </DashboardCard>

            {/* Farmer Profile Carousel */}
            <DashboardCard title="Farmer Profile" icon={<FaUser />}>
              {farmersData.length > 0 ? (
                <div
                  className="relative"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                >
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => handleSwipe('prev')}
                        className="p-2 bg-white rounded-full shadow-md hover:bg-green-50 transition-all disabled:opacity-30"
                        disabled={currentFarmerIndex === 0}
                      >
                        <FaArrowLeft className="text-green-600" />
                      </button>
                      <h3 className="text-lg font-bold text-green-900">{currentFarmer.name}</h3>
                      <button
                        onClick={() => handleSwipe('next')}
                        className="p-2 bg-white rounded-full shadow-md hover:bg-green-50 transition-all disabled:opacity-30"
                        disabled={currentFarmerIndex === farmersData.length - 1}
                      >
                        <FaArrowRight className="text-green-600" />
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><strong>Contact:</strong> {currentFarmer.contact || "N/A"}</p>
                      <p><strong>Barangay:</strong> {currentFarmer.farmBarangay || "Unknown"}</p>
                      <p><strong>Hectares:</strong> {currentFarmer.hectares || 0} ha</p>
                      <p><strong>Main Crop:</strong> {currentFarmer.vegetable}</p>
                      <p><strong>Farm Type:</strong> {currentFarmer.farmType || "N/A"}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">
                      Farmer {currentFarmerIndex + 1} of {farmersData.length}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-6">No farmer data available</p>
              )}
            </DashboardCard>

            {/* Overall Analysis */}
            <DashboardCard title="Overall Analysis" icon={<FaChartLine />}>
              <div className="space-y-3 text-sm text-gray-700 max-h-64 overflow-y-auto pr-2">
                <p className="leading-relaxed">
                  Currently tracking <strong className="text-green-700">{totalFarmers}</strong> registered farmers cultivating <strong className="text-green-700">{totalVegetables}</strong> vegetable types across Canlaon City.
                </p>
                <p className="leading-relaxed">
                  {highDemandVeggies.length > 0 && (
                    <>Leading crop is <strong className="text-green-700">{highDemandVeggies[0].name}</strong> with {highDemandVeggies[0].value.toFixed(1)} ha of production.</>
                  )}
                </p>
                <p className="leading-relaxed">
                  {farmerCropTrends.length > 0 && (
                    <>Most cultivated crop is <strong className="text-green-700">{farmerCropTrends[0].name}</strong> with <strong>{farmerCropTrends[0].count}</strong> farmers involved.</>
                  )}
                </p>
                <p className="leading-relaxed">
                  {productionByBarangay.length > 0 && (
                    <>Top producing barangay: <strong className="text-green-700">{productionByBarangay[0].name}</strong> with {productionByBarangay[0].value.toFixed(1)} ha.</>
                  )}
                </p>
              </div>
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardCard = ({ title, children, icon }) => (
  <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/50 hover:shadow-2xl transition-shadow">
    {title && (
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-green-600 text-xl">{icon}</span>}
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
    )}
    {children}
  </div>
);

const StatCard = ({ title, value, icon, color }) => (
  <div className={`bg-gradient-to-br ${color} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
        <p className="text-white text-3xl font-bold">{value}</p>
      </div>
      <div className="text-5xl opacity-80">{icon}</div>
    </div>
  </div>
);

export default AgriDashboard;