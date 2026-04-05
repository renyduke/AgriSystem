import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ReactApexChart from 'react-apexcharts';
import { OrbitProgress } from 'react-loading-indicators';
import API_BASE_URL from '../../config';
import { useTheme } from '../../context/ThemeContext';

// Utility functions for commodity normalization
const getBaseCommodityName = (name) => {
  if (!name) return "";
  // Strip out variations like "(Per Kg.)", "Kg", "Kg.", "(Pc.)", "Pcs", etc.
  let base = name.replace(/\s*\(?(Per\s*)?(Kg\.?|Sack|Piece|Bundle|Pc\.?|Pcs\.?)\)?\s*/gi, '').trim();
  // Normalize known duplicates/typos
  if (base.toLowerCase() === 'cauli-flower') return 'Cauliflower';
  return base;
};

const formatCommodityName = (name) => {
  if (!name) return "";
  const base = getBaseCommodityName(name);
  const match = name.match(/\(?(Per\s*)?(Kg\.?|Sack|Piece|Bundle|Pc\.?|Pcs\.?)\)?/i);
  
  // Format the suffix cleanly based on what was matched
  let suffix = '(Per Kg.)'; // default
  if (match) {
    const rawUnit = match[2].toLowerCase();
    if (rawUnit.includes('pc') || rawUnit.includes('piece')) suffix = '(Per Pc.)';
    else if (rawUnit.includes('sack')) suffix = '(Per Sack)';
    else if (rawUnit.includes('bundle')) suffix = '(Per Bundle)';
  }
  
  return `${base} ${suffix}`;
};

const deduplicateCommodities = (commodityList) => {
  if (!commodityList) return [];
  const seen = new Map();
  commodityList.forEach(name => {
    const base = getBaseCommodityName(name);
    if (!seen.has(base.toLowerCase())) {
      seen.set(base.toLowerCase(), name);
    }
  });
  return [...seen.values()];
};

