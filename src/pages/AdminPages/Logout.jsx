import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

const Logout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("user"); // Clear user data, matching AdminHeader logic
    navigate("/"); // Redirect to homepage
  };

  const handleCancel = () => {
    navigate(-1); // Go back to the previous page (e.g., Maps or admin dashboard)
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="bg-white bg-opacity-95 text-black p-6 rounded-2xl shadow-lg max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-center">Logout</h2>
        <p className="text-center mb-6">Are you sure you want to log out?</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            <LogOut className="w-5 h-5" />
            Confirm Logout
          </button>
          <button
            onClick={handleCancel}
            className="bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Logout;