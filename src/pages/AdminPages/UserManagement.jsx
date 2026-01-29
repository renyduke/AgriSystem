import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { FaUser, FaSpinner, FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash } from "react-icons/fa";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ 
    fullName: "", 
    email: "", 
    position: "collector",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
    } catch (err) {
      setError("Error fetching users: " + err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user) => setEditingUser({ ...user });
  
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const userRef = doc(db, "users", editingUser.id);
      await updateDoc(userRef, {
        fullName: editingUser.fullName,
        email: editingUser.email,
        position: editingUser.position.toLowerCase()
      });
      setEditingUser(null);
      fetchUsers();
      alert("User updated successfully!");
    } catch (err) {
      setError("Error updating user: " + err.message);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await deleteDoc(doc(db, "users", userId));
        fetchUsers();
        alert("User deleted successfully!");
      } catch (err) {
        setError("Error deleting user: " + err.message);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for fullName field
    if (name === "fullName") {
      // Only allow letters and spaces
      const lettersOnly = value.replace(/[^a-zA-Z\s]/g, '');
      
      // Capitalize first letter after each space
      const capitalized = lettersOnly
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      setEditingUser({ ...editingUser, [name]: capitalized });
    } else {
      setEditingUser({ ...editingUser, [name]: value });
    }
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for fullName field
    if (name === "fullName") {
      // Only allow letters and spaces
      const lettersOnly = value.replace(/[^a-zA-Z\s]/g, '');
      
      // Capitalize first letter after each space
      const capitalized = lettersOnly
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      setNewUser({ ...newUser, [name]: capitalized });
    } else {
      setNewUser({ ...newUser, [name]: value });
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (newUser.password !== newUser.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newUser.email,
        newUser.password
      );
      const user = userCredential.user;

      // Use setDoc to store user data with UID as document ID
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: newUser.fullName,
        email: newUser.email,
        position: newUser.position.toLowerCase(),
        createdAt: new Date().toISOString()
      });

      setAddingUser(false);
      setNewUser({ 
        fullName: "", 
        email: "", 
        position: "collector",
        password: "",
        confirmPassword: ""
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      fetchUsers();
      alert("User added successfully!");
    } catch (err) {
      setError("Error adding user: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <FaSpinner className="text-4xl text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 relative">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-10 animate-fade-in">
          <h2 className="text-4xl font-extrabold text-green-800 flex items-center">
            <FaUser className="mr-3 text-green-600" />
            <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              User Management
            </span>
          </h2>
          <button
            onClick={() => setAddingUser(true)}
            className="group flex items-center bg-green-600 text-white px-4 py-2 rounded-full 
              hover:bg-green-700 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <FaPlus className="mr-2 group-hover:animate-pulse" />
            Add User
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-xl shadow-md animate-fade-in">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-x-auto animate-fade-up">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <tr>
                <th className="p-4 text-left">Full Name</th>
                <th className="p-4 text-left">Email</th>
                <th className="p-4 text-left">Position</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr
                  key={user.id}
                  className={`border-b hover:bg-green-50 transition-colors duration-200 ${
                    index % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <td className="p-4">{user.fullName}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.position === "admin" 
                        ? "bg-blue-100 text-blue-800" 
                        : "bg-green-100 text-green-800"
                    }`}>
                      {user.position}
                    </span>
                  </td>
                  <td className="p-4 flex space-x-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="flex items-center bg-blue-500 text-white px-3 py-1.5 rounded-lg 
                        hover:bg-blue-600 transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <FaEdit className="mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="flex items-center bg-red-500 text-white px-3 py-1.5 rounded-lg 
                        hover:bg-red-600 transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <FaTrash className="mr-1" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <>
            {/* Backdrop with blur */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
              onClick={() => setEditingUser(null)}
            ></div>
            
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
              <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl pointer-events-auto animate-scale-in">
                <h3 className="text-2xl font-bold text-green-800 mb-6 flex items-center">
                  <FaEdit className="mr-2 text-green-600" /> Edit User
                </h3>
                <form onSubmit={handleUpdate} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={editingUser.fullName}
                      onChange={handleChange}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Full Name"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Letters only, auto-capitalized</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={editingUser.email}
                      onChange={handleChange}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Email"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Position
                    </label>
                    <select
                      name="position"
                      value={editingUser.position}
                      onChange={handleChange}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    >
                      <option value="admin">Admin</option>
                      <option value="collector">Collector</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-5 py-2.5 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-medium shadow-md hover:shadow-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Add User Modal */}
        {addingUser && (
          <>
            {/* Backdrop with blur */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
              onClick={() => setAddingUser(false)}
            ></div>
            
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
              <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl pointer-events-auto animate-scale-in max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-bold text-green-800 mb-6 flex items-center">
                  <FaPlus className="mr-2 text-green-600" /> Add New User
                </h3>
                <form onSubmit={handleAddUser} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={newUser.fullName}
                      onChange={handleNewUserChange}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Full Name"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Letters only, auto-capitalized</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={newUser.email}
                      onChange={handleNewUserChange}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Email"
                      required
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={newUser.password}
                      onChange={handleNewUserChange}
                      className="w-full p-3 pr-10 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-[42px] text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={newUser.confirmPassword}
                      onChange={handleNewUserChange}
                      className="w-full p-3 pr-10 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Confirm Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-[42px] text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Position
                    </label>
                    <select
                      name="position"
                      value={newUser.position}
                      onChange={handleNewUserChange}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    >
                      <option value="admin">Admin</option>
                      <option value="collector">Collector</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddingUser(false)}
                      className="px-5 py-2.5 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-medium shadow-md hover:shadow-lg"
                    >
                      Add User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-fade-up { animation: fadeUp 0.6s ease-out; }
        .animate-scale-in { animation: scaleIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default UserManagement;