const Dashboard = () => {
  const { darkMode } = useTheme();
  // Core state
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState('');
  const [selectedDataType, setSelectedDataType] = useState('price');
  const [forecastMode, setForecastMode] = useState('weekly');
  const [periodsAhead, setPeriodsAhead] = useState(4);
  const [forecastResult, setForecastResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Chart state
  const [chartCommodity, setChartCommodity] = useState('');
  const [selectedChartMonth, setSelectedChartMonth] = useState('all');

  // Comparison state
  const [comparisonCommodities, setComparisonCommodities] = useState([]);
  const [comparisonDataType, setComparisonDataType] = useState('price');

  // Model management states
  const [modelInfo, setModelInfo] = useState(null);
  const [showModelManager, setShowModelManager] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Notification state
  const [notifications, setNotifications] = useState([]);

  // Projected volume state
  const [projectedVolume, setProjectedVolume] = useState(null);
  const [projectedVolumeLoading, setProjectedVolumeLoading] = useState(false);

  // Overview filters
  const [overviewYearFilter, setOverviewYearFilter] = useState('all');
  const [overviewCommodityFilter, setOverviewCommodityFilter] = useState('all');
  const [overviewDataView, setOverviewDataView] = useState('price');
  const [chartYearFilter, setChartYearFilter] = useState('all');
  const [comparisonYearFilter, setComparisonYearFilter] = useState('all');
  const [overviewMonthFilter, setOverviewMonthFilter] = useState('all');
  const [overviewWeekFilter, setOverviewWeekFilter] = useState('all');
  const [overviewSearchQuery, setOverviewSearchQuery] = useState('');
  const [overviewSortConfig, setOverviewSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Training State
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const logsEndRef = React.useRef(null);
  const wsRef = React.useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trainingLogs]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatPeriod = (item, mode) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (mode === 'yearly') {
      return `${item.year}`;
    } else if (mode === 'monthly') {
      return `${monthNames[item.month - 1]} ${item.year}`;
    } else {
      return `${monthNames[item.month - 1]} ${item.year} - ${item.week_label}`;
    }
  };

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    fetchDashboardData();
    fetchModelInfo();
  }, []);

  useEffect(() => {
    if (dashboardData && dashboardData.commodities.length > 0) {
      const uniqueCmds = deduplicateCommodities(dashboardData.commodities);
      setChartCommodity(uniqueCmds[0]);
      setSelectedCommodity(uniqueCmds[0]);
    }
  }, [dashboardData]);

  useEffect(() => {
    if (forecastMode === 'weekly') {
      setPeriodsAhead(4);
    } else if (forecastMode === 'monthly') {
      setPeriodsAhead(4);
    } else if (forecastMode === 'yearly') {
      setPeriodsAhead(12);
    }
  }, [forecastMode]);

  // Auto-fetch projected volume when chartCommodity changes
  useEffect(() => {
    const fetchProjectedVolume = async () => {
      if (!chartCommodity || !dashboardData) return;

      setProjectedVolumeLoading(true);
      try {
        const response = await axios.post(`${API_BASE_URL}/api/forecast`, {
          commodity: chartCommodity,
          data_type: 'volume',
          weeks_ahead: 4
        });
        
        // Sum the next 4 weeks forecast
        const totalProjected = response.data.forecast_data.reduce((sum, item) => sum + item.value, 0);
        
        // Get current month total for comparison
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const baseCommodity = getBaseCommodityName(chartCommodity);
        
        const currentMonthVolume = dashboardData.volume_data
          .filter(d => 
            getBaseCommodityName(d.commodity) === baseCommodity &&
            d.year === currentYear &&
            d.month === currentMonth
          )
          .reduce((sum, item) => sum + (item.volume || 0), 0);
        
        const trend = currentMonthVolume > 0 
          ? ((totalProjected - currentMonthVolume) / currentMonthVolume) * 100 
          : 0;
        
        setProjectedVolume({
          total: totalProjected,
          trend: trend,
          currentMonth: currentMonthVolume
        });
      } catch (err) {
        console.log('Projected volume unavailable:', err.response?.data?.detail || err.message);
        setProjectedVolume(null);
      } finally {
        setProjectedVolumeLoading(false);
      }
    };

    fetchProjectedVolume();
  }, [chartCommodity, dashboardData]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard`);
      const uniqueCmds = deduplicateCommodities(response.data.commodities);
      setDashboardData({
        ...response.data,
        uniqueCommodities: uniqueCmds
      });
    } catch (err) {
      setError(err.message);
      console.error('Error fetching dashboard data:', err);
      addNotification('Failed to load dashboard data', 'error');
    }
  };

  const fetchModelInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/models`);
      setModelInfo(response.data);
    } catch (err) {
      console.error('Error fetching model info:', err);
    }
  };

  // ============================================================================
  // DATA ANALYSIS FUNCTIONS FOR OVERVIEW
  // ============================================================================

  const analyzeVolumeData = useMemo(() => {
    if (!dashboardData) return null;

    let filteredData = dashboardData.volume_data;

    if (overviewYearFilter !== 'all') {
      filteredData = filteredData.filter(item => item.year === parseInt(overviewYearFilter));
    }
    if (overviewMonthFilter !== 'all') {
      filteredData = filteredData.filter(item => item.month === parseInt(overviewMonthFilter));
    }
    if (overviewWeekFilter !== 'all') {
      filteredData = filteredData.filter(item => item.week === parseInt(overviewWeekFilter));
    }
    if (overviewCommodityFilter !== 'all') {
      const baseFilter = getBaseCommodityName(overviewCommodityFilter);
      filteredData = filteredData.filter(item => getBaseCommodityName(item.commodity) === baseFilter);
    }

    const grouped = {};
    filteredData.forEach(item => {
      const key = `${item.year}-${item.month}-${item.week}`;
      const baseName = getBaseCommodityName(item.commodity);
      
      // Search matching for commodities within the week
      if (overviewSearchQuery && !baseName.toLowerCase().includes(overviewSearchQuery.toLowerCase())) {
        return;
      }

      if (!grouped[key]) {
        grouped[key] = {
          year: item.year,
          month: item.month,
          week: item.week,
          week_label: item.week_label,
          commodities: {},
          totalVolume: 0,
          dateValue: new Date(item.year, item.month - 1, item.week * 7).getTime()
        };
      }
      if (!grouped[key].commodities[baseName]) {
        grouped[key].commodities[baseName] = 0;
      }
      grouped[key].commodities[baseName] += item.volume;
      grouped[key].totalVolume += item.volume;
    });

    let result = Object.values(grouped);

    // Sorting
    result.sort((a, b) => {
      const { key, direction } = overviewSortConfig;
      let comparison = 0;
      if (key === 'date') comparison = a.dateValue - b.dateValue;
      else if (key === 'volume') comparison = a.totalVolume - b.totalVolume;
      else if (key === 'month') comparison = a.month - b.month;
      return direction === 'asc' ? comparison : -comparison;
    });

    const expectedCommodities = overviewCommodityFilter === 'all'
      ? dashboardData.uniqueCommodities.length
      : 1;

    result.forEach(item => {
      const actualCommodities = Object.keys(item.commodities).length;
      item.completeness = (actualCommodities / expectedCommodities) * 100;
      item.missingCommodities = expectedCommodities - actualCommodities;
    });

    return result;
  }, [dashboardData, overviewYearFilter, overviewMonthFilter, overviewWeekFilter, overviewCommodityFilter, overviewSearchQuery, overviewSortConfig]);

  const analyzePriceData = useMemo(() => {
    if (!dashboardData) return null;

    let filteredData = dashboardData.price_data;

    if (overviewYearFilter !== 'all') {
      filteredData = filteredData.filter(item => item.year === parseInt(overviewYearFilter));
    }
    if (overviewMonthFilter !== 'all') {
      filteredData = filteredData.filter(item => item.month === parseInt(overviewMonthFilter));
    }
    if (overviewWeekFilter !== 'all') {
      filteredData = filteredData.filter(item => item.week === parseInt(overviewWeekFilter));
    }
    if (overviewCommodityFilter !== 'all') {
      const baseFilter = getBaseCommodityName(overviewCommodityFilter);
      filteredData = filteredData.filter(item => getBaseCommodityName(item.commodity) === baseFilter);
    }

    const grouped = {};
    filteredData.forEach(item => {
      const key = `${item.year}-${item.month}-${item.week}`;
      const baseName = getBaseCommodityName(item.commodity);

      // Search matching
      if (overviewSearchQuery && !baseName.toLowerCase().includes(overviewSearchQuery.toLowerCase())) {
        return;
      }

      if (!grouped[key]) {
        grouped[key] = {
          year: item.year,
          month: item.month,
          week: item.week,
          week_label: item.week_label,
          commodities: {},
          dateValue: new Date(item.year, item.month - 1, item.week * 7).getTime()
        };
      }
      if (!grouped[key].commodities[baseName]) {
        grouped[key].commodities[baseName] = {
          lowest: item.lowest_price,
          highest: item.highest_price,
          average: item.average_price,
          count: 1
        };
      } else {
        const existing = grouped[key].commodities[baseName];
        existing.lowest = Math.min(existing.lowest, item.lowest_price);
        existing.highest = Math.max(existing.highest, item.highest_price);
        existing.average = ((existing.average * existing.count) + item.average_price) / (existing.count + 1);
        existing.count += 1;
      }
    });

    let result = Object.values(grouped);

    // Sorting
    result.sort((a, b) => {
      const { key, direction } = overviewSortConfig;
      let comparison = 0;
      if (key === 'date') comparison = a.dateValue - b.dateValue;
      else if (key === 'month') comparison = a.month - b.month;
      else if (key === 'volume') {
        const avgA = Object.values(a.commodities).reduce((sum, p) => sum + p.average, 0) / (Object.keys(a.commodities).length || 1);
        const avgB = Object.values(b.commodities).reduce((sum, p) => sum + p.average, 0) / (Object.keys(b.commodities).length || 1);
        comparison = avgA - avgB;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    const expectedCommodities = overviewCommodityFilter === 'all'
      ? dashboardData.uniqueCommodities.length
      : 1;

    result.forEach(item => {
      const actualCommodities = Object.keys(item.commodities).length;
      item.completeness = (actualCommodities / expectedCommodities) * 100;
      item.missingCommodities = expectedCommodities - actualCommodities;

      const prices = Object.values(item.commodities);
      if (prices.length > 0) {
        item.weekLowest = Math.min(...prices.map(p => p.lowest));
        item.weekHighest = Math.max(...prices.map(p => p.highest));
        item.weekAverage = prices.reduce((sum, p) => sum + p.average, 0) / prices.length;
      }
    });

    return result;
  }, [dashboardData, overviewYearFilter, overviewMonthFilter, overviewWeekFilter, overviewCommodityFilter, overviewSearchQuery, overviewSortConfig]);

  const sentimentData = useMemo(() => {
    if (!dashboardData || !chartCommodity) return { score: 0, label: 'No Data' };
    const baseChartCommodity = getBaseCommodityName(chartCommodity);
    
    const commodityPrices = dashboardData.price_data.filter(
      item => getBaseCommodityName(item.commodity) === baseChartCommodity
    );
    
    if (commodityPrices.length < 2) return { score: 50, label: 'Stable' };
    
    const sortedPrices = [...commodityPrices].sort((a, b) => 
      new Date(a.year, a.month-1, a.week*7) - new Date(b.year, b.month-1, b.week*7)
    );
    
    const latest = sortedPrices[sortedPrices.length - 1].average_price;
    const previous = sortedPrices[sortedPrices.length - 2].average_price;
    const change = previous !== 0 ? ((latest - previous) / previous) * 100 : 0;
    
    // Simple logic: Increasing price = potentially higher demand/better sentiment
    let score = 50 + (change * 2); 
    score = Math.max(0, Math.min(100, score));
    
    let label = 'Neutral';
    if (score > 75) label = 'Bullish / High Demand';
    else if (score < 25) label = 'Bearish / Oversupply';
    else if (score > 55) label = 'Positive';
    else if (score < 45) label = 'Weakening';
    
    return { score, label };
  }, [dashboardData, chartCommodity]);

  // ============================================================================
  // FORECAST HANDLING — FIXED
  // ============================================================================

  const handleForecast = async () => {
    if (!selectedCommodity) {
      alert('Please select a commodity');
      return;
    }

    // FIX 1: Guard against NaN periodsAhead
    const safePeriodsAhead = isNaN(periodsAhead) || periodsAhead < 1 ? 4 : periodsAhead;

    setLoading(true);
    setError(null);
    addNotification('Generating forecast...', 'info');

    try {
      // Send the full commodity name so backend can match it exactly in Supabase
      const requestBody = {
        commodity: selectedCommodity,
        data_type: selectedDataType,
        forecast_mode: forecastMode,
        weeks_ahead: safePeriodsAhead
      };

      console.log('Forecast request payload:', requestBody); // helpful for debugging

      const response = await axios.post(`${API_BASE_URL}/api/forecast`, requestBody);
      setForecastResult(response.data);
      setActiveTab('forecast');
      addNotification('Forecast generated successfully!', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      addNotification(`Error: ${errorMsg}`, 'error');
      console.error('Forecast error response:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // TRAINING HANDLING
  // ============================================================================

  const startTraining = async () => {
    if (isTraining) return;

    setIsTraining(true);
    setTrainingLogs(['Starting training process...', 'Connecting to server...']);
    setActiveTab('training');

    try {
      await axios.post(`${API_BASE_URL}/api/start_training`);

      const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/training';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setTrainingLogs(prev => [...prev, '✅ Connected to Training Server']);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setTrainingLogs(prev => [...prev, data.message]);
        } else if (data.type === 'status') {
          setIsTraining(data.is_training);
          if (!data.is_training) {
            ws.close();
            addNotification('Training Completed!', 'success');
            fetchModelInfo();
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setTrainingLogs(prev => [...prev, '❌ Connection Error']);
        setIsTraining(false);
      };

      ws.onclose = () => {
        setTrainingLogs(prev => [...prev, 'Connection closed']);
      };

    } catch (err) {
      console.error(err);
      setError(err.message);
      setIsTraining(false);
      addNotification('Failed to start training', 'error');
      setTrainingLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    }
  };

  const handleUploadAndTrain = async () => {
    if (!uploadFile) {
      alert('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      setUploadProgress(10);
      const response = await axios.post(`${API_BASE_URL}/api/upload_dataset`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      const { rows, commodities, columns } = response.data;
      addNotification(`✅ Valid Dataset: ${rows} rows, ${commodities} commodities`, 'success');
      alert(`Dataset Validated Successfully!\n\nDetails:\n- Rows: ${rows}\n- Commodities: ${commodities}\n- Columns: ${columns.join(', ')}\n\nStarting training now...`);

      setTimeout(() => startTraining(), 1000);

    } catch (err) {
      console.error(err);
      const errorDetail = err.response?.data?.detail || 'Upload failed';
      addNotification(`❌ Error: ${errorDetail}`, 'error');
      alert(`Dataset Validation Failed ❌\n\nReason: ${errorDetail}`);
      setUploadProgress(0);
      setUploadFile(null);
    }
  };

  // ============================================================================
  // FILE UPLOAD HANDLING
  // ============================================================================

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setUploadFile(file);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    setTimeout(() => {
      addNotification(`File "${file.name}" uploaded successfully!`, 'success');
      setUploadFile(null);
      setUploadProgress(0);
    }, 2500);
  };

  const downloadTrainingScript = () => {
    const scriptContent = `# train_external_data.py Configuration Template

CONFIG = {
    'csv_path': 'your_uploaded_file.csv',
    
    'columns': {
        'date': 'Date',
        'commodity': 'Commodity',
        'volume': 'Volume',
        'price': 'Price'
    },
    
    'commodities': [
        'Cabbage',
        'Tomato',
        'Potato',
        # Add your commodities here
    ],
    
    'sequence_length': 4,
    'epochs': 100,
    'test_weeks': 8,
}

# Run this script: python train_external_data.py
`;

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'train_config_template.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // EXPORT FUNCTIONS
  // ============================================================================

  const exportForecastToCSV = () => {
    if (!forecastResult) return;

    const csvRows = [
      ['Period', 'Year', 'Month', 'Week', 'Value', 'Type'],
      ...forecastResult.forecast_data.filter(item => item.week !== 5).map(item => [
        formatPeriod(item, forecastResult.forecast_mode),
        item.year,
        item.month,
        item.week,
        forecastResult.data_type === 'volume' ? (item.value / 1000).toFixed(4) : item.value.toFixed(2),
        'Forecast'
      ])
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast_${forecastResult.commodity}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification('Forecast exported to CSV', 'success');
  };

  // ============================================================================
  // SUMMARY STATS
  // ============================================================================

  const formatVolume = (kg) => {
    if (kg >= 1000) return { value: (kg / 1000).toFixed(3), unit: 'MT' };
    return { value: kg.toFixed(2), unit: 'Kg' };
  };

  const getSummaryStats = () => {
    if (!dashboardData) return null;

    const volumeTotal = dashboardData.volume_data.reduce((sum, item) => sum + item.volume, 0);
    const priceAvg = dashboardData.price_data.length > 0
      ? dashboardData.price_data.reduce((sum, item) => sum + item.average_price, 0) / dashboardData.price_data.length
      : 0;

    return {
      totalWeeks: dashboardData.volume_data.length + dashboardData.price_data.length,
      totalVolume: (volumeTotal / 1000).toFixed(2),
      avgPrice: priceAvg.toFixed(2),
      commoditiesCount: dashboardData.uniqueCommodities.length
    };
  };

  // ============================================================================
  // CHART DATA FUNCTIONS
  // ============================================================================

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const getCommodityChartData = () => {
    if (!dashboardData || !chartCommodity) return null;

    const baseChartCommodity = getBaseCommodityName(chartCommodity);

    const allYears = chartYearFilter === 'all'
      ? [...new Set(dashboardData.price_data
          .filter(d => getBaseCommodityName(d.commodity) === baseChartCommodity)
          .map(d => d.year))].sort()
      : [parseInt(chartYearFilter)];

    const latestYear = allYears[allYears.length - 1];

    // --- WEEKLY DRILL-DOWN: a specific month is selected ---
    if (selectedChartMonth !== 'all') {
      const month = parseInt(selectedChartMonth);
      const categories = [];
      const volumeData = [];
      const priceData = [];

      for (let week = 1; week <= 4; week++) {
        const volRows = dashboardData.volume_data.filter(d =>
          getBaseCommodityName(d.commodity) === baseChartCommodity &&
          d.year === latestYear && d.month === month && d.week === week
        );
        const priceRows = dashboardData.price_data.filter(d =>
          getBaseCommodityName(d.commodity) === baseChartCommodity &&
          d.year === latestYear && d.month === month && d.week === week
        );

        // Only include weeks that have data
        if (volRows.length === 0 && priceRows.length === 0) continue;

        const volAvg = volRows.length
          ? volRows.reduce((s, d) => s + (d.volume || 0), 0) / volRows.length : 0;
        const priceAvg = priceRows.length
          ? priceRows.reduce((s, d) => s + (d.average_price || 0), 0) / priceRows.length : 0;

        categories.push(`Week ${week}`);
        volumeData.push(parseFloat(volAvg.toFixed(2)));
        priceData.push(parseFloat(priceAvg.toFixed(2)));
      }

      return { categories, volumeData, priceData, drillMode: true, month, year: latestYear };
    }

    // --- DEFAULT: monthly overview ---
    const categories = [];
    const volumeData = [];
    const priceData = [];

    for (let month = 1; month <= 12; month++) {
      const volRows = dashboardData.volume_data.filter(d =>
        getBaseCommodityName(d.commodity) === baseChartCommodity &&
        d.month === month && d.year === latestYear
      );
      const priceRows = dashboardData.price_data.filter(d =>
        getBaseCommodityName(d.commodity) === baseChartCommodity &&
        d.month === month && d.year === latestYear
      );

      const volAvg = volRows.length
        ? volRows.reduce((s, d) => s + (d.volume || 0), 0) / volRows.length : 0;
      const priceAvg = priceRows.length
        ? priceRows.reduce((s, d) => s + (d.average_price || 0), 0) / priceRows.length : 0;

      categories.push(`${MONTH_NAMES[month - 1]} ${latestYear}`);
      volumeData.push(parseFloat(volAvg.toFixed(2)));
      priceData.push(parseFloat(priceAvg.toFixed(2)));
    }

    return { categories, volumeData, priceData, drillMode: false };
  };

  // ============================================================================
  // CHART CONFIGURATIONS
  // ============================================================================

  const getVolumeChartOptions = () => {
    const chartData = getCommodityChartData();
    if (!chartData) return { series: [], options: {} };

    const title = chartData.drillMode 
      ? `📦 ${chartCommodity} - ${MONTH_NAMES_FULL[chartData.month - 1]} ${chartData.year} Weekly Volume`
      : `📦 ${chartCommodity} - Monthly Avg Volume`;

    return {
      series: [{ name: 'Volume (Kg)', data: chartData.volumeData }],
      options: {
        chart: { type: 'bar', height: 300, toolbar: { show: true } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        colors: ['#3b82f6'],
        dataLabels: {
          enabled: false,
        },
        xaxis: { categories: chartData.categories, labels: { rotate: -45 } },
        yaxis: { title: { text: 'Volume (Kg)' } },
        title: { text: title, align: 'left' }
      }
    };
  };

  const getPriceChartOptions = () => {
    const chartData = getCommodityChartData();
    if (!chartData) return { series: [], options: {} };

    const title = chartData.drillMode 
      ? `💰 ${chartCommodity} - ${MONTH_NAMES_FULL[chartData.month - 1]} ${chartData.year} Weekly Price`
      : `💰 ${chartCommodity} - Monthly Avg Price`;

    return {
      series: [{ name: 'Price (₱)', data: chartData.priceData }],
      options: {
        chart: { type: 'bar', height: 300, toolbar: { show: true } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        colors: ['#10b981'],
        dataLabels: {
          enabled: false,
        },
        xaxis: { categories: chartData.categories, labels: { rotate: -45 } },
        yaxis: { title: { text: 'Price (₱)' } },
        title: { text: title, align: 'left' }
      }
    };
  };

  const getMultiCommodityBarChart = () => {
    if (!dashboardData || !comparisonCommodities.length) return { series: [], options: {} };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const commodity = comparisonCommodities[0];
    const baseCommodity = getBaseCommodityName(commodity);
    const sourceData = comparisonDataType === 'volume' ? dashboardData.volume_data : dashboardData.price_data;

    // Get all years available for this commodity
    const years = [...new Set(
      sourceData
        .filter(d => getBaseCommodityName(d.commodity) === baseCommodity)
        .map(d => d.year)
    )].sort();

    // Build one series per year, averaged by month
    const series = years.map(year => {
      const monthlyData = Array.from({ length: 12 }, (_, mi) => {
        const month = mi + 1;
        const rows = sourceData.filter(d =>
          getBaseCommodityName(d.commodity) === baseCommodity &&
          d.year === year && d.month === month
        );
        if (!rows.length) return null;
        const vals = rows.map(d => comparisonDataType === 'volume' ? d.volume : d.average_price).filter(v => v != null);
        return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
      });
      return { name: String(year), data: monthlyData };
    });

    return {
      series,
      options: {
        chart: { type: 'bar', height: 420, toolbar: { show: true } },
        plotOptions: { bar: { horizontal: false, columnWidth: '70%', borderRadius: 3 } },
        dataLabels: { enabled: false },
        colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#546E7A'],
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
          categories: monthNames,
          title: { text: 'Month', style: { fontSize: '13px', fontWeight: 600 } }
        },
        yaxis: {
          title: { text: comparisonDataType === 'price' ? 'Avg Price (₱/Kg)' : 'Volume (Kg)', style: { fontSize: '13px', fontWeight: 600 } },
          labels: { formatter: val => val == null ? '' : comparisonDataType === 'price' ? '₱' + val.toFixed(0) : val.toFixed(0) }
        },
        title: {
          text: `Prevailing Market ${comparisonDataType === 'price' ? 'Prices' : 'Volume'} of ${commodity} (${years.join('-')})`,
          align: 'center',
          style: { fontSize: '16px', fontWeight: 'bold' }
        },
        legend: { position: 'bottom', horizontalAlign: 'center' },
        tooltip: {
          shared: true, intersect: false,
          y: { formatter: val => val == null ? 'No data' : comparisonDataType === 'price' ? '₱' + val.toFixed(2) : val.toFixed(2) + ' Kg' }
        },
        grid: { borderColor: '#e7e7e7', strokeDashArray: 4 }
      }
    };
  };

  const getWeeklyTrendLineChart = () => {
    if (!dashboardData || !comparisonCommodities.length) return { series: [], options: {} };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const commodity = comparisonCommodities[0];
    const baseCommodity = getBaseCommodityName(commodity);
    const sourceData = comparisonDataType === 'volume' ? dashboardData.volume_data : dashboardData.price_data;

    const years = [...new Set(
      sourceData
        .filter(d => getBaseCommodityName(d.commodity) === baseCommodity)
        .map(d => d.year)
    )].sort();

    const series = years.map(year => {
      const monthlyData = Array.from({ length: 12 }, (_, mi) => {
        const month = mi + 1;
        const rows = sourceData.filter(d =>
          getBaseCommodityName(d.commodity) === baseCommodity &&
          d.year === year && d.month === month
        );
        if (!rows.length) return null;
        const vals = rows.map(d => comparisonDataType === 'volume' ? d.volume : d.average_price).filter(v => v != null);
        return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
      });
      return { name: String(year), data: monthlyData };
    });

    return {
      series,
      options: {
        chart: { type: 'line', height: 420, toolbar: { show: true }, zoom: { enabled: true } },
        stroke: { width: 3, curve: 'smooth' },
        markers: { size: 5, hover: { size: 7 } },
        colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#546E7A'],
        xaxis: {
          categories: monthNames,
          title: { text: 'Month', style: { fontSize: '13px', fontWeight: 600 } }
        },
        yaxis: {
          title: { text: comparisonDataType === 'price' ? 'Avg Price (₱/Kg)' : 'Volume (Kg)', style: { fontSize: '13px', fontWeight: 600 } },
          labels: { formatter: val => val == null ? '' : comparisonDataType === 'price' ? '₱' + val.toFixed(0) : val.toFixed(0) }
        },
        title: {
          text: `${commodity} ${comparisonDataType === 'price' ? 'Price' : 'Volume'} Trend by Year`,
          align: 'center',
          style: { fontSize: '16px', fontWeight: 'bold' }
        },
        legend: { position: 'bottom', horizontalAlign: 'center' },
        tooltip: {
          shared: true, intersect: false,
          y: { formatter: val => val == null ? 'No data' : comparisonDataType === 'price' ? '₱' + val.toFixed(2) : val.toFixed(2) + ' Kg' }
        },
        grid: { borderColor: '#e7e7e7', strokeDashArray: 4 }
      }
    };
  };

  const getMixedComparisonChart = () => {
    if (!dashboardData || !chartCommodity) return { series: [], options: {} };
    const baseChartCommodity = getBaseCommodityName(chartCommodity);

    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

    const volumeData = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.volume_data.find(
        item => getBaseCommodityName(item.commodity) === baseChartCommodity && item.week === weekNumber
      );
      return dataPoint ? dataPoint.volume : 0;
    });

    const priceData = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.price_data.find(
        item => getBaseCommodityName(item.commodity) === baseChartCommodity && item.week === weekNumber
      );
      return dataPoint ? dataPoint.average_price : 0;
    });

    return {
      series: [
        { name: 'Volume (Kg)', type: 'column', data: volumeData },
        { name: 'Price (₱)', type: 'line', data: priceData }
      ],
      options: {
        chart: {
          height: 400,
          type: 'line',
          stacked: false,
          toolbar: { show: true }
        },
        stroke: { width: [0, 4], curve: 'smooth' },
        plotOptions: { bar: { columnWidth: '50%', borderRadius: 4 } },
        colors: ['#3b82f6', '#10b981'],
        fill: {
          opacity: [0.85, 1],
          gradient: {
            inverseColors: false,
            shade: 'light',
            type: 'vertical',
            opacityFrom: 0.85,
            opacityTo: 0.55,
            stops: [0, 100, 100, 100]
          }
        },
        labels: weeks,
        markers: { size: 5 },
        xaxis: { title: { text: 'Week Number' } },
        yaxis: [
          {
            axisTicks: { show: true },
            axisBorder: { show: true, color: '#3b82f6' },
            labels: {
              style: { colors: '#3b82f6' },
              formatter: function (val) { return val.toFixed(0) + ' Kg'; }
            },
            title: {
              text: 'Volume (Kg)',
              style: { color: '#3b82f6', fontWeight: 600 }
            }
          },
          {
            opposite: true,
            axisTicks: { show: true },
            axisBorder: { show: true, color: '#10b981' },
            labels: {
              style: { colors: '#10b981' },
              formatter: function (val) { return '₱' + val.toFixed(0); }
            },
            title: {
              text: 'Price (₱)',
              style: { color: '#10b981', fontWeight: 600 }
            }
          }
        ],
        title: {
          text: `📊 ${chartCommodity} - Volume vs Price Analysis`,
          align: 'left',
          style: { fontSize: '18px', fontWeight: 'bold' }
        },
        tooltip: {
          shared: true,
          intersect: false,
          y: [
            { formatter: function (val) { return val.toFixed(2) + ' Kg'; } },
            { formatter: function (val) { return '₱' + val.toFixed(2); } }
          ]
        },
        legend: { horizontalAlign: 'left', offsetX: 40 }
      }
    };
  };

  const getStackedPriceChart = () => {
    if (!dashboardData || !chartCommodity) return { series: [], options: {} };
    const baseChartCommodity = getBaseCommodityName(chartCommodity);

    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

    const lowestPrices = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.price_data.find(
        item => getBaseCommodityName(item.commodity) === baseChartCommodity && item.week === weekNumber
      );
      return dataPoint ? dataPoint.lowest_price : 0;
    });

    const priceRanges = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.price_data.find(
        item => getBaseCommodityName(item.commodity) === baseChartCommodity && item.week === weekNumber
      );
      return dataPoint ? (dataPoint.highest_price - dataPoint.lowest_price) : 0;
    });

    return {
      series: [
        { name: 'Lowest Price', data: lowestPrices },
        { name: 'Price Range', data: priceRanges }
      ],
      options: {
        chart: {
          type: 'bar',
          height: 350,
          stacked: true,
          toolbar: { show: true }
        },
        plotOptions: {
          bar: {
            horizontal: false,
            borderRadius: 4,
            dataLabels: {
              total: {
                enabled: true,
                formatter: function (val) { return '₱' + val.toFixed(0); },
                style: { fontSize: '12px', fontWeight: 900 }
              }
            }
          }
        },
        colors: ['#29A380', '#FF9B2B'],
        stroke: { width: 1, colors: ['#fff'] },
        xaxis: { categories: weeks, title: { text: 'Week Number' } },
        yaxis: {
          title: { text: 'Price (₱)' },
          labels: { formatter: function (val) { return '₱' + val.toFixed(0); } }
        },
        title: {
          text: `💰 ${chartCommodity} - Weekly Price Range Breakdown`,
          align: 'left',
          style: { fontSize: '18px', fontWeight: 'bold' }
        },
        tooltip: {
          y: { formatter: function (val) { return '₱' + val.toFixed(2); } }
        },
        fill: { opacity: 1 },
        legend: { position: 'top', horizontalAlign: 'left', offsetX: 40 }
      }
    };
  };

  const getForecastChartOptions = () => {
    if (!forecastResult) return { series: [], options: {} };

    const mode = forecastResult.forecast_mode || 'weekly';
    const isVolume = forecastResult.data_type === 'volume';

    const filteredHistorical = forecastResult.historical_data.slice(-12).filter(item => item.week !== 5);
    const filteredForecast = forecastResult.forecast_data.filter(item => item.week !== 5);

    const toMT = val => isVolume ? val / 1000 : val;

    const historicalCategories = filteredHistorical.map(item => formatPeriod(item, mode));
    const historicalValues = filteredHistorical.map(item => toMT(item.value));
    const forecastCategories = filteredForecast.map(item => formatPeriod(item, mode));
    const forecastValues = filteredForecast.map(item => toMT(item.value));

    const allCategories = [...historicalCategories, ...forecastCategories];
    const historicalSeries = [...historicalValues, ...Array(forecastValues.length).fill(null)];
    const forecastSeries = [
      ...Array(historicalValues.length - 1).fill(null),
      historicalValues[historicalValues.length - 1],
      ...forecastValues
    ];

    return {
      series: [
        { name: 'Historical Data', data: historicalSeries },
        { name: 'Forecast', data: forecastSeries }
      ],
      options: {
        chart: { type: 'line', height: 400, toolbar: { show: true } },
        colors: ['#3b82f6', '#10b981'],
        stroke: { width: [3, 3], curve: 'smooth', dashArray: [0, 5] },
        xaxis: {
          categories: allCategories,
          labels: { rotate: -45, rotateAlways: true }
        },
        yaxis: {
          title: { text: forecastResult.data_type === 'price' ? 'Price (₱)' : 'Volume (MT)' }
        },
        title: {
          text: `🔮 ${mode.charAt(0).toUpperCase() + mode.slice(1)} Forecast: ${forecastResult.commodity}`,
          align: 'left'
        },
        legend: { position: 'top', horizontalAlign: 'right' },
        annotations: {
          xaxis: [{
            x: historicalCategories.length - 0.5,
            borderColor: '#9333ea',
            strokeDashArray: 4,
            label: {
              text: 'Forecast Start',
              style: { color: '#fff', background: '#9333ea' }
            }
          }]
        }
      }
    };
  };

  const stats = getSummaryStats();
  const forecastChart = getForecastChartOptions();
  const volumeChart = getVolumeChartOptions();
  const priceChart = getPriceChartOptions();
  const multiBarChart = getMultiCommodityBarChart();
  const trendLineChart = getWeeklyTrendLineChart();
  const mixedChart = getMixedComparisonChart();
  const stackedChart = getStackedPriceChart();

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (!dashboardData) {
    return (
      <div className={`min-h-screen ${darkMode ? "bg-slate-950" : "bg-gradient-to-br from-green-50 to-blue-50"} flex items-center justify-center transition-colors duration-300`}>
        <OrbitProgress variant="dotted" color="#32cd32" size="medium" text="" textColor="" />
      </div>
    );
  }

  const availableYears = [...new Set([
    ...dashboardData.volume_data.map(d => d.year),
    ...dashboardData.price_data.map(d => d.year)
  ])].sort((a, b) => b - a);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className={`min-h-screen ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-slate-800"} px-6 pt-2 pb-8 w-full font-sans transition-colors duration-300`}>
      {/* Notification Center */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 ${
              notif.type === 'success' ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-green-600 text-white') :
              notif.type === 'error' ? (darkMode ? 'bg-rose-600 text-white' : 'bg-red-600 text-white') :
              (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white')
            }`}
          >
            <span className="text-xl">
              {notif.type === 'success' ? '✅' : notif.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span>{notif.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <h1 className={`text-3xl font-bold ${darkMode ? "text-slate-100" : "text-slate-800"} mb-2`}>AgriData Analytics Dashboard</h1>
      <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"} mb-8`}>Multi-Period Agricultural Forecasting & Analysis</p>

      {/* Main Content */}
      <main className="w-full">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
          <div className={`${darkMode ? "bg-slate-900 border-blue-500/50" : "bg-white border-blue-500"} rounded-lg shadow-md p-6 border-l-4 transition-colors`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Total Entries</p>
                <p className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{stats?.totalWeeks || 0}</p>
              </div>
              <div className="text-4xl opacity-80">📊</div>
            </div>
          </div>

          <div className={`${darkMode ? "bg-slate-900 border-green-500/50" : "bg-white border-green-500"} rounded-lg shadow-md p-6 border-l-4 transition-colors`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Total Volume</p>
                <p className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{stats?.totalVolume || 0} <span className="text-sm font-normal">MT</span></p>
              </div>
              <div className="text-4xl opacity-80">📦</div>
            </div>
          </div>

          <div className={`${darkMode ? "bg-slate-900 border-yellow-500/50" : "bg-white border-yellow-500"} rounded-lg shadow-md p-6 border-l-4 transition-colors`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Avg Price</p>
                <p className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>₱{stats?.avgPrice || 0}</p>
              </div>
              <div className="text-4xl opacity-80">💰</div>
            </div>
          </div>

          <div className={`${darkMode ? "bg-slate-900 border-purple-500/50" : "bg-white border-purple-500"} rounded-lg shadow-md p-6 border-l-4 transition-colors`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Commodities</p>
                <p className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{stats?.commoditiesCount || 0}</p>
              </div>
              <div className="text-4xl opacity-80">🥬</div>
            </div>
          </div>
        </div>

        {/* Forecast Controls */}
        <div className={`${darkMode ? "bg-slate-900 border border-slate-800" : "bg-white"} rounded-lg shadow-md p-6 mb-8 transition-colors`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>🔮 Advanced Forecast Controls</h2>
            {selectedCommodity && (
              <div className="text-sm">
                {modelInfo?.models?.find(m =>
                  m.model_key === `global_${selectedDataType}` ||
                  (m.commodity.toLowerCase() === selectedCommodity.toLowerCase() && m.data_type === selectedDataType)
                ) ? (
                  <span className={`px-3 py-1 ${darkMode ? "bg-green-900/30 text-green-400 border border-green-800/30" : "bg-green-100 text-green-800"} rounded-full font-semibold`}>
                    ⚡ Using Pre-trained Model
                  </span>
                ) : (
                  <span className={`px-3 py-1 ${darkMode ? "bg-yellow-900/30 text-yellow-500 border border-yellow-800/30" : "bg-yellow-100 text-yellow-800"} rounded-full font-semibold`}>
                    🔨 Will Train from Database
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Commodity</label>
                <select
                  value={selectedCommodity}
                  onChange={(e) => setSelectedCommodity(e.target.value)}
                  className={`w-full px-4 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-green-500/50" : "bg-white border-gray-300 focus:ring-green-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                >
                  {dashboardData.uniqueCommodities.map(commodity => (
                    <option key={commodity} value={commodity} className={darkMode ? "bg-slate-800" : "bg-white"}>{formatCommodityName(commodity)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Data Type</label>
                <select
                  value={selectedDataType}
                  onChange={(e) => setSelectedDataType(e.target.value)}
                  className={`w-full px-4 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-green-500/50" : "bg-white border-gray-300 focus:ring-green-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                >
                  <option value="volume" className={darkMode ? "bg-slate-800" : "bg-white"}>Volume (Kg)</option>
                  <option value="price" className={darkMode ? "bg-slate-800" : "bg-white"}>Price (₱)</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Forecast Mode</label>
                <select
                  value={forecastMode}
                  onChange={(e) => setForecastMode(e.target.value)}
                  className={`w-full px-4 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-green-500/50" : "bg-white border-gray-300 focus:ring-green-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                >
                  <option value="weekly" className={darkMode ? "bg-slate-800" : "bg-white"}>📅 Weekly</option>
                  <option value="monthly" className={darkMode ? "bg-slate-800" : "bg-white"}>📆 Monthly</option>
                  <option value="yearly" className={darkMode ? "bg-slate-800" : "bg-white"}>🗓️ Yearly</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>
                  Forecast Duration (Weeks Ahead)
                </label>
                <input
                  type="number"
                  value={periodsAhead}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPeriodsAhead(isNaN(val) ? 4 : Math.min(Math.max(val, 1), 12));
                  }}
                  min="1"
                  max="12"
                  className={`w-full px-4 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-green-500/50" : "bg-white border-gray-300 focus:ring-green-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleForecast}
                  disabled={loading}
                  className={`w-full ${darkMode ? "bg-green-600 hover:bg-green-500 disabled:bg-slate-800" : "bg-green-600 hover:bg-green-700 disabled:bg-gray-400"} text-white font-semibold py-2 px-6 rounded-lg transition-all active:scale-[0.98]`}
                >
                  {loading ? 'Forecasting...' : 'Generate'}
                </button>
              </div>
            </div>

            {error && (
              <div className={`mt-4 ${darkMode ? "bg-rose-900/10 border-rose-800/50" : "bg-red-50 border-red-500"} border-l-4 p-4 rounded`}>
                <p className={darkMode ? "text-rose-400" : "text-red-700"}>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className={`${darkMode ? "bg-slate-900 border border-slate-800" : "bg-white"} rounded-lg shadow-md mb-8 transition-colors`}>
          <div className={`border-b ${darkMode ? "border-slate-800" : "border-gray-200"}`}>
            <nav className="flex space-x-8 px-6 overflow-x-auto">
              {[
                { key: 'overview', label: '📊 Overview' },
                { key: 'commodity', label: '📈 Commodity Charts' },
                { key: 'comparison', label: '📊 Multi-Commodity Comparison' },
                { key: 'forecast', label: '🔮 Forecast Results' },
                { key: 'training', label: '🏋️ Training & Models' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition-all ${activeTab === tab.key
                    ? tab.key === 'training'
                      ? 'border-purple-500 text-purple-500'
                      : 'border-green-500 text-green-500'
                    : `border-transparent ${darkMode ? "text-slate-500 hover:text-slate-300" : "text-gray-500 hover:text-gray-700"}`
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className={`${darkMode ? "bg-slate-800/50 border-slate-700" : "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200"} rounded-lg p-6 border transition-colors`}>
                  <h4 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"} mb-4`}>📋 Data Filters & View Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Year</label>
                      <select
                        value={overviewYearFilter}
                        onChange={(e) => setOverviewYearFilter(e.target.value)}
                        className={`w-full px-3 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500/50" : "bg-white border-gray-300 focus:ring-blue-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                      >
                        <option value="all" className={darkMode ? "bg-slate-800" : "bg-white"}>All Years</option>
                        {availableYears.map(year => (
                          <option key={year} value={year} className={darkMode ? "bg-slate-800" : "bg-white"}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Month</label>
                      <select
                        value={overviewMonthFilter}
                        onChange={(e) => setOverviewMonthFilter(e.target.value)}
                        className={`w-full px-3 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500/50" : "bg-white border-gray-300 focus:ring-blue-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                      >
                        <option value="all" className={darkMode ? "bg-slate-800" : "bg-white"}>All Months</option>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                          <option key={m} value={i + 1} className={darkMode ? "bg-slate-800" : "bg-white"}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Week</label>
                      <select
                        value={overviewWeekFilter}
                        onChange={(e) => setOverviewWeekFilter(e.target.value)}
                        className={`w-full px-3 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500/50" : "bg-white border-gray-300 focus:ring-blue-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                      >
                        <option value="all" className={darkMode ? "bg-slate-800" : "bg-white"}>All Weeks</option>
                        {[1, 2, 3, 4].map(w => (
                          <option key={w} value={w} className={darkMode ? "bg-slate-800" : "bg-white"}>Week {w}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Commodity</label>
                      <select
                        value={overviewCommodityFilter}
                        onChange={(e) => setOverviewCommodityFilter(e.target.value)}
                        className={`w-full px-3 py-2 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500/50" : "bg-white border-gray-300 focus:ring-blue-500 text-gray-900"} border rounded-lg focus:ring-2 transition-colors`}
                      >
                        <option value="all" className={darkMode ? "bg-slate-800" : "bg-white"}>All Commodities</option>
                        {dashboardData.uniqueCommodities.map(commodity => (
                          <option key={commodity} value={commodity} className={darkMode ? "bg-slate-800" : "bg-white"}>{formatCommodityName(commodity)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-2`}>Search</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search commodity..."
                          value={overviewSearchQuery}
                          onChange={(e) => setOverviewSearchQuery(e.target.value)}
                          className={`w-full px-3 py-2 pl-9 ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500/50 placeholder:text-slate-600" : "bg-white border-gray-300 focus:ring-blue-500 text-gray-900"} border rounded-lg focus:ring-2 text-sm transition-colors`}
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex gap-2">
                        <button
                          onClick={() => setOverviewDataView('volume')}
                          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${overviewDataView === 'volume'
                            ? `bg-blue-600 text-white shadow-lg ${darkMode ? "shadow-blue-900/40" : "shadow-blue-100"}`
                            : `${darkMode ? "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"} border`
                            }`}
                        >
                          📦 Volume View
                        </button>
                        <button
                          onClick={() => setOverviewDataView('price')}
                          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${overviewDataView === 'price'
                            ? `bg-emerald-600 text-white shadow-lg ${darkMode ? "shadow-emerald-900/40" : "shadow-emerald-100"}`
                            : `${darkMode ? "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"} border`
                            }`}
                        >
                          💰 Price View
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black ${darkMode ? "text-slate-500" : "text-gray-400"} uppercase tracking-widest`}>Sort By:</span>
                      <select 
                        value={`${overviewSortConfig.key}-${overviewSortConfig.direction}`}
                        onChange={(e) => {
                          const [key, direction] = e.target.value.split('-');
                          setOverviewSortConfig({ key, direction });
                        }}
                        className={`bg-transparent text-xs font-bold ${darkMode ? "text-slate-300" : "text-slate-700"} outline-none cursor-pointer`}
                      >
                        <option value="date-desc" className={darkMode ? "bg-slate-800" : "bg-white"}>Newest First</option>
                        <option value="date-asc" className={darkMode ? "bg-slate-800" : "bg-white"}>Oldest First</option>
                        <option value="volume-desc" className={darkMode ? "bg-slate-800" : "bg-white"}>Highest {overviewDataView === 'volume' ? 'Volume' : 'Price'}</option>
                        <option value="volume-asc" className={darkMode ? "bg-slate-800" : "bg-white"}>Lowest {overviewDataView === 'volume' ? 'Volume' : 'Price'}</option>
                        <option value="month-asc" className={darkMode ? "bg-slate-800" : "bg-white"}>Month (Jan-Dec)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SUMMARY GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} p-5 rounded-2xl border shadow-sm transition-colors`}>
                    <p className={`text-[10px] font-bold ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-[0.15em] mb-1`}>Filtered Volume</p>
                    <p className={`text-2xl font-black ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                      {(() => { const kg = (overviewDataView === 'volume' ? (analyzeVolumeData || []) : []).reduce((sum, item) => sum + item.totalVolume, 0); const fmt = formatVolume(kg); return <>{fmt.value}<span className={`text-xs ml-1 font-bold ${darkMode ? "text-slate-600" : "text-slate-300"}`}>{fmt.unit}</span></>; })()}
                    </p>
                  </div>
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} p-5 rounded-2xl border shadow-sm transition-colors`}>
                    <p className={`text-[10px] font-bold ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-[0.15em] mb-1`}>Average Price</p>
                    <p className={`text-2xl font-black ${darkMode ? "text-emerald-400" : "text-green-600"}`}>
                      ₱{(overviewDataView === 'price' ? (analyzePriceData || []) : [])
                        .reduce((sum, item, _, arr) => sum + (item.weekAverage || 0) / (arr.length || 1), 0).toFixed(2)}
                    </p>
                  </div>
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} p-5 rounded-2xl border shadow-sm transition-colors`}>
                    <p className={`text-[10px] font-bold ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-[0.15em] mb-1`}>Data Completeness</p>
                    <p className={`text-2xl font-black ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                      {((overviewDataView === 'volume' ? (analyzeVolumeData || []) : (analyzePriceData || []))
                        .reduce((sum, item, _, arr) => sum + item.completeness / (arr.length || 1), 0) || 0).toFixed(0)}
                      <span className={`text-xs ml-1 font-bold ${darkMode ? "text-slate-600" : "text-slate-300"}`}>%</span>
                    </p>
                  </div>
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} p-5 rounded-2xl border shadow-sm transition-colors`}>
                    <p className={`text-[10px] font-bold ${darkMode ? "text-slate-500" : "text-slate-400"} uppercase tracking-[0.15em] mb-1`}>Periods Tracked</p>
                    <p className={`text-2xl font-black ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                      {(overviewDataView === 'volume' ? (analyzeVolumeData || []) : (analyzePriceData || [])).length}
                      <span className={`text-xs ml-1 font-bold ${darkMode ? "text-slate-600" : "text-slate-300"}`}>Weeks</span>
                    </p>
                  </div>
                </div>

                {/* VOLUME TABLE */}
                {overviewDataView === 'volume' && analyzeVolumeData && (
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border overflow-hidden transition-colors`}>
                    <div className={`${darkMode ? "bg-slate-800/80" : "bg-gradient-to-r from-blue-50 to-blue-100"} px-6 py-4 border-b ${darkMode ? "border-slate-700" : "border-gray-200"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`${darkMode ? "bg-blue-900/30" : "bg-blue-100"} p-2 rounded-lg`}>
                            <span className="text-xl text-blue-600">📦</span>
                          </div>
                          <div>
                            <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Volume Data by Week</h3>
                            <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Aggregated weekly totals with completeness tracking</p>
                          </div>
                        </div>
                        <div className={`text-sm ${darkMode ? "text-slate-500" : "text-gray-500"}`}>
                          {analyzeVolumeData.length} weeks • {overviewYearFilter === 'all' ? 'All years' : overviewYearFilter}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className={`min-w-full divide-y ${darkMode ? "divide-slate-800" : "divide-gray-200"}`}>
                        <thead className={darkMode ? "bg-slate-800/50" : "bg-gray-50"}>
                          <tr>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Period</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Week</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Month/Year</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Total Volume</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Commodities</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Completeness</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Details</th>
                          </tr>
                        </thead>
                        <tbody className={`${darkMode ? "bg-slate-900" : "bg-white"} divide-y ${darkMode ? "divide-slate-800" : "divide-gray-200"}`}>
                          {analyzeVolumeData.map((item, idx) => {
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const isComplete = item.completeness === 100;

                            return (
                              <tr key={idx} className={`${darkMode ? "hover:bg-blue-900/10" : "hover:bg-blue-50/30"} transition-colors ${!isComplete ? (darkMode ? "bg-yellow-900/5" : "bg-yellow-50/20") : ""}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`text-sm font-medium ${darkMode ? "text-slate-200" : "text-gray-900"}`}>
                                    {item.week_label || `Week ${item.week}, ${monthNames[item.month - 1]} ${item.year}`}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-800"}`}>
                                    W{item.week}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-900"}`}>{monthNames[item.month - 1]} {item.year}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {(() => { const fmt = formatVolume(item.totalVolume); return <><span className={`text-lg font-black ${darkMode ? "text-blue-400" : "text-blue-700"}`}>{fmt.value}</span><span className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>{fmt.unit}</span></>; })()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-900"}`}>
                                    {Object.keys(item.commodities).length} / {overviewCommodityFilter === 'all' ? dashboardData.uniqueCommodities.length : 1}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-24 ${darkMode ? "bg-slate-700" : "bg-gray-200"} rounded-full h-2`}>
                                        <div
                                          className={`h-2 rounded-full ${isComplete ? (darkMode ? "bg-emerald-500" : "bg-green-500") : "bg-yellow-500"}`}
                                          style={{ width: `${item.completeness}%` }}
                                        ></div>
                                      </div>
                                      <span className={`text-xs font-bold ${isComplete ? (darkMode ? "text-emerald-500" : "text-green-600") : "text-yellow-600"}`}>
                                        {item.completeness.toFixed(0)}%
                                      </span>
                                    </div>
                                    {!isComplete && (
                                      <div className="text-xs text-yellow-600">⚠️ {item.missingCommodities} missing</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs space-y-1 max-w-xs">
                                    {Object.entries(item.commodities).map(([commodity, volume]) => (
                                      <div key={commodity} className="flex justify-between gap-4">
                                        <span className={darkMode ? "text-slate-400" : "text-gray-600"}>{formatCommodityName(commodity)}:</span>
                                        <span className={`font-bold ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{(() => { const fmt = formatVolume(volume); return `${fmt.value} ${fmt.unit}`; })()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className={`${darkMode ? "bg-slate-800/50" : "bg-gray-50"} px-6 py-4 border-t ${darkMode ? "border-slate-800" : "border-gray-200"}`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Total Weeks:</span>
                          <span className={`ml-2 font-black ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{analyzeVolumeData.length}</span>
                        </div>
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Total Volume:</span>
                          <span className={`ml-2 font-black ${darkMode ? "text-blue-400" : "text-blue-700"}`}>
                            {(() => { const kg = analyzeVolumeData.reduce((sum, item) => sum + item.totalVolume, 0); const fmt = formatVolume(kg); return `${fmt.value} ${fmt.unit}`; })()}
                          </span>
                        </div>
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Complete Weeks:</span>
                          <span className={`ml-2 font-black ${darkMode ? "text-emerald-500" : "text-green-600"}`}>
                            {analyzeVolumeData.filter(item => item.completeness === 100).length}
                          </span>
                        </div>
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Incomplete:</span>
                          <span className="ml-2 font-black text-yellow-600">
                            {analyzeVolumeData.filter(item => item.completeness < 100).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PRICE TABLE */}
                {overviewDataView === 'price' && analyzePriceData && (
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border overflow-hidden transition-colors`}>
                    <div className={`${darkMode ? "bg-slate-800/80" : "bg-gradient-to-r from-green-50 to-green-100"} px-6 py-4 border-b ${darkMode ? "border-slate-700" : "border-gray-200"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`${darkMode ? "bg-green-900/30" : "bg-green-100"} p-2 rounded-lg`}>
                            <span className="text-xl text-green-600">💰</span>
                          </div>
                          <div>
                            <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Price Data by Week (LP/HP/AP)</h3>
                            <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Lowest, Highest, and Average prices with completeness tracking</p>
                          </div>
                        </div>
                        <div className={`text-sm ${darkMode ? "text-slate-500" : "text-gray-500"}`}>
                          {analyzePriceData.length} weeks • {overviewYearFilter === 'all' ? 'All years' : overviewYearFilter}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className={`min-w-full divide-y ${darkMode ? "divide-slate-800" : "divide-gray-200"}`}>
                        <thead className={darkMode ? "bg-slate-800/50" : "bg-gray-50"}>
                          <tr>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Period</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Week</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Month/Year</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Week LP (₱)</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Week HP (₱)</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Week AP (₱)</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Completeness</th>
                            <th className={`px-6 py-3 text-left text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Commodity Details</th>
                          </tr>
                        </thead>
                        <tbody className={`${darkMode ? "bg-slate-900" : "bg-white"} divide-y ${darkMode ? "divide-slate-800" : "divide-gray-200"}`}>
                          {analyzePriceData.map((item, idx) => {
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const isComplete = item.completeness === 100;

                            return (
                              <tr key={idx} className={`${darkMode ? "hover:bg-green-900/10" : "hover:bg-green-50/30"} transition-colors ${!isComplete ? (darkMode ? "bg-yellow-900/5" : "bg-yellow-50/20") : ""}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`text-sm font-medium ${darkMode ? "text-slate-200" : "text-gray-900"}`}>
                                    {item.week_label || `Week ${item.week}, ${monthNames[item.month - 1]} ${item.year}`}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-800"}`}>
                                    W{item.week}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-900"}`}>{monthNames[item.month - 1]} {item.year}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-sm font-black ${darkMode ? "text-rose-400" : "text-red-600"}`}>₱{item.weekLowest?.toFixed(2) || 'N/A'}</span>
                                    <span className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-400"}`}>LP</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-sm font-black ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>₱{item.weekHighest?.toFixed(2) || 'N/A'}</span>
                                    <span className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-400"}`}>HP</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-sm font-black ${darkMode ? "text-green-500" : "text-green-700"}`}>₱{item.weekAverage?.toFixed(2) || 'N/A'}</span>
                                    <span className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-400"}`}>AP</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-24 ${darkMode ? "bg-slate-700" : "bg-gray-200"} rounded-full h-2`}>
                                        <div
                                          className={`h-2 rounded-full ${isComplete ? (darkMode ? "bg-emerald-500" : "bg-green-500") : "bg-yellow-500"}`}
                                          style={{ width: `${item.completeness}%` }}
                                        ></div>
                                      </div>
                                      <span className={`text-xs font-bold ${isComplete ? (darkMode ? "text-emerald-500" : "text-green-600") : "text-yellow-600"}`}>
                                        {item.completeness.toFixed(0)}%
                                      </span>
                                    </div>
                                    <div className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-600"}`}>
                                      {Object.keys(item.commodities).length} / {overviewCommodityFilter === 'all' ? dashboardData.uniqueCommodities.length : 1}
                                    </div>
                                    {!isComplete && (
                                      <div className="text-[10px] text-yellow-600">⚠️ {item.missingCommodities} missing</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs space-y-2 min-w-[200px]">
                                    {Object.entries(item.commodities).map(([commodity, prices]) => (
                                      <div key={commodity} className={`border-l-2 ${darkMode ? "border-green-800" : "border-green-200"} pl-2 py-1`}>
                                        <div className={`font-bold text-[11px] ${darkMode ? "text-slate-200" : "text-gray-900"} mb-1 truncate max-w-[180px]`} title={formatCommodityName(commodity)}>
                                          {formatCommodityName(commodity)}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                          <span className={darkMode ? "text-slate-500" : "text-gray-500"}>LP: <span className={`font-bold ${darkMode ? "text-rose-400" : "text-red-600"}`}>₱{prices.lowest.toFixed(2)}</span></span>
                                          <span className={darkMode ? "text-slate-500" : "text-gray-500"}>HP: <span className={`font-bold ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>₱{prices.highest.toFixed(2)}</span></span>
                                          <span className={darkMode ? "text-slate-500" : "text-gray-500"}>AP: <span className={`font-bold ${darkMode ? "text-green-500" : "text-green-700"}`}>₱{prices.average.toFixed(2)}</span></span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className={`${darkMode ? "bg-slate-800/50" : "bg-gray-50"} px-6 py-4 border-t ${darkMode ? "border-slate-800" : "border-gray-200"}`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Total Weeks:</span>
                          <span className={`ml-2 font-black ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{analyzePriceData.length}</span>
                        </div>
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Avg Weekly Price:</span>
                          <span className={`ml-2 font-black ${darkMode ? "text-green-500" : "text-green-700"}`}>
                            ₱{(analyzePriceData.reduce((sum, item) => sum + (item.weekAverage || 0), 0) / (analyzePriceData.length || 1)).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Complete Weeks:</span>
                          <span className={`ml-2 font-black ${darkMode ? "text-emerald-500" : "text-green-600"}`}>
                            {analyzePriceData.filter(item => item.completeness === 100).length}
                          </span>
                        </div>
                        <div>
                          <span className={darkMode ? "text-slate-500" : "text-gray-600"}>Incomplete:</span>
                          <span className="ml-2 font-black text-yellow-600">
                            {analyzePriceData.filter(item => item.completeness < 100).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TRAINING TAB */}
            {activeTab === 'training' && (
              <div className="space-y-8">
                {modelInfo && modelInfo.models && (
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg p-6 border shadow-sm relative overflow-hidden transition-colors`}>
                    <h3 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"} mb-6 flex items-center gap-2`}>
                      <span>📉</span> Model Performance Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {modelInfo.models.map((model) => (
                        <div key={model.model_key} className={`${darkMode ? "bg-slate-800/50 border-slate-700 hover:border-green-500/30" : "bg-gray-50 border-gray-100 hover:border-green-200"} rounded-xl p-5 border transition-all`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className={`text-[10px] font-black ${darkMode ? "text-slate-500" : "text-gray-500"} uppercase tracking-wider mb-1`}>
                                Global {model.data_type} Model
                              </p>
                              <h4 className={`text-lg font-black ${darkMode ? "text-slate-100" : "text-gray-900"}`}>
                                {model.data_type === 'price' ? '💰 Price Prediction' : '📦 Volume Prediction'}
                              </h4>
                            </div>
                            <div className={`px-2 py-1 rounded text-[10px] font-black ${model.is_loaded 
                              ? (darkMode ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/30' : 'bg-green-100 text-green-700') 
                              : (darkMode ? 'bg-rose-900/30 text-rose-400 border border-rose-800/30' : 'bg-red-100 text-red-700')}`}>
                              {model.is_loaded ? '● Loaded' : '○ Missing'}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className={`${darkMode ? "bg-slate-900/50 border-slate-700" : "bg-white border-gray-100"} p-3 rounded-lg border shadow-sm`}>
                              <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-500"} mb-1`}>Accuracy</p>
                              <p className={`text-2xl font-black ${model.performance?.accuracy > 50 
                                ? (darkMode ? 'text-emerald-400' : 'text-green-600') 
                                : (darkMode ? 'text-amber-400' : 'text-amber-600')}`}>
                                {model.performance?.accuracy ? `${model.performance.accuracy.toFixed(1)}%` : 'N/A'}
                              </p>
                            </div>
                            <div className={`${darkMode ? "bg-slate-900/50 border-slate-700" : "bg-white border-gray-100"} p-3 rounded-lg border shadow-sm`}>
                              <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-500"} mb-1`}>Status</p>
                              <p className={`text-sm font-black ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
                                {model.performance?.accuracy > 70 ? 'Excellent' : model.performance?.accuracy > 50 ? 'Stable' : 'Training Needed'}
                              </p>
                            </div>
                          </div>

                          <div className={`flex items-center gap-2 text-[10px] ${darkMode ? "text-slate-500" : "text-gray-400"} font-black`}>
                            <span className={`w-2 h-2 rounded-full ${darkMode ? "bg-blue-500" : "bg-blue-400"}`}></span>
                            Last Trained: {model.training_date !== 'Unknown'
                              ? new Date(model.training_date).toLocaleDateString() + ' ' + new Date(model.training_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Never'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {modelInfo.total_models === 0 && (
                      <div className={`text-center py-6 ${darkMode ? "text-slate-500" : "text-gray-500"}`}>
                        No global models found. Please upload data and train the system.
                      </div>
                    )}
                  </div>
                )}

                <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg p-6 border shadow-sm transition-colors`}>
                  <h3 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"} mb-6`}>🚀 Train New Models</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? "text-slate-400" : "text-gray-700"} mb-4`}>
                        1. Upload Training Dataset (CSV)
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className={`flex flex-col items-center justify-center w-full h-48 border-2 ${darkMode ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800" : "border-gray-300 bg-gray-50 hover:bg-gray-100"} border-dashed rounded-lg cursor-pointer transition-colors`}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <span className="text-4xl mb-3">📄</span>
                            <p className={`mb-2 text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
                              <span className="font-bold">Click to upload</span> or drag and drop
                            </p>
                            <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-500"}`}>CSV file with: Date, Commodity, Volume, Price</p>
                            {uploadFile && (
                              <div className={`mt-4 px-4 py-2 ${darkMode ? "bg-emerald-900/30 text-emerald-400" : "bg-green-100 text-green-800"} rounded-lg flex items-center gap-2`}>
                                <span className="font-bold">✅ {uploadFile.name}</span>
                              </div>
                            )}
                          </div>
                          <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                        </label>
                      </div>

                      {uploadProgress > 0 && (
                        <div className="mt-4">
                          <div className="flex justify-between mb-1">
                            <span className={`text-xs font-bold ${darkMode ? "text-blue-400" : "text-blue-700"}`}>Uploading...</span>
                            <span className={`text-xs font-bold ${darkMode ? "text-blue-400" : "text-blue-700"}`}>{uploadProgress}%</span>
                          </div>
                          <div className={`w-full ${darkMode ? "bg-slate-800" : "bg-gray-200"} rounded-full h-2`}>
                            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-center space-y-4">
                      <div className={`${darkMode ? "bg-amber-900/10 border-amber-800/50" : "bg-yellow-50 border-yellow-400"} border-l-4 p-4 rounded`}>
                        <div className="flex">
                          <div className="flex-shrink-0">⚠️</div>
                          <div className="ml-3">
                            <p className={`text-sm ${darkMode ? "text-amber-400" : "text-yellow-700"}`}>
                              Training takes about <strong>15-30 minutes</strong>.
                              The system will train models for ALL 18 commodities (Price & Volume).
                              Please do not close this tab while training.
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleUploadAndTrain}
                        disabled={isTraining || !uploadFile}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-4 border border-transparent text-lg font-black rounded-lg text-white shadow-sm transition-all
                          ${isTraining
                            ? (darkMode ? 'bg-slate-800 text-slate-500' : 'bg-gray-400')
                            : !uploadFile
                              ? (darkMode ? 'bg-slate-800 text-slate-600' : 'bg-gray-300')
                              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transform hover:scale-[1.01] active:scale-[0.99] shadow-lg'
                          }`}
                      >
                        {isTraining ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Training in Progress...
                          </>
                        ) : (
                          <><span>🚀</span> Start Training Pipeline</>
                        )}
                      </button>

                      {!uploadFile && (
                        <p className={`text-center text-xs font-bold ${darkMode ? "text-slate-600" : "text-gray-500"}`}>Please upload a CSV file to enable training</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${darkMode ? "bg-slate-900 border-slate-700" : "bg-gray-900 border-gray-700"} rounded-lg shadow-xl overflow-hidden border transition-colors`}>
                  <div className={`${darkMode ? "bg-slate-800" : "bg-gray-800"} px-4 py-3 border-b border-gray-700 flex justify-between items-center`}>
                    <span className="text-gray-300 font-mono text-xs font-bold">🖥️ Training Logs (Live Stream)</span>
                    {isTraining && (
                      <span className="flex items-center gap-2 px-2 py-1 bg-green-900/50 rounded text-green-400 text-[10px] font-black animate-pulse">
                        ● Live
                      </span>
                    )}
                  </div>
                  <div className={`p-4 h-96 overflow-y-auto font-mono text-xs ${darkMode ? "text-blue-400" : "text-green-400"} space-y-1 bg-black/50`}>
                    {trainingLogs.length === 0 ? (
                      <div className="text-gray-600 italic text-center mt-20">Waiting for training to start...</div>
                    ) : (
                      trainingLogs.map((log, index) => (
                        <div key={index} className={`break-words border-l-2 border-transparent hover:border-blue-600 pl-2 py-0.5`}>
                          <span className="opacity-40 mr-2">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                          {log}
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {!isTraining && dashboardData && (
                  <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg p-6 border shadow-sm transition-colors`}>
                    <h3 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"} mb-6 flex items-center gap-2`}>
                      <span>🖼️</span> Model Training Visualizations
                    </h3>
                    <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"} mb-6 italic`}>
                      These plots show how the LSTM models perform on historical data for each commodity.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dashboardData.uniqueCommodities.map(commodity => {
                        const plotName = getBaseCommodityName(commodity).toLowerCase().replace(/\s+/g, '_');
                        return (
                        <div key={commodity} className={`space-y-4 ${darkMode ? "bg-slate-800/50 border-slate-700" : "bg-gray-50 border-gray-100"} p-4 rounded-xl border transition-colors`}>
                          <div className={`text-sm font-black ${darkMode ? "text-slate-300" : "text-gray-700"} pb-2 border-b ${darkMode ? "border-slate-700" : "border-gray-200"} mb-2`}>{formatCommodityName(commodity)}</div>

                          <div className={`border ${darkMode ? "border-slate-700" : "border-gray-200"} rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all bg-white`}>
                            <div className={`${darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"} px-3 py-1 text-[10px] font-black uppercase`}>Price Model</div>
                            <img
                              src={`${API_BASE_URL}/plots/global_model_${plotName}_price_training.png`}
                              alt={`${commodity} Price`}
                              className={`w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity ${darkMode ? "invert opacity-80" : ""}`}
                              onError={(e) => {
                                const currentSrc = e.target.src;
                                if (currentSrc.includes('global_model_')) {
                                  e.target.src = `${API_BASE_URL}/plots/${plotName}_price_training.png`;
                                } else {
                                  e.target.parentElement.style.display = 'none';
                                }
                              }}
                              onClick={(e) => window.open(e.target.src, '_blank')}
                            />
                          </div>

                          <div className={`border ${darkMode ? "border-slate-700" : "border-gray-200"} rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all bg-white`}>
                            <div className={`${darkMode ? "bg-emerald-900/30 text-emerald-400" : "bg-green-50 text-green-600"} px-3 py-1 text-[10px] font-black uppercase`}>Volume Model</div>
                            <img
                              src={`${API_BASE_URL}/plots/${plotName}_volume_training.png`}
                              alt={`${commodity} Volume`}
                              className={`w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity ${darkMode ? "invert opacity-80" : ""}`}
                              onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                              onClick={(e) => window.open(e.target.src, '_blank')}
                            />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* COMMODITY TAB */}
            {activeTab === 'commodity' && (
              <div className="space-y-6">
                <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg p-6 border shadow-sm transition-colors`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Commodity Deep-Dive</h3>
                      <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Detailed price and volume analysis for specific commodities</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase`}>Commodity:</label>
                        <select
                          value={chartCommodity}
                          onChange={(e) => setChartCommodity(e.target.value)}
                          className={`text-sm rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
                        >
                          {dashboardData?.uniqueCommodities?.map(c => (
                            <option key={c} value={c}>{formatCommodityName(c)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase`}>Month:</label>
                        <select
                          value={selectedChartMonth}
                          onChange={(e) => setSelectedChartMonth(e.target.value)}
                          className={`text-sm rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
                        >
                          <option value="all">All Months (Overview)</option>
                          {MONTH_NAMES_FULL.map((month, idx) => (
                            <option key={idx + 1} value={idx + 1}>{month}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase`}>Year:</label>
                        <select
                          value={chartYearFilter}
                          onChange={(e) => setChartYearFilter(e.target.value)}
                          className={`text-sm rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
                        >
                          <option value="all">All Years</option>
                          {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                    <div className={`${darkMode ? "bg-slate-800/50 border-slate-700 shadow-lg" : "bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 shadow-sm"} rounded-xl p-5 border relative overflow-hidden transition-all`}>
                      <div className={`absolute top-0 right-0 p-4 text-4xl opacity-10 ${darkMode ? "text-green-400" : "text-green-600"}`}>📈</div>
                      <h4 className={`text-xs font-black ${darkMode ? "text-slate-400" : "text-green-800"} uppercase tracking-wider mb-2`}>Market Sentiment</h4>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-3xl font-black ${darkMode ? "text-green-400" : "text-green-700"}`}>
                          {sentimentData?.score?.toFixed(1) || '0.0'}
                        </span>
                        <span className={`text-xs font-bold ${darkMode ? "text-slate-500" : "text-green-600 opacity-60"}`}>/ 100</span>
                      </div>
                      <p className={`text-sm font-black ${darkMode ? "text-slate-300" : "text-gray-900"}`}>{sentimentData?.label || 'Calculating...'}</p>
                      <div className={`mt-3 pt-3 border-t ${darkMode ? "border-slate-700" : "border-green-200/50"} text-[10px] ${darkMode ? "text-slate-500" : "text-green-800/60"} font-bold`}>
                        Based on price volatility & liquidity
                      </div>
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className={`${darkMode ? "bg-slate-800/30 border-slate-700" : "bg-white border-gray-100"} rounded-xl p-4 border transition-colors`}>
                        <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-500"} uppercase font-black mb-1`}>Total Volume</p>
                        <p className={`text-xl font-black ${darkMode ? "text-slate-200" : "text-gray-900"}`}>
                          {dashboardData?.commodityDetails?.[chartCommodity]?.total_volume?.toLocaleString()} <span className="text-xs font-normal">MT</span>
                        </p>
                      </div>
                      <div className={`${darkMode ? "bg-slate-800/30 border-slate-700" : "bg-white border-gray-100"} rounded-xl p-4 border transition-colors`}>
                        <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-500"} uppercase font-black mb-1`}>Average Price</p>
                        <p className={`text-xl font-black ${darkMode ? "text-emerald-500" : "text-emerald-600"}`}>
                          ₱{dashboardData?.commodityDetails?.[chartCommodity]?.avg_price?.toFixed(2)}
                        </p>
                      </div>
                      <div className={`${darkMode ? "bg-slate-800/30 border-slate-700" : "bg-white border-gray-100"} rounded-xl p-4 border transition-colors`}>
                        <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-gray-500"} uppercase font-black mb-1`}>Data Points</p>
                        <p className={`text-xl font-black ${darkMode ? "text-slate-200" : "text-gray-900"}`}>
                          {dashboardData?.commodityDetails?.[chartCommodity]?.count} weeks
                        </p>
                      </div>
                      <div className={`${darkMode ? "bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-700/50" : "bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200"} rounded-xl p-4 border transition-all relative overflow-hidden`}>
                        <div className={`absolute top-0 right-0 p-3 text-3xl opacity-10 ${darkMode ? "text-blue-400" : "text-blue-600"}`}>🔮</div>
                        <p className={`text-[10px] ${darkMode ? "text-blue-400" : "text-blue-700"} uppercase font-black mb-1`}>Projected Next Month</p>
                        {projectedVolumeLoading ? (
                          <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Loading...</p>
                        ) : projectedVolume ? (
                          <>
                            <p className={`text-xl font-black ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                              {projectedVolume.total.toFixed(0)} <span className="text-xs font-normal">Kg</span>
                            </p>
                            <div className={`mt-2 flex items-center gap-1 text-xs font-bold ${projectedVolume.trend >= 0 ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-red-400' : 'text-red-600')}`}>
                              <span>{projectedVolume.trend >= 0 ? '↑' : '↓'}</span>
                              <span>{Math.abs(projectedVolume.trend).toFixed(1)}% vs current</span>
                            </div>
                          </>
                        ) : (
                          <p className={`text-xs ${darkMode ? "text-slate-500" : "text-gray-500"}`}>No volume data</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg shadow-md p-6 transition-colors`}>
                  <h4 className={`text-sm font-black ${darkMode ? "text-slate-400" : "text-gray-700"} uppercase mb-4`}>Volume Trends</h4>
                  {volumeChart.series.length > 0 ? (
                    <ReactApexChart options={volumeChart.options} series={volumeChart.series} type="bar" height={300} />
                  ) : (
                    <div className={`text-center py-12 ${darkMode ? "text-slate-500" : "text-gray-500"}`}>No data available</div>
                  )}
                </div>
                <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg shadow-md p-6 transition-colors`}>
                  <h4 className={`text-sm font-black ${darkMode ? "text-slate-400" : "text-gray-700"} uppercase mb-4`}>Price Volatility</h4>
                  {priceChart.series.length > 0 ? (
                    <ReactApexChart options={priceChart.options} series={priceChart.series} type="bar" height={300} />
                  ) : (
                    <div className={`text-center py-12 ${darkMode ? "text-slate-500" : "text-gray-500"}`}>No data available</div>
                  )}
                </div>

                <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border p-6 transition-colors`}>
                  <h4 className={`text-sm font-black ${darkMode ? "text-slate-400" : "text-gray-700"} uppercase mb-4`}>Volume vs Price Correlation</h4>
                  <ReactApexChart options={mixedChart.options} series={mixedChart.series} type="line" height={400} />
                </div>

                <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border p-6 transition-colors`}>
                  <h4 className={`text-sm font-black ${darkMode ? "text-slate-400" : "text-gray-700"} uppercase mb-4`}>Weekly Distribution</h4>
                  <ReactApexChart options={stackedChart.options} series={stackedChart.series} type="bar" height={350} />
                </div>
              </div>
            )}

            {/* COMPARISON TAB */}
            {activeTab === 'comparison' && (
              <div className="space-y-6">
                <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg p-6 border shadow-sm transition-colors`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Year-over-Year Comparison</h3>
                      <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Compare monthly averages across all years for a single commodity</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase`}>Data Type:</label>
                        <select
                          value={comparisonDataType}
                          onChange={(e) => setComparisonDataType(e.target.value)}
                          className={`text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2 outline-none transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-300 text-gray-700"}`}
                        >
                          <option value="price">💰 Price (₱/Kg)</option>
                          <option value="volume">📦 Volume (Kg)</option>
                        </select>
                      </div>
                      <button
                        onClick={() => setComparisonCommodities([])}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-bold"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className={`block text-xs font-black ${darkMode ? "text-slate-500" : "text-gray-500"} uppercase tracking-wider mb-3`}>
                      Select a Commodity
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {dashboardData?.uniqueCommodities?.map(commodity => {
                        const isSelected = comparisonCommodities[0] === commodity;
                        return (
                          <button
                            key={commodity}
                            onClick={() => setComparisonCommodities([commodity])}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                              ${isSelected
                                ? (darkMode ? 'bg-green-600 border-green-500 text-white shadow-lg' : 'bg-green-600 border-green-600 text-white shadow-md')
                                : (darkMode
                                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300')
                              }`}
                          >
                            {formatCommodityName(commodity)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {comparisonCommodities.length > 0 && (() => {
                  const commodity = comparisonCommodities[0];
                  const baseCommodity = getBaseCommodityName(commodity);
                  const sourceData = comparisonDataType === 'volume' ? dashboardData.volume_data : dashboardData.price_data;
                  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                  const years = [...new Set(
                    sourceData.filter(d => getBaseCommodityName(d.commodity) === baseCommodity).map(d => d.year)
                  )].sort();

                  const tableData = monthNames.map((month, mi) => {
                    const row = { month };
                    years.forEach(year => {
                      const rows = sourceData.filter(d =>
                        getBaseCommodityName(d.commodity) === baseCommodity &&
                        d.year === year && d.month === mi + 1
                      );
                      const vals = rows.map(d => comparisonDataType === 'volume' ? d.volume : d.average_price).filter(v => v != null);
                      row[year] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
                    });
                    return row;
                  });

                  return (
                    <>
                      {/* Bar Chart */}
                      <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border p-6 transition-colors`}>
                        <ReactApexChart options={multiBarChart.options} series={multiBarChart.series} type="bar" height={420} />
                      </div>

                      {/* Line Chart */}
                      <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border p-6 transition-colors`}>
                        <ReactApexChart options={trendLineChart.options} series={trendLineChart.series} type="line" height={420} />
                      </div>

                      {/* Monthly Data Table */}
                      <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border overflow-hidden transition-colors`}>
                        <div className={`px-6 py-4 border-b ${darkMode ? "border-slate-800" : "border-gray-200"}`}>
                          <h4 className={`font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                            Monthly Average {comparisonDataType === 'price' ? 'Prices (₱/Kg)' : 'Volume (Kg)'} — {commodity}
                          </h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className={`min-w-full divide-y ${darkMode ? "divide-slate-800" : "divide-gray-200"}`}>
                            <thead className={darkMode ? "bg-slate-800" : "bg-gray-50"}>
                              <tr>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Month</th>
                                {years.map(y => (
                                  <th key={y} className={`px-4 py-3 text-center text-xs font-bold uppercase ${darkMode ? "text-slate-400" : "text-gray-500"}`}>{y}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className={`divide-y ${darkMode ? "divide-slate-800 bg-slate-900" : "divide-gray-100 bg-white"}`}>
                              {tableData.map((row, i) => (
                                <tr key={i} className={darkMode ? "hover:bg-slate-800/50" : "hover:bg-gray-50"}>
                                  <td className={`px-4 py-2 text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-900"}`}>{row.month}</td>
                                  {years.map(y => (
                                    <td key={y} className={`px-4 py-2 text-sm text-center ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
                                      {row[y] != null ? (comparisonDataType === 'price' ? `₱${row[y]}` : row[y]) : '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {comparisonCommodities.length === 0 && (
                  <div className={`${darkMode ? "bg-slate-800/50 text-slate-400" : "bg-gray-50 text-gray-600"} text-center py-12 rounded-lg`}>
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className={`text-xl font-semibold ${darkMode ? "text-white" : "text-gray-900"} mb-2`}>Select a Commodity</h3>
                    <p className={`${darkMode ? "text-slate-400" : "text-gray-600"}`}>Pick a commodity above to see its year-over-year comparison</p>
                  </div>
                )}
              </div>
            )}

            {/* FORECAST TAB */}
            {activeTab === 'forecast' && (
              <div>
                {forecastResult ? (
                  <div className="space-y-6">
                    <div className="flex gap-2">
                      <button
                        onClick={exportForecastToCSV}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold shadow-md transform hover:scale-[1.02] transition-all"
                      >
                        <span>📥</span>
                        <span>Export CSV</span>
                      </button>
                    </div>

                    <div className={`${darkMode ? "bg-blue-900/10 border-blue-900/30" : "bg-blue-50 border-blue-200"} rounded-lg p-6 border transition-colors`}>
                      <h3 className={`text-lg font-black ${darkMode ? "text-blue-400" : "text-gray-900"} mb-4`}>📈 Performance Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {forecastResult.metrics.rmse !== undefined && (
                          <div className={`${darkMode ? "bg-slate-900/50 border-white/5" : "bg-white border-gray-100"} p-3 rounded-lg border`}>
                            <p className={`text-[10px] uppercase font-black ${darkMode ? "text-slate-500" : "text-gray-600"}`}>RMSE</p>
                            <p className={`text-xl font-black ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{forecastResult.metrics.rmse.toFixed(2)}</p>
                          </div>
                        )}
                        {forecastResult.metrics.mae !== undefined && (
                          <div className={`${darkMode ? "bg-slate-900/50 border-white/5" : "bg-white border-gray-100"} p-3 rounded-lg border`}>
                            <p className={`text-[10px] uppercase font-black ${darkMode ? "text-slate-500" : "text-gray-600"}`}>MAE</p>
                            <p className={`text-xl font-black ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{forecastResult.metrics.mae.toFixed(2)}</p>
                          </div>
                        )}
                        {forecastResult.metrics.mape !== undefined && (
                          <div className={`${darkMode ? "bg-slate-900/50 border-white/5" : "bg-white border-gray-100"} p-3 rounded-lg border`}>
                            <p className={`text-[10px] uppercase font-black ${darkMode ? "text-slate-500" : "text-gray-600"}`}>MAPE</p>
                            <p className={`text-xl font-black ${darkMode ? "text-slate-200" : "text-gray-900"}`}>{forecastResult.metrics.mape.toFixed(2)}%</p>
                          </div>
                        )}
                        {forecastResult.metrics.accuracy !== undefined && (
                          <div className={`${darkMode ? "bg-slate-900/50 border-white/5" : "bg-white border-gray-100"} p-3 rounded-lg border`}>
                            <p className={`text-[10px] uppercase font-black ${darkMode ? "text-slate-500" : "text-gray-600"}`}>Accuracy</p>
                            <p className={`text-xl font-black ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>{forecastResult.metrics.accuracy?.toFixed(1)}%</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border p-6 transition-colors shadow-sm`}>
                      <ReactApexChart options={forecastChart.options} series={forecastChart.series} type="line" height={400} />
                    </div>

                    <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} rounded-lg border overflow-hidden transition-colors`}>
                      <table className={`min-w-full divide-y ${darkMode ? "divide-slate-800" : "divide-gray-200"}`}>
                        <thead className={darkMode ? "bg-slate-800/50" : "bg-gray-50"}>
                          <tr>
                            <th className={`px-6 py-3 text-left text-xs font-black ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Period</th>
                            <th className={`px-6 py-3 text-left text-xs font-black ${darkMode ? "text-slate-400" : "text-gray-500"} uppercase tracking-wider`}>Forecasted Value</th>
                          </tr>
                        </thead>
                        <tbody className={`${darkMode ? "bg-slate-900" : "bg-white"} divide-y ${darkMode ? "divide-slate-800" : "divide-gray-200"}`}>
                          {forecastResult.forecast_data.filter(item => item.week !== 5).map((item, idx) => (
                            <tr key={idx} className={`${darkMode ? "hover:bg-slate-800/50" : "hover:bg-gray-50"} transition-colors`}>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-900"}`}>
                                {formatPeriod(item, forecastResult.forecast_mode || 'weekly')}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm font-black ${darkMode ? "text-green-400" : "text-green-700"}`}>
                                {forecastResult.data_type === 'volume'
                                  ? (item.value / 1000).toFixed(4) + ' MT'
                                  : '₱' + item.value.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className={`${darkMode ? "bg-slate-800/50 text-slate-400" : "bg-gray-50 text-gray-600"} text-center py-12 rounded-lg`}>
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className={`text-xl font-semibold ${darkMode ? "text-white" : "text-gray-900"} mb-2`}>No Forecast Generated Yet</h3>
                    <p className={`${darkMode ? "text-slate-400" : "text-gray-600"}`}>Select forecast parameters and click "Generate" to see predictions</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;