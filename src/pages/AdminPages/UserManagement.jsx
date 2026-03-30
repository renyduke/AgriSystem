import { useState, useEffect } from "react";
import { OrbitProgress } from 'react-loading-indicators';
import { useTheme } from "../../context/ThemeContext";
import { auth, db, firebaseConfig } from "../../firebase";
import { logActivity } from "../../services/activityLogger";
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc, getDoc, arrayUnion } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { useNavigate } from "react-router-dom";
import { FaUser, FaSpinner, FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash } from "react-icons/fa";
import { supabase } from "../../supabase/supabaseClient";

const UserManagement = () => {
  const { darkMode } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [availableTitles, setAvailableTitles] = useState([]);
  const [showNewTitleInput, setShowNewTitleInput] = useState(false);
  const [newTitleValue, setNewTitleValue] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    position: "collector",
    jobTitle: "",
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

  const fetchTitles = async () => {
    try {
      const docRef = doc(db, "settings", "jobTitles");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().titles) {
        setAvailableTitles(docSnap.data().titles);
      } else {
        const defaultTitles = ["City Agriculturist", "Data Encoder", "Field Collector"];
        await setDoc(docRef, { titles: defaultTitles });
        setAvailableTitles(defaultTitles);
      }
    } catch (err) {
      console.error("Error fetching job titles:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTitles();
  }, []);

  const handleAddNewTitle = async () => {
    if (!newTitleValue.trim()) return;
    try {
      const docRef = doc(db, "settings", "jobTitles");
      await updateDoc(docRef, { titles: arrayUnion(newTitleValue.trim()) });
      setAvailableTitles([...availableTitles, newTitleValue.trim()]);
      if (addingUser) {
        setNewUser({ ...newUser, jobTitle: newTitleValue.trim() });
      } else if (editingUser) {
        setEditingUser({ ...editingUser, jobTitle: newTitleValue.trim() });
      }
      setNewTitleValue("");
      setShowNewTitleInput(false);
    } catch (err) {
      console.error("Error adding title:", err);
    }
  };

  const handleEdit = (user) => setEditingUser({ ...user });

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const userRef = doc(db, "users", editingUser.id);
      await updateDoc(userRef, {
        fullName: editingUser.fullName,
        email: editingUser.email,
        position: editingUser.position.toLowerCase(),
        jobTitle: editingUser.jobTitle || ""
      });
      setEditingUser(null);
      fetchUsers();
      logActivity('update', 'User', editingUser.fullName, auth.currentUser?.displayName || 'Admin');
      alert("User updated successfully!");
    } catch (err) {
      setError("Error updating user: " + err.message);
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        // 1. Delete from Firebase Firestore
        await deleteDoc(doc(db, "users", user.id));

        // 2. If user is a collector, delete from Supabase 'users' table
        // We assume 'username' in Supabase matches the 'email' in Firestore for collectors
        if (user.position === "collector") {
          const { error: supabaseError } = await supabase
            .from("users")
            .delete()
            .eq("username", user.email);

          if (supabaseError) {
            console.error("Error deleting from Supabase:", supabaseError);
            alert("User deleted from Firebase but failed to delete from Supabase (Mobile App).");
          }
        }

        fetchUsers();
        logActivity('delete', 'User', user.fullName, auth.currentUser?.displayName || 'Admin');
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

    setLoading(true);

    try {
      let emailToRegister = newUser.email;
      let usernameToStore = newUser.email; // Default for admin

      // 1. If user is a COLLECTOR
      if (newUser.position.toLowerCase() === "collector") {
        // Treat input as USERNAME
        // Append dummy domain for Firebase Auth (which requires email)
        emailToRegister = `${newUser.email}@agrimap.collector`;
        usernameToStore = newUser.email;

        // Check if username exists in Supabase
        const { data: existingUser, error: checkError } = await supabase
          .from("users")
          .select("username")
          .eq("username", usernameToStore)
          .maybeSingle();

        if (checkError) throw new Error("Supabase check error: " + checkError.message);

        if (existingUser) {
          setError(`Username "${usernameToStore}" already exists in Collector database.`);
          setLoading(false);
          return;
        }
      }

      // 2. Create user with a Secondary Firebase App so we don't log out the Admin
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp_" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        emailToRegister,
        newUser.password
      );
      const user = userCredential.user;

      // Sign out the secondary app immediately to clear its session
      await signOut(secondaryAuth);

      // 3. Store user data in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: newUser.fullName,
        email: emailToRegister, // Stores the @agrimap.collector email
        username: usernameToStore, // Stores the raw username for reference
        position: newUser.position.toLowerCase(),
        jobTitle: newUser.jobTitle || "",
        createdAt: new Date().toISOString()
      });

      // 4. If user is a COLLECTOR, add to Supabase 'users' table
      if (newUser.position.toLowerCase() === "collector") {
        const { error: insertError } = await supabase
          .from("users")
          .insert([
            {
              username: usernameToStore, // Plain username
              password: newUser.password,
              created_at: new Date().toISOString(),
            },
          ]);

        if (insertError) {
          console.error("Supabase insert error:", insertError);
          alert("Warning: User created in Firebase but failed to create in Supabase.");
        }
      }

      setAddingUser(false);
      setNewUser({
        fullName: "",
        email: "",
        position: "collector",
        jobTitle: "",
        password: "",
        confirmPassword: ""
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      fetchUsers();
      logActivity('add', 'User', newUser.fullName, auth.currentUser?.displayName || 'Admin');
      alert("User added successfully!");
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This username/email is already taken.");
      } else {
        setError("Error adding user: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <OrbitProgress variant="dotted" color="#32cd32" size="medium" text="" textColor="" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-6 pt-2 pb-6 relative font-sans transition-colors duration-300">
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">
            User Management
          </h2>
          <button
            onClick={() => setAddingUser(true)}
            className="flex items-center bg-green-600 text-white px-4 py-2.5 rounded-xl 
              hover:bg-green-700 transition-all duration-200 shadow-sm active:scale-95 font-medium"
          >
            <FaPlus className="mr-2" />
            Add User
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl shadow-sm">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-4 text-left font-semibold text-sm">Full Name</th>
                <th className="p-4 text-left font-semibold text-sm">Username / Email</th>
                <th className="p-4 text-left font-semibold text-sm">Job Title</th>
                <th className="p-4 text-left font-semibold text-sm">Role</th>
                <th className="p-4 text-left font-semibold text-sm text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr
                  key={user.id}
                  className={`border-b dark:border-slate-800 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors duration-200 ${index % 2 === 0 ? "bg-gray-50 dark:bg-slate-900/50" : "bg-white dark:bg-slate-900"
                    }`}
                >
                  <td className="p-4 text-slate-700 dark:text-slate-200">{user.fullName}</td>
                  <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {user.position === 'collector' && user.username
                      ? user.username
                      : user.email}
                  </td>
                  <td className="p-4 text-slate-700 dark:text-slate-200">{user.jobTitle || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${user.position === "admin"
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"
                      : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30"
                      }`}>
                      {user.position.charAt(0).toUpperCase() + user.position.slice(1)}
                    </span>
                  </td>
                  <td className="p-4 flex items-center justify-end space-x-2 pr-6">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FaEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setEditingUser(null)}
            ></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-lg shadow-xl relative z-10 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
                Edit User
              </h3>
              <form onSubmit={handleUpdate} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={editingUser.fullName}
                    onChange={handleChange}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    placeholder="Full Name"
                    required
                  />
                  <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider font-medium">Letters only, auto-capitalized</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={editingUser.email}
                    onChange={handleChange}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    placeholder="Email"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Job Title / Position
                  </label>
                  {!showNewTitleInput ? (
                    <select
                      name="jobTitle"
                      value={editingUser.jobTitle || ""}
                      onChange={(e) => {
                        if (e.target.value === "ADD_NEW") setShowNewTitleInput(true);
                        else handleChange(e);
                      }}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    >
                      <option value="">Select a title</option>
                      {availableTitles.map(title => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                      <option value="ADD_NEW" className="font-bold text-green-600">— Add New Position —</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                       <input
                         type="text"
                         value={newTitleValue}
                         onChange={(e) => setNewTitleValue(e.target.value)}
                         className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-slate-700 dark:text-slate-200"
                         placeholder="Type new position..."
                       />
                       <button type="button" onClick={handleAddNewTitle} className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium text-sm">Save</button>
                       <button type="button" onClick={() => { setShowNewTitleInput(false); setNewTitleValue(""); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-medium text-sm">Cancel</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Role (System Access)
                  </label>
                  <select
                    name="position"
                    value={editingUser.position}
                    onChange={handleChange}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200 appearance-none pointer-events-auto"
                  >
                    <option value="admin">Admin</option>
                    <option value="collector">Collector</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold text-sm shadow-md shadow-green-200 active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {addingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setAddingUser(false)}
            ></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-lg shadow-xl relative z-10 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
                Add New User
              </h3>
              <form onSubmit={handleAddUser} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={newUser.fullName}
                    onChange={handleNewUserChange}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    placeholder="Full Name"
                    required
                  />
                  <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider font-medium">Letters only, auto-capitalized</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    {newUser.position === 'collector' ? 'Username' : 'Email'}
                  </label>
                  <input
                    type={newUser.position === 'collector' ? "text" : "email"}
                    name="email"
                    value={newUser.email}
                    onChange={handleNewUserChange}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    placeholder={newUser.position === 'collector' ? "Enter username" : "Enter email address"}
                    required
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={newUser.password}
                    onChange={handleNewUserChange}
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[42px] text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={newUser.confirmPassword}
                    onChange={handleNewUserChange}
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    placeholder="Confirm Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-[42px] text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Job Title / Position
                  </label>
                  {!showNewTitleInput ? (
                    <select
                      name="jobTitle"
                      value={newUser.jobTitle || ""}
                      onChange={(e) => {
                        if (e.target.value === "ADD_NEW") setShowNewTitleInput(true);
                        else handleNewUserChange(e);
                      }}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                    >
                      <option value="">Select a title</option>
                      {availableTitles.map(title => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                      <option value="ADD_NEW" className="font-bold text-green-600">— Add New Position —</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                       <input
                         type="text"
                         value={newTitleValue}
                         onChange={(e) => setNewTitleValue(e.target.value)}
                         className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-slate-700 dark:text-slate-200"
                         placeholder="Type new position..."
                       />
                       <button type="button" onClick={handleAddNewTitle} className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium text-sm">Save</button>
                       <button type="button" onClick={() => { setShowNewTitleInput(false); setNewTitleValue(""); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-medium text-sm">Cancel</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-400 mb-2">
                    Role (System Access)
                  </label>
                  <div className="relative">
                    <select
                      name="position"
                      value={newUser.position}
                      onChange={handleNewUserChange}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200 appearance-none pointer-events-auto"
                    >
                      <option value="admin">Admin</option>
                      <option value="collector">Collector</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setAddingUser(false)}
                    className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold text-sm shadow-md shadow-green-200 active:scale-95"
                  >
                    Add User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;