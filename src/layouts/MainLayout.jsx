import { Outlet } from "react-router-dom";

const MainLayout = () => {
  return (
    <div className="flex flex-col h-screen bg-gray-950">
        <Outlet />
    </div>
  );
};

export default MainLayout;
