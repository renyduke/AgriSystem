import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-300 to-yellow-200">
        
      <h1 className="text-4xl font-bold text-green-900 mb-8">🌿 Welcome 🌾</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link 
          to="/SignIn" 
          className="bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition border-2 border-green-900"
        >
          🌱 Admin
        </Link>
        <Link 
          to="/user" 
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition border-2 border-yellow-700"
        >
          🚜 User
        </Link>
      </div>
    </div>
  );  
};

export default LandingPage;
