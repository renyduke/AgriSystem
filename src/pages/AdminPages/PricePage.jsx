import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://backend-3-fl3e.onrender.com';

// Classify commodities into sections
const RICE_CORN_KEYWORDS = ['rice', 'corn', 'palay'];
const isRiceCorn = (commodity) => RICE_CORN_KEYWORDS.some(k => commodity.toLowerCase().includes(k));

const PricePage = () => {
  const [priceData, setPriceData] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Signature States
  const [preparedBy, setPreparedBy] = useState('JACKLORD P. VILLARINO');
  const [preparedTitle, setPreparedTitle] = useState('FW-1/Price Monitoring In-Charge');
  const [approvedBy, setApprovedBy] = useState('ANDREA C. CANOY');
  const [approvedTitle, setApprovedTitle] = useState('City Agriculturist');

  const printRef = useRef();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    fetchPriceData();
  }, []);

  const fetchPriceData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard`);
      setPriceData(response.data.price_data);
      setCommodities(response.data.commodities);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching price data:', err);
      setLoading(false);
    }
  };

  // Split commodities into two groups
  const vegetableCommodities = commodities.filter(c => !isRiceCorn(c));
  const riceCornCommodities = commodities.filter(c => isRiceCorn(c));

  // Process data: group by month, then aggregate all weeks per commodity within each month
  const processMonthlyData = () => {
    let filteredData = priceData;

    if (selectedYear !== 'all') {
      filteredData = filteredData.filter(d => d.year === parseInt(selectedYear));
    }
    if (selectedMonth !== 'all') {
      filteredData = filteredData.filter(d => d.month === parseInt(selectedMonth));
    }

    const monthlyGroups = {};
    filteredData.forEach(item => {
      const monthKey = `${item.year}-${String(item.month).padStart(2, '0')}`;
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = { year: item.year, month: item.month, commodityData: {} };
      }
      if (!monthlyGroups[monthKey].commodityData[item.commodity]) {
        monthlyGroups[monthKey].commodityData[item.commodity] = { lowestValues: [], highestValues: [], averageValues: [] };
      }
      const cd = monthlyGroups[monthKey].commodityData[item.commodity];
      if (item.lowest_price) cd.lowestValues.push(item.lowest_price);
      if (item.highest_price) cd.highestValues.push(item.highest_price);
      if (item.average_price) cd.averageValues.push(item.average_price);
    });

    const result = {};
    Object.entries(monthlyGroups).forEach(([key, group]) => {
      const commodityPrices = {};
      Object.entries(group.commodityData).forEach(([commodity, data]) => {
        commodityPrices[commodity] = {
          lowest: data.lowestValues.length > 0 ? Math.min(...data.lowestValues) : null,
          highest: data.highestValues.length > 0 ? Math.max(...data.highestValues) : null,
          average: data.averageValues.length > 0
            ? data.averageValues.reduce((a, b) => a + b, 0) / data.averageValues.length
            : null
        };
      });
      result[key] = { year: group.year, month: group.month, commodityPrices };
    });
    return result;
  };

  const getPeriodLabel = () => {
    const parts = [];
    if (selectedMonth !== 'all') parts.push(monthNames[parseInt(selectedMonth) - 1]);
    if (selectedYear !== 'all') parts.push(selectedYear);
    return parts.length > 0 ? parts.join(' ') : 'All Periods';
  };

  const downloadCSV = () => {
    const monthlyData = processMonthlyData();
    let csv = '';
    Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).forEach(([_, data]) => {
      const monthLabel = `${monthNames[data.month - 1]} ${data.year}`;
      csv += `\n${monthLabel}\n`;
      csv += '\n1. HIGH VALUE CROP COMMODITY PRODUCT PRICE MONITORING\n';
      csv += 'No.,Commodity,Lowest,Highest,Average\n';
      vegetableCommodities.forEach((c, i) => {
        const p = data.commodityPrices[c];
        csv += `${i + 1},"${c} (Per Kg.)",${p && p.lowest ? '₱' + p.lowest.toFixed(2) : ''},${p && p.highest ? '₱' + p.highest.toFixed(2) : ''},${p && p.average ? '₱' + p.average.toFixed(2) : ''}\n`;
      });
      if (riceCornCommodities.length > 0) {
        csv += '\n2. RICE & CORN COMMODITY PRICE MONITORING\n';
        csv += 'No.,Commodity,Lowest,Highest,Average\n';
        riceCornCommodities.forEach((c, i) => {
          const p = data.commodityPrices[c];
          csv += `${i + 1},"${c} (Per Kg.)",${p && p.lowest ? '₱' + p.lowest.toFixed(2) : ''},${p && p.highest ? '₱' + p.highest.toFixed(2) : ''},${p && p.average ? '₱' + p.average.toFixed(2) : ''}\n`;
        });
      }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price_monitoring_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to build table rows HTML for print
  const buildSectionRowsHtml = (commodityList, data) => {
    let html = '';
    commodityList.forEach((commodity, idx) => {
      const prices = data.commodityPrices[commodity];
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td style="text-align: left; padding-left: 8px;">${commodity} (Per Kg.)</td>
          <td>${prices && prices.lowest ? '₱' + prices.lowest.toFixed(2) : ''}</td>
          <td>${prices && prices.highest ? '₱' + prices.highest.toFixed(2) : ''}</td>
          <td style="font-weight: 600;">${prices && prices.average ? '₱' + prices.average.toFixed(2) : ''}</td>
          <td></td>
        </tr>
      `;
    });
    return html;
  };

  // Print function - Government Form Style (one page per month)
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const sortedMonthEntries = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));

    let pagesHtml = '';
    sortedMonthEntries.forEach(([monthKey, data], index) => {
      const monthLabel = `${monthNames[data.month - 1]} ${data.year}`;
      const isLastPage = index === sortedMonthEntries.length - 1;

      const vegRows = buildSectionRowsHtml(vegetableCommodities, data);
      const rcRows = buildSectionRowsHtml(riceCornCommodities, data);

      pagesHtml += `
        <div class="page" ${!isLastPage ? 'style="page-break-after: always;"' : ''}>
          <div class="gov-header">
            <img src="/logo.png" alt="Logo" class="gov-logo" />
            <p>Republic of the Philippines</p>
            <p><strong>OFFICE OF THE CITY AGRICULTURIST</strong></p>
            <p>Canlaon City, Negros Oriental</p>
            <p class="title">PRICE MONITORING OF AGRICULTURAL CROPS COMMODITY PRODUCTS</p>
            <p class="subtitle">For the Period (Month/Date/Year): ${monthLabel}</p>
          </div>

          <p class="section-label">1. HIGH VALUE CROP COMMODITY PRODUCT PRICE MONITORING</p>
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 30px;">No.</th>
                <th rowspan="2">Commodity</th>
                <th colspan="3">Prices (Php/Kilograms)</th>
                <th rowspan="2" style="width: 80px;">Remarks</th>
              </tr>
              <tr>
                <th style="width: 80px;">Lowest</th>
                <th style="width: 80px;">Highest</th>
                <th style="width: 80px;">Average</th>
              </tr>
            </thead>
            <tbody>
              ${vegRows}
            </tbody>
          </table>

          ${riceCornCommodities.length > 0 ? `
            <p class="section-label" style="margin-top: 15px;">2. RICE & CORN COMMODITY PRICE MONITORING</p>
            <table>
              <thead>
                <tr>
                  <th rowspan="2" style="width: 30px;">No.</th>
                  <th rowspan="2">Commodity</th>
                  <th colspan="3">Prices (Php/Kilograms)</th>
                  <th rowspan="2" style="width: 80px;">Remarks</th>
                </tr>
                <tr>
                  <th style="width: 80px;">Lowest</th>
                  <th style="width: 80px;">Highest</th>
                  <th style="width: 80px;">Average</th>
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
          <title>Price Monitoring Report</title>
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

  const monthlyData = processMonthlyData();
  const availableYears = [...new Set(priceData.map(d => d.year))].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading price data...</p>
        </div>
      </div>
    );
  }

  const sortedMonths = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));

  // Render a commodity table section
  const renderCommodityTable = (commodityList, data) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th rowSpan={2} className="px-3 py-3 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300 w-12">No.</th>
            <th rowSpan={2} className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300">Commodity</th>
            <th colSpan={3} className="px-4 py-2 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300">Prices (Php/Kilograms)</th>
            <th rowSpan={2} className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300 w-28">Remarks</th>
          </tr>
          <tr>
            <th className="px-4 py-2 text-center text-xs font-bold text-gray-900 border border-gray-300 w-28">Lowest</th>
            <th className="px-4 py-2 text-center text-xs font-bold text-gray-900 border border-gray-300 w-28">Highest</th>
            <th className="px-4 py-2 text-center text-xs font-bold text-gray-900 border border-gray-300 w-28">Average</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-300">
          {commodityList.map((commodity, idx) => {
            const prices = data.commodityPrices[commodity];
            return (
              <tr key={commodity} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-center text-sm text-gray-900 border border-gray-300">{idx + 1}</td>
                <td className="px-4 py-2 text-left text-sm text-gray-900 border border-gray-300">{commodity} (Per Kg.)</td>
                <td className="px-4 py-2 text-center text-sm text-gray-900 border border-gray-300">
                  {prices && prices.lowest ? `₱${prices.lowest.toFixed(2)}` : ''}
                </td>
                <td className="px-4 py-2 text-center text-sm text-gray-900 border border-gray-300">
                  {prices && prices.highest ? `₱${prices.highest.toFixed(2)}` : ''}
                </td>
                <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border border-gray-300">
                  {prices && prices.average ? `₱${prices.average.toFixed(2)}` : ''}
                </td>
                <td className="px-4 py-2 text-center text-sm text-gray-500 border border-gray-300"></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">💰 Price Monitoring Report</h1>
                <p className="text-sm text-gray-600 mt-1">Agricultural Crops Commodity Price Monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                <option value="all">All Years</option>
                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                <option value="all">All Months</option>
                {monthNames.map((month, idx) => <option key={idx} value={idx + 1}>{month}</option>)}
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button onClick={downloadCSV}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                <span>📥</span><span>CSV</span>
              </button>
              <button onClick={handlePrint}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                <span>🖨️</span><span>Print</span>
              </button>
            </div>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-semibold text-blue-700">Period: {getPeriodLabel()}</p>
                <p className="text-sm text-gray-600 mt-1">Each month aggregates all weeks (1-4): LP = min, HP = max, AP = average</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>✍️</span> Signature Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Prepared/Submitted by</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter name" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title/Position</label>
                <input type="text" value={preparedTitle} onChange={(e) => setPreparedTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter title" />
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Submitted to</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input type="text" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter name" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title/Position</label>
                <input type="text" value={approvedTitle} onChange={(e) => setApprovedTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter title" />
              </div>
            </div>
          </div>
        </div>

        {/* Tables */}
        <div ref={printRef}>
          {sortedMonths.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">No data available for selected filters</div>
          ) : (
            sortedMonths.map(([monthKey, data]) => {
              const monthLabel = `${monthNames[data.month - 1]} ${data.year}`;
              return (
                <div key={monthKey} className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                  <div className="bg-yellow-50 border-b border-yellow-300 px-6 py-3">
                    <h3 className="text-lg font-bold text-gray-900">📅 {monthLabel}</h3>
                    <p className="text-xs text-gray-500">Aggregated from Weeks 1-4</p>
                  </div>

                  <div className="p-4">
                    {/* Section 1: Vegetables / High Value Crops */}
                    {vegetableCommodities.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold text-gray-800 mb-2 bg-green-50 px-3 py-2 rounded border-l-4 border-green-500">
                          1. HIGH VALUE CROP COMMODITY PRODUCT PRICE MONITORING
                        </h4>
                        {renderCommodityTable(vegetableCommodities, data)}
                      </>
                    )}

                    {/* Section 2: Rice & Corn */}
                    {riceCornCommodities.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold text-gray-800 mt-5 mb-2 bg-amber-50 px-3 py-2 rounded border-l-4 border-amber-500">
                          2. RICE & CORN COMMODITY PRICE MONITORING
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
              <p className="text-sm text-gray-600 mb-1">Prepared/Submitted by:</p>
              <div className="mt-8 pt-2 inline-block border-t-2 border-gray-800">
                <p className="font-bold uppercase">{preparedBy}</p>
                <p className="text-sm text-gray-600">{preparedTitle}</p>
              </div>
            </div>
            <div className="signature-box">
              <p className="text-sm text-gray-600 mb-1">Submitted to:</p>
              <div className="mt-8 pt-2 inline-block border-t-2 border-gray-800">
                <p className="font-bold uppercase">{approvedBy}</p>
                <p className="text-sm text-gray-600">{approvedTitle}</p>
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

export default PricePage;