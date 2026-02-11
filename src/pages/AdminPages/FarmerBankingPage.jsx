import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import axios from 'axios';
import {
  FaUser, FaSearch, FaFilter, FaMoneyBillWave, FaTractor,
  FaChartLine, FaDownload, FaPrint, FaCalendarAlt, FaLeaf,
  FaArrowUp, FaArrowDown, FaExclamationTriangle, FaCheckCircle,
  FaInfoCircle, FaTimes, FaChevronRight
} from 'react-icons/fa';

const API_BASE_URL = 'https://backend-3-fl3e.onrender.com';

const FarmerBankingPage = () => {
  const [farmers, setFarmers] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const printRef = useRef();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch farmers from Firebase
      const farmerSnapshot = await getDocs(collection(db, 'farmers'));
      const farmerList = await Promise.all(
        farmerSnapshot.docs.map(async (doc) => {
          const farmerData = { id: doc.id, ...doc.data() };
          const vegetableQuery = query(
            collection(db, 'vegetables'),
            where('farmerId', '==', farmerData.id)
          );
          const vegetableSnapshot = await getDocs(vegetableQuery);
          const farmerCrops = vegetableSnapshot.docs.map((vegDoc) => ({
            id: vegDoc.id,
            ...vegDoc.data()
          }));
          return { ...farmerData, mainCrops: farmerCrops };
        })
      );

      // Fetch price and volume data from API
      const response = await axios.get(`${API_BASE_URL}/api/dashboard`);

      setFarmers(farmerList);
      setPriceData(response.data.price_data);
      setVolumeData(response.data.volume_data);
      setCommodities(response.data.commodities);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  // Get latest average price for a commodity
  const getLatestPrice = (commodityName) => {
    if (!priceData.length) return null;

    const commodityPrices = priceData.filter(p => p.commodity === commodityName);
    if (!commodityPrices.length) return null;

    // Sort by year, month, week descending
    const sorted = commodityPrices.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (b.month !== a.month) return b.month - a.month;
      return b.week - a.week;
    });

    return sorted[0].average_price;
  };

  // Get price trend (up/down/stable)
  const getPriceTrend = (commodityName) => {
    if (!priceData.length) return 'stable';

    const commodityPrices = priceData
      .filter(p => p.commodity === commodityName)
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        if (b.month !== a.month) return b.month - a.month;
        return b.week - a.week;
      });

    if (commodityPrices.length < 2) return 'stable';

    const latest = commodityPrices[0].average_price;
    const previous = commodityPrices[1].average_price;
    const change = ((latest - previous) / previous) * 100;

    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  };

  // Calculate estimated crop value
  const calculateCropValue = (crop, estimatedKg = 100) => {
    const price = getLatestPrice(crop.name);
    if (!price) return null;
    return price * estimatedKg;
  };

  // Calculate total farmer portfolio value
  const calculateFarmerValue = (farmer, estimatedKgPerCrop = 100) => {
    if (!farmer.mainCrops || farmer.mainCrops.length === 0) return 0;

    return farmer.mainCrops.reduce((total, crop) => {
      const value = calculateCropValue(crop, estimatedKgPerCrop);
      return total + (value || 0);
    }, 0);
  };

  // Get market recommendation
  const getMarketRecommendation = (crop) => {
    const trend = getPriceTrend(crop.name);
    const price = getLatestPrice(crop.name);

    if (!price) return { type: 'info', message: 'No price data available' };

    const harvestDate = new Date(crop.harvestDate);
    const today = new Date();
    const daysUntilHarvest = Math.ceil((harvestDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilHarvest < 0) {
      return { type: 'warning', message: 'Harvest overdue - sell immediately' };
    }

    if (trend === 'up') {
      return { type: 'success', message: 'Prices rising - good time to sell' };
    } else if (trend === 'down') {
      return { type: 'warning', message: 'Prices falling - consider selling soon' };
    }

    return { type: 'info', message: 'Prices stable - monitor market' };
  };

  // Filter farmers
  const filteredFarmers = farmers.filter(farmer => {
    const matchesSearch = farmer.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCrop = !filterCrop || farmer.mainCrops?.some(crop => crop.name === filterCrop);
    return matchesSearch && matchesCrop;
  });

  // Get all unique crops from all farmers
  const allCrops = [...new Set(farmers.flatMap(f => f.mainCrops?.map(c => c.name) || []))].sort();

  // Calculate dashboard statistics
  const totalFarmers = farmers.length;
  const totalHectares = farmers.reduce((sum, f) => sum + (parseFloat(f.hectares) || 0), 0);
  const totalCrops = farmers.reduce((sum, f) => sum + (f.mainCrops?.length || 0), 0);
  const totalEstimatedValue = farmers.reduce((sum, f) => sum + calculateFarmerValue(f, 100), 0);

  // Print function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Farmer Data Banking Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              font-size: 12px;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 8px; 
              text-align: left;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            .stat-box {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: center;
            }
            @media print {
              body { margin: 0.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Farmer Data Banking Report</h2>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Export CSV
  const downloadCSV = () => {
    let csv = 'Farmer Name,Contact,Location,Hectares,Crops,Estimated Value (₱)\n';

    filteredFarmers.forEach(farmer => {
      const crops = farmer.mainCrops?.map(c => c.name).join('; ') || 'None';
      const value = calculateFarmerValue(farmer, 100).toFixed(2);
      csv += `"${farmer.fullName}","${farmer.contact}","${farmer.farmLocation}",${farmer.hectares || 0},"${crops}",${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farmer_banking_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading farmer banking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🏦 Farmer Data Banking</h1>
              <p className="text-sm text-gray-600 mt-1">Financial insights and market intelligence</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadCSV}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <FaDownload />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <FaPrint />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Dashboard Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Farmers</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalFarmers}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FaUser className="text-blue-600 text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Hectares</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalHectares.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FaTractor className="text-green-600 text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Crops</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalCrops}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <FaLeaf className="text-amber-600 text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Est. Total Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">₱{(totalEstimatedValue / 1000).toFixed(1)}K</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FaMoneyBillWave className="text-purple-600 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <FaSearch className="mr-2 text-gray-400" />
                Search Farmers
              </label>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <FaFilter className="mr-2 text-gray-400" />
                Filter by Crop
              </label>
              <select
                value={filterCrop}
                onChange={(e) => setFilterCrop(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">All Crops</option>
                {allCrops.map(crop => (
                  <option key={crop} value={crop}>{crop}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 mt-4">
            <span>Showing {filteredFarmers.length} of {totalFarmers} farmers</span>
            {(searchQuery || filterCrop) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterCrop('');
                }}
                className="text-green-600 hover:text-green-700 flex items-center"
              >
                <FaTimes className="mr-1" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Farmer List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Farmer List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4">
              <h2 className="text-white font-semibold text-lg">Farmer Accounts</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {filteredFarmers.map(farmer => {
                const farmerValue = calculateFarmerValue(farmer, 100);
                return (
                  <div
                    key={farmer.id}
                    onClick={() => setSelectedFarmer(farmer)}
                    className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${selectedFarmer?.id === farmer.id
                        ? 'bg-green-50 border-l-4 border-l-green-600'
                        : 'hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                          <FaUser className="text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{farmer.fullName}</p>
                          <p className="text-xs text-gray-500">{farmer.mainCrops?.length || 0} crops</p>
                        </div>
                      </div>
                      <FaChevronRight className="text-gray-400" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-600">{farmer.hectares || 0} ha</span>
                      <span className="text-sm font-semibold text-green-600">₱{farmerValue.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Farmer Details */}
          <div className="lg:col-span-2">
            {selectedFarmer ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Farmer Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                        <FaUser className="text-green-600 text-2xl" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedFarmer.fullName}</h2>
                        <p className="text-green-100">Farmer ID: {selectedFarmer.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-100 text-sm">Estimated Portfolio Value</p>
                      <p className="text-3xl font-bold">₱{calculateFarmerValue(selectedFarmer, 100).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Farmer Info */}
                <div className="p-6 border-b border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Contact</p>
                      <p className="font-semibold text-gray-900">{selectedFarmer.contact}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Farm Size</p>
                      <p className="font-semibold text-gray-900">{selectedFarmer.hectares || 0} hectares</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Farm Location</p>
                      <p className="font-semibold text-gray-900">{selectedFarmer.farmLocation}</p>
                    </div>
                  </div>
                </div>

                {/* Crop Portfolio */}
                <div className="p-6" ref={printRef}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FaChartLine className="mr-2 text-green-600" />
                    Production Portfolio
                  </h3>

                  {selectedFarmer.mainCrops && selectedFarmer.mainCrops.length > 0 ? (
                    <div className="space-y-4">
                      {selectedFarmer.mainCrops.map((crop, index) => {
                        const price = getLatestPrice(crop.name);
                        const trend = getPriceTrend(crop.name);
                        const value = calculateCropValue(crop, 100);
                        const recommendation = getMarketRecommendation(crop);

                        return (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900 text-lg">{crop.name}</h4>
                                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                                  <span className="flex items-center">
                                    <FaCalendarAlt className="mr-1" />
                                    Planted: {crop.plantingDate}
                                  </span>
                                  <span className="flex items-center">
                                    <FaCalendarAlt className="mr-1" />
                                    Harvest: {crop.harvestDate}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                {price ? (
                                  <>
                                    <p className="text-2xl font-bold text-green-600">₱{price.toFixed(2)}/kg</p>
                                    <div className="flex items-center justify-end mt-1">
                                      {trend === 'up' && <FaArrowUp className="text-green-600 mr-1" />}
                                      {trend === 'down' && <FaArrowDown className="text-red-600 mr-1" />}
                                      <span className={`text-sm ${trend === 'up' ? 'text-green-600' :
                                          trend === 'down' ? 'text-red-600' :
                                            'text-gray-600'
                                        }`}>
                                        {trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable'}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-sm text-gray-500">No price data</p>
                                )}
                              </div>
                            </div>

                            {/* Market Recommendation */}
                            <div className={`p-3 rounded-lg flex items-start space-x-2 ${recommendation.type === 'success' ? 'bg-green-50 border border-green-200' :
                                recommendation.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                                  'bg-blue-50 border border-blue-200'
                              }`}>
                              {recommendation.type === 'success' && <FaCheckCircle className="text-green-600 mt-0.5" />}
                              {recommendation.type === 'warning' && <FaExclamationTriangle className="text-yellow-600 mt-0.5" />}
                              {recommendation.type === 'info' && <FaInfoCircle className="text-blue-600 mt-0.5" />}
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Market Recommendation</p>
                                <p className="text-sm text-gray-700">{recommendation.message}</p>
                              </div>
                            </div>

                            {/* Estimated Value */}
                            {value && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Estimated value (100kg)</span>
                                  <span className="text-lg font-bold text-gray-900">₱{value.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FaLeaf className="mx-auto text-4xl mb-2 text-gray-300" />
                      <p>No crops registered for this farmer</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <FaUser className="mx-auto text-6xl text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Farmer</h3>
                <p className="text-gray-600">Choose a farmer from the list to view their financial profile and market insights</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FarmerBankingPage;
