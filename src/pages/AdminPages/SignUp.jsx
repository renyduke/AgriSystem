import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import { EyeSlashIcon, EyeIcon } from "@heroicons/react/24/solid";
import { FaSpinner, FaCheckCircle, FaTimes, FaEnvelope, FaLock, FaUser, FaKey } from "react-icons/fa";
import logo from "/logo.png";

// IMPORTANT: In production, store this in environment variables or Firestore
const ADMIN_REGISTRATION_KEY = "AGRI-ADMIN-2024-SECURE";

export function SignUp() {
  const [passwordShown, setPasswordShown] = useState(false);
  const [confirmPasswordShown, setConfirmPasswordShown] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    registrationKey: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [localReply, setLocalReply] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);

  const togglePasswordVisibility = () => setPasswordShown((prev) => !prev);
  const toggleConfirmPasswordVisibility = () => setConfirmPasswordShown((prev) => !prev);

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
      
      setFormData(prev => ({ ...prev, [name]: capitalized }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    setError("");
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setError("Full name is required");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (formData.registrationKey !== ADMIN_REGISTRATION_KEY) {
      setError("Invalid admin registration key");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!validateForm()) {
      setLocalReply({ type: "error", message: error });
      setTimeout(() => setLocalReply(null), 3000);
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: formData.fullName,
        email: formData.email,
        position: "admin",
        createdAt: new Date().toISOString()
      });

      setLocalReply({ type: "success", message: "Account created successfully! Redirecting to sign in..." });
      
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

    } catch (error) {
      console.error("Sign up error:", error.message);
      
      let errorMessage = "Registration failed. Please try again.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email already registered. Please sign in.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Check your connection.";
      }
      
      setError(errorMessage);
      setLocalReply({ type: "error", message: errorMessage });
      setTimeout(() => setLocalReply(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const navigateToSignIn = () => {
    window.location.href = "/";
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 overflow-auto">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 left-1/2 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Success/Error Toast Notification */}
      {localReply && (
        <div
          className={`fixed top-6 right-6 p-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-slide-in-right backdrop-blur-sm max-w-sm ${
            localReply.type === "success" 
              ? "bg-green-50 text-green-800 border-2 border-green-200" 
              : "bg-red-50 text-red-800 border-2 border-red-200"
          }`}
        >
          <div className={`p-2 rounded-full ${localReply.type === "success" ? "bg-green-100" : "bg-red-100"}`}>
            {localReply.type === "success" ? (
              <FaCheckCircle className="text-green-600 text-xl" />
            ) : (
              <FaTimes className="text-red-600 text-xl" />
            )}
          </div>
          <span className="font-medium">{localReply.message}</span>
        </div>
      )}

      {/* Main Card Container - Perfectly centered */}
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-3xl blur-xl opacity-20 animate-pulse-slow"></div>
          
          <div className="relative bg-white/90 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white/20">
            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full blur-md opacity-50"></div>
                <img 
                  src={logo} 
                  alt="Agri Logo" 
                  className="relative w-20 h-20 mx-auto rounded-full border-4 border-white shadow-lg"
                />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                Create Admin Account
              </h2>
              <p className="text-gray-600 text-sm">Register as system administrator</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-shake">
                <div className="flex items-start">
                  <FaTimes className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Sign Up Form */}
            <div className="space-y-5">
              {/* Full Name Input */}
              <div className="relative">
                <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                    focusedInput === 'fullName' ? 'text-green-500' : 'text-gray-400'
                  }`}>
                    <FaUser className="text-lg" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      focusedInput === 'fullName'
                        ? 'border-green-500 bg-white shadow-lg shadow-green-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    value={formData.fullName}
                    onChange={handleChange}
                    onFocus={() => setFocusedInput('fullName')}
                    onBlur={() => setFocusedInput(null)}
                    required
                    disabled={loading}
                  />
                </div>
                
              </div>

              {/* Email Input */}
              <div className="relative">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                    focusedInput === 'email' ? 'text-green-500' : 'text-gray-400'
                  }`}>
                    <FaEnvelope className="text-lg" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      focusedInput === 'email'
                        ? 'border-green-500 bg-white shadow-lg shadow-green-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="relative">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                    focusedInput === 'password' ? 'text-green-500' : 'text-gray-400'
                  }`}>
                    <FaLock className="text-lg" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={passwordShown ? "text" : "password"}
                    placeholder="Minimum 6 characters"
                    className={`w-full pl-12 pr-12 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      focusedInput === 'password'
                        ? 'border-green-500 bg-white shadow-lg shadow-green-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-green-600 transition-colors"
                    disabled={loading}
                    tabIndex="-1"
                  >
                    {passwordShown ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="relative">
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                    focusedInput === 'confirmPassword' ? 'text-green-500' : 'text-gray-400'
                  }`}>
                    <FaLock className="text-lg" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={confirmPasswordShown ? "text" : "password"}
                    placeholder="Re-enter your password"
                    className={`w-full pl-12 pr-12 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      focusedInput === 'confirmPassword'
                        ? 'border-green-500 bg-white shadow-lg shadow-green-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-green-600 transition-colors"
                    disabled={loading}
                    tabIndex="-1"
                  >
                    {confirmPasswordShown ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Admin Registration Key */}
              <div className="relative">
                <label htmlFor="registrationKey" className="block text-sm font-semibold text-gray-700 mb-2">
                  Admin Registration Key
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                    focusedInput === 'registrationKey' ? 'text-green-500' : 'text-gray-400'
                  }`}>
                    <FaKey className="text-lg" />
                  </div>
                  <input
                    id="registrationKey"
                    name="registrationKey"
                    type="text"
                    placeholder="Enter admin registration key"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      focusedInput === 'registrationKey'
                        ? 'border-green-500 bg-white shadow-lg shadow-green-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    value={formData.registrationKey}
                    onChange={handleChange}
                    onFocus={() => setFocusedInput('registrationKey')}
                    onBlur={() => setFocusedInput(null)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 transform ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                }`}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <FaSpinner className="animate-spin text-xl" />
                    <span>Creating Account...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Create Account</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                )}
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <button 
                  onClick={navigateToSignIn}
                  className="text-green-600 hover:text-green-700 font-semibold hover:underline transition-colors"
                  disabled={loading}
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom CSS Animations
const styles = `
  @keyframes blob {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  }

  @keyframes slideInRight {
    0% { opacity: 0; transform: translateX(100px); }
    100% { opacity: 1; transform: translateX(0); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }

  @keyframes pulse-slow {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 0.3; }
  }

  .animate-blob {
    animation: blob 7s infinite;
  }

  .animation-delay-2000 {
    animation-delay: 2s;
  }

  .animation-delay-4000 {
    animation-delay: 4s;
  }

  .animate-slide-in-right {
    animation: slideInRight 0.4s ease-out;
  }

  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }

  .animate-pulse-slow {
    animation: pulse-slow 3s ease-in-out infinite;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default SignUp;