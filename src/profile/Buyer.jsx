import { useEffect, useState } from "react";
import { db } from "../config/firebaseConfig";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { FaUser, FaPhone, FaShoppingCart, FaEdit, FaTrash, FaSearch } from "react-icons/fa";

const Buyer = () => {
  const [buyers, setBuyers] = useState([]);
  const [filteredBuyers, setFilteredBuyers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    const fetchBuyers = async () => {
      try {
        const buyersRef = collection(db, "buyers");
        const querySnapshot = await getDocs(buyersRef);
        const buyerList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setBuyers(buyerList);
        setFilteredBuyers(buyerList);
      } catch (error) {
        console.error("Error fetching buyers:", error);
      }
    };

    fetchBuyers();
  }, []);

  useEffect(() => {
    const filtered = buyers.filter(buyer => 
      buyer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      buyer.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      buyer.vegetable?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBuyers(filtered);
  }, [searchTerm, buyers]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this buyer?")) {
      try {
        await deleteDoc(doc(db, "buyers", id));
        setBuyers((prevBuyers) => prevBuyers.filter((buyer) => buyer.id !== id));
        alert("Buyer deleted successfully!");
      } catch (error) {
        console.error("Error deleting buyer:", error);
        alert("Error deleting buyer.");
      }
    }
  };

  const handleEdit = (buyer) => {
    setEditingBuyer(buyer.id);
    setEditForm({
      name: buyer.name,
      contact: buyer.contact,
      vegetable: buyer.vegetable,
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (buyerId) => {
    try {
      const buyerRef = doc(db, "buyers", buyerId);
      await updateDoc(buyerRef, editForm);
      setBuyers((prev) =>
        prev.map((buyer) => (buyer.id === buyerId ? { ...buyer, ...editForm } : buyer))
      );
      setEditingBuyer(null);
      alert("Buyer updated successfully!");
    } catch (error) {
      console.error("Error updating buyer:", error);
      alert("Error updating buyer.");
    }
  };

  return (
    <div className="max-w-4xl ml-105 p-6">
      <h2 className="text-3xl font-bold text-green-700 text-center mb-6">🛒 Buyer Community Profiles</h2>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, contact, or vegetable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
          />
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="space-y-8">
        {filteredBuyers.length > 0 ? (
          filteredBuyers.map((buyer) => (
            <div
              key={buyer.id}
              className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
            >
              <div className="h-32 bg-blue-200 relative">
                <div className="absolute -bottom-16 left-6">
                  <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center border-4 border-white shadow-md">
                    <FaUser className="text-gray-600 text-4xl" />
                  </div>
                </div>
              </div>

              <div className="pt-16 pb-6 px-6">
                <div className="flex justify-between items-start">
                  <div className="ml-32">
                    {editingBuyer === buyer.id ? (
                      <input
                        type="text"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                        className="text-2xl font-bold text-gray-800 border rounded p-1"
                      />
                    ) : (
                      <h3 className="text-2xl font-bold text-gray-800">{buyer.name}</h3>
                    )}
                    <p className="text-gray-500">Buyer in Canlaon City</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(buyer)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Edit Profile"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(buyer.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete Profile"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                <hr className="my-4 border-gray-200" />

                {editingBuyer === buyer.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <FaPhone className="text-green-700 mr-3" />
                      <input
                        type="text"
                        name="contact"
                        value={editForm.contact}
                        onChange={handleEditChange}
                        className="w-full border rounded p-1 text-gray-700"
                      />
                    </div>
                    <div className="flex items-center">
                      <FaShoppingCart className="text-green-700 mr-3" />
                      <input
                        type="text"
                        name="vegetable"
                        value={editForm.vegetable}
                        onChange={handleEditChange}
                        className="w-full border rounded p-1 text-gray-700"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSave(buyer.id)}
                        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingBuyer(null)}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <FaPhone className="text-green-700 mr-3" />
                      <span className="text-gray-700">
                        <strong>Contact:</strong> {buyer.contact}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <FaShoppingCart className="text-green-700 mr-3" />
                      <span className="text-gray-700">
                        <strong>Vegetable:</strong> {buyer.vegetable || "N/A"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-6 bg-white rounded-lg shadow-lg">
            <p className="text-gray-500">No buyers found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Buyer;