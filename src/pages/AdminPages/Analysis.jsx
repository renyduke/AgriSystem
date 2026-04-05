import React, { useEffect, useState, useRef } from "react";
import { OrbitProgress } from 'react-loading-indicators';
import { useTheme } from "../../context/ThemeContext";
import ReactApexChart from "react-apexcharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db } from "../../config/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import axios from "axios";
import { FaSpinner, FaTractor, FaChartBar, FaChartLine, FaLeaf, FaChartPie, FaArrowLeft, FaArrowRight, FaUser, FaSeedling, FaMapMarkedAlt, FaFilter } from "react-icons/fa";
import Loading from "../../components/Loading";
import API_BASE_URL from "../../config";

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
  const { darkMode } = useTheme();
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

  // Integration state
  const [marketData, setMarketData] = useState({ volume_data: [], price_data: [] });
  const [integrationVegFilter, setIntegrationVegFilter] = useState('all');
  const [integrationYearFilter, setIntegrationYearFilter] = useState('all');
  const [integrationMonthFilter, setIntegrationMonthFilter] = useState('all');
  const [integrationWeekFilter, setIntegrationWeekFilter] = useState('all');

  // Average yield per hectare (kg) — editable assumption per crop
  const AVG_YIELD_KG_PER_HA = 15000;

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
            vegetable: farmer.vegetable || 'N/A',
            location: farmer.farmLocation || 'Unknown',
          }))
          .sort((a, b) => b.production - a.production)
          .slice(0, 5);
        setTopProducingFarmers(topFarmers);

        // Fetch market data from backend
        try {
          const marketRes = await axios.get(`${API_BASE_URL}/api/dashboard`);
          setMarketData(marketRes.data);
        } catch (e) {
          console.warn('Market data unavailable:', e.message);
        }

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
    theme: { mode: darkMode ? 'dark' : 'light' },
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
      labels: { style: { fontSize: '12px', colors: darkMode ? '#94a3b8' : '#64748b' } },
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
      labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b' } }
    },
    yaxis: { labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b' } } },
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
      labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b' } }
    },
    yaxis: { labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b', fontSize: '13px', fontWeight: 500 } } },
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

  // Hectares by farmer & vegetable — multi-line chart
  const allVegetables = [...new Set(farmersData.map(f => f.vegetable || 'N/A'))];
  const farmerNames = farmersData.map(f => f.name || 'Unknown');
  const farmerLocations = farmersData.map(f => {
    // Extract just the barangay part (first segment before comma)
    const loc = f.farmLocation || f.address || 'Unknown';
    return loc.split(',')[0].trim();
  });

  const farmerHectaresSeries = allVegetables.map(veg => ({
    name: veg,
    data: farmersData.map(f =>
      (f.vegetable || 'N/A') === veg ? parseFloat((Number(f.hectares) || 0).toFixed(2)) : 0
    )
  })).filter(s => s.data.some(v => v > 0));

  const farmerHectaresOptions = {
    ...commonChartOptions,
    chart: {
      ...commonChartOptions.chart,
      type: 'line',
      height: 350,
      dropShadow: { enabled: true, color: '#000', top: 18, left: 7, blur: 10, opacity: 0.2 },
      zoom: { enabled: false },
      toolbar: { show: true },
    },
    colors: COLORS,
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    markers: { size: 4, hover: { size: 6 } },
    xaxis: {
      categories: farmerNames,
      title: { text: 'Farmer', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
      labels: {
        rotate: -40,
        style: { colors: darkMode ? '#94a3b8' : '#64748b', fontSize: '11px' },
      },
    },
    yaxis: {
      title: { text: 'Hectares (ha)', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
      labels: {
        style: { colors: darkMode ? '#94a3b8' : '#64748b' },
        formatter: val => `${val} ha`,
      },
      min: 0,
    },
    grid: {
      borderColor: darkMode ? '#1e293b' : '#e7e7e7',
      row: { colors: [darkMode ? '#0f172a' : '#f3f3f3', 'transparent'], opacity: 0.5 },
    },
    legend: { position: 'top', horizontalAlign: 'right', floating: true, offsetY: -25, offsetX: -5 },
    tooltip: {
      custom: ({ series, seriesIndex, dataPointIndex }) => {
        const farmer = farmersData[dataPointIndex];
        const val = series[seriesIndex][dataPointIndex];
        const location = farmerLocations[dataPointIndex];
        return `<div style="padding:10px;font-size:12px;line-height:1.6">
          <strong>${farmer?.name || 'Unknown'}</strong><br/>
          📍 ${location}<br/>
          🌿 ${allVegetables[seriesIndex]}: <strong>${val} ha</strong>
        </div>`;
      }
    },
  };

  // Hectares by location (barangay) — line chart
  const locationGroups = farmersData.reduce((acc, f) => {
    const loc = (f.farmLocation || f.address || 'Unknown').split(',')[0].trim();
    if (!acc[loc]) acc[loc] = { total: 0, farmers: [] };
    acc[loc].total += Number(f.hectares) || 0;
    acc[loc].farmers.push(f.name || 'Unknown');
    return acc;
  }, {});

  const locationLabels = Object.keys(locationGroups).sort();
  const locationHectares = locationLabels.map(loc => parseFloat(locationGroups[loc].total.toFixed(2)));

  const locationChartOptions = {
    ...commonChartOptions,
    chart: {
      ...commonChartOptions.chart,
      type: 'line',
      height: 300,
      dropShadow: { enabled: true, color: '#000', top: 18, left: 7, blur: 10, opacity: 0.2 },
      zoom: { enabled: false },
      toolbar: { show: true },
    },
    colors: ['#10b981'],
    stroke: { curve: 'smooth', width: 3 },
    dataLabels: { enabled: true, formatter: val => `${val}ha`, style: { fontSize: '10px' } },
    markers: { size: 5, hover: { size: 7 } },
    xaxis: {
      categories: locationLabels,
      title: { text: 'Barangay / Location', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
      labels: { rotate: -35, style: { colors: darkMode ? '#94a3b8' : '#64748b', fontSize: '11px' } },
    },
    yaxis: {
      title: { text: 'Total Hectares (ha)', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
      labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b' }, formatter: val => `${val} ha` },
      min: 0,
    },
    grid: {
      borderColor: darkMode ? '#1e293b' : '#e7e7e7',
      row: { colors: [darkMode ? '#0f172a' : '#f3f3f3', 'transparent'], opacity: 0.5 },
    },
    legend: { show: false },
    tooltip: {
      custom: ({ dataPointIndex }) => {
        const loc = locationLabels[dataPointIndex];
        const group = locationGroups[loc];
        const farmerList = group.farmers.slice(0, 5).join(', ') + (group.farmers.length > 5 ? ` +${group.farmers.length - 5} more` : '');
        return `<div style="padding:10px;font-size:12px;line-height:1.6">
          <strong>📍 ${loc}</strong><br/>
          🌾 Total: <strong>${group.total.toFixed(2)} ha</strong><br/>
          👨‍🌾 Farmers (${group.farmers.length}): ${farmerList}
        </div>`;
      }
    },
  };

  // ============================================================================
  // PRODUCTION vs MARKET VOLUME INTEGRATION CHART
  // ============================================================================

  const getBaseName = (name) => {
    if (!name) return '';
    return name.replace(/\s*\(?(Per\s*)?(Kg\.?|Sack|Piece|Bundle|Pc\.?|Pcs\.?)\)?\s*/gi, '').trim();
  };

  // All vegetable types present in farmer data
  const allFarmerVegs = [...new Set(farmersData.map(f => f.vegetable || 'N/A').filter(v => v !== 'N/A'))].sort();

  // All years/months/weeks present in market volume data (cascading)
  const allMarketYears = [...new Set(marketData.volume_data.map(d => d.year))].sort((a, b) => a - b);
  const allMarketMonths = [...new Set(
    marketData.volume_data
      .filter(d => integrationYearFilter === 'all' || d.year === parseInt(integrationYearFilter))
      .map(d => d.month)
  )].sort((a, b) => a - b);
  const allMarketWeeks = [...new Set(
    marketData.volume_data
      .filter(d =>
        (integrationYearFilter === 'all' || d.year === parseInt(integrationYearFilter)) &&
        (integrationMonthFilter === 'all' || d.month === parseInt(integrationMonthFilter))
      )
      .filter(d => d.week !== 5)
      .map(d => d.week)
  )].sort((a, b) => a - b);

  const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Filtered market volume data
  const filteredMarketVolume = marketData.volume_data.filter(d => {
    const vegMatch = integrationVegFilter === 'all' || getBaseName(d.commodity).toLowerCase() === integrationVegFilter.toLowerCase();
    const yearMatch = integrationYearFilter === 'all' || d.year === parseInt(integrationYearFilter);
    const monthMatch = integrationMonthFilter === 'all' || d.month === parseInt(integrationMonthFilter);
    const weekMatch = integrationWeekFilter === 'all' || d.week === parseInt(integrationWeekFilter);
    return vegMatch && yearMatch && monthMatch && weekMatch && d.week !== 5;
  });

  // Filtered farmer data
  const filteredFarmerData = farmersData.filter(f =>
    integrationVegFilter === 'all' || (f.vegetable || 'N/A').toLowerCase() === integrationVegFilter.toLowerCase()
  );

  // Aggregate: hectares per location per vegetable
  const locationVegMap = {};
  filteredFarmerData.forEach(f => {
    const loc = (f.farmLocation || f.address || 'Unknown').split(',')[0].trim();
    const veg = f.vegetable || 'N/A';
    if (!locationVegMap[loc]) locationVegMap[loc] = {};
    locationVegMap[loc][veg] = (locationVegMap[loc][veg] || 0) + (Number(f.hectares) || 0);
  });

  const integrationLocations = Object.keys(locationVegMap).sort();

  // Bar series: one per vegetable — hectares per location
  const vegTypes = integrationVegFilter === 'all'
    ? [...new Set(filteredFarmerData.map(f => f.vegetable || 'N/A'))]
    : [integrationVegFilter];

  const barSeries = vegTypes.map(veg => ({
    name: `${veg} (ha)`,
    type: 'column',
    data: integrationLocations.map(loc => parseFloat(((locationVegMap[loc]?.[veg] || 0)).toFixed(2)))
  }));

  // Estimated production line: hectares × AVG_YIELD_KG_PER_HA per location
  const estProductionSeries = {
    name: 'Est. Production (kg)',
    type: 'line',
    data: integrationLocations.map(loc => {
      const totalHa = vegTypes.reduce((sum, veg) => sum + (locationVegMap[loc]?.[veg] || 0), 0);
      return parseFloat((totalHa * AVG_YIELD_KG_PER_HA).toFixed(0));
    })
  };

  // Market volume line: total volume for filtered veg across all locations (single value repeated — shown as reference line)
  const totalMarketVol = filteredMarketVolume.reduce((sum, d) => sum + (d.volume || 0), 0);
  const marketVolSeries = {
    name: 'Market Volume (kg)',
    type: 'line',
    data: integrationLocations.map(() => parseFloat(totalMarketVol.toFixed(0)))
  };

  const integrationSeries = [...barSeries, estProductionSeries, marketVolSeries];

  const integrationChartOptions = {
    chart: {
      type: 'line',
      height: 420,
      toolbar: { show: true },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
    },
    theme: { mode: darkMode ? 'dark' : 'light' },
    stroke: {
      width: integrationSeries.map(s => s.type === 'line' ? 3 : 0),
      curve: 'smooth',
      dashArray: integrationSeries.map((s, i) => {
        if (s.name.includes('Market')) return 6;
        if (s.name.includes('Est.')) return 3;
        return 0;
      }),
    },
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
    colors: [...COLORS.slice(0, vegTypes.length), '#f59e0b', '#ef4444'],
    dataLabels: { enabled: false },
    markers: {
      size: integrationSeries.map(s => s.type === 'line' ? 4 : 0),
      hover: { size: 6 }
    },
    xaxis: {
      categories: integrationLocations,
      title: { text: 'Location (Barangay)', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
      labels: { rotate: -35, style: { colors: darkMode ? '#94a3b8' : '#64748b', fontSize: '11px' } },
    },
    yaxis: [
      {
        seriesName: barSeries[0]?.name,
        title: { text: 'Hectares (ha)', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
        labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b' }, formatter: v => `${v} ha` },
        min: 0,
      },
      {
        opposite: true,
        seriesName: 'Est. Production (kg)',
        title: { text: 'Volume / Est. Production (kg)', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
        labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b' }, formatter: v => `${(v/1000).toFixed(1)}k kg` },
        min: 0,
      },
    ],
    legend: { position: 'top', horizontalAlign: 'left' },
    grid: { borderColor: darkMode ? '#1e293b' : '#e7e7e7', strokeDashArray: 4 },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val, { seriesIndex }) => {
          const s = integrationSeries[seriesIndex];
          if (!s) return val;
          if (s.type === 'column') return `${val} ha`;
          return `${val.toLocaleString()} kg`;
        }
      }
    },
  };

  // ============================================================================
  // TOP 10 HIGH PRODUCTION CROPS BY HECTARES
  // ============================================================================

  const top10CropsData = (() => {
    const cropHectares = {};
    farmersData.forEach(farmer => {
      const ha = Number(farmer.hectares) || 0;
      if (farmer.mainCrops) {
        Object.values(farmer.mainCrops).forEach(crop => {
          if (crop?.name) {
            cropHectares[crop.name] = (cropHectares[crop.name] || 0) + ha;
          }
        });
      } else if (farmer.vegetable && farmer.vegetable !== 'N/A') {
        cropHectares[farmer.vegetable] = (cropHectares[farmer.vegetable] || 0) + ha;
      }
    });
    return Object.entries(cropHectares)
      .map(([name, hectares]) => ({ name, hectares }))
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 10);
  })();

  const top10CropsOptions = {
    ...commonChartOptions,
    chart: { ...commonChartOptions.chart, type: 'bar' },
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        distributed: true,
        barHeight: '65%',
        dataLabels: { position: 'top' },
      }
    },
    dataLabels: {
      enabled: true,
      formatter: val => `${val} ha`,
      offsetX: 5,
      style: { fontSize: '12px', colors: [darkMode ? '#e2e8f0' : '#374151'], fontWeight: 600 },
    },
    xaxis: {
      categories: top10CropsData.map(c => c.name),
      labels: {
        style: { colors: darkMode ? '#94a3b8' : '#64748b', fontSize: '12px' },
        formatter: val => `${val} ha`,
      },
      title: { text: 'Total Planted Area (ha)', style: { color: darkMode ? '#94a3b8' : '#64748b' } },
    },
    yaxis: {
      labels: { style: { colors: darkMode ? '#94a3b8' : '#64748b', fontSize: '13px', fontWeight: 600 } },
    },
    legend: { show: false },
    tooltip: {
      y: { formatter: val => `${val} ha` },
    },
    grid: { borderColor: darkMode ? '#1e293b' : '#e7e7e7', strokeDashArray: 4 },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <OrbitProgress variant="dotted" color="#32cd32" size="medium" text="" textColor="" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-6 transition-colors duration-300">
      <div className="w-full px-6 pt-2 pb-6 space-y-6">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Farmer Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time insights on Canlaon's agricultural landscape</p>
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
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <FaChartLine className="text-green-600 dark:text-green-400 text-lg" />
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Production Yield Trends</h2>
              </div>
            </div>
            <ReactApexChart options={prodTrendsOptions} series={[{ name: 'Production (ha)', data: highDemandVeggies.map(item => item.value) }]} type="area" height={350} />
          </div>

          {/* Land Ownership (Donut Chart) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <FaChartPie className="text-purple-600 dark:text-purple-400 text-lg" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Land Ownership</h2>
            </div>
            <div className="flex items-center justify-center h-[300px]">
              <ReactApexChart options={landOwnershipOptions} series={landOwnershipDistribution.map(item => item.count)} type="donut" width="100%" />
            </div>
          </div>
        </div>

        {/* Charts Section - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Farmers */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FaTractor className="text-blue-600 dark:text-blue-400 text-lg" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Top Producers</h2>
            </div>
            <ReactApexChart options={topFarmersOptions} series={[{ name: 'Hectares', data: topProducingFarmers.map(item => item.production) }]} type="bar" height={320} />
          </div>

          {/* Crop Popularity */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <FaSeedling className="text-orange-600 dark:text-orange-400 text-lg" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Crop Popularity</h2>
            </div>
            <ReactApexChart options={cropTrendsOptions} series={[{ name: 'Farmers', data: farmerCropTrends.map(item => item.count) }]} type="bar" height={320} />
          </div>
        </div>

        {/* Top 10 High Production Crops by Hectares */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <FaSeedling className="text-emerald-600 dark:text-emerald-400 text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Top 10 High Production Crop Commodities Grown in the City</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ranked by total planted area (hectares) across all farmers</p>
            </div>
          </div>
          {top10CropsData.length > 0 ? (
            <ReactApexChart
              options={top10CropsOptions}
              series={[{ name: 'Total Hectares', data: top10CropsData.map(c => parseFloat(c.hectares.toFixed(2))) }]}
              type="bar"
              height={420}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">No crop data available</p>
          )}
        </div>

        {/* Production vs Market Volume Integration Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <FaChartLine className="text-purple-600 dark:text-purple-400 text-lg" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Production vs Market Volume</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Bars = hectares per location · Dashed = estimated production · Red = recorded market volume
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <FaFilter className="text-gray-400 text-xs" />
                <select
                  value={integrationVegFilter}
                  onChange={e => setIntegrationVegFilter(e.target.value)}
                  className={`text-sm rounded-lg border p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
                >
                  <option value="all">All Vegetables</option>
                  {allFarmerVegs.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <select
                value={integrationYearFilter}
                onChange={e => { setIntegrationYearFilter(e.target.value); setIntegrationMonthFilter('all'); setIntegrationWeekFilter('all'); }}
                className={`text-sm rounded-lg border p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
              >
                <option value="all">All Years</option>
                {allMarketYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={integrationMonthFilter}
                onChange={e => { setIntegrationMonthFilter(e.target.value); setIntegrationWeekFilter('all'); }}
                className={`text-sm rounded-lg border p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
              >
                <option value="all">All Months</option>
                {allMarketMonths.map(m => <option key={m} value={m}>{MONTH_NAMES_SHORT[m - 1]}</option>)}
              </select>
              <select
                value={integrationWeekFilter}
                onChange={e => setIntegrationWeekFilter(e.target.value)}
                className={`text-sm rounded-lg border p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
              >
                <option value="all">All Weeks</option>
                {allMarketWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
          </div>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-3 mb-5">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${darkMode ? "bg-slate-800 text-slate-300" : "bg-gray-100 text-gray-700"}`}>
              🌾 Total Hectares: {filteredFarmerData.reduce((s, f) => s + (Number(f.hectares) || 0), 0).toFixed(2)} ha
            </span>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${darkMode ? "bg-amber-900/30 text-amber-400" : "bg-amber-50 text-amber-700"}`}>
              📦 Est. Production: {(filteredFarmerData.reduce((s, f) => s + (Number(f.hectares) || 0), 0) * AVG_YIELD_KG_PER_HA).toLocaleString()} kg
            </span>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${darkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-700"}`}>
              🏪 Market Volume: {totalMarketVol.toLocaleString()} kg
            </span>
            {totalMarketVol > 0 && (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}`}>
                📊 Supply Ratio: {((filteredFarmerData.reduce((s, f) => s + (Number(f.hectares) || 0), 0) * AVG_YIELD_KG_PER_HA) / totalMarketVol * 100).toFixed(1)}%
              </span>
            )}
          </div>

          {integrationLocations.length > 0 ? (
            <ReactApexChart
              options={integrationChartOptions}
              series={integrationSeries}
              type="line"
              height={420}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">No data — add farmers with location and vegetable info</p>
          )}
        </div>

        {/* Hectares by Farmer & Vegetable */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <FaChartBar className="text-green-600 dark:text-green-400 text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Hectares by Farmer & Vegetable</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Farm size per farmer, color-coded by crop type</p>
            </div>
          </div>
          {farmerHectaresSeries.length > 0 ? (
            <ReactApexChart
              options={farmerHectaresOptions}
              series={farmerHectaresSeries}
              type="line"
              height={350}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">No farmer data available</p>
          )}
        </div>

        {/* Hectares by Location */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <FaMapMarkedAlt className="text-teal-600 dark:text-teal-400 text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Hectares by Location</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total farm area per barangay — hover to see farmers</p>
            </div>
          </div>
          {locationLabels.length > 0 ? (
            <ReactApexChart
              options={locationChartOptions}
              series={[{ name: 'Total Hectares', data: locationHectares }]}
              type="line"
              height={300}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">No location data available</p>
          )}
        </div>

        {/* Map & Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Production Map (spans 2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <FaMapMarkedAlt className="text-red-600 dark:text-red-400 text-lg" />
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Production Zones</h2>
              </div>
              <span className="text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded-md">Live View</span>
            </div>
            <div className="h-[400px] w-full rounded-xl overflow-hidden border border-gray-100 relative z-0">
              <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer url={darkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} />
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
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaTractor className="text-gray-400" /> Recent Activity
              </h3>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Updated profile details</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{new Date(activity.timestamp).toLocaleDateString()}</span>
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

const StatCard = ({ title, value, unit, icon, color, bg }) => {
  const { darkMode } = useTheme();
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
          {unit && <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>}
        </div>
      </div>
      <div className={`p-3 rounded-xl ${bg} ${darkMode ? 'bg-opacity-10' : ''}`}>
        <span className={`text-xl ${color}`}>{icon}</span>
      </div>
    </div>
  );
};

export default AgriDashboard;