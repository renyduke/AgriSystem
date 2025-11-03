import React, { useState, useEffect, useRef } from "react";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell, Brush
} from "recharts";
import { db } from "../../config/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { FaSpinner, FaDownload, FaChartBar, FaLeaf, FaPrint, FaFilePdf, FaTractor} from "react-icons/fa";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const COLORS = ["#16a34a", "#ea580c", "#2563eb", "#dc2626", "#65a30d", "#f97316"];

const CustomTooltip = ({ active, payload, label, formatter, labelFormatter }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border border-green-200 backdrop-blur-sm">
        <p className="text-green-900 font-semibold text-sm">{labelFormatter(label)}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-gray-700 text-sm">
            {entry.name}: {formatter(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [totalVegetables, setTotalVegetables] = useState(0);
  const [productionByBarangay, setProductionByBarangay] = useState([]);
  const [highDemandVeggies, setHighDemandVeggies] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [farmerCropTrends, setFarmerCropTrends] = useState([]);
  const [totalProduction, setTotalProduction] = useState(0);
  const [averageFarmSize, setAverageFarmSize] = useState(0);
  const [seasonDistribution, setSeasonDistribution] = useState([]);
  const [topProducingFarmers, setTopProducingFarmers] = useState([]);
  const [landOwnershipDistribution, setLandOwnershipDistribution] = useState([]);
  const [farmTypeDistribution, setFarmTypeDistribution] = useState([]);
  const [visibleSeries, setVisibleSeries] = useState({});
  const reportRef = useRef(null);

  useEffect(() => {
    const unsubscribeFarmers = onSnapshot(
      collection(db, "farmers"),
      (snapshot) => {
        const farmers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: "farmer",
          timestamp: doc.data().timestamp || new Date().toISOString(),
          name: doc.data().fullName || `${doc.data().firstName || ''} ${doc.data().lastName || ''}`,
          vegetable: doc.data().mainCrops?.crop1?.name || "N/A",
          landOwnership: doc.data().landOwnership || "Unknown",
          farmType: doc.data().farmType || "Unknown",
        }));
        setTotalFarmers(snapshot.size);

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

        const avgFarmSize = snapshot.size > 0 ? totalProd / snapshot.size : 0;
        setAverageFarmSize(avgFarmSize.toFixed(2));

        const seasonDist = farmers.reduce((acc, farmer) => {
          const season = farmer.season || "Default";
          acc[season] = (acc[season] || 0) + 1;
          return acc;
        }, {});
        const seasonData = Object.entries(seasonDist).map(([season, count]) => ({ season, count }));
        setSeasonDistribution(seasonData);

        const landOwnershipDist = farmers.reduce((acc, farmer) => {
          const ownership = farmer.landOwnership || "Unknown";
          acc[ownership] = (acc[ownership] || 0) + 1;
          return acc;
        }, {});
        const landOwnershipData = Object.entries(landOwnershipDist).map(([ownership, count]) => ({ ownership, count }));
        setLandOwnershipDistribution(landOwnershipData);

        const farmTypeDist = farmers.reduce((acc, farmer) => {
          const type = farmer.farmType || "Unknown";
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        const farmTypeData = Object.entries(farmTypeDist).map(([type, count]) => ({ type, count }));
        setFarmTypeDistribution(farmTypeData);

        const topFarmers = farmers
          .map(farmer => ({
            name: farmer.name,
            production: Number(farmer.hectares) || 0,
          }))
          .sort((a, b) => b.production - a.production)
          .slice(0, 5);
        setTopProducingFarmers(topFarmers);

        setVisibleSeries({
          farmerCropTrends: cropTrendsData.reduce((acc, item) => ({ ...acc, [item.name]: true }), {}),
          highDemandVeggies: demandData.reduce((acc, item) => ({ ...acc, [item.name]: true }), {}),
          seasonDistribution: seasonData.reduce((acc, item) => ({ ...acc, [item.season]: true }), {}),
          landOwnershipDistribution: landOwnershipData.reduce((acc, item) => ({ ...acc, [item.ownership]: true }), {}),
          farmTypeDistribution: farmTypeData.reduce((acc, item) => ({ ...acc, [item.type]: true }), {}),
          topProducingFarmers: topFarmers.reduce((acc, item) => ({ ...acc, [item.name]: true }), {}),
          productionByBarangay: prodData.reduce((acc, item) => ({ ...acc, [item.name]: true }), {}),
        });

        setLoading(false);
      },
      (error) => {
        console.error("Error fetching farmers data:", error);
        setError("Failed to load farmers data: " + error.message);
        setLoading(false);
      }
    );

    const unsubscribeVegetables = onSnapshot(
      collection(db, "vegetables_list"),
      (snapshot) => {
        setTotalVegetables(snapshot.size);
      },
      (error) => {
        console.error("Error fetching vegetables data:", error);
      }
    );

    return () => {
      unsubscribeFarmers();
      unsubscribeVegetables();
    };
  }, []);

  const handleLegendClick = (chartKey, dataKey) => {
    setVisibleSeries(prev => ({
      ...prev,
      [chartKey]: {
        ...prev[chartKey],
        [dataKey]: !prev[chartKey][dataKey],
      },
    }));
  };

  const handleBarClick = (data, chartKey) => {
    alert(`Selected ${chartKey}: ${data.name} with value ${data.count || data.production}`);
  };

  const handlePieClick = (data, chartKey) => {
    alert(`Selected ${chartKey}: ${data.season || data.ownership || data.type || data.name} with ${data.count || data.value}`);
  };

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

  const handlePrint = () => {
    window.print();
  };

 const handleDownloadPDF = async () => {
  try {
    if (reportRef.current) {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('agri_reports.pdf');
    } else {
      console.error("Report reference is not available");
      alert("Failed to generate PDF: Report content not found");
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Failed to generate PDF: " + error.message);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-green-900 text-center mb-8 flex items-center justify-center">
          <FaChartBar className="mr-2 text-green-600" /> Reports
        </h1>

        <div className="flex justify-end space-x-4 mb-6">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <FaPrint /> Print Report
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            <FaFilePdf /> Download PDF
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <FaSpinner className="text-5xl text-green-600 animate-spin" />
          </div>
        )}
        {error && (
          <div className="bg-red-100 p-4 rounded-xl text-red-700 text-center font-medium">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div ref={reportRef} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
              <OverviewCard title="Total Farmers" value={totalFarmers} icon={<FaChartBar />} />
              <OverviewCard title="Vegetable Types" value={totalVegetables} icon={<FaLeaf />} />
              <OverviewCard title="Total Production" value={`${totalProduction} ha`} icon={<FaTractor />} />
              <OverviewCard title="Avg Farm Size" value={`${averageFarmSize} ha`} icon={<FaChartBar />} />
            </div>

            <ReportSection
              title="Recent Activities"
              description="Latest farmer activities (Real-time)"
              data={recentActivities}
              download={() => downloadCSV(recentActivities.map(act => ({ name: act.name, timestamp: act.timestamp })), "recent_activities.csv")}
            >
              <div className="space-y-2 h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-green-200 scrollbar-track-gray-100">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm hover:bg-green-50 transition-all duration-200"
                  >
                    <div className="flex items-center space-x-2 flex-1 truncate">
                      <FaTractor className="text-green-600" />
                      <span className="truncate font-medium text-gray-800">{activity.name}</span>
                    </div>
                    <span className="text-gray-500 ml-2 whitespace-nowrap">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </ReportSection>

            <ReportSection
              title="Farmer Crop Trends 🌾"
              description="Number of farmers producing each vegetable (Real-time)"
              data={farmerCropTrends}
              download={() => downloadCSV(farmerCropTrends, "farmer_crop_trends.csv")}
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={farmerCropTrends.filter(item => visibleSeries.farmerCropTrends[item.name])}
                  onClick={(data) => data && handleBarClick(data.activePayload[0].payload, "Crop")}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 12, fill: "#1f2937" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#1f2937" }} label={{ value: "Number of Farmers", angle: -90, position: "insideLeft", offset: -10, fill: "#1f2937" }} />
                  <Tooltip 
                    content={<CustomTooltip 
                      formatter={(value) => [`${value} farmers`, "Count"]} 
                      labelFormatter={(label) => `Vegetable: ${label}`} 
                    />}
                  />
                  <Legend 
                    onClick={(e) => handleLegendClick("farmerCropTrends", e.dataKey)} 
                    formatter={(value) => <span className={visibleSeries.farmerCropTrends[value] ? "text-gray-800 font-medium" : "text-gray-400"}>{value}</span>}
                  />
                  <Bar 
                    dataKey="count" 
                    onClick={(data) => handleBarClick(data, "Crop")} 
                    radius={[8, 8, 0, 0]}
                    animationDuration={1000}
                  >
                    {farmerCropTrends.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ReportSection>

            <ReportSection
              title="Vegetable Production Trends 📈"
              description="Most produced vegetables based on farmer data (Real-time)"
              data={highDemandVeggies}
              download={() => downloadCSV(highDemandVeggies, "vegetable_production_trends.csv")}
            >
              <ResponsiveContainer width="100%" height={400}>
                <LineChart 
                  data={highDemandVeggies.filter(item => visibleSeries.highDemandVeggies[item.name])}
                  margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                  <XAxis dataKey="name" angle={0} textAnchor="middle" height={50} tick={{ fontSize: 12, fill: "#1f2937" }} padding={{ left: 20, right: 20 }} />
                  <YAxis tick={{ fontSize: 12, fill: "#1f2937" }} label={{ value: "Quantity (ha)", angle: -90, position: "insideLeft", offset: -10, fill: "#1f2937" }} />
                  <Tooltip 
                    content={<CustomTooltip 
                      formatter={(value) => [`${value} ha`, "Quantity"]} 
                      labelFormatter={(label) => `Vegetable: ${label}`} 
                    />}
                  />
                  <Legend 
                    onClick={(e) => handleLegendClick("highDemandVeggies", e.dataKey)} 
                    formatter={(value) => <span className={visibleSeries.highDemandVeggies[value] ? "text-gray-800 font-medium" : "text-gray-400"}>{value}</span>}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#16a34a" 
                    strokeWidth={4} 
                    dot={{ fill: "#16a34a", r: 6 }} 
                    activeDot={{ r: 8, fill: "#16a34a", stroke: "#fff", strokeWidth: 2 }} 
                    animationDuration={1000}
                  />
                  <Brush dataKey="name" height={30} stroke="#16a34a" fill="#f3f4f6" />
                </LineChart>
              </ResponsiveContainer>
            </ReportSection>

            <ReportSection
              title="Season Distribution 📊"
              description="Number of farmers by season (Real-time)"
              data={seasonDistribution}
              download={() => downloadCSV(seasonDistribution.map(item => ({ season: item.season, count: item.count })), "season_distribution.csv")}
            >
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={seasonDistribution.filter(item => visibleSeries.seasonDistribution[item.season])}
                    dataKey="count"
                    nameKey="season"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ season, count }) => `${season}: ${count}`}
                    labelLine={{ stroke: "#1f2937", strokeWidth: 1 }}
                    onClick={(data) => handlePieClick(data, "Season")}
                    animationDuration={1000}
                  >
                    {seasonDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        style={{ cursor: "pointer", opacity: visibleSeries.seasonDistribution[entry.season] ? 1 : 0.3 }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomTooltip 
                      formatter={(value) => [`${value} farmers`, "Count"]} 
                      labelFormatter={(label) => `Season: ${label}`} 
                    />}
                  />
                  <Legend 
                    onClick={(e) => handleLegendClick("seasonDistribution", e.dataKey)} 
                    formatter={(value) => <span className={visibleSeries.seasonDistribution[value] ? "text-gray-800 font-medium" : "text-gray-400"}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ReportSection>

            <ReportSection
              title="Land Ownership Distribution 🏡"
              description="Distribution of farmers by land ownership type (Real-time)"
              data={landOwnershipDistribution}
              download={() => downloadCSV(landOwnershipDistribution.map(item => ({ ownership: item.ownership, count: item.count })), "land_ownership_distribution.csv")}
            >
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={landOwnershipDistribution.filter(item => visibleSeries.landOwnershipDistribution[item.ownership])}
                    dataKey="count"
                    nameKey="ownership"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ ownership, count }) => `${ownership}: ${count}`}
                    labelLine={{ stroke: "#1f2937", strokeWidth: 1 }}
                    onClick={(data) => handlePieClick(data, "Land Ownership")}
                    animationDuration={1000}
                  >
                    {landOwnershipDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        style={{ cursor: "pointer", opacity: visibleSeries.landOwnershipDistribution[entry.ownership] ? 1 : 0.3 }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomTooltip 
                      formatter={(value) => [`${value} farmers`, "Count"]} 
                      labelFormatter={(label) => `Ownership: ${label}`} 
                    />}
                  />
                  <Legend 
                    onClick={(e) => handleLegendClick("landOwnershipDistribution", e.dataKey)} 
                    formatter={(value) => <span className={visibleSeries.landOwnershipDistribution[value] ? "text-gray-800 font-medium" : "text-gray-400"}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ReportSection>

            <ReportSection
              title="Farm Type Distribution 🌾"
              description="Distribution of farmers by farm type (Real-time)"
              data={farmTypeDistribution}
              download={() => downloadCSV(farmTypeDistribution.map(item => ({ type: item.type, count: item.count })), "farm_type_distribution.csv")}
            >
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={farmTypeDistribution.filter(item => visibleSeries.farmTypeDistribution[item.type])}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ type, count }) => `${type}: ${count}`}
                    labelLine={{ stroke: "#1f2937", strokeWidth: 1 }}
                    onClick={(data) => handlePieClick(data, "Farm Type")}
                    animationDuration={1000}
                  >
                    {farmTypeDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        style={{ cursor: "pointer", opacity: visibleSeries.farmTypeDistribution[entry.type] ? 1 : 0.3 }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomTooltip 
                      formatter={(value) => [`${value} farmers`, "Count"]} 
                      labelFormatter={(label) => `Farm Type: ${label}`} 
                    />}
                  />
                  <Legend 
                    onClick={(e) => handleLegendClick("farmTypeDistribution", e.dataKey)} 
                    formatter={(value) => <span className={visibleSeries.farmTypeDistribution[value] ? "text-gray-800 font-medium" : "text-gray-400"}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ReportSection>

            <ReportSection
              title="Top Producing Farmers 🏆"
              description="Farmers ranked by production area (Real-time)"
              data={topProducingFarmers}
              download={() => downloadCSV(topProducingFarmers, "top_producing_farmers.csv")}
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={topProducingFarmers.filter(item => visibleSeries.topProducingFarmers[item.name])}
                  onClick={(data) => data && handleBarClick(data.activePayload[0].payload, "Farmer")}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 12, fill: "#1f2937" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#1f2937" }} label={{ value: "Production (ha)", angle: -90, position: "insideLeft", offset: -10, fill: "#1f2937" }} />
                  <Tooltip 
                    content={<CustomTooltip 
                      formatter={(value) => [`${value} ha`, "Production"]} 
                      labelFormatter={(label) => `Farmer: ${label}`} 
                    />}
                  />
                  <Legend 
                    onClick={(e) => handleLegendClick("topProducingFarmers", e.dataKey)} 
                    formatter={(value) => <span className={visibleSeries.topProducingFarmers[value] ? "text-gray-800 font-medium" : "text-gray-400"}>{value}</span>}
                  />
                  <Bar 
                    dataKey="production" 
                    onClick={(data) => handleBarClick(data, "Farmer")} 
                    radius={[8, 8, 0, 0]}
                    animationDuration={1000}
                  >
                    {topProducingFarmers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ReportSection>

            <ReportSection
              title="Production by Barangay 📊"
              description="Total production by barangay in ha (Real-time)"
              data={productionByBarangay}
              download={() => downloadCSV(productionByBarangay, "production_by_barangay.csv")}
            >
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={productionByBarangay.filter(item => visibleSeries.productionByBarangay[item.name])}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "#1f2937", strokeWidth: 1 }}
                    onClick={(data) => handlePieClick(data, "Barangay")}
                    animationDuration={1000}
                  >
                    {productionByBarangay.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        style={{ cursor: "pointer", opacity: visibleSeries.productionByBarangay[entry.name] ? 1 : 0.3 }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomTooltip 
                      formatter={(value) => [`${value} ha`, "Production"]} 
                      labelFormatter={(label) => `Barangay: ${label}`} 
                    />}
                  />
                  <Legend 
                    onClick={(e) => handleLegendClick("productionByBarangay", e.dataKey)} 
                    formatter={(value) => <span className={visibleSeries.productionByBarangay[value] ? "text-gray-800 font-medium" : "text-gray-400"}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ReportSection>

            <ReportSection title="Overall Analysis" description="Comprehensive summary of agricultural activities">
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  This report provides a comprehensive overview of agricultural activities in Canlaon City. Currently, there are <strong>{totalFarmers}</strong> registered farmers cultivating <strong>{totalVegetables}</strong> distinct vegetable types, contributing to a vibrant local food ecosystem.
                </p>
                <p>
                  The system tracks farmer production trends, with {highDemandVeggies.length > 0 ? highDemandVeggies[0].name : "no data yet"} leading at {highDemandVeggies.length > 0 ? highDemandVeggies[0].value : 0} ha.
                </p>
                <p>
                  Farmer production trends show {farmerCropTrends.length > 0 ? farmerCropTrends[0].name : "no data yet"} as the most cultivated crop, with <strong>{farmerCropTrends.length > 0 ? farmerCropTrends[0].count : 0}</strong> farmers involved. Significant activity in barangays like {productionByBarangay.length > 0 ? productionByBarangay[0].name : "Unknown"}.
                </p>
                <p>
                  Land ownership data indicates that {landOwnershipDistribution.length > 0 ? landOwnershipDistribution[0].ownership : "no data"} is the most common type, with {landOwnershipDistribution.length > 0 ? landOwnershipDistribution[0].count : 0} farmers. Farm type distribution shows {farmTypeDistribution.length > 0 ? farmTypeDistribution[0].type : "no data"} as the predominant type, with {farmTypeDistribution.length > 0 ? farmTypeDistribution[0].count : 0} farmers.
                </p>
                <p>
                  Recent activities indicate ongoing engagement, with the latest being {recentActivities.length > 0 ? recentActivities[0].name : "none recorded"} at {recentActivities.length > 0 ? new Date(recentActivities[0].timestamp).toLocaleString() : "N/A"}. This data suggests a dynamic agricultural economy with opportunities for targeted growth in high-demand crops.
                </p>
              </div>
            </ReportSection>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportSection = ({ title, description, children, data, download }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 page-break-before">
    <div className="flex justify-between items-center mb-4">
      <div>
        <h2 className="text-xl font-semibold text-green-900 flex items-center">
          <FaLeaf className="mr-2 text-green-600" /> {title}
        </h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {data && data.length > 0 && (
        <button
          onClick={download}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <FaDownload /> Download CSV
        </button>
      )}
    </div>
    {children}
  </div>
);

const OverviewCard = ({ title, value, icon }) => (
  <div className={`p-6 rounded-xl shadow-lg bg-green-100 hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1`}>
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      </div>
      <div className="text-3xl text-gray-600">{icon}</div>
    </div>
  </div>
);

export default Reports;