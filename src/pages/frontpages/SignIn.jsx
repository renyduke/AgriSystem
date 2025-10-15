import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { EyeSlashIcon, EyeIcon } from "@heroicons/react/24/solid";
import { FaSpinner, FaCheckCircle, FaTimes } from "react-icons/fa"; // Added FaCheckCircle and FaTimes for notifications
import logo from "/logo.png";

export function SignIn() {
  const [passwordShown, setPasswordShown] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [localReply, setLocalReply] = useState(null); // State for localhost reply
  const navigate = useNavigate();

  const togglePasswordVisibility = () => setPasswordShown((prev) => !prev);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("User signed in:", user);

      // Fetch user data from Firestore using UID as document ID
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const position = userData.position; // "admin" or "user"

        setLocalReply({ type: "success", message: "Login successful (Localhost)" });
        setTimeout(() => setLocalReply(null), 2000); // Clear reply after 2 seconds

        // Redirect based on position
        if (position === "admin") {
          navigate("/home");
        } else if (position === "user") {
          navigate("/user");
        } else {
          setError("Invalid user position. Contact support.");
          setLocalReply({ type: "error", message: "Invalid user position (Localhost)" });
          setTimeout(() => setLocalReply(null), 2000);
          return;
        }
      } else {
        setError("User data not found in Firestore.");
        setLocalReply({ type: "error", message: "User data not found (Localhost)" });
        setTimeout(() => setLocalReply(null), 2000);
        return;
      }
    } catch (error) {
      console.error("Login error:", error.message);
      setError("Login failed: " + error.message);
      setLocalReply({ type: "error", message: "Login failed (Localhost)" });
      setTimeout(() => setLocalReply(null), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex items-center justify-center h-screen bg-green-100">
      <div className="w-96 shadow-lg bg-white border border-green-300 rounded-lg p-6 relative">
        {/* Localhost Reply Notification */}
        {localReply && (
          <div
            className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-out ${
              localReply.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {localReply.type === "success" ? (
              <FaCheckCircle className="text-green-600" />
            ) : (
              <FaTimes className="text-red-600" />
            )}
            <span>{localReply.message}</span>
          </div>
        )}

        <div className="text-center">
          <img src={logo} alt="Agri Logo" className="mx-auto w-16 h-16 mb-2" />
          <h2 className="text-green-700 font-bold text-2xl">Sign In</h2>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mt-4 bg-red-100 p-2 rounded">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-4">
            <label htmlFor="email" className="block text-green-900 font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@mail.com"
              className="w-full p-2 border border-green-400 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block text-green-900 font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={passwordShown ? "text" : "password"}
                placeholder="********"
                className="w-full p-2 border border-green-400 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-3 flex items-center text-green-700"
                disabled={loading}
              >
                {passwordShown ? (
                  <EyeIcon className="h-5 w-5" />
                ) : (
                  <EyeSlashIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full transition duration-300 flex items-center justify-center ${
              loading ? "opacity-75 cursor-not-allowed" : ""
            }`}
            disabled={loading}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </section>
  );
}

// Custom CSS for fade-in-out animation
const styles = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-10px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
  .animate-fade-in-out {
    animation: fadeInOut 2s ease-in-out forwards;
  }
`;

// Inject styles into the document
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default SignIn;