import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://backend-3-fl3e.onrender.com';

const VolumePage = () => {
  const [volumeData, setVolumeData] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Signature States
  const [preparedBy, setPreparedBy] = useState('JACKLORD P. VILLARINO');
  const [preparedTitle, setPreparedTitle] = useState('Farm Worker 1/Data Collector');
  const [approvedBy, setApprovedBy] = useState('ANDREA C. CANOY');
  const [approvedTitle, setApprovedTitle] = useState('City Agriculturist');

  const printRef = useRef();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    fetchVolumeData();
  }, []);

  const fetchVolumeData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard`);
      setVolumeData(response.data.volume_data);
      setCommodities(response.data.commodities);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching volume data:', err);
      setLoading(false);
    }
  };

  // Process data into table format
  const processTableData = () => {
    let filteredData = volumeData;

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

      grouped[monthKey].weeks[weekKey][item.commodity] = item.volume;
    });

    return grouped;
  };

  // Calculate totals for each commodity
  const calculateCommodityTotals = (tableData) => {
    const totals = {};
    commodities.forEach(commodity => {
      totals[commodity] = 0;
    });

    Object.values(tableData).forEach(monthData => {
      Object.values(monthData.weeks).forEach(weekData => {
        commodities.forEach(commodity => {
          if (weekData[commodity]) {
            totals[commodity] += weekData[commodity];
          }
        });
      });
    });

    return totals;
  };

  // Calculate week totals
  const calculateWeekTotal = (weekData) => {
    return commodities.reduce((sum, commodity) => {
      return sum + (weekData[commodity] || 0);
    }, 0);
  };

  // Download as CSV
  const downloadCSV = () => {
    const tableData = processTableData();
    const totals = calculateCommodityTotals(tableData);

    let csv = 'Month/Date,' + commodities.join(',') + ',Total\n';

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
            row.push(weekData[commodity] ? weekData[commodity].toFixed(2) : '');
          });

          row.push(calculateWeekTotal(weekData).toFixed(2));
          csv += row.join(',') + '\n';
        });
      });

    // Add totals row
    csv += 'Total,';
    csv += commodities.map(commodity => totals[commodity].toFixed(2)).join(',');
    const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
    csv += ',' + grandTotal.toFixed(2) + '\n';

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volume_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Volume Report</title>
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
            @media print {
              body { margin: 0.5cm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/logo.png" style="width: 60px; height: 60px; margin-bottom: 10px;" />
            <h2>Agricultural Volume Report</h2>
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
  const availableYears = [...new Set(volumeData.map(d => d.year))].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading volume data...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">📦 Volume Data Report</h1>
              <p className="text-sm text-gray-600 mt-1">Detailed commodity volume analysis</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
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

            <div className="flex-1 min-w-[200px]">
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
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <span>📥</span>
                <span>Download CSV</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <span>🖨️</span>
                <span>Print</span>
              </button>
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
                      {commodity}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase border border-gray-300">
                    Total
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
                            const weekTotal = calculateWeekTotal(weekData);
                            const displayWeek = weekNum.toLowerCase().includes('week') ? weekNum : `Week ${weekNum}`;

                            return (
                              <tr key={`${monthKey}-${weekNum}`} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-center text-sm text-gray-900 border border-gray-300">
                                  {displayWeek}
                                </td>
                                {commodities.map(commodity => (
                                  <td
                                    key={commodity}
                                    className="px-4 py-2 text-center text-sm text-gray-900 border border-gray-300"
                                    style={{ backgroundColor: weekData[commodity] ? '#ffff99' : 'white' }}
                                  >
                                    {weekData[commodity] ? weekData[commodity].toFixed(2) : ''}
                                  </td>
                                ))}
                                <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border border-gray-300 bg-gray-100">
                                  {weekTotal > 0 ? weekTotal.toFixed(2) : ''}
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
                      Total
                    </td>
                    {commodities.map(commodity => (
                      <td
                        key={commodity}
                        className="px-4 py-3 text-center text-sm font-bold text-gray-900 border border-gray-300"
                      >
                        {totals[commodity] > 0 ? totals[commodity].toFixed(2) : ''}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 border border-gray-300">
                      {Object.values(totals).reduce((sum, val) => sum + val, 0).toFixed(2)}
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

export default VolumePage;