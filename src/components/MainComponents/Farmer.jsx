import { useState, useEffect } from "react";
import { db } from "../../config/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const Farmer = () => {
  const [farmers, setFarmers] = useState([]);

  useEffect(() => {
    const fetchFarmers = async () => {
      const querySnapshot = await getDocs(collection(db, "farmers"));
      const farmerList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFarmers(farmerList);
    };
    
    fetchFarmers();
  }, []);

  return (
    <div className="p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold">Registered Farmers</h2>

      {farmers.length === 0 ? (
        <p className="text-gray-600 mt-4">No farmers registered yet.</p>
      ) : (
        <ul className="mt-4">
          {farmers.map((farmer) => (
            <li key={farmer.id} className="p-2 border-b">
              <p><strong>Name:</strong> {farmer.name}</p>
              <p><strong>Email:</strong> {farmer.email}</p>
              <p><strong>Phone:</strong> {farmer.phone}</p>
              <p><strong>Main Crops:</strong> {farmer.crops}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Farmer;
