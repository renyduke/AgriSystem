import { useState, useEffect } from "react";
import { db } from "../../config/firebaseConfig"; // Consistent with your project
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { FaTrash, FaEdit, FaQrcode } from "react-icons/fa";
import QRCode from "qrcode";

const QRCodes = () => {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [editBuyerData, setEditBuyerData] = useState({
    name: "",
    contact: "",
  });

  // Fetch buyers with QR codes from Firestore
  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const buyersSnapshot = await getDocs(collection(db, "buyers"));
      const buyersList = await Promise.all(
        buyersSnapshot.docs.map(async (doc) => {
          const buyerData = {
            id: doc.id,
            name: doc.data().name,
            contact: doc.data().contact,
            qrImage: doc.data().qrImage || null, // Check if QR exists
          };

          // Generate QR if it doesn't exist
          if (!buyerData.qrImage) {
            const qrImageData = await QRCode.toDataURL(buyerData.id, {
              width: 200,
              margin: 2,
            });
            buyerData.qrImage = qrImageData;
            // Update Firestore with QR image
            await updateDoc(doc.ref, { qrImage: qrImageData });
          }

          return buyerData;
        })
      );
      setBuyers(buyersList);
    } catch (error) {
      console.error("Error fetching buyers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Edit buyer details
  const handleEditBuyer = async (buyer) => {
    if (!editBuyerData.name.trim() || !editBuyerData.contact.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const buyerDoc = doc(db, "buyers", buyer.id);
      await updateDoc(buyerDoc, {
        name: editBuyerData.name.trim(),
        contact: editBuyerData.contact.trim(),
      });

      setEditingBuyer(null);
      setEditBuyerData({ name: "", contact: "" });
      await fetchBuyers();
    } catch (error) {
      console.error("Error editing buyer:", error);
      alert("Error editing buyer");
    } finally {
      setLoading(false);
    }
  };

  // Delete buyer and their QR code
  const handleDeleteBuyer = async (buyerId) => {
    if (!window.confirm("Are you sure you want to delete this buyer and their QR code?")) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, "buyers", buyerId));
      await fetchBuyers();
    } catch (error) {
      console.error("Error deleting buyer:", error);
      alert("Error deleting buyer");
    } finally {
      setLoading(false);
    }
  };

  // Download QR code
  const downloadQRCode = (buyer) => {
    const link = document.createElement("a");
    link.href = buyer.qrImage;
    link.download = `buyer-qr-${buyer.id}.png`;
    link.click();
  };

  return (
    <div className="ml-60 p-8 bg-gray-100 min-h-screen">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <FaQrcode className="mr-2" /> Buyer QR Codes
        </h2>

        {/* Buyers List with QR Codes */}
        {loading ? (
          <div className="text-center py-4 text-gray-600">Loading...</div>
        ) : buyers.length === 0 ? (
          <div className="text-center py-4 text-gray-600">No registered buyers found.</div>
        ) : (
          <div className="space-y-4">
            {buyers.map((buyer) => (
              <div
                key={buyer.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                {editingBuyer?.id === buyer.id ? (
                  <div className="flex flex-col gap-2 flex-1">
                    <input
                      type="text"
                      value={editBuyerData.name}
                      onChange={(e) => setEditBuyerData({ ...editBuyerData, name: e.target.value })}
                      className="p-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Edit name"
                    />
                    <input
                      type="tel"
                      value={editBuyerData.contact}
                      onChange={(e) => setEditBuyerData({ ...editBuyerData, contact: e.target.value })}
                      className="p-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Edit contact"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditBuyer(buyer)}
                        className="text-green-600 hover:text-green-800"
                        disabled={loading}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingBuyer(null)}
                        className="text-gray-600 hover:text-gray-800"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 flex-1">
                    <img src={buyer.qrImage} alt={`QR for ${buyer.name}`} className="w-16 h-16" />
                    <div>
                      <span className="font-medium">{buyer.name}</span>
                      <p className="text-sm text-gray-600">{buyer.contact}</p>
                    </div>
                  </div>
                )}
                {!editingBuyer && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingBuyer(buyer);
                        setEditBuyerData({
                          name: buyer.name,
                          contact: buyer.contact,
                        });
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      disabled={loading}
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDeleteBuyer(buyer.id)}
                      className="text-red-500 hover:text-red-700"
                      disabled={loading}
                    >
                      <FaTrash />
                    </button>
                    <button
                      onClick={() => downloadQRCode(buyer)}
                      className="text-green-600 hover:text-green-800"
                      disabled={loading}
                    >
                      Download QR
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodes;