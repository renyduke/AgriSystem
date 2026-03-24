import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from '../../config';
import { useTheme } from '../../context/ThemeContext';

// Classify commodities into sections
const RICE_CORN_KEYWORDS = ['rice', 'corn', 'palay'];
const isRiceCorn = (commodity) => RICE_CORN_KEYWORDS.some(k => commodity.toLowerCase().includes(k));

// Strip any existing unit suffix to get the base commodity name
const getBaseCommodityName = (name) => {
  if (!name) return "";
  let base = name.replace(/\s*\(Per\s+(Kg\.|Sack|Piece|Bundle)\)\s*/gi, '').trim();
  // Normalize known duplicates/typos
  if (base.toLowerCase() === 'cauli-flower') return 'Cauliflower';
  return base;
};

// Format display name — always show with proper unit suffix, never double
const formatCommodityName = (name) => {
  if (!name) return "";
  const base = getBaseCommodityName(name);
  // Preserve original suffix if it had one (e.g. "Per Sack", "Per Piece")
  const match = name.match(/\(Per\s+(Kg\.|Sack|Piece|Bundle)\)/i);
  const suffix = match ? match[0] : '(Per Kg.)';
  return `${base} ${suffix}`;
};

// De-duplicate commodity list by base name
const deduplicateCommodities = (commodityList) => {
  const seen = new Map();
  commodityList.forEach(name => {
    const base = getBaseCommodityName(name);
    if (!seen.has(base.toLowerCase())) {
      seen.set(base.toLowerCase(), name);
    }
  });
  return [...seen.values()];
};

const VolumePage = () => {
  const { darkMode } = useTheme();
  const [volumeData, setVolumeData] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('all');

  // Signature States
  const [preparedBy, setPreparedBy] = useState('JACKLORD P. VILLARINO');
  const [preparedTitle, setPreparedTitle] = useState('FW-1/Price Monitoring In-Charge');
  const [approvedBy, setApprovedBy] = useState('ANDREA C. CANOY');
  const [approvedTitle, setApprovedTitle] = useState('City Agriculturist');

  const printRef = useRef();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    fetchVolumeData();
  }, []);

  // Reset downstream filters when upstream changes
  useEffect(() => {
    setSelectedMonth('all');
    setSelectedWeek('all');
  }, [selectedYear]);

  useEffect(() => {
    setSelectedWeek('all');
  }, [selectedMonth]);

  const fetchVolumeData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard`);
      setVolumeData(response.data.volume_data);
      setCommodities(deduplicateCommodities(response.data.commodities));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching volume data:', err);
      setLoading(false);
    }
  };

  // Split commodities into two groups
  const vegetableCommodities = commodities.filter(c => !isRiceCorn(c));
  const riceCornCommodities = commodities.filter(c => isRiceCorn(c));

  // Get available years
  const availableYears = [...new Set(volumeData.map(d => d.year))].sort((a, b) => b - a);

  // Get available months (filtered by selected year)
  const getAvailableMonths = () => {
    let filtered = volumeData;
    if (selectedYear !== 'all') {
      filtered = filtered.filter(d => d.year === parseInt(selectedYear));
    }
    return [...new Set(filtered.map(d => d.month))].sort((a, b) => a - b);
  };

  // Get available weeks (filtered by selected year and month)
  const getAvailableWeeks = () => {
    let filtered = volumeData;
    if (selectedYear !== 'all') {
      filtered = filtered.filter(d => d.year === parseInt(selectedYear));
    }
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(d => d.month === parseInt(selectedMonth));
    }
    const weekSet = new Map();
    filtered.forEach(d => {
      const key = `${d.year}-${d.month}-${d.week}`;
      if (!weekSet.has(key)) {
        weekSet.set(key, {
          year: d.year,
          month: d.month,
          week: d.week,
          week_label: d.week_label || `Week ${d.week}`
        });
      }
    });
    return [...weekSet.values()].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.week - b.week;
    });
  };

  const availableMonths = getAvailableMonths();
  const availableWeeks = getAvailableWeeks();

  // Process data: group by week (individual weeks, no aggregation)
  const processWeeklyData = () => {
    let filteredData = volumeData;
    if (selectedYear !== 'all') filteredData = filteredData.filter(d => d.year === parseInt(selectedYear));
    if (selectedMonth !== 'all') filteredData = filteredData.filter(d => d.month === parseInt(selectedMonth));
    if (selectedWeek !== 'all') filteredData = filteredData.filter(d => d.week === parseInt(selectedWeek));

    const weeklyGroups = {};
    filteredData.forEach(item => {
      const weekKey = `${item.year}-${String(item.month).padStart(2, '0')}-W${item.week}`;
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = {
          year: item.year,
          month: item.month,
          week: item.week,
          week_label: item.week_label || `Week ${item.week}`,
          commodityVolumes: {}
        };
      }
      // Normalize commodity name to base for consistent lookup
      const baseName = getBaseCommodityName(item.commodity);
      if (!weeklyGroups[weekKey].commodityVolumes[baseName]) {
        weeklyGroups[weekKey].commodityVolumes[baseName] = 0;
      }
      if (item.volume) weeklyGroups[weekKey].commodityVolumes[baseName] += item.volume;
    });
    return weeklyGroups;
  };

  const getPeriodLabel = () => {
    const parts = [];
    if (selectedWeek !== 'all') parts.push(`Week ${selectedWeek}`);
    if (selectedMonth !== 'all') parts.push(monthNames[parseInt(selectedMonth) - 1]);
    if (selectedYear !== 'all') parts.push(selectedYear);
    return parts.length > 0 ? parts.join(', ') : 'All Periods';
  };

  const getWeekFullLabel = (data) => {
    return `${data.week_label}, ${monthNames[data.month - 1]} ${data.year}`;
  };

  const downloadCSV = () => {
    const weeklyData = processWeeklyData();
    let csv = '';
    Object.entries(weeklyData).sort(([a], [b]) => a.localeCompare(b)).forEach(([_, data]) => {
      const weekLabel = getWeekFullLabel(data);
      csv += `\n${weekLabel}\n`;
      csv += '\n1. HIGH VALUE CROP COMMODITY VOLUME\n';
      csv += 'No.,Commodity,Volume (Kg),Remarks\n';
      let vegTotal = 0;
      vegetableCommodities.forEach((c, i) => {
        const vol = data.commodityVolumes[getBaseCommodityName(c)] || 0;
        csv += `${i + 1},"${formatCommodityName(c)}",${vol > 0 ? vol.toFixed(2) + ' kg' : ''},\n`;
        vegTotal += vol;
      });
      csv += `,,${vegTotal.toFixed(2)} kg,Subtotal\n`;

      if (riceCornCommodities.length > 0) {
        csv += '\n2. RICE & CORN COMMODITY VOLUME\n';
        csv += 'No.,Commodity,Volume (Kg),Remarks\n';
        let rcTotal = 0;
        riceCornCommodities.forEach((c, i) => {
          const vol = data.commodityVolumes[getBaseCommodityName(c)] || 0;
          csv += `${i + 1},"${formatCommodityName(c)}",${vol > 0 ? vol.toFixed(2) + ' kg' : ''},\n`;
          rcTotal += vol;
        });
        csv += `,,${rcTotal.toFixed(2)} kg,Subtotal\n`;
      }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volume_monitoring_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to build section rows for print
  const buildSectionRowsHtml = (commodityList, data) => {
    let html = '';
    let sectionTotal = 0;
    commodityList.forEach((commodity, idx) => {
      const volume = data.commodityVolumes[getBaseCommodityName(commodity)] || 0;
      sectionTotal += volume;
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td style="text-align: left; padding-left: 8px;">${formatCommodityName(commodity)}</td>
          <td>${volume > 0 ? volume.toFixed(2) + ' kg' : ''}</td>
          <td></td>
        </tr>
      `;
    });
    html += `
      <tr style="font-weight: bold; background-color: #f0f0f0;">
        <td colspan="2" style="text-align: right; padding-right: 8px;">Subtotal</td>
        <td>${sectionTotal > 0 ? sectionTotal.toFixed(2) + ' kg' : ''}</td>
        <td></td>
      </tr>
    `;
    return html;
  };

  // Print function - Government Form Style (one page per week)
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const sortedWeekEntries = Object.entries(weeklyData).sort(([a], [b]) => a.localeCompare(b));

    let pagesHtml = '';
    sortedWeekEntries.forEach(([weekKey, data], index) => {
      const weekLabel = getWeekFullLabel(data);
      const isLastPage = index === sortedWeekEntries.length - 1;

      const vegRows = buildSectionRowsHtml(vegetableCommodities, data);
      const rcRows = buildSectionRowsHtml(riceCornCommodities, data);

      pagesHtml += `
        <div class="page" ${!isLastPage ? 'style="page-break-after: always;"' : ''}>
          <div class="gov-header">
            <img src="/logo.png" alt="Logo" class="gov-logo" />
            <p>Republic of the Philippines</p>
            <p><strong>OFFICE OF THE CITY AGRICULTURIST</strong></p>
            <p>Canlaon City, Negros Oriental</p>
            <p class="title">VOLUME MONITORING OF AGRICULTURAL CROPS COMMODITY PRODUCTS</p>
            <p class="subtitle">For the Period (Week/Month/Year): ${weekLabel}</p>
          </div>

          <p class="section-label">1. HIGH VALUE CROP COMMODITY VOLUME MONITORING</p>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No.</th>
                <th>Commodity</th>
                <th style="width: 100px;">Volume (Kg)</th>
                <th style="width: 100px;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${vegRows}
            </tbody>
          </table>

          ${riceCornCommodities.length > 0 ? `
            <p class="section-label" style="margin-top: 15px;">2. RICE & CORN COMMODITY VOLUME MONITORING</p>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px;">No.</th>
                  <th>Commodity</th>
                  <th style="width: 100px;">Volume (Kg)</th>
                  <th style="width: 100px;">Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${rcRows}
              </tbody>
            </table>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <p class="signature-label">Prepared/Submitted by:</p>
              <div class="signature-line">
                <p><strong>${preparedBy}</strong></p>
                <p>${preparedTitle}</p>
              </div>
            </div>
            <div class="signature-box">
              <p class="signature-label">Submitted to:</p>
              <div class="signature-line">
                <p><strong>${approvedBy}</strong></p>
                <p>${approvedTitle}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Volume Monitoring Report</title>
          <style>
            @page { size: portrait; margin: 1cm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 10px; color: #000; }
            .page { padding: 1cm; }
            .gov-header { text-align: center; margin-bottom: 10px; }
            .gov-logo { width: 60px; height: 60px; margin: 0 auto 5px auto; display: block; }
            .gov-header p { margin: 2px 0; font-size: 10px; }
            .gov-header .title { font-weight: bold; font-size: 11px; margin-top: 8px; text-align: center; }
            .gov-header .subtitle { font-size: 10px; text-align: center; }
            .section-label { font-weight: bold; font-size: 10px; margin: 8px 0 3px 0; text-align: center; }
            table { border-collapse: collapse; width: 100%; margin-top: 3px; font-size: 9px; }
            th, td { border: 1px solid #000; padding: 3px 5px; text-align: center; }
            th { font-weight: bold; font-size: 9px; }
            .signature-section { margin-top: 20px; display: flex; justify-content: space-between; }
            .signature-box { text-align: center; width: 45%; }
            .signature-line { display: inline-block; border-top: 1px solid #000; padding-top: 3px; margin-top: 30px; }
            .signature-line p { margin: 1px 0; font-size: 9px; }
            .signature-label { font-size: 9px; margin-bottom: 0; }
            @media print { .page { padding: 0; } }
          </style>
        </head>
        <body>
          ${pagesHtml}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };
  const weeklyData = processWeeklyData();

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? "bg-slate-950" : "bg-gradient-to-br from-green-50 to-blue-50"} flex items-center justify-center transition-colors duration-300`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className={`mt-4 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>Loading volume data...</p>
        </div>
      </div>
    );
  }

  const sortedWeeks = Object.entries(weeklyData).sort(([a], [b]) => a.localeCompare(b));

  // Render a commodity volume table section
  const renderCommodityTable = (commodityList, data) => {
    const sectionTotal = commodityList.reduce((sum, c) => sum + (data.commodityVolumes[getBaseCommodityName(c)] || 0), 0);
    return (
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y ${darkMode ? "divide-slate-700" : "divide-gray-300"}`}>
          <thead className={darkMode ? "bg-slate-800" : "bg-gray-100"}>
            <tr>
              <th className={`px-3 py-3 text-center text-xs font-bold ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-900 border-gray-300"} uppercase border w-12`}>No.</th>
              <th className={`px-4 py-3 text-center text-xs font-bold ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-900 border-gray-300"} uppercase border`}>Commodity</th>
              <th className={`px-4 py-3 text-center text-xs font-bold ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-900 border-gray-300"} uppercase border w-36`}>Volume (Kg)</th>
              <th className={`px-4 py-3 text-center text-xs font-bold ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-900 border-gray-300"} uppercase border w-36`}>Remarks</th>
            </tr>
          </thead>
          <tbody className={`${darkMode ? "bg-slate-900 divide-slate-700" : "bg-white divide-gray-300"} divide-y`}>
            {commodityList.map((commodity, idx) => {
              const volume = data.commodityVolumes[getBaseCommodityName(commodity)] || 0;
              return (
                <tr key={commodity} className={darkMode ? "hover:bg-slate-800/50" : "hover:bg-gray-50"}>
                  <td className={`px-3 py-2 text-center text-sm ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-900 border-gray-300"} border`}>{idx + 1}</td>
                  <td className={`px-4 py-2 text-left text-sm ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-900 border-gray-300"} border`}>{formatCommodityName(commodity)}</td>
                  <td className={`px-4 py-2 text-center text-sm ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-900 border-gray-300"} border`}>{volume > 0 ? `${volume.toFixed(2)} kg` : ''}</td>
                  <td className={`px-4 py-2 text-center text-sm ${darkMode ? "text-slate-500 border-slate-700" : "text-gray-500 border-gray-300"} border`}></td>
                </tr>
              );
            })}
            <tr className={`${darkMode ? "bg-slate-800" : "bg-gray-200"} font-bold`}>
              <td colSpan={2} className={`px-4 py-3 text-right text-sm font-bold ${darkMode ? "text-slate-200 border-slate-700" : "text-gray-900 border-gray-300"} border`}>Subtotal</td>
              <td className={`px-4 py-3 text-center text-sm font-bold ${darkMode ? "text-slate-200 border-slate-700" : "text-gray-900 border-gray-300"} border`}>{sectionTotal > 0 ? `${sectionTotal.toFixed(2)} kg` : ''}</td>
              <td className={`px-4 py-3 border ${darkMode ? "border-slate-700" : "border-gray-300"}`}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-slate-950 text-slate-200" : "bg-gray-50 text-slate-800"} px-6 pt-2 pb-8 w-full font-sans transition-colors duration-300`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-slate-800"} mb-2`}>Volume Monitoring Report</h1>
        <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
          Agricultural Crops Commodity Volume Monitoring
        </p>
      </div>

      {/* Main Content */}
      <main className="w-full">
        {/* Controls */}
        <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-2xl border shadow-sm p-6 mb-8 transition-colors`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Filter by Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                className={`w-full px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"} border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none`}>
                <option value="all">All Years</option>
                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Filter by Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className={`w-full px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"} border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none`}>
                <option value="all">All Months</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{monthNames[month - 1]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Filter by Week</label>
              <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}
                className={`w-full px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"} border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none`}>
                <option value="all">All Weeks</option>
                {availableWeeks.map(w => (
                  <option key={`${w.year}-${w.month}-${w.week}`} value={w.week}>
                    {w.week_label} ({monthNames[w.month - 1]} {w.year})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 items-end">
              <button onClick={downloadCSV}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-green-100 active:scale-95 text-sm">
                <span>📥</span><span>CSV</span>
              </button>
              <button onClick={handlePrint}
                className={`flex-1 px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"} border rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 text-sm`}>
                <span>🖨️</span><span>Print</span>
              </button>
            </div>
          </div>
          <div className={`${darkMode ? "bg-blue-900/20 border-blue-500/50" : "bg-blue-50 border-blue-500"} border-l-4 p-4 rounded-xl`}>
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <div>
                <p className={`font-bold ${darkMode ? "text-blue-400" : "text-blue-700"}`}>Period: {getPeriodLabel()}</p>
                <p className={`text-sm ${darkMode ? "text-blue-400/70" : "text-blue-600/70"}`}>Showing weekly volume data per commodity</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Settings */}
        <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-2xl border shadow-sm p-6 mb-8 transition-colors`}>
          <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-800"} mb-6 flex items-center gap-2`}>
            <span>✍️</span> Signature Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prepared/Submitted by</p>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Name</label>
                <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)}
                  className={`w-full px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"} border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all`} placeholder="Enter name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Title/Position</label>
                <input type="text" value={preparedTitle} onChange={(e) => setPreparedTitle(e.target.value)}
                  className={`w-full px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"} border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all`} placeholder="Enter title" />
              </div>
            </div>
            <div className="space-y-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submitted to</p>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Name</label>
                <input type="text" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}
                  className={`w-full px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"} border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all`} placeholder="Enter name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Title/Position</label>
                <input type="text" value={approvedTitle} onChange={(e) => setApprovedTitle(e.target.value)}
                  className={`w-full px-4 py-3 ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"} border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all`} placeholder="Enter title" />
              </div>
            </div>
          </div>
        </div>

        {/* Tables */}
        <div ref={printRef}>
          {sortedWeeks.length === 0 ? (
            <div className={`${darkMode ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-white border-slate-200 text-gray-500"} rounded-lg shadow-md p-8 text-center border`}>No data available for selected filters</div>
          ) : (
            sortedWeeks.map(([weekKey, data]) => {
              const weekLabel = getWeekFullLabel(data);
              return (
                <div key={weekKey} className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-2xl border shadow-sm overflow-hidden mb-8 transition-colors`}>
                  <div className={`${darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100"} border-b px-6 py-4`}>
                    <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-800"}`}>📅 {weekLabel}</h3>
                    <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"} mt-1 uppercase tracking-wider font-bold`}>{data.week_label} — {monthNames[data.month - 1]} {data.year}</p>
                  </div>

                  <div className="p-4">
                    {/* Section 1: Vegetables / High Value Crops */}
                    {vegetableCommodities.length > 0 && (
                      <>
                        <h4 className={`text-xs font-bold ${darkMode ? "text-slate-400 bg-slate-800/50 border-green-600" : "text-slate-500 bg-slate-50 border-green-500"} mb-4 px-4 py-2 rounded-lg border-l-4 uppercase tracking-wider`}>
                          1. HIGH VALUE CROP COMMODITY VOLUME MONITORING
                        </h4>
                        {renderCommodityTable(vegetableCommodities, data)}
                      </>
                    )}

                    {/* Section 2: Rice & Corn */}
                    {riceCornCommodities.length > 0 && (
                      <>
                        <h4 className={`text-sm font-bold ${darkMode ? "text-amber-400 bg-amber-900/20 border-amber-600" : "text-gray-800 bg-amber-50 border-amber-500"} mt-5 mb-2 px-3 py-2 rounded border-l-4`}>
                          2. RICE & CORN COMMODITY VOLUME MONITORING
                        </h4>
                        {renderCommodityTable(riceCornCommodities, data)}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Signature Section */}
          <div className="signature-section p-8">
            <div className="signature-box">
              <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"} mb-1`}>Prepared/Submitted by:</p>
              <div className={`mt-8 pt-2 inline-block border-t-2 ${darkMode ? "border-slate-700" : "border-gray-800"}`}>
                <p className={`font-bold uppercase ${darkMode ? "text-white" : "text-gray-900"}`}>{preparedBy}</p>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>{preparedTitle}</p>
              </div>
            </div>
            <div className="signature-box">
              <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"} mb-1`}>Submitted to:</p>
              <div className={`mt-8 pt-2 inline-block border-t-2 ${darkMode ? "border-slate-700" : "border-gray-800"}`}>
                <p className={`font-bold uppercase ${darkMode ? "text-white" : "text-gray-900"}`}>{approvedBy}</p>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>{approvedTitle}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          gap: 40px;
        }
        .signature-box {
          text-align: center;
          flex: 1;
        }
        @media print {
          .signature-section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default VolumePage;
