import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore"; // Added setDoc
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
    position: "user",
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
    setEditingUser({ ...editingUser, [e.target.name]: e.target.value });
  };

  const handleNewUserChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
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
        position: "user",
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

  // Rest of the component (JSX) remains unchanged
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <FaSpinner className="text-4xl text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 pl-">
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.position === "admin" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                    }`}>
                      {user.position}
                    </span>
                  </td>
                  <td className="p-4 flex space-x-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="flex items-center bg-blue-500 text-white px-3 py-1 rounded-lg 
                        hover:bg-blue-600 transition-all duration-300"
                    >
                      <FaEdit className="mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="flex items-center bg-red-500 text-white px-3 py-1 rounded-lg 
                        hover:bg-red-600 transition-all duration-300"
                    >
                      <FaTrash className="mr-1" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
              <h3 className="text-2xl font-bold text-green-800 mb-6 flex items-center">
                <FaEdit className="mr-2" /> Edit User
              </h3>
              <form onSubmit={handleUpdate} className="space-y-5">
                <input
                  type="text"
                  name="fullName"
                  value={editingUser.fullName}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Full Name"
                />
                <input
                  type="email"
                  name="email"
                  value={editingUser.email}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Email"
                />
                <select
                  name="position"
                  value={editingUser.position}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {addingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
              <h3 className="text-2xl font-bold text-green-800 mb-6 flex items-center">
                <FaPlus className="mr-2" /> Add New User
              </h3>
              <form onSubmit={handleAddUser} className="space-y-5">
                <input
                  type="text"
                  name="fullName"
                  value={newUser.fullName}
                  onChange={handleNewUserChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Full Name"
                  required
                />
                <input
                  type="email"
                  name="email"
                  value={newUser.email}
                  onChange={handleNewUserChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Email"
                  required
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={newUser.password}
                    onChange={handleNewUserChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={newUser.confirmPassword}
                    onChange={handleNewUserChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Confirm Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <select
                  name="position"
                  value={newUser.position}
                  onChange={handleNewUserChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setAddingUser(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                  >
                    Add User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        .animate-fade-up { animation: fadeUp 0.6s ease-out; }
      `}</style>
    </div>
  );
};

export default UserManagement;