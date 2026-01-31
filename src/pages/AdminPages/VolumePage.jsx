// src/pages/VolumePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:8000';

const VolumePage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/dashboard`);
        setData(res.data);
      } catch (err) {
        setError('Failed to load volume data');
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading volume data...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.daily_volume_data?.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow max-w-md">
          <p className="text-red-600 text-xl mb-4">No volume data available</p>
          <Link to="/" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Get unique sorted dates
  const dates = [...new Set(data.daily_volume_data.map(item => item.date))].sort();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
  <Link
    to="/home/dashboard"
    className="inline-flex items-center px-5 py-2.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors shadow-sm"
  >
    <svg 
      className="w-5 h-5 mr-2" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
    Back to Dashboard
  </Link>
</div>
        <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-blue-700 text-white px-6 py-5">
            <h2 className="text-xl font-semibold">Daily Harvest Volumes (kg)</h2>
            <p className="text-blue-100 mt-1 text-sm">
              {dates.length} days • {data.commodities.length} commodities
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  {data.commodities.map(commodity => (
                    <th
                      key={commodity}
                      className="px-5 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[110px]"
                    >
                      {commodity}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-800 uppercase bg-blue-50">
                    Total (kg)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {dates.map(date => {
                  const dayEntries = data.daily_volume_data.filter(d => d.date === date);
                  const dayMap = Object.fromEntries(dayEntries.map(e => [e.commodity, e.volume]));
                  const dayTotal = dayEntries.reduce((sum, e) => sum + e.volume, 0);

                  return (
                    <tr key={date} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(date).toLocaleDateString('en-PH', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      {data.commodities.map(commodity => (
                        <td key={commodity} className="px-5 py-4 text-center text-sm text-gray-700">
                          {dayMap[commodity] != null ? dayMap[commodity].toLocaleString() : '—'}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-center font-bold text-blue-700 bg-blue-50/30">
                        {dayTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}

                {/* Grand Totals */}
                <tr className="bg-green-50 font-bold">
                  <td className="px-6 py-5 text-right text-gray-800 uppercase tracking-wide">
                    GRAND TOTAL
                  </td>
                  {data.commodities.map(commodity => {
                    const total = data.daily_volume_data
                      .filter(d => d.commodity === commodity)
                      .reduce((sum, d) => sum + d.volume, 0);
                    return (
                      <td key={commodity} className="px-5 py-5 text-center text-green-700">
                        {total.toLocaleString()}
                      </td>
                    );
                  })}
                  <td className="px-6 py-5 text-center text-xl text-green-800 bg-green-50/60">
                    {data.daily_volume_data.reduce((sum, d) => sum + d.volume, 0).toLocaleString()}
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

export default VolumePage;