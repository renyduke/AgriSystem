import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react"; 

const Header = () => {
  const navigate = useNavigate(); 

  const handleLogout = () => {
    localStorage.removeItem("user"); 

    navigate("/");
  };

  return (
    <header className="bg-white bg-opacity-78 text-black p-4 flex justify-between items-center ml-66 rounded-2xl mt-1 mr-1 shadow-lg">
      <h1 className="text-xl font-bold">Welcome User</h1>

      {/* Logout Icon */}
      <div className="flex items-center gap-4">
        <LogOut
          onClick={handleLogout}
          className="w-6 h-6 text-black hover:text-red-700 cursor-pointer"
        />
      </div>
    </header>
  );
};

export default Header;
