import Header from "../components/SignUpAdmin/Header"; // Import Header

import { Outlet } from "react-router-dom";

const FarmerRegisterLayout = () => {
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <Header />
      

      <div className="flex flex-1 overflow-hidden">
       


        {/* Page Content */}
        <div className="flex-1 p-6  ">
          <Outlet />
        </div>
      </div>

      
     
    </div>
  );
};

export default FarmerRegisterLayout;
