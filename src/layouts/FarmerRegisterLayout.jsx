import Header from "../components/FarmerRegistration/Header"; // Import Header

import { Outlet } from "react-router-dom";

const FarmerRegisterLayout = () => {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <Header />
      

      <div className="flex flex-1 overflow-hidden">
       


        {/* Page Content */}
        <div className="flex-1 p-6 overflow-auto  ">
          <Outlet />
        </div>
      </div>

      
     
    </div>
  );
};

export default FarmerRegisterLayout;
