import React, { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { db } from "../../config/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { 
  FaFileAlt, FaDownload, FaFilter, FaCalendar, FaChartBar, 
  FaPrint, FaSpinner, FaTractor, FaSeedling, FaMapMarkedAlt,
  FaUsers, FaLeaf, FaChartLine, FaChartPie, FaTable
} from "react-icons/fa";

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("all");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [selectedCrop, setSelectedCrop] = useState("all");
  
  // Data states
  const [farmers, setFarmers] = useState([]);
  const [vegetables, setVegetables] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [crops, setCrops] = useState([]);
  
  // Analytics states
  const [summaryStats, setSummaryStats] = useState({
    totalFarmers: 0,
    totalHectares: 0,
    totalVegetables: 0,
    activeFarms: 0,
    avgFarmSize: 0
  });
  
  const [barangayData, setBarangayData] = useState([]);
  const [cropDistribution, setCropDistribution] = useState([]);
  const [seasonalData, setSeasonalData] = useState([]);
  const [landOwnershipData, setLandOwnershipData] = useState([]);
  const [farmTypeData, setFarmTypeData] = useState([]);
  const [productionTrends, setProductionTrends] = useState([]);
  const [topProducers, setTopProducers] = useState([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  useEffect(() => {
    if (farmers.length > 0) {
      applyFilters();
    }
  }, [dateRange, selectedBarangay, selectedCrop, farmers]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch farmers
      const farmersSnapshot = await getDocs(collection(db, "farmers"));
      const farmersData = farmersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        name: doc.data().fullName || `${doc.data().firstName || ''} ${doc.data().lastName || ''}`,
        mainCrop: doc.data().mainCrops?.crop1?.name || "N/A",
        hectares: Number(doc.data().hectares) || 0,
        timestamp: doc.data().timestamp || doc.data().createdAt
      }));
      setFarmers(farmersData);

      // Fetch vegetables
      const vegetablesSnapshot = await getDocs(collection(db, "vegetables_list"));
      const vegetablesData = vegetablesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVegetables(vegetablesData);

      // Extract unique barangays and crops
      const uniqueBarangays = [...new Set(farmersData.map(f => f.farmBarangay).filter(Boolean))];
      const uniqueCrops = [...new Set(farmersData.map(f => f.mainCrop).filter(Boolean))];
      setBarangays(uniqueBarangays.sort());
      setCrops(uniqueCrops.sort());

      // Calculate initial analytics
      calculateAnalytics(farmersData);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching report data:", error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filteredFarmers = [...farmers];

    // Filter by barangay
    if (selectedBarangay !== "all") {
      filteredFarmers = filteredFarmers.filter(f => f.farmBarangay === selectedBarangay);
    }

    // Filter by crop
    if (selectedCrop !== "all") {
      filteredFarmers = filteredFarmers.filter(f => f.mainCrop === selectedCrop);
    }

    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateRange) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case "year":
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filteredFarmers = filteredFarmers.filter(f => {
        if (!f.timestamp) return true;
        const farmDate = f.timestamp.toDate ? f.timestamp.toDate() : new Date(f.timestamp);
        return farmDate >= filterDate;
      });
    }

    calculateAnalytics(filteredFarmers);
  };

  const calculateAnalytics = (data) => {
    // Summary Statistics
    const totalHectares = data.reduce((sum, f) => sum + f.hectares, 0);
    const avgFarmSize = data.length > 0 ? totalHectares / data.length : 0;
    
    setSummaryStats({
      totalFarmers: data.length,
      totalHectares: totalHectares.toFixed(2),
      totalVegetables: vegetables.length,
      activeFarms: data.filter(f => f.status === "active" || !f.status).length,
      avgFarmSize: avgFarmSize.toFixed(2)
    });

    // Barangay Analysis
    const barangayStats = {};
    data.forEach(farmer => {
      const barangay = farmer.farmBarangay || "Unknown";
      if (!barangayStats[barangay]) {
        barangayStats[barangay] = { count: 0, hectares: 0 };
      }
      barangayStats[barangay].count++;
      barangayStats[barangay].hectares += farmer.hectares;
    });
    
    const barangayArray = Object.entries(barangayStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.hectares - a.hectares);
    setBarangayData(barangayArray);

    // Crop Distribution
    const cropStats = {};
    data.forEach(farmer => {
      if (farmer.mainCrops) {
        Object.values(farmer.mainCrops).forEach(crop => {
          if (crop.name) {
            cropStats[crop.name] = (cropStats[crop.name] || 0) + 1;
          }
        });
      }
    });
    
    const cropArray = Object.entries(cropStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    setCropDistribution(cropArray);

    // Seasonal Distribution
    const seasonStats = {};
    data.forEach(farmer => {
      const season = farmer.season || "Not Specified";
      seasonStats[season] = (seasonStats[season] || 0) + 1;
    });
    setSeasonalData(Object.entries(seasonStats).map(([season, count]) => ({ season, count })));

    // Land Ownership
    const ownershipStats = {};
    data.forEach(farmer => {
      const ownership = farmer.landOwnership || "Not Specified";
      ownershipStats[ownership] = (ownershipStats[ownership] || 0) + 1;
    });
    setLandOwnershipData(Object.entries(ownershipStats).map(([ownership, count]) => ({ ownership, count })));

    // Farm Type
    const farmTypeStats = {};
    data.forEach(farmer => {
      const type = farmer.farmType || "Not Specified";
      farmTypeStats[type] = (farmTypeStats[type] || 0) + 1;
    });
    setFarmTypeData(Object.entries(farmTypeStats).map(([type, count]) => ({ type, count })));

    // Production Trends (by crop)
    const productionStats = {};
    data.forEach(farmer => {
      const crop = farmer.mainCrop || "Unknown";
      if (!productionStats[crop]) {
        productionStats[crop] = 0;
      }
      productionStats[crop] += farmer.hectares;
    });
    
    const productionArray = Object.entries(productionStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    setProductionTrends(productionArray);

    // Top Producers
    const topFarmers = data
      .map(f => ({ name: f.name, production: f.hectares, barangay: f.farmBarangay }))
      .sort((a, b) => b.production - a.production)
      .slice(0, 10);
    setTopProducers(topFarmers);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Barangay", "Hectares", "Main Crop", "Farm Type", "Land Ownership"];
    const csvData = farmers.map(f => [
      f.name,
      f.farmBarangay || "N/A",
      f.hectares,
      f.mainCrop,
      f.farmType || "N/A",
      f.landOwnership || "N/A"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agricultural-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

  // Chart Options
  const barangayChartOptions = {
    chart: { type: 'bar', toolbar: { show: true } },
    colors: COLORS,
    plotOptions: { bar: { borderRadius: 8, distributed: true, horizontal: false } },
    dataLabels: { enabled: false },
    xaxis: { 
      categories: barangayData.map(b => b.name),
      labels: { rotate: -45, style: { fontSize: '11px' } }
    },
    yaxis: { title: { text: 'Total Hectares' } },
    title: { text: 'Production by Barangay', align: 'left', style: { fontSize: '16px', fontWeight: 'bold' } },
    legend: { show: false }
  };

  const cropPieOptions = {
    chart: { type: 'donut' },
    labels: cropDistribution.map(c => c.name),
    colors: COLORS,
    title: { text: 'Crop Distribution', align: 'left', style: { fontSize: '16px', fontWeight: 'bold' } },
    legend: { position: 'bottom' },
    responsive: [{
      breakpoint: 480,
      options: { legend: { position: 'bottom' } }
    }]
  };

  const productionLineOptions = {
    chart: { type: 'line', toolbar: { show: true } },
    colors: ['#10b981'],
    stroke: { curve: 'smooth', width: 3 },
    markers: { size: 5 },
    xaxis: { categories: productionTrends.map(p => p.name) },
    yaxis: { title: { text: 'Hectares' } },
    title: { text: 'Production Trends by Crop', align: 'left', style: { fontSize: '16px', fontWeight: 'bold' } }
  };

  const seasonChartOptions = {
    chart: { type: 'pie' },
    labels: seasonalData.map(s => s.season),
    colors: COLORS,
    title: { text: 'Seasonal Distribution', align: 'left', style: { fontSize: '16px', fontWeight: 'bold' } },
    legend: { position: 'bottom' }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: FaChartBar },
    { id: "production", label: "Production", icon: FaChartLine },
    { id: "farmers", label: "Farmers", icon: FaUsers },
    { id: "detailed", label: "Detailed Data", icon: FaTable }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="text-6xl text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-green-800 font-semibold text-lg">Generating reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/50">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl shadow-lg">
                <FaFileAlt className="text-white text-3xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Agricultural Reports
                </h1>
                <p className="text-gray-600 text-sm mt-1">Comprehensive analytics and insights</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg"
              >
                <FaDownload />
                <span className="hidden md:inline">Export CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg"
              >
                <FaPrint />
                <span className="hidden md:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaCalendar className="inline mr-2" />
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaMapMarkedAlt className="inline mr-2" />
                Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Barangays</option>
                {barangays.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaSeedling className="inline mr-2" />
                Crop Type
              </label>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Crops</option>
                {crops.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title="Total Farmers" value={summaryStats.totalFarmers} icon="👨‍🌾" color="from-green-400 to-emerald-500" />
          <StatCard title="Total Hectares" value={summaryStats.totalHectares} icon="📏" color="from-blue-400 to-cyan-500" />
          <StatCard title="Crop Types" value={summaryStats.totalVegetables} icon="🥬" color="from-yellow-400 to-orange-500" />
          <StatCard title="Active Farms" value={summaryStats.activeFarms} icon="🌾" color="from-purple-400 to-pink-500" />
          <StatCard title="Avg Farm Size" value={`${summaryStats.avgFarmSize} ha`} icon="📊" color="from-teal-400 to-cyan-500" />
        </div>

        {/* Tabs */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                        : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <ReactApexChart
                      options={barangayChartOptions}
                      series={[{ data: barangayData.map(b => b.hectares) }]}
                      type="bar"
                      height={350}
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <ReactApexChart
                      options={cropPieOptions}
                      series={cropDistribution.map(c => c.count)}
                      type="donut"
                      height={350}
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <ReactApexChart
                      options={seasonChartOptions}
                      series={seasonalData.map(s => s.count)}
                      type="pie"
                      height={350}
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Key Insights</h3>
                    <div className="space-y-4">
                      {barangayData.length > 0 && (
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong className="text-green-700">Top Producing Barangay:</strong> {barangayData[0].name} with {barangayData[0].hectares.toFixed(2)} hectares
                          </p>
                        </div>
                      )}
                      {cropDistribution.length > 0 && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong className="text-blue-700">Most Cultivated Crop:</strong> {cropDistribution[0].name} ({cropDistribution[0].count} farmers)
                          </p>
                        </div>
                      )}
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong className="text-purple-700">Average Farm Size:</strong> {summaryStats.avgFarmSize} hectares per farmer
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Production Tab */}
            {activeTab === "production" && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <ReactApexChart
                    options={productionLineOptions}
                    series={[{ name: 'Production (ha)', data: productionTrends.map(p => p.value) }]}
                    type="line"
                    height={350}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <FaTractor className="text-green-600" />
                      Top 10 Producers
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 text-sm font-semibold text-gray-700">Rank</th>
                            <th className="text-left py-2 text-sm font-semibold text-gray-700">Name</th>
                            <th className="text-left py-2 text-sm font-semibold text-gray-700">Barangay</th>
                            <th className="text-right py-2 text-sm font-semibold text-gray-700">Hectares</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducers.map((farmer, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 text-sm">
                                <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full font-semibold text-xs">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3 text-sm text-gray-900">{farmer.name}</td>
                              <td className="py-3 text-sm text-gray-600">{farmer.barangay || 'N/A'}</td>
                              <td className="py-3 text-sm text-right font-semibold text-gray-900">{farmer.production.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <FaChartPie className="text-blue-600" />
                      Distribution Analysis
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Land Ownership</h4>
                        {landOwnershipData.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">{item.ownership}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${(item.count / summaryStats.totalFarmers) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 w-8">{item.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-700 mb-2">Farm Type</h4>
                        {farmTypeData.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">{item.type}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${(item.count / summaryStats.totalFarmers) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 w-8">{item.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Farmers Tab */}
            {activeTab === "farmers" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Registered Farmers</h4>
                    <p className="text-3xl font-bold text-green-700">{summaryStats.totalFarmers}</p>
                    <p className="text-xs text-gray-500 mt-2">Total count</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Active Farms</h4>
                    <p className="text-3xl font-bold text-blue-700">{summaryStats.activeFarms}</p>
                    <p className="text-xs text-gray-500 mt-2">Currently farming</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Barangays Covered</h4>
                    <p className="text-3xl font-bold text-purple-700">{barangays.length}</p>
                    <p className="text-xs text-gray-500 mt-2">Geographic reach</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Farmers by Barangay</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {barangayData.map((barangay, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{barangay.name}</h4>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            {barangay.count} farmers
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaMapMarkedAlt className="text-gray-400" />
                          <span className="text-sm text-gray-600">{barangay.hectares.toFixed(2)} ha</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Data Tab */}
            {activeTab === "detailed" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <FaTable className="text-gray-600" />
                      Complete Farmer Database
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Showing {farmers.length} farmers
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Farmer Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Barangay
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Main Crop
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Hectares
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Farm Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Land Ownership
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Season
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {farmers.map((farmer, idx) => (
                          <tr key={farmer.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <FaUsers className="text-green-600 text-xs" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">{farmer.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {farmer.farmBarangay || 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                                <FaLeaf className="text-xs" />
                                {farmer.mainCrop}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {farmer.hectares.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {farmer.farmType || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {farmer.landOwnership || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {farmer.season || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {farmers.length === 0 && (
                    <div className="p-12 text-center">
                      <FaFilter className="text-gray-300 text-5xl mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No farmers found matching the filters</p>
                      <p className="text-sm text-gray-400 mt-2">Try adjusting your filter criteria</p>
                    </div>
                  )}
                </div>

                {/* Summary Cards Below Table */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-4">Crop Variety</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {cropDistribution.slice(0, 10).map((crop, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{crop.name}</span>
                          <span className="text-sm font-semibold text-green-600">{crop.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-4">Barangay Coverage</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {barangayData.slice(0, 10).map((barangay, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{barangay.name}</span>
                          <span className="text-sm font-semibold text-blue-600">{barangay.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-4">Production Summary</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm text-gray-700">Total Production</span>
                        <span className="text-sm font-bold text-green-700">{summaryStats.totalHectares} ha</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm text-gray-700">Average per Farm</span>
                        <span className="text-sm font-bold text-blue-700">{summaryStats.avgFarmSize} ha</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm text-gray-700">Active Farms</span>
                        <span className="text-sm font-bold text-purple-700">{summaryStats.activeFarms}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Additional Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly/Seasonal Breakdown */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/50">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaCalendar className="text-green-600" />
              Seasonal Analysis
            </h3>
            <div className="space-y-4">
              {seasonalData.map((season, idx) => {
                const percentage = ((season.count / summaryStats.totalFarmers) * 100).toFixed(1);
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{season.season}</span>
                      <span className="text-sm font-semibold text-gray-900">{season.count} farmers ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regional Performance */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/50">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaMapMarkedAlt className="text-blue-600" />
              Regional Performance
            </h3>
            <div className="space-y-3">
              {barangayData.slice(0, 5).map((barangay, idx) => (
                <div key={idx} className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-blue-600">{idx + 1}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{barangay.name}</p>
                        <p className="text-xs text-gray-500">{barangay.count} farmers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">{barangay.hectares.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">hectares</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-cyan-500 h-2 rounded-full"
                      style={{ width: `${(barangay.hectares / Math.max(...barangayData.map(b => b.hectares))) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/50">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FaFileAlt className="text-purple-600" />
            Executive Summary
          </h3>
          <div className="prose prose-sm max-w-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-500">
                  <h4 className="font-semibold text-green-900 mb-2">Agricultural Overview</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Currently monitoring <strong>{summaryStats.totalFarmers}</strong> farmers across <strong>{barangays.length}</strong> barangays, 
                    cultivating a total of <strong>{summaryStats.totalHectares} hectares</strong> with <strong>{summaryStats.totalVegetables}</strong> different 
                    crop varieties. The average farm size is <strong>{summaryStats.avgFarmSize} hectares</strong>.
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-l-4 border-blue-500">
                  <h4 className="font-semibold text-blue-900 mb-2">Top Performers</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {barangayData.length > 0 && (
                      <>
                        <strong>{barangayData[0].name}</strong> leads in production with <strong>{barangayData[0].hectares.toFixed(2)} hectares</strong>, 
                        followed by {barangayData.length > 1 && <><strong>{barangayData[1].name}</strong> ({barangayData[1].hectares.toFixed(2)} ha)</>}.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-l-4 border-yellow-500">
                  <h4 className="font-semibold text-yellow-900 mb-2">Crop Diversity</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {cropDistribution.length > 0 && (
                      <>
                        <strong>{cropDistribution[0].name}</strong> is the most popular crop with <strong>{cropDistribution[0].count}</strong> farmers, 
                        representing strong market demand and farmer preference in the region.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-l-4 border-purple-500">
                  <h4 className="font-semibold text-purple-900 mb-2">Recommendations</h4>
                  <ul className="text-sm text-gray-700 leading-relaxed list-disc list-inside space-y-1">
                    <li>Focus support on high-performing barangays</li>
                    <li>Encourage crop diversification in monoculture areas</li>
                    <li>Provide training for farmers below average production</li>
                    <li>Monitor seasonal trends for better planning</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }) => (
  <div className={`bg-gradient-to-br ${color} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
      </div>
      <div className="text-4xl opacity-80">{icon}</div>
    </div>
  </div>
);

export default Reports;