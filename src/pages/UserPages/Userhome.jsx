import React, { useEffect, useState } from "react";
import { db } from "@/config/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function UserHome() {
  const [farmers, setFarmers] = useState([]);
  const [vegetables, setVegetables] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [farmersSnap, vegSnap, transSnap, priceSnap, locSnap, notifSnap] = await Promise.all([
          getDocs(collection(db, "farmers")),
          getDocs(collection(db, "vegetables")),
          getDocs(collection(db, "transactions")),
          getDocs(collection(db, "market_prices")),
          getDocs(collection(db, "farmer_locations")),
          getDocs(collection(db, "notifications"))
        ]);

        setFarmers(farmersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setVegetables(vegSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setTransactions(transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setMarketPrices(priceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLocations(locSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setNotifications(notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredVegetables = vegetables.filter(veg => 
    veg.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const vegetableTrends = vegetables.reduce((acc, veg) => {
    acc[veg.name] = (acc[veg.name] || 0) + (veg.quantity || 1);
    return acc;
  }, {});

  const trendData = Object.entries(vegetableTrends)
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  const handleRegisterFarmer = () => {
    // Add your farmer registration logic here
    console.log("Register new farmer");
  };

  const handleRegisterBuyerNeeds = () => {
    // Add your buyer needs registration logic here
    console.log("Register buyer needs");
  };

  if (loading) return <div className="p-6 bg-gray-100 min-h-screen ml-64">Loading...</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen ml-64">
      <h1 className="text-2xl font-bold text-center mb-6">Dashboard</h1>

      {/* Overview Section */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 relative">
        <div className="bg-blue-500 text-white p-4 rounded-lg">
          <h2 className="text-lg">Total Farmers 🧑‍🌾</h2>
          <p className="text-2xl font-bold">{farmers.length}</p>
        </div>
        <div className="bg-green-500 text-white p-4 rounded-lg">
          <h2 className="text-lg">Available Vegetables 🥦</h2>
          <p className="text-2xl font-bold">{vegetables.length}</p>
        </div>
        <div className="bg-yellow-500 text-white p-4 rounded-lg">
          <h2 className="text-lg">Market Price Updates 💲</h2>
          <p className="text-2xl font-bold">{marketPrices.length}</p>
        </div>
        <div className="bg-purple-500 text-white p-4 rounded-lg">
          <h2 className="text-lg">Recent Transactions 🛍️</h2>
          <p className="text-2xl font-bold">{transactions.length}</p>
        </div>
        {/* Plus Button for Registering Farmer */}
        <button
          onClick={handleRegisterFarmer}
          className="absolute -top-4 -right-4 w-12 h-12 bg-blue-600 text-white rounded-full 
                     flex items-center justify-center shadow-lg hover:bg-blue-700 
                     transition-all duration-200 transform hover:scale-105"
          title="Register New Farmer"
        >
          <span className="text-2xl">+</span>
        </button>
      </section>

      {/* Interactive Map */}
      <section className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">📍 Interactive Map</h2>
        {locations.length > 0 && (
          <MapContainer 
            center={[locations[0].lat, locations[0].lng]} 
            zoom={12} 
            style={{ height: "400px", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {locations.map((loc) => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                <Popup>
                  {loc.name}<br/>
                  Vegetables: {loc.availableVegetables?.join(", ") || "N/A"}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
        <p className="mt-2 text-sm text-gray-600">
          View registered farmers and suggested routes to nearby farms
        </p>
      </section>

      {/* Statistics & Insights */}
      <section className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">📊 Statistics & Insights</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trendData}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="quantity" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-sm text-gray-600">
          Most demanded vegetables and production trends
        </p>
      </section>

      {/* Notifications & Updates */}
      <section className="bg-white p-6 rounded-lg shadow-lg mb-6 relative">
        <h2 className="text-xl font-semibold mb-4">🔔 Notifications & Updates</h2>
        <ul className="space-y-2">
          {notifications.slice(0, 5).map((notif) => (
            <li key={notif.id} className="border-b pb-2">
              {notif.type === "vegetable" && "🥕 New Vegetable: "}
              {notif.type === "price" && "💰 Price Update: "}
              {notif.type === "announcement" && "📢 DA Announcement: "}
              {notif.message}
            </li>
          ))}
        </ul>
        {/* Plus Button for Registering Buyer Needs */}
        <button
          onClick={handleRegisterBuyerNeeds}
          className="absolute top-4 right-4 w-10 h-10 bg-green-600 text-white rounded-full 
                     flex items-center justify-center shadow-lg hover:bg-green-700 
                     transition-all duration-200 transform hover:scale-105"
          title="Register Buyer Needs"
        >
          <span className="text-xl">+</span>
        </button>
      </section>

      {/* User Actions */}
      <section className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">🛠️ User Actions</h2>
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Search vegetables 🔎"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border rounded"
            />
            {searchQuery && (
              <ul className="mt-2 max-h-40 overflow-auto">
                {filteredVegetables.map((veg) => (
                  <li key={veg.id} className="p-2 hover:bg-gray-100">
                    {veg.name} - {veg.quantity} available
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            👨‍🌾 Check Farmer Profiles
          </button>
          <button className="bg-green-500 text-white px-4 py-2 rounded">
            📩 Request Purchase/Inquiry
          </button>
        </div>
      </section>
    </div>
  );
}

export default UserHome;