import { useNavigate } from "react-router-dom";
import { LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const Header = () => {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();

  const handleLogout = () => {
    localStorage.removeItem("home");
    navigate("/home");
  };

  return (
    <header className="bg-white dark:bg-slate-900 bg-opacity-78 dark:bg-opacity-90 text-black dark:text-white p-4 flex justify-between items-center rounded-2xl mt-1 mr-1 shadow-lg transition-colors border border-transparent dark:border-slate-800">
      {/* Logo */}
      <img src="/logo.png" alt="Logo" className="h-10" />

      {/* Icons */}
      <div className="flex items-center gap-4">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
        </button>

        <LogOut
          onClick={handleLogout}
          className="w-6 h-6 text-black dark:text-white hover:text-red-700 cursor-pointer"
        />
      </div>
    </header>
  );
};

export default Header;