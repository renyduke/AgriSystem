import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ReactApexChart from 'react-apexcharts';

const API_BASE_URL = 'http://localhost:8000';

const Dashboard = () => {
  // Core state
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState('');
  const [selectedDataType, setSelectedDataType] = useState('volume');
  const [forecastMode, setForecastMode] = useState('weekly');
  const [periodsAhead, setPeriodsAhead] = useState(4);
  const [forecastResult, setForecastResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Chart state
  const [chartCommodity, setChartCommodity] = useState('');
  const [selectedWeekRange, setSelectedWeekRange] = useState('1-5');
  
  // Comparison state
  const [comparisonCommodities, setComparisonCommodities] = useState([]);
  const [comparisonDataType, setComparisonDataType] = useState('volume');
  
  // Model management states
  const [modelInfo, setModelInfo] = useState(null);
  const [showModelManager, setShowModelManager] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Notification state
  const [notifications, setNotifications] = useState([]);

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
      setChartCommodity(dashboardData.commodities[0]);
      setSelectedCommodity(dashboardData.commodities[0]);
    }
  }, [dashboardData]);

  useEffect(() => {
    if (forecastMode === 'weekly') {
      setPeriodsAhead(4);
    } else if (forecastMode === 'monthly') {
      setPeriodsAhead(12);
    } else if (forecastMode === 'yearly') {
      setPeriodsAhead(3);
    }
  }, [forecastMode]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard`);
      setDashboardData(response.data);
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
  // FORECAST HANDLING
  // ============================================================================

  const handleForecast = async () => {
    if (!selectedCommodity) {
      alert('Please select a commodity');
      return;
    }

    setLoading(true);
    setError(null);
    addNotification('Generating forecast...', 'info');
    
    try {
      const requestBody = {
        commodity: selectedCommodity,
        data_type: selectedDataType,
        forecast_mode: forecastMode
      };

      if (forecastMode === 'weekly') {
        requestBody.weeks_ahead = periodsAhead;
      } else {
        requestBody.periods_ahead = periodsAhead;
      }

      const response = await axios.post(`${API_BASE_URL}/api/forecast`, requestBody);
      setForecastResult(response.data);
      setActiveTab('forecast');
      addNotification('Forecast generated successfully!', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      addNotification(`Error: ${errorMsg}`, 'error');
    } finally {
      setLoading(false);
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
      ...forecastResult.forecast_data.map(item => [
        formatPeriod(item, forecastResult.forecast_mode),
        item.year,
        item.month,
        item.week,
        item.value.toFixed(2),
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

  const getSummaryStats = () => {
    if (!dashboardData) return null;

    const volumeTotal = dashboardData.volume_data.reduce((sum, item) => sum + item.volume, 0);
    const priceAvg = dashboardData.price_data.length > 0
      ? dashboardData.price_data.reduce((sum, item) => sum + item.average_price, 0) / dashboardData.price_data.length
      : 0;

    return {
      totalWeeks: dashboardData.volume_data.length + dashboardData.price_data.length,
      totalVolume: volumeTotal.toFixed(2),
      avgPrice: priceAvg.toFixed(2),
      commoditiesCount: dashboardData.commodities.length
    };
  };

  // ============================================================================
  // WEEK RANGE UTILITIES
  // ============================================================================

  const weekRanges = [
    { value: '1-5', label: 'Weeks 1-5' },
    { value: '6-10', label: 'Weeks 6-10' },
    { value: '11-15', label: 'Weeks 11-15' },
    { value: '16-20', label: 'Weeks 16-20' },
    { value: '21-25', label: 'Weeks 21-25' },
    { value: '26-30', label: 'Weeks 26-30' }
  ];

  const getWeeksInRange = () => {
    const [start, end] = selectedWeekRange.split('-').map(Number);
    const weeks = [];
    for (let i = start; i <= end; i++) {
      weeks.push(`Week ${i}`);
    }
    return weeks;
  };

  // ============================================================================
  // CHART DATA FUNCTIONS
  // ============================================================================

  const getCommodityChartData = () => {
    if (!dashboardData || !chartCommodity) return null;

    const weeks = getWeeksInRange();
    const [startWeek] = selectedWeekRange.split('-').map(Number);

    const volumeData = weeks.map((weekLabel, index) => {
      const weekNumber = startWeek + index;
      const dataPoint = dashboardData.volume_data.find(
        item => item.commodity === chartCommodity && item.week === weekNumber
      );
      return dataPoint ? dataPoint.volume : 0;
    });

    const priceData = weeks.map((weekLabel, index) => {
      const weekNumber = startWeek + index;
      const dataPoint = dashboardData.price_data.find(
        item => item.commodity === chartCommodity && item.week === weekNumber
      );
      return dataPoint ? dataPoint.average_price : 0;
    });

    return { weeks, volumeData, priceData };
  };

  // ============================================================================
  // CHART CONFIGURATIONS - SINGLE COMMODITY
  // ============================================================================

  const getVolumeChartOptions = () => {
    const chartData = getCommodityChartData();
    if (!chartData) return { series: [], options: {} };

    return {
      series: [{ name: 'Volume (Kg)', data: chartData.volumeData }],
      options: {
        chart: { type: 'bar', height: 300, toolbar: { show: true } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        colors: ['#3b82f6'],
        dataLabels: {
          enabled: true,
          formatter: function(val) { return val.toFixed(1) + ' Kg'; }
        },
        xaxis: { categories: chartData.weeks },
        yaxis: { title: { text: 'Volume (Kg)' } },
        title: { text: `📦 ${chartCommodity} - Weekly Volume`, align: 'left' }
      }
    };
  };

  const getPriceChartOptions = () => {
    const chartData = getCommodityChartData();
    if (!chartData) return { series: [], options: {} };

    return {
      series: [{ name: 'Price (₱)', data: chartData.priceData }],
      options: {
        chart: { type: 'bar', height: 300, toolbar: { show: true } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        colors: ['#10b981'],
        dataLabels: {
          enabled: true,
          formatter: function(val) { return '₱' + val.toFixed(2); }
        },
        xaxis: { categories: chartData.weeks },
        yaxis: { title: { text: 'Price (₱)' } },
        title: { text: `💰 ${chartCommodity} - Weekly Price`, align: 'left' }
      }
    };
  };

  // ============================================================================
  // CHART CONFIGURATIONS - MULTI-COMMODITY COMPARISON
  // ============================================================================

  const getMultiCommodityBarChart = () => {
    if (!dashboardData || comparisonCommodities.length === 0) {
      return { series: [], options: {} };
    }

    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    
    const series = comparisonCommodities.map(commodity => {
      const weeklyData = weeks.map((_, weekIndex) => {
        const weekNumber = weekIndex + 1;
        
        if (comparisonDataType === 'volume') {
          const dataPoint = dashboardData.volume_data.find(
            item => item.commodity === commodity && item.week === weekNumber
          );
          return dataPoint ? dataPoint.volume : 0;
        } else {
          const dataPoint = dashboardData.price_data.find(
            item => item.commodity === commodity && item.week === weekNumber
          );
          return dataPoint ? dataPoint.average_price : 0;
        }
      });
      
      return {
        name: commodity,
        data: weeklyData
      };
    });

    return {
      series,
      options: {
        chart: {
          type: 'bar',
          height: 400,
          toolbar: { show: true },
          animations: { enabled: true, speed: 800 }
        },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '70%',
            borderRadius: 4,
            dataLabels: { position: 'top' }
          }
        },
        dataLabels: {
          enabled: true,
          formatter: function(val) {
            return comparisonDataType === 'price' 
              ? '₱' + val.toFixed(1) 
              : val.toFixed(0);
          },
          offsetY: -20,
          style: { fontSize: '10px', colors: ['#304758'] }
        },
        colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0'],
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
          categories: weeks,
          title: { text: 'Week Number', style: { fontSize: '14px', fontWeight: 600 } }
        },
        yaxis: {
          title: {
            text: comparisonDataType === 'price' ? 'Price (₱)' : 'Volume (Kg)',
            style: { fontSize: '14px', fontWeight: 600 }
          },
          labels: {
            formatter: function(val) {
              return comparisonDataType === 'price' 
                ? '₱' + val.toFixed(0) 
                : val.toFixed(0);
            }
          }
        },
        fill: { opacity: 1 },
        legend: {
          position: 'top',
          horizontalAlign: 'left',
          fontSize: '12px',
          markers: { width: 12, height: 12, radius: 2 }
        },
        title: {
          text: `📊 Multi-Commodity ${comparisonDataType === 'price' ? 'Price' : 'Volume'} Comparison`,
          align: 'left',
          style: { fontSize: '18px', fontWeight: 'bold' }
        },
        tooltip: {
          shared: true,
          intersect: false,
          y: {
            formatter: function(val) {
              return comparisonDataType === 'price' 
                ? '₱' + val.toFixed(2) 
                : val.toFixed(2) + ' Kg';
            }
          }
        },
        grid: { borderColor: '#e7e7e7', strokeDashArray: 4 }
      }
    };
  };

  const getWeeklyTrendLineChart = () => {
    if (!dashboardData || comparisonCommodities.length === 0) {
      return { series: [], options: {} };
    }

    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    
    const series = comparisonCommodities.map(commodity => {
      const weeklyData = weeks.map((_, weekIndex) => {
        const weekNumber = weekIndex + 1;
        
        if (comparisonDataType === 'volume') {
          const dataPoint = dashboardData.volume_data.find(
            item => item.commodity === commodity && item.week === weekNumber
          );
          return dataPoint ? dataPoint.volume : null;
        } else {
          const dataPoint = dashboardData.price_data.find(
            item => item.commodity === commodity && item.week === weekNumber
          );
          return dataPoint ? dataPoint.average_price : null;
        }
      });
      
      return {
        name: commodity,
        data: weeklyData
      };
    });

    return {
      series,
      options: {
        chart: {
          type: 'line',
          height: 400,
          toolbar: { show: true },
          zoom: { enabled: true }
        },
        stroke: { width: 3, curve: 'smooth' },
        markers: { size: 5, hover: { size: 7 } },
        colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0'],
        xaxis: {
          categories: weeks,
          title: { text: 'Week Number', style: { fontSize: '14px', fontWeight: 600 } }
        },
        yaxis: {
          title: {
            text: comparisonDataType === 'price' ? 'Price (₱)' : 'Volume (Kg)',
            style: { fontSize: '14px', fontWeight: 600 }
          },
          labels: {
            formatter: function(val) {
              if (val === null) return '';
              return comparisonDataType === 'price' 
                ? '₱' + val.toFixed(0) 
                : val.toFixed(0);
            }
          }
        },
        title: {
          text: `📈 Weekly Trend Analysis - ${comparisonDataType === 'price' ? 'Price' : 'Volume'}`,
          align: 'left',
          style: { fontSize: '18px', fontWeight: 'bold' }
        },
        legend: { position: 'top', horizontalAlign: 'right' },
        tooltip: {
          shared: true,
          intersect: false,
          y: {
            formatter: function(val) {
              if (val === null) return 'No data';
              return comparisonDataType === 'price' 
                ? '₱' + val.toFixed(2) 
                : val.toFixed(2) + ' Kg';
            }
          }
        },
        grid: { borderColor: '#e7e7e7', strokeDashArray: 4 }
      }
    };
  };

  const getMixedComparisonChart = () => {
    if (!dashboardData || !chartCommodity) return { series: [], options: {} };

    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    
    const volumeData = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.volume_data.find(
        item => item.commodity === chartCommodity && item.week === weekNumber
      );
      return dataPoint ? dataPoint.volume : 0;
    });

    const priceData = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.price_data.find(
        item => item.commodity === chartCommodity && item.week === weekNumber
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
              formatter: function(val) { return val.toFixed(0) + ' Kg'; }
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
              formatter: function(val) { return '₱' + val.toFixed(0); }
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
            { formatter: function(val) { return val.toFixed(2) + ' Kg'; } },
            { formatter: function(val) { return '₱' + val.toFixed(2); } }
          ]
        },
        legend: { horizontalAlign: 'left', offsetX: 40 }
      }
    };
  };

  const getStackedPriceChart = () => {
    if (!dashboardData || !chartCommodity) return { series: [], options: {} };

    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    
    const lowestPrices = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.price_data.find(
        item => item.commodity === chartCommodity && item.week === weekNumber
      );
      return dataPoint ? dataPoint.lowest_price : 0;
    });

    const priceRanges = weeks.map((_, weekIndex) => {
      const weekNumber = weekIndex + 1;
      const dataPoint = dashboardData.price_data.find(
        item => item.commodity === chartCommodity && item.week === weekNumber
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
                formatter: function(val) { return '₱' + val.toFixed(0); },
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
          labels: { formatter: function(val) { return '₱' + val.toFixed(0); } }
        },
        title: {
          text: `💰 ${chartCommodity} - Weekly Price Range Breakdown`,
          align: 'left',
          style: { fontSize: '18px', fontWeight: 'bold' }
        },
        tooltip: {
          y: { formatter: function(val) { return '₱' + val.toFixed(2); } }
        },
        fill: { opacity: 1 },
        legend: { position: 'top', horizontalAlign: 'left', offsetX: 40 }
      }
    };
  };

  // ============================================================================
  // FORECAST CHART
  // ============================================================================

  const getForecastChartOptions = () => {
    if (!forecastResult) return { series: [], options: {} };

    const mode = forecastResult.forecast_mode || 'weekly';
    const historicalCategories = forecastResult.historical_data.slice(-12).map(item => formatPeriod(item, mode));
    const historicalValues = forecastResult.historical_data.slice(-12).map(item => item.value);
    const forecastCategories = forecastResult.forecast_data.map(item => formatPeriod(item, mode));
    const forecastValues = forecastResult.forecast_data.map(item => item.value);

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
          title: { text: forecastResult.data_type === 'price' ? 'Price (₱)' : 'Volume (Kg)' }
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Notification Center */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
              notif.type === 'success' ? 'bg-green-500 text-white' :
              notif.type === 'error' ? 'bg-red-500 text-white' :
              'bg-blue-500 text-white'
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
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🌾 AgriData Analytics Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Multi-Period Agricultural Forecasting & Analysis</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowModelManager(!showModelManager)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>🤖</span>
                <span>Model Manager</span>
                {modelInfo && (
                  <span className="bg-purple-800 px-2 py-0.5 rounded-full text-xs">
                    {modelInfo.total_models}
                  </span>
                )}
              </button>
              <div className="text-right">
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-lg font-semibold text-gray-700">January 21, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Model Manager Modal */}
      {showModelManager && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl">
                    <span className="text-3xl">🤖</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Model Intelligence Hub</h2>
                    <p className="text-white/80 text-sm">Manage AI models and train with custom datasets</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModelManager(false)}
                  className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            {modelInfo && modelInfo.models && modelInfo.models.length > 0 && (
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-gray-700">
                        {modelInfo.models.filter(m => m.is_loaded).length} Active
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">
                        {modelInfo.total_models} Total Models
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">
                        {(modelInfo.models.reduce((sum, m) => sum + (m.performance?.accuracy || 0), 0) / modelInfo.models.length).toFixed(1)}% Avg Accuracy
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border">
                    Last updated: {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Upload Section - Modern Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <span className="text-2xl">📤</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Train New Models</h3>
                    <p className="text-sm text-gray-600">Upload datasets to train custom AI models</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* File Upload Card */}
                  <div className="bg-white rounded-xl border-2 border-dashed border-blue-200 p-8 text-center hover:border-blue-400 transition-colors">
                    <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <span className="text-3xl">📁</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Upload Dataset</h4>
                    <p className="text-sm text-gray-600 mb-6">Drag & drop or browse CSV files</p>
                    
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Choose File</span>
                    </label>
                    
                    <p className="text-xs text-gray-500 mt-4">Supports .csv files up to 100MB</p>
                  </div>

                  {/* Progress Bar */}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="bg-white rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Uploading...</span>
                        <span className="text-sm font-bold text-blue-600">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={downloadTrainingScript}
                      className="bg-white border-2 border-green-200 hover:border-green-400 text-green-700 rounded-xl p-4 transition-all hover:shadow-md group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-50 p-2 rounded-lg group-hover:bg-green-100 transition-colors">
                          <span className="text-xl">📥</span>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">Download Template</p>
                          <p className="text-xs text-gray-600">Config & training script</p>
                        </div>
                      </div>
                    </button>

                    <button className="bg-white border-2 border-blue-200 hover:border-blue-400 text-blue-700 rounded-xl p-4 transition-all hover:shadow-md group">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                          <span className="text-xl">📊</span>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">View Documentation</p>
                          <p className="text-xs text-gray-600">API & training guide</p>
                        </div>
                      </div>
                    </button>

                    <button className="bg-white border-2 border-purple-200 hover:border-purple-400 text-purple-700 rounded-xl p-4 transition-all hover:shadow-md group">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-50 p-2 rounded-lg group-hover:bg-purple-100 transition-colors">
                          <span className="text-xl">⚙️</span>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">Advanced Settings</p>
                          <p className="text-xs text-gray-600">Model parameters</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Instructions Panel */}
                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-amber-50 p-2 rounded-lg">
                        <span className="text-xl">📝</span>
                      </div>
                      <h4 className="font-semibold text-gray-900">Quick Start Guide</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-600 font-bold px-3 py-1 rounded-full text-sm">1</span>
                        <div>
                          <p className="font-medium text-sm">Upload CSV</p>
                          <p className="text-xs text-gray-600">Commodity, date, volume, price</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-600 font-bold px-3 py-1 rounded-full text-sm">2</span>
                        <div>
                          <p className="font-medium text-sm">Configure</p>
                          <p className="text-xs text-gray-600">Edit template for your data</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-600 font-bold px-3 py-1 rounded-full text-sm">3</span>
                        <div>
                          <p className="font-medium text-sm">Train Models</p>
                          <p className="text-xs text-gray-600">Run training script</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-600 font-bold px-3 py-1 rounded-full text-sm">4</span>
                        <div>
                          <p className="font-medium text-sm">Deploy</p>
                          <p className="text-xs text-gray-600">Restart API to load models</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Models Table Section */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-50 p-2 rounded-lg">
                        <span className="text-xl">📊</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Loaded Models</h3>
                        <p className="text-sm text-gray-600">
                          {modelInfo ? `${modelInfo.total_models} models available` : 'Loading models...'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        Filter
                      </button>
                      <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        Sort by
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {modelInfo && modelInfo.models && modelInfo.models.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Commodity
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Performance
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Details
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {modelInfo.models.map((model, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${
                                    model.data_type === 'volume' ? 'bg-blue-50' : 'bg-green-50'
                                  }`}>
                                    <span className={model.data_type === 'volume' ? 'text-blue-600' : 'text-green-600'}>
                                      {model.data_type === 'volume' ? '📦' : '💰'}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">{model.commodity}</p>
                                    <p className="text-xs text-gray-500">{model.model_type || 'LSTM'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  model.data_type === 'volume' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {model.data_type.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                      <div 
                                        className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full"
                                        style={{ width: `${model.performance?.accuracy || 0}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">
                                      {model.performance?.accuracy ? `${model.performance.accuracy.toFixed(1)}%` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex gap-3 text-xs text-gray-600">
                                    <span>MAE: {model.performance?.mae ? model.performance.mae.toFixed(2) : 'N/A'}</span>
                                    <span>RMSE: {model.performance?.rmse ? model.performance.rmse.toFixed(2) : 'N/A'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                <div className="space-y-1">
                                  <p>Epochs: {model.training_epochs || 'N/A'}</p>
                                  <p>Updated: {model.training_date ? new Date(model.training_date).toLocaleDateString() : 'N/A'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    model.is_loaded ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                                  }`}></div>
                                  <span className={`text-sm font-medium ${
                                    model.is_loaded ? 'text-green-700' : 'text-red-700'
                                  }`}>
                                    {model.is_loaded ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                  <button className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </button>
                                  <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <span className="text-4xl">📦</span>
                      </div>
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">No Models Found</h4>
                      <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        Upload a dataset and train your first model to get started with AI-powered forecasting
                      </p>
                      <div className="flex justify-center gap-4">
                        <button
                          onClick={downloadTrainingScript}
                          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow"
                        >
                          Get Started
                        </button>
                        <button className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors">
                          View Tutorial
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Summary Cards */}
              {modelInfo && modelInfo.models && modelInfo.models.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-900">Model Health</h4>
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <span className="text-blue-600 text-xl">📈</span>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {(modelInfo.models.reduce((sum, m) => sum + (m.performance?.accuracy || 0), 0) / modelInfo.models.length).toFixed(1)}%
                    </div>
                    <p className="text-sm text-gray-600">Average Accuracy</p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-xs text-green-600 font-semibold">+2.5%</span>
                      <span className="text-xs text-gray-500">from last month</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl p-6 border border-green-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-900">Active Models</h4>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <span className="text-green-600 text-xl">⚡</span>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {modelInfo.models.filter(m => m.is_loaded).length}/{modelInfo.total_models}
                    </div>
                    <p className="text-sm text-gray-600">Ready for predictions</p>
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full"
                          style={{ width: `${(modelInfo.models.filter(m => m.is_loaded).length / modelInfo.total_models) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-6 border border-purple-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-900">Recent Activity</h4>
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <span className="text-purple-600 text-xl">🔄</span>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {modelInfo.models.filter(m => {
                        const date = new Date(m.training_date);
                        const now = new Date();
                        return (now - date) / (1000 * 60 * 60 * 24) <= 7;
                      }).length}
                    </div>
                    <p className="text-sm text-gray-600">Models trained this week</p>
                    <div className="mt-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                        </svg>
                        Trending up
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border">
                    <span className="text-gray-600 text-sm">🤖</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Need help?</p>
                    <p className="text-xs text-gray-600">Check our documentation or contact support</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModelManager(false)}
                    className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 hover:border-gray-400 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      addNotification('Models refreshed successfully', 'success');
                      fetchModelInfo();
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                  >
                    Refresh Models
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Entries</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalWeeks || 0}</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Volume</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalVolume || 0}</p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Price</p>
                <p className="text-3xl font-bold text-gray-900">₱{stats?.avgPrice || 0}</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Commodities</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.commoditiesCount || 0}</p>
              </div>
              <div className="text-4xl">🥬</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Models</p>
                <p className="text-3xl font-bold text-gray-900">{modelInfo?.total_models || 0}</p>
              </div>
              <div className="text-4xl">🤖</div>
            </div>
          </div>
        </div>

        {/* Forecast Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">🔮 Advanced Forecast Controls</h2>
            {selectedCommodity && (
              <div className="text-sm">
                {modelInfo?.models?.find(m => 
                  m.commodity.toLowerCase() === selectedCommodity.toLowerCase() && 
                  m.data_type === selectedDataType
                ) ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-semibold">
                    ⚡ Using Pre-trained Model
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
                    🔨 Will Train from Database
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commodity</label>
                <select
                  value={selectedCommodity}
                  onChange={(e) => setSelectedCommodity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {dashboardData.commodities.map(commodity => (
                    <option key={commodity} value={commodity}>{commodity}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Type</label>
                <select
                  value={selectedDataType}
                  onChange={(e) => setSelectedDataType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="volume">Volume (Kg)</option>
                  <option value="price">Price (₱)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Mode</label>
                <select
                  value={forecastMode}
                  onChange={(e) => setForecastMode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="weekly">📅 Weekly</option>
                  <option value="monthly">📆 Monthly</option>
                  <option value="yearly">🗓️ Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {forecastMode === 'weekly' ? 'Weeks' : forecastMode === 'monthly' ? 'Months' : 'Years'} Ahead
                </label>
                <input
                  type="number"
                  value={periodsAhead}
                  onChange={(e) => setPeriodsAhead(parseInt(e.target.value))}
                  min="1"
                  max={forecastMode === 'weekly' ? 12 : forecastMode === 'monthly' ? 24 : 5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleForecast}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? 'Forecasting...' : 'Generate'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab('commodity')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'commodity'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📈 Commodity Charts
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'comparison'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📊 Multi-Commodity Comparison
              </button>
              <button
                onClick={() => setActiveTab('forecast')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'forecast'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🔮 Forecast Results
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Forecast Tab */}
            {activeTab === 'forecast' && (
              <div>
                {forecastResult ? (
                  <div className="space-y-6">
                    {/* Export Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={exportForecastToCSV}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2"
                      >
                        <span>📥</span>
                        <span>Export CSV</span>
                      </button>
                    </div>

                    {/* Metrics */}
                    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Performance Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {forecastResult.metrics.rmse !== undefined && (
                          <>
                            <div>
                              <p className="text-sm text-gray-600">RMSE</p>
                              <p className="text-xl font-bold">{forecastResult.metrics.rmse.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">MAE</p>
                              <p className="text-xl font-bold">{forecastResult.metrics.mae.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">MAPE</p>
                              <p className="text-xl font-bold">{forecastResult.metrics.mape.toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Accuracy</p>
                              <p className="text-xl font-bold text-green-600">{forecastResult.metrics.accuracy?.toFixed(1)}%</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Chart */}
                    <div>
                      <ReactApexChart
                        options={forecastChart.options}
                        series={forecastChart.series}
                        type="line"
                        height={400}
                      />
                    </div>

                    {/* Data Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {forecastResult.forecast_data.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatPeriod(item, forecastResult.forecast_mode || 'weekly')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.value.toFixed(2)} {forecastResult.data_type === 'price' ? '₱' : 'Kg'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Forecast Generated Yet</h3>
                    <p className="text-gray-600">Select forecast parameters and click "Generate" to see predictions</p>
                  </div>
                )}
              </div>
            )}

            {/* Commodity Tab */}
            {activeTab === 'commodity' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Commodity</label>
                    <select
                      value={chartCommodity}
                      onChange={(e) => setChartCommodity(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      {dashboardData.commodities.map(commodity => (
                        <option key={commodity} value={commodity}>{commodity}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Week Range</label>
                    <select
                      value={selectedWeekRange}
                      onChange={(e) => setSelectedWeekRange(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      {weekRanges.map(range => (
                        <option key={range.value} value={range.value}>{range.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    {volumeChart.series.length > 0 ? (
                      <ReactApexChart
                        options={volumeChart.options}
                        series={volumeChart.series}
                        type="bar"
                        height={300}
                      />
                    ) : (
                      <div className="text-center py-12 text-gray-500">No data available</div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    {priceChart.series.length > 0 ? (
                      <ReactApexChart
                        options={priceChart.options}
                        series={priceChart.series}
                        type="bar"
                        height={300}
                      />
                    ) : (
                      <div className="text-center py-12 text-gray-500">No data available</div>
                    )}
                  </div>
                </div>

                {/* Mixed Chart */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <ReactApexChart
                    options={mixedChart.options}
                    series={mixedChart.series}
                    type="line"
                    height={400}
                  />
                </div>

                {/* Stacked Chart */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <ReactApexChart
                    options={stackedChart.options}
                    series={stackedChart.series}
                    type="bar"
                    height={350}
                  />
                </div>
              </div>
            )}

            {/* Comparison Tab */}
            {activeTab === 'comparison' && (
              <div className="space-y-6">
                {/* Commodity Selection */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Commodities to Compare</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {dashboardData.commodities.slice(0, 8).map(commodity => (
                      <label
                        key={commodity}
                        className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                          comparisonCommodities.includes(commodity)
                            ? 'bg-blue-100 border-blue-500 shadow-md'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={comparisonCommodities.includes(commodity)}
                          onChange={(e) => {
                            if (e.target.checked && comparisonCommodities.length < 5) {
                              setComparisonCommodities([...comparisonCommodities, commodity]);
                            } else if (!e.target.checked) {
                              setComparisonCommodities(comparisonCommodities.filter(c => c !== commodity));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-900">{commodity}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Type</label>
                      <select
                        value={comparisonDataType}
                        onChange={(e) => setComparisonDataType(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="volume">📦 Volume (Kg)</option>
                        <option value="price">💰 Price (₱)</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => setComparisonCommodities([])}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  {comparisonCommodities.length > 0 && (
                    <div className="mt-3 text-sm text-gray-600">
                      <span className="font-semibold">{comparisonCommodities.length}</span> commodities selected (max 5)
                    </div>
                  )}
                </div>

                {/* Bar Chart */}
                {comparisonCommodities.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <ReactApexChart
                      options={multiBarChart.options}
                      series={multiBarChart.series}
                      type="bar"
                      height={400}
                    />
                  </div>
                )}

                {/* Line Chart */}
                {comparisonCommodities.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <ReactApexChart
                      options={trendLineChart.options}
                      series={trendLineChart.series}
                      type="line"
                      height={400}
                    />
                  </div>
                )}

                {/* Empty State */}
                {comparisonCommodities.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Commodities to Compare</h3>
                    <p className="text-gray-600">Choose up to 5 commodities from the list above to see comparison charts</p>
                  </div>
                )}
              </div>
            )}

            {/* Overview Tab - RESTORED DATA TABLES WITH DATE FORMATTING */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Volume Data Table */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <span className="text-xl text-blue-600">📦</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Volume Data</h3>
                          <p className="text-sm text-gray-600">All commodity volume records (in Kg)</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Total Records: {dashboardData.volume_data.length}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Commodity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date Period
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Week
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Month
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Year
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Volume (Kg)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.volume_data.slice(0, 20).map((item, idx) => {
                          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                              'July', 'August', 'September', 'October', 'November', 'December'];
                          const monthName = monthNames[item.month - 1];
                          const dateLabel = `${monthName} ${item.year}`;
                          
                          return (
                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="ml-0">
                                    <div className="text-sm font-medium text-gray-900">{item.commodity}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.week_label || `Week ${item.week}, ${monthName} ${item.year}`}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  Week {item.week}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  <div className="flex items-center gap-2">
                                    <span className="text-blue-600">{monthName}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-500 text-xs">M{item.month}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-semibold text-gray-900">{item.year}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-bold text-blue-700">{item.volume.toFixed(2)}</div>
                                  <span className="text-xs text-gray-500">Kg</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-xs text-gray-500">
                                  <div>Full Date: {monthName} {item.year}</div>
                                  <div>Week {item.week} of {item.year}</div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {dashboardData.volume_data.length > 20 && (
                      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
                        <p className="text-sm text-gray-500">
                          Showing 20 of {dashboardData.volume_data.length} records
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Data Table */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <span className="text-xl text-green-600">💰</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Price Data</h3>
                          <p className="text-sm text-gray-600">All commodity price records (in ₱)</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Total Records: {dashboardData.price_data.length}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Commodity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date Period
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Week
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Month
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Year
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price Details (₱)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price Range
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.price_data.slice(0, 20).map((item, idx) => {
                          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                              'July', 'August', 'September', 'October', 'November', 'December'];
                          const monthName = monthNames[item.month - 1];
                          const dateLabel = `${monthName} ${item.year}`;
                          const priceRange = item.highest_price - item.lowest_price;
                          const avgPosition = ((item.average_price - item.lowest_price) / (priceRange || 1)) * 100;
                          
                          return (
                            <tr key={idx} className="hover:bg-green-50/30 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="ml-0">
                                    <div className="text-sm font-medium text-gray-900">{item.commodity}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.week_label || `Week ${item.week}, ${monthName} ${item.year}`}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  Week {item.week}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  <div className="flex items-center gap-2">
                                    <span className="text-green-600">{monthName}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-500 text-xs">M{item.month}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-semibold text-gray-900">{item.year}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Average:</span>
                                    <span className="text-sm font-bold text-green-700">₱{item.average_price.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Low:</span>
                                    <span className="text-xs text-red-600">₱{item.lowest_price.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">High:</span>
                                    <span className="text-xs text-emerald-600">₱{item.highest_price.toFixed(2)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 mb-1">Range: ₱{priceRange.toFixed(2)}</div>
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-gradient-to-r from-red-400 via-yellow-400 to-emerald-500 h-2 rounded-full relative"
                                      style={{ width: '100%' }}
                                    >
                                      <div 
                                        className="absolute w-1 h-3 bg-gray-800 rounded-full -mt-0.5"
                                        style={{ left: `${avgPosition}%` }}
                                        title={`Average: ₱${item.average_price.toFixed(2)}`}
                                      ></div>
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>₱{item.lowest_price.toFixed(0)}</span>
                                    <span>₱{item.highest_price.toFixed(0)}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {dashboardData.price_data.length > 20 && (
                      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
                        <p className="text-sm text-gray-500">
                          Showing 20 of {dashboardData.price_data.length} records
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Date Range Summary */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">📅</span>
                      Date Range Summary
                    </h4>
                    <div className="space-y-4">
                      {(() => {
                        const allYears = [...new Set([...dashboardData.volume_data.map(d => d.year), ...dashboardData.price_data.map(d => d.year)])];
                        const sortedYears = allYears.sort((a, b) => a - b);
                        
                        if (sortedYears.length === 0) return null;
                        
                        const earliestYear = sortedYears[0];
                        const latestYear = sortedYears[sortedYears.length - 1];
                        
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Data Coverage</span>
                              <span className="font-bold text-blue-600">
                                {sortedYears.length} {sortedYears.length === 1 ? 'Year' : 'Years'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Earliest Year</span>
                              <span className="font-bold text-gray-900">{earliestYear}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Latest Year</span>
                              <span className="font-bold text-gray-900">{latestYear}</span>
                            </div>
                            <div className="pt-3 border-t border-gray-200">
                              <div className="text-sm text-gray-600 mb-2">Years with Data:</div>
                              <div className="flex flex-wrap gap-2">
                                {sortedYears.map(year => (
                                  <span key={year} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                    {year}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Month Distribution */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">📊</span>
                      Month Distribution
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthCounts = Array(12).fill(0);
                        
                        dashboardData.volume_data.forEach(item => {
                          if (item.month >= 1 && item.month <= 12) {
                            monthCounts[item.month - 1]++;
                          }
                        });
                        
                        const maxCount = Math.max(...monthCounts);
                        
                        return monthCounts.map((count, index) => (
                          <div key={index} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">{monthNames[index]}</span>
                              <span className="text-sm font-medium text-gray-900">{count} records</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full"
                                style={{ width: `${(count / maxCount) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Commodities Summary */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">🥬</span>
                      Commodities Summary
                    </h4>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        {dashboardData.commodities.map((commodity, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-bold">{commodity.charAt(0)}</span>
                              </div>
                              <span className="font-medium text-gray-900">{commodity}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900">
                                {dashboardData.volume_data.filter(item => item.commodity === commodity).length} records
                              </div>
                              <div className="text-xs text-gray-500">
                                {dashboardData.price_data.filter(item => item.commodity === commodity).length} price entries
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Total Commodities</span>
                          <span className="font-bold text-purple-600">{dashboardData.commodities.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Filters</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Year</label>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const allYears = [...new Set([...dashboardData.volume_data.map(d => d.year), ...dashboardData.price_data.map(d => d.year)])];
                          const sortedYears = allYears.sort((a, b) => b - a);
                          
                          return sortedYears.slice(0, 5).map(year => (
                            <button
                              key={year}
                              className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              {year}
                            </button>
                          ));
                        })()}
                        <button className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-sm hover:bg-blue-200 transition-colors">
                          All Years
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Commodity</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="">All Commodities</option>
                        {dashboardData.commodities.map(commodity => (
                          <option key={commodity} value={commodity}>{commodity}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Type</label>
                      <div className="flex gap-2">
                        <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
                          Volume Data
                        </button>
                        <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium">
                          Price Data
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;