import { useState } from "react";
import { auth, db } from "../../firebase"; // Ensure this path matches your setup
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom"; // For redirection

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    position: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Hook for navigation

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // Save user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        fullName: formData.fullName,
        email: formData.email,
        position: formData.position.toLowerCase(), // Store as lowercase for consistency
        uid: user.uid,
      });

      alert("User registered successfully!");


      // Reset form
      setFormData({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        position: "",
      });
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className=" bg-gray-100 flex items-center justify-center p-6 mx-auto ">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-green-700 text-center mb-6">🌱 Sign Up</h2>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4 bg-red-100 p-2 rounded">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              required
              className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.fullName}
              onChange={handleChange}
            />
          </div>
          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              required
              className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.password}
              onChange={handleChange}
            />
          </div>
          <div>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              required
              className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
          </div>
          <div>
            <select
              name="position"
              required
              className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.position}
              onChange={handleChange}
            >
              <option value="">Select Position</option>
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-green-700 text-white p-3 rounded-lg hover:bg-green-800 transition duration-300"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUp;