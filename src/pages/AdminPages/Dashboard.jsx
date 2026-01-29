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

  // NEW: Overview filters
  const [overviewYearFilter, setOverviewYearFilter] = useState('all');
  const [overviewCommodityFilter, setOverviewCommodityFilter] = useState('all');
  const [overviewDataView, setOverviewDataView] = useState('volume'); // 'volume' or 'price'

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
  // NEW: DATA ANALYSIS FUNCTIONS FOR OVERVIEW
  // ============================================================================

  const analyzeVolumeData = useMemo(() => {
    if (!dashboardData) return null;

    let filteredData = dashboardData.volume_data;
    
    // Apply filters
    if (overviewYearFilter !== 'all') {
      filteredData = filteredData.filter(item => item.year === parseInt(overviewYearFilter));
    }
    if (overviewCommodityFilter !== 'all') {
      filteredData = filteredData.filter(item => item.commodity === overviewCommodityFilter);
    }

    // Group by year-month-week-commodity
    const grouped = {};
    filteredData.forEach(item => {
      const key = `${item.year}-${item.month}-${item.week}`;
      if (!grouped[key]) {
        grouped[key] = {
          year: item.year,
          month: item.month,
          week: item.week,
          week_label: item.week_label,
          commodities: {},
          totalVolume: 0
        };
      }
      grouped[key].commodities[item.commodity] = item.volume;
      grouped[key].totalVolume += item.volume;
    });

    // Convert to array and sort
    const result = Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return b.week - a.week;
    });

    // Calculate completeness
    const expectedCommodities = overviewCommodityFilter === 'all' 
      ? dashboardData.commodities.length 
      : 1;
    
    result.forEach(item => {
      const actualCommodities = Object.keys(item.commodities).length;
      item.completeness = (actualCommodities / expectedCommodities) * 100;
      item.missingCommodities = expectedCommodities - actualCommodities;
    });

    return result;
  }, [dashboardData, overviewYearFilter, overviewCommodityFilter]);

  const analyzePriceData = useMemo(() => {
    if (!dashboardData) return null;

    let filteredData = dashboardData.price_data;
    
    // Apply filters
    if (overviewYearFilter !== 'all') {
      filteredData = filteredData.filter(item => item.year === parseInt(overviewYearFilter));
    }
    if (overviewCommodityFilter !== 'all') {
      filteredData = filteredData.filter(item => item.commodity === overviewCommodityFilter);
    }

    // Group by year-month-week-commodity
    const grouped = {};
    filteredData.forEach(item => {
      const key = `${item.year}-${item.month}-${item.week}`;
      if (!grouped[key]) {
        grouped[key] = {
          year: item.year,
          month: item.month,
          week: item.week,
          week_label: item.week_label,
          commodities: {}
        };
      }
      grouped[key].commodities[item.commodity] = {
        lowest: item.lowest_price,
        highest: item.highest_price,
        average: item.average_price
      };
    });

    // Convert to array and sort
    const result = Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return b.week - a.week;
    });

    // Calculate completeness and averages
    const expectedCommodities = overviewCommodityFilter === 'all' 
      ? dashboardData.commodities.length 
      : 1;
    
    result.forEach(item => {
      const actualCommodities = Object.keys(item.commodities).length;
      item.completeness = (actualCommodities / expectedCommodities) * 100;
      item.missingCommodities = expectedCommodities - actualCommodities;
      
      // Calculate overall averages for the week
      const prices = Object.values(item.commodities);
      if (prices.length > 0) {
        item.weekLowest = Math.min(...prices.map(p => p.lowest));
        item.weekHighest = Math.max(...prices.map(p => p.highest));
        item.weekAverage = prices.reduce((sum, p) => sum + p.average, 0) / prices.length;
      }
    });

    return result;
  }, [dashboardData, overviewYearFilter, overviewCommodityFilter]);

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
  // CHART CONFIGURATIONS
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

  // Get available years for filter
  const availableYears = [...new Set([
    ...dashboardData.volume_data.map(d => d.year),
    ...dashboardData.price_data.map(d => d.year)
  ])].sort((a, b) => b - a);

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
              {/* <button
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
              </button> */}
              <div className="text-right">
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-lg font-semibold text-gray-700">January 21, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </header>

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

          {/* <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Models</p>
                <p className="text-3xl font-bold text-gray-900">{modelInfo?.total_models || 0}</p>
              </div>
              <div className="text-4xl">🤖</div>
            </div>
          </div> */}
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
            {/* ENHANCED OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">📋 Data Filters & View Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Year</label>
                      <select 
                        value={overviewYearFilter}
                        onChange={(e) => setOverviewYearFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Years</option>
                        {availableYears.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Commodity</label>
                      <select 
                        value={overviewCommodityFilter}
                        onChange={(e) => setOverviewCommodityFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Commodities</option>
                        {dashboardData.commodities.map(commodity => (
                          <option key={commodity} value={commodity}>{commodity}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">View Type</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setOverviewDataView('volume')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                            overviewDataView === 'volume' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white text-gray-700 border border-gray-300'
                          }`}
                        >
                          📦 Volume
                        </button>
                        <button 
                          onClick={() => setOverviewDataView('price')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                            overviewDataView === 'price' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-white text-gray-700 border border-gray-300'
                          }`}
                        >
                          💰 Price
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VOLUME DATA TABLE */}
                {overviewDataView === 'volume' && analyzeVolumeData && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <span className="text-xl text-blue-600">📦</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Volume Data by Week</h3>
                            <p className="text-sm text-gray-600">Aggregated weekly totals with completeness tracking</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {analyzeVolumeData.length} weeks • {overviewYearFilter === 'all' ? 'All years' : overviewYearFilter}
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month/Year</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Volume (Kg)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commodities</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completeness</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {analyzeVolumeData.map((item, idx) => {
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const isComplete = item.completeness === 100;
                            
                            return (
                              <tr key={idx} className={`hover:bg-blue-50/30 transition-colors ${!isComplete ? 'bg-yellow-50/20' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.week_label || `Week ${item.week}, ${monthNames[item.month - 1]} ${item.year}`}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                    W{item.week}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{monthNames[item.month - 1]} {item.year}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-blue-700">{item.totalVolume.toFixed(2)}</span>
                                    <span className="text-xs text-gray-500">Kg</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {Object.keys(item.commodities).length} / {overviewCommodityFilter === 'all' ? dashboardData.commodities.length : 1}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 bg-gray-200 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-yellow-500'}`}
                                          style={{ width: `${item.completeness}%` }}
                                        ></div>
                                      </div>
                                      <span className={`text-xs font-bold ${isComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {item.completeness.toFixed(0)}%
                                      </span>
                                    </div>
                                    {!isComplete && (
                                      <div className="text-xs text-yellow-600">
                                        ⚠️ {item.missingCommodities} missing
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs space-y-1 max-w-xs">
                                    {Object.entries(item.commodities).map(([commodity, volume]) => (
                                      <div key={commodity} className="flex justify-between">
                                        <span className="text-gray-600">{commodity}:</span>
                                        <span className="font-medium text-gray-900">{volume.toFixed(2)} Kg</span>
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

                    {/* Summary Footer */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Weeks:</span>
                          <span className="ml-2 font-bold text-gray-900">{analyzeVolumeData.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Volume:</span>
                          <span className="ml-2 font-bold text-blue-700">
                            {analyzeVolumeData.reduce((sum, item) => sum + item.totalVolume, 0).toFixed(2)} Kg
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Complete Weeks:</span>
                          <span className="ml-2 font-bold text-green-600">
                            {analyzeVolumeData.filter(item => item.completeness === 100).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Incomplete Weeks:</span>
                          <span className="ml-2 font-bold text-yellow-600">
                            {analyzeVolumeData.filter(item => item.completeness < 100).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PRICE DATA TABLE */}
                {overviewDataView === 'price' && analyzePriceData && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-100 p-2 rounded-lg">
                            <span className="text-xl text-green-600">💰</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Price Data by Week (LP/HP/AP)</h3>
                            <p className="text-sm text-gray-600">Lowest, Highest, and Average prices with completeness tracking</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {analyzePriceData.length} weeks • {overviewYearFilter === 'all' ? 'All years' : overviewYearFilter}
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month/Year</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week LP (₱)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week HP (₱)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week AP (₱)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completeness</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commodity Details</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {analyzePriceData.map((item, idx) => {
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const isComplete = item.completeness === 100;
                            
                            return (
                              <tr key={idx} className={`hover:bg-green-50/30 transition-colors ${!isComplete ? 'bg-yellow-50/20' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.week_label || `Week ${item.week}, ${monthNames[item.month - 1]} ${item.year}`}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    W{item.week}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{monthNames[item.month - 1]} {item.year}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-red-600">₱{item.weekLowest?.toFixed(2) || 'N/A'}</span>
                                    <span className="text-xs text-gray-400">LP</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-emerald-600">₱{item.weekHighest?.toFixed(2) || 'N/A'}</span>
                                    <span className="text-xs text-gray-400">HP</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-green-700">₱{item.weekAverage?.toFixed(2) || 'N/A'}</span>
                                    <span className="text-xs text-gray-400">AP</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 bg-gray-200 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-yellow-500'}`}
                                          style={{ width: `${item.completeness}%` }}
                                        ></div>
                                      </div>
                                      <span className={`text-xs font-bold ${isComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {item.completeness.toFixed(0)}%
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {Object.keys(item.commodities).length} / {overviewCommodityFilter === 'all' ? dashboardData.commodities.length : 1}
                                    </div>
                                    {!isComplete && (
                                      <div className="text-xs text-yellow-600">
                                        ⚠️ {item.missingCommodities} missing
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs space-y-2 max-w-sm">
                                    {Object.entries(item.commodities).map(([commodity, prices]) => (
                                      <div key={commodity} className="border-l-2 border-green-200 pl-2">
                                        <div className="font-medium text-gray-900 mb-1">{commodity}</div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <div>
                                            <span className="text-gray-500">LP:</span>
                                            <span className="ml-1 text-red-600 font-medium">₱{prices.lowest.toFixed(2)}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">HP:</span>
                                            <span className="ml-1 text-emerald-600 font-medium">₱{prices.highest.toFixed(2)}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">AP:</span>
                                            <span className="ml-1 text-green-700 font-medium">₱{prices.average.toFixed(2)}</span>
                                          </div>
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

                    {/* Summary Footer */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Weeks:</span>
                          <span className="ml-2 font-bold text-gray-900">{analyzePriceData.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Avg Weekly Price:</span>
                          <span className="ml-2 font-bold text-green-700">
                            ₱{(analyzePriceData.reduce((sum, item) => sum + (item.weekAverage || 0), 0) / analyzePriceData.length).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Complete Weeks:</span>
                          <span className="ml-2 font-bold text-green-600">
                            {analyzePriceData.filter(item => item.completeness === 100).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Incomplete Weeks:</span>
                          <span className="ml-2 font-bold text-yellow-600">
                            {analyzePriceData.filter(item => item.completeness < 100).length}
                          </span>
                        </div>
                      </div>
                    </div>
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

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <ReactApexChart
                    options={mixedChart.options}
                    series={mixedChart.series}
                    type="line"
                    height={400}
                  />
                </div>

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

                {comparisonCommodities.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Commodities to Compare</h3>
                    <p className="text-gray-600">Choose up to 5 commodities from the list above to see comparison charts</p>
                  </div>
                )}
              </div>
            )}

            {/* Forecast Tab */}
            {activeTab === 'forecast' && (
              <div>
                {forecastResult ? (
                  <div className="space-y-6">
                    <div className="flex gap-2">
                      <button
                        onClick={exportForecastToCSV}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2"
                      >
                        <span>📥</span>
                        <span>Export CSV</span>
                      </button>
                    </div>

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

                    <div>
                      <ReactApexChart
                        options={forecastChart.options}
                        series={forecastChart.series}
                        type="line"
                        height={400}
                      />
                    </div>

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
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;