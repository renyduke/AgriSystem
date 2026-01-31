// src/pages/PricePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:8000';

const PricePage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/dashboard`);
        setData(res.data);
      } catch (err) {
        setError('Failed to load price data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading price data...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.price_data?.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow max-w-md">
          <p className="text-red-600 text-xl mb-4">No price data available</p>
          <Link to="/dashboard" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Get unique week keys
  const weeks = [...new Set(data.price_data.map(item => `${item.year}-${String(item.month).padStart(2,'0')}-W${item.week}`))].sort();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Weekly Price Report</h1>
          <Link
            to="/"
            className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-green-700 text-white px-6 py-5">
            <h2 className="text-xl font-semibold">Weekly Average Prices (₱/kg)</h2>
            <p className="text-green-100 mt-1 text-sm">
              {weeks.length} weeks • {data.commodities.length} commodities
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Week
                  </th>
                  {data.commodities.map(commodity => (
                    <th
                      key={commodity}
                      className="px-5 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[110px]"
                    >
                      {commodity}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-800 uppercase bg-green-50">
                    Avg Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {weeks.map(weekKey => {
                  const weekEntries = data.price_data.filter(
                    d => `${d.year}-${String(d.month).padStart(2,'0')}-W${d.week}` === weekKey
                  );
                  const weekMap = Object.fromEntries(weekEntries.map(e => [e.commodity, e.average_price]));
                  const weekAvg = weekEntries.reduce((sum, e) => sum + e.average_price, 0) / weekEntries.length || 0;

                  return (
                    <tr key={weekKey} className="hover:bg-green-50/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {weekKey}
                      </td>
                      {data.commodities.map(commodity => (
                        <td key={commodity} className="px-5 py-4 text-center text-sm text-gray-700">
                          {weekMap[commodity] != null ? weekMap[commodity].toFixed(2) : '—'}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-center font-bold text-green-700 bg-green-50/30">
                        {weekAvg.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}

                {/* Grand Averages */}
                <tr className="bg-green-50 font-bold">
                  <td className="px-6 py-5 text-right text-gray-800 uppercase tracking-wide">
                    OVERALL AVERAGE
                  </td>
                  {data.commodities.map(commodity => {
                    const prices = data.price_data
                      .filter(d => d.commodity === commodity)
                      .map(d => d.average_price);
                    const avg = prices.length ? (prices.reduce((a,b)=>a+b,0) / prices.length) : 0;
                    return (
                      <td key={commodity} className="px-5 py-5 text-center text-green-700">
                        {avg.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="px-6 py-5 text-center text-xl text-green-800 bg-green-50/60">
                    {(data.price_data.reduce((sum, d) => sum + d.average_price, 0) / data.price_data.length || 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricePage;