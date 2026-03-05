import React, { useEffect, useState, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db } from "../../config/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { FaSpinner, FaTractor, FaChartBar, FaChartLine, FaLeaf, FaChartPie, FaArrowLeft, FaArrowRight, FaUser, FaSeedling, FaMapMarkedAlt } from "react-icons/fa";
import Loading from "../../components/Loading";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const createPinIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

const getIconColor = (crop) => {
  if (!crop) return "grey";
  switch (crop.trim()) {
    case "Tomato": return "red";
    case "Corn": return "yellow";
    case "Rice": return "green";
    default: return "grey";
  }
};

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

  const currentFarmer = farmersData[currentFarmerIndex] || {};

  // Common Chart Options
  const commonChartOptions = {
    chart: {
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
      },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif'
    },
    theme: { mode: 'light' },
    dataLabels: { enabled: false },
    grid: { borderColor: '#f3f4f6', strokeDashArray: 4 },
  };

  const cropTrendsOptions = {
    ...commonChartOptions,
    chart: { type: 'bar' },
    colors: COLORS,
    plotOptions: {
      bar: {
        borderRadius: 6,
        distributed: true,
        columnWidth: '60%'
      }
    },
    xaxis: {
      categories: farmerCropTrends.map(item => item.name),
      labels: { style: { fontSize: '12px', colors: '#64748b' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      title: { text: undefined }, // Removed Y-axis title for cleaner look
      labels: { style: { colors: '#64748b' } }
    },
    legend: { show: false },
  };

  const prodTrendsOptions = {
    ...commonChartOptions,
    chart: { type: 'area' },
    colors: ['#10b981'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.2,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: highDemandVeggies.map(item => item.name),
      labels: { style: { colors: '#64748b' } }
    },
    yaxis: { labels: { style: { colors: '#64748b' } } },
  };

  const topFarmersOptions = {
    ...commonChartOptions,
    chart: { type: 'bar' },
    colors: ['#3b82f6'],
    plotOptions: {
      bar: {
        borderRadius: 4,
        horizontal: true,
        barHeight: '60%'
      }
    },
    xaxis: {
      categories: topProducingFarmers.map(item => item.name),
      labels: { style: { colors: '#64748b' } }
    },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '13px', fontWeight: 500 } } },
  };

  const landOwnershipOptions = {
    ...commonChartOptions,
    chart: { type: 'donut' },
    labels: landOwnershipDistribution.map(item => item.ownership),
    colors: COLORS,
    legend: { position: 'bottom', fontSize: '13px', markers: { radius: 12 } },
    stroke: { show: false },
    plotOptions: { pie: { donut: { size: '65%' } } }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading fullScreen={false} text="Loading analytics data..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">Real-time insights on Canlaon's agricultural landscape</p>
          </div>

        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard title="Total Farmers" value={totalFarmers} icon={<FaUser />} color="text-blue-600" bg="bg-blue-50" />
          <StatCard title="Crop Varieties" value={totalVegetables} icon={<FaLeaf />} color="text-green-600" bg="bg-green-50" />
          <StatCard title="Total Hectares" value={totalProduction.toFixed(1)} unit="ha" icon={<FaMapMarkedAlt />} color="text-amber-600" bg="bg-amber-50" />
        </div>

        {/* Charts Section - Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Production Trends (Main Chart - spans 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <FaChartLine className="text-green-600 text-lg" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Production Yield Trends</h2>
              </div>
            </div>
            <ReactApexChart options={prodTrendsOptions} series={[{ name: 'Production (ha)', data: highDemandVeggies.map(item => item.value) }]} type="area" height={350} />
          </div>

          {/* Land Ownership (Donut Chart) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 rounded-lg">
                <FaChartPie className="text-purple-600 text-lg" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Land Ownership</h2>
            </div>
            <div className="flex items-center justify-center h-[300px]">
              <ReactApexChart options={landOwnershipOptions} series={landOwnershipDistribution.map(item => item.count)} type="donut" width="100%" />
            </div>
          </div>
        </div>

        {/* Charts Section - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Farmers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FaTractor className="text-blue-600 text-lg" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Top Producers</h2>
            </div>
            <ReactApexChart options={topFarmersOptions} series={[{ name: 'Hectares', data: topProducingFarmers.map(item => item.production) }]} type="bar" height={320} />
          </div>

          {/* Crop Popularity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-50 rounded-lg">
                <FaSeedling className="text-orange-600 text-lg" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Crop Popularity</h2>
            </div>
            <ReactApexChart options={cropTrendsOptions} series={[{ name: 'Farmers', data: farmerCropTrends.map(item => item.count) }]} type="bar" height={320} />
          </div>
        </div>

        {/* Map & Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Production Map (spans 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <FaMapMarkedAlt className="text-red-600 text-lg" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Production Zones</h2>
              </div>
              <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-md">Live View</span>
            </div>
            <div className="h-[400px] w-full rounded-xl overflow-hidden border border-gray-100 relative z-0">
              <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {farmersData
                  .filter((farm) => farm.coordinates && farm.coordinates.length === 2)
                  .map((farm) => (
                    <Marker
                      key={farm.id}
                      position={farm.coordinates}
                      icon={createPinIcon(getIconColor(farm.vegetable))}
                    >
                      <Popup>
                        <div className="p-1">
                          <strong className="block text-sm text-gray-900">{farm.name}</strong>
                          <span className="text-xs text-gray-500">{farm.farmBarangay} • {farm.vegetable}</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">

            {/* Key Insights */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-3 mb-4 border-b border-green-400 pb-3">
                <FaChartBar className="text-green-100 text-lg" />
                <h2 className="text-lg font-bold">Key Insights</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-200 mt-2 flex-shrink-0" />
                  <p className="text-green-50 text-sm leading-relaxed">
                    <strong className="text-white">{totalFarmers} active farmers</strong> are currently cultivating {totalVegetables} distinct vegetable types.
                  </p>
                </li>
                {highDemandVeggies.length > 0 && (
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-200 mt-2 flex-shrink-0" />
                    <p className="text-green-50 text-sm leading-relaxed">
                      <strong className="text-white">{highDemandVeggies[0].name}</strong> dominates production with {highDemandVeggies[0].value.toFixed(1)} ha planted.
                    </p>
                  </li>
                )}
                {productionByBarangay.length > 0 && (
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-200 mt-2 flex-shrink-0" />
                    <p className="text-green-50 text-sm leading-relaxed">
                      <strong className="text-white">{productionByBarangay[0].name}</strong> is the top producing barangay this season.
                    </p>
                  </li>
                )}
              </ul>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FaTractor className="text-gray-400" /> Recent Activity
              </h3>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.name}</p>
                      <p className="text-xs text-gray-500">Updated profile details</p>
                    </div>
                    <span className="text-xs text-gray-400 ml-auto">{new Date(activity.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
                {recentActivities.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

const StatCard = ({ title, value, unit, icon, color, bg }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm font-medium text-gray-400">{unit}</span>}
      </div>
    </div>
    <div className={`p-3 rounded-xl ${bg}`}>
      <span className={`text-xl ${color}`}>{icon}</span>
    </div>
  </div>
);

export default AgriDashboard;