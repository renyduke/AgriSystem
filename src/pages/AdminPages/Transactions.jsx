  import React, { useEffect, useState } from "react";
  import { db } from "../../config/firebaseConfig";
  import { collection, getDocs, query, orderBy } from "firebase/firestore";

  const Transactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState("desc");

    useEffect(() => {
      const fetchTransactions = async () => {
        try {
          setLoading(true);
          setError(null);

          // Query qrScans collection instead of transactions
          const q = query(collection(db, "qrScans"), orderBy("timestamp", "desc"));
          const transSnapshot = await getDocs(q);
          const transData = transSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: new Date(doc.data().timestamp), // Convert ISO string to Date
          }));

          setTransactions(transData);
        } catch (err) {
          console.error("Error fetching transactions:", err);
          setError("Failed to load transactions");
        } finally {
          setLoading(false);
        }
      };

      fetchTransactions();
    }, []);

    // Filter transactions
    const filteredTransactions = transactions.filter(trans =>
      trans.buyerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trans.buyerId?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort transactions
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
      return sortOrder === "desc"
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp;
    });

    const toggleSortOrder = () => {
      setSortOrder(prev => (prev === "desc" ? "asc" : "desc"));
    };

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-100 via-green-50 to-teal-100 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-green-600"></div>
            <p className="mt-4 text-gray-600 text-lg">Loading transactions...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-100 via-green-50 to-teal-100 flex items-center justify-center p-4">
          <p className="text-center text-red-700 bg-red-50 p-4 rounded-xl text-lg font-medium">{error}</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-100 via-green-50 to-teal-100 p-4 md:p-6 ml-55">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-auto p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-green-900 mb-6 text-center flex items-center justify-center">
            <span className="mr-2 text-green-600">🛍️</span> Transaction History
          </h1>

          {/* Search and Sort Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <input
              type="text"
              placeholder="Search by buyer name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-2/3 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            />
            <button
              onClick={toggleSortOrder}
              className="w-full sm:w-auto bg-green-600 text-white py-3 px-6 rounded-xl hover:bg-green-700 transition-all duration-200 flex items-center justify-center shadow-md"
            >
              <span className="mr-2">{sortOrder === "desc" ? "↓" : "↑"}</span>
              Sort by Date
            </button>
          </div>

          {/* Transactions List */}
          {sortedTransactions.length === 0 ? (
            <p className="text-center text-gray-600 text-lg">No transactions found.</p>
          ) : (
            <div className="space-y-6">
              {sortedTransactions.map((trans) => (
                <div
                  key={trans.id}
                  className="bg-green-50 p-5 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-green-800">
                        Buyer: {trans.buyerName || "Unknown"}
                      </h3>
                      <p className="text-gray-700">
                        <strong className="text-green-700">ID:</strong> {trans.buyerId}
                      </p>
                      <p className="text-gray-700">
                        <strong className="text-green-700">Scanned:</strong>{" "}
                        {trans.timestamp.toLocaleDateString()} {trans.timestamp.toLocaleTimeString()}
                      </p>
                      {trans.selectedVegetables && (
                        <p className="text-gray-700">
                          <strong className="text-green-700">Vegetables:</strong>{" "}
                          {trans.selectedVegetables.join(", ")}
                        </p>
                      )}
                      <p className="text-gray-700">
                        <strong className="text-green-700">Quantity:</strong> {trans.quantity}
                      </p>
                    </div>
                    <div className="mt-4 md:mt-0">
                      <span
                        className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium"
                      >
                        Scanned
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  export default Transactions;