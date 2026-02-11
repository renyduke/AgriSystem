import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://backend-3-fl3e.onrender.com';

const PricePage = () => {
  const [priceData, setPriceData] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [priceType, setPriceType] = useState('average'); // 'lowest', 'highest', 'average'

  // Signature States
  const [preparedBy, setPreparedBy] = useState('JACKLORD P. VILLARINO');
  const [preparedTitle, setPreparedTitle] = useState('Farm Worker 1/Data Collector');
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

  // Process data into table format
  const processTableData = () => {
    let filteredData = priceData;

    // Apply filters
    if (selectedYear !== 'all') {
      filteredData = filteredData.filter(d => d.year === parseInt(selectedYear));
    }
    if (selectedMonth !== 'all') {
      filteredData = filteredData.filter(d => d.month === parseInt(selectedMonth));
    }

    // Group by month and week
    const grouped = {};

    filteredData.forEach(item => {
      const monthKey = `${item.year}-${item.month}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          month: item.month,
          year: item.year,
          weeks: {}
        };
      }

      const weekKey = item.week;
      if (!grouped[monthKey].weeks[weekKey]) {
        grouped[monthKey].weeks[weekKey] = {};
      }

      grouped[monthKey].weeks[weekKey][item.commodity] = {
        lowest: item.lowest_price,
        highest: item.highest_price,
        average: item.average_price
      };
    });

    return grouped;
  };

  // Get price value based on selected type
  const getPriceValue = (priceObj) => {
    if (!priceObj) return null;
    switch (priceType) {
      case 'lowest':
        return priceObj.lowest;
      case 'highest':
        return priceObj.highest;
      case 'average':
      default:
        return priceObj.average;
    }
  };

  // Calculate totals for each commodity
  const calculateCommodityTotals = (tableData) => {
    const totals = {};
    const counts = {};

    commodities.forEach(commodity => {
      totals[commodity] = 0;
      counts[commodity] = 0;
    });

    Object.values(tableData).forEach(monthData => {
      Object.values(monthData.weeks).forEach(weekData => {
        commodities.forEach(commodity => {
          if (weekData[commodity]) {
            const price = getPriceValue(weekData[commodity]);
            if (price) {
              totals[commodity] += price;
              counts[commodity]++;
            }
          }
        });
      });
    });

    // Calculate averages
    const averages = {};
    commodities.forEach(commodity => {
      averages[commodity] = counts[commodity] > 0 ? totals[commodity] / counts[commodity] : 0;
    });

    return averages;
  };

  // Calculate week average price
  const calculateWeekAverage = (weekData) => {
    let sum = 0;
    let count = 0;

    commodities.forEach(commodity => {
      if (weekData[commodity]) {
        const price = getPriceValue(weekData[commodity]);
        if (price) {
          sum += price;
          count++;
        }
      }
    });

    return count > 0 ? sum / count : 0;
  };

  // Download as CSV
  const downloadCSV = () => {
    const tableData = processTableData();
    const totals = calculateCommodityTotals(tableData);

    const priceLabel = priceType === 'lowest' ? 'LP' : priceType === 'highest' ? 'HP' : 'AP';
    let csv = `Month/Date,${commodities.join(',')},Average\n`;

    Object.entries(tableData)
      .sort(([keyA], [keyB]) => {
        const [yearA, monthA] = keyA.split('-').map(Number);
        const [yearB, monthB] = keyB.split('-').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
      })
      .forEach(([_, monthData]) => {
        const monthName = monthNames[monthData.month - 1];
        csv += `${monthName}\n`;

        const weekNumbers = Object.keys(monthData.weeks).sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.replace(/\D/g, '')) || 0;
          return numA - numB;
        });

        weekNumbers.forEach(weekNum => {
          const weekData = monthData.weeks[weekNum];
          const displayWeek = weekNum.toLowerCase().includes('week') ? weekNum : `Week ${weekNum}`;
          const row = [displayWeek];

          commodities.forEach(commodity => {
            const price = weekData[commodity] ? getPriceValue(weekData[commodity]) : 0;
            row.push(price ? price.toFixed(2) : '');
          });

          row.push(calculateWeekAverage(weekData).toFixed(2));
          csv += row.join(',') + '\n';
        });
      });

    // Add totals row
    csv += `Average (${priceLabel}),`;
    csv += commodities.map(commodity => totals[commodity] ? totals[commodity].toFixed(2) : '').join(',');
    const grandAverage = Object.values(totals).filter(v => v > 0).reduce((sum, val, _, arr) => sum + val / arr.length, 0);
    csv += ',' + grandAverage.toFixed(2) + '\n';

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price_report_${priceType}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = printRef.current.innerHTML;
    const priceLabel = priceType === 'lowest' ? 'Lowest Price (LP)' :
      priceType === 'highest' ? 'Highest Price (HP)' :
        'Average Price (AP)';

    printWindow.document.write(`
      <html>
        <head>
          <title>Price Report - ${priceLabel}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              font-size: 10px;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 6px 8px; 
              text-align: center;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
            }
            .month-header {
              background-color: #fff3cd;
              font-weight: bold;
              text-align: left;
            }
            .total-row {
              background-color: #e9ecef;
              font-weight: bold;
            }
            .signature-section {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              text-align: center;
              width: 45%;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .header h2 {
              margin: 5px 0;
            }
            .price-badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: bold;
              margin-left: 5px;
            }
            @media print {
              body { margin: 0.5cm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/logo.png" style="width: 60px; height: 60px; margin-bottom: 10px;" />
            <h2>Agricultural Price Report</h2>
            <p><strong>${priceLabel}</strong></p>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          ${printContent}
          <div class="signature-section">
            <div class="signature-box">
              <p>Prepared & Submitted By:</p>
              <div style="margin-top: 40px; border-top: 2px solid #000; padding-top: 5px;">
                <p><strong>${preparedBy}</strong></p>
                <p>${preparedTitle}</p>
              </div>
            </div>
            
            <div class="signature-box">
              <p>Approved By:</p>
              <div style="margin-top: 40px; border-top: 2px solid #000; padding-top: 5px;">
                <p><strong>${approvedBy}</strong></p>
                <p>${approvedTitle}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const tableData = processTableData();
  const totals = calculateCommodityTotals(tableData);
  const availableYears = [...new Set(priceData.map(d => d.year))].sort((a, b) => b - a);

  const getPriceTypeLabel = () => {
    switch (priceType) {
      case 'lowest':
        return { label: 'LP', full: 'Lowest Price', color: 'text-red-600', bg: 'bg-red-100' };
      case 'highest':
        return { label: 'HP', full: 'Highest Price', color: 'text-emerald-600', bg: 'bg-emerald-100' };
      case 'average':
      default:
        return { label: 'AP', full: 'Average Price', color: 'text-green-600', bg: 'bg-green-100' };
    }
  };

  const priceInfo = getPriceTypeLabel();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">💰 Price Data Report</h1>
              <p className="text-sm text-gray-600 mt-1">Detailed commodity price analysis (LP/HP/AP)</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price Type</label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="average">💚 Average Price (AP)</option>
                <option value="lowest">❤️ Lowest Price (LP)</option>
                <option value="highest">💎 Highest Price (HP)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Months</option>
                {monthNames.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-end">
              <button
                onClick={downloadCSV}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span>📥</span>
                <span>CSV</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span>🖨️</span>
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Price Type Info Banner */}
          <div className={`${priceInfo.bg} border-l-4 ${priceInfo.color.replace('text-', 'border-')} p-4 rounded`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <div>
                <p className={`font-semibold ${priceInfo.color}`}>
                  Currently Displaying: {priceInfo.full} ({priceInfo.label})
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {priceType === 'lowest' && 'Shows the minimum price recorded for each commodity per week'}
                  {priceType === 'highest' && 'Shows the maximum price recorded for each commodity per week'}
                  {priceType === 'average' && 'Shows the average price calculated for each commodity per week'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Settings - NEW Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>✍️</span> Signature Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Prepared & Submitted By</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title/Position</label>
                <input
                  type="text"
                  value={preparedTitle}
                  onChange={(e) => setPreparedTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Enter title"
                />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Approved By</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title/Position</label>
                <input
                  type="text"
                  value={approvedTitle}
                  onChange={(e) => setApprovedTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Enter title"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div ref={printRef} className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300">
                    Month/Date
                  </th>
                  {commodities.map(commodity => (
                    <th
                      key={commodity}
                      className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300"
                    >
                      <div>{commodity}</div>
                      <div className={`text-[9px] font-normal ${priceInfo.color}`}>({priceInfo.label})</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300">
                    <div>Average</div>
                    <div className={`text-[9px] font-normal ${priceInfo.color}`}>({priceInfo.label})</div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-300">
                {Object.entries(tableData).length === 0 ? (
                  <tr>
                    <td
                      colSpan={commodities.length + 2}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No data available for selected filters
                    </td>
                  </tr>
                ) : (
                  Object.entries(tableData)
                    .sort(([keyA], [keyB]) => {
                      const [yearA, monthA] = keyA.split('-').map(Number);
                      const [yearB, monthB] = keyB.split('-').map(Number);
                      if (yearA !== yearB) return yearA - yearB;
                      return monthA - monthB;
                    })
                    .map(([monthKey, monthData]) => {
                      const weekNumbers = Object.keys(monthData.weeks).sort((a, b) => {
                        const numA = parseInt(a.replace(/\D/g, '')) || 0;
                        const numB = parseInt(b.replace(/\D/g, '')) || 0;
                        return numA - numB;
                      });

                      return (
                        <React.Fragment key={monthKey}>
                          {/* Month Header Row */}
                          <tr className="bg-yellow-50">
                            <td
                              colSpan={commodities.length + 2}
                              className="px-4 py-2 text-left font-bold text-gray-900 border border-gray-300"
                            >
                              {monthNames[monthData.month - 1]}
                            </td>
                          </tr>

                          {/* Week Data Rows */}
                          {weekNumbers.map(weekNum => {
                            const weekData = monthData.weeks[weekNum];
                            const weekAverage = calculateWeekAverage(weekData);
                            const displayWeek = weekNum.toLowerCase().includes('week') ? weekNum : `Week ${weekNum}`;

                            return (
                              <tr key={`${monthKey}-${weekNum}`} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-center text-sm text-gray-900 border border-gray-300">
                                  {displayWeek}
                                </td>
                                {commodities.map(commodity => {
                                  const price = weekData[commodity] ? getPriceValue(weekData[commodity]) : null;
                                  return (
                                    <td
                                      key={commodity}
                                      className="px-4 py-2 text-center text-sm text-gray-900 border border-gray-300"
                                      style={{ backgroundColor: price ? '#ffff99' : 'white' }}
                                    >
                                      {price ? `₱${price.toFixed(2)}` : ''}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border border-gray-300 bg-gray-100">
                                  {weekAverage > 0 ? `₱${weekAverage.toFixed(2)}` : ''}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                )}

                {/* Totals Row */}
                {Object.entries(tableData).length > 0 && (
                  <tr className="bg-gray-200">
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 border border-gray-300">
                      Average ({priceInfo.label})
                    </td>
                    {commodities.map(commodity => (
                      <td
                        key={commodity}
                        className="px-4 py-3 text-center text-sm font-bold text-gray-900 border border-gray-300"
                      >
                        {totals[commodity] > 0 ? `₱${totals[commodity].toFixed(2)}` : ''}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 border border-gray-300">
                      ₱{Object.values(totals).filter(v => v > 0).reduce((sum, val, _, arr) => sum + val / arr.length, 0).toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Signature Section */}
            <div className="signature-section p-8">
              <div className="signature-box">
                <p className="text-sm text-gray-600 mb-1">Prepared & Submitted By:</p>
                <div className="mt-8 pt-4 border-t-2 border-gray-800">
                  <p className="font-bold uppercase">{preparedBy}</p>
                  <p className="text-sm text-gray-600">{preparedTitle}</p>
                </div>
              </div>

              <div className="signature-box">
                <p className="text-sm text-gray-600 mb-1">Approved By:</p>
                <div className="mt-8 pt-4 border-t-2 border-gray-800">
                  <p className="font-bold uppercase">{approvedBy}</p>
                  <p className="text-sm text-gray-600">{approvedTitle}</p>
                </div>
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
          .signature-section {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default PricePage;