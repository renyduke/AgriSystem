import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import SignIn from "./pages/frontpages/SignIn";
import SignUp from "./pages/AdminPages/SignUp";
import AdminDashboard from "./pages/AdminPages/Home";
import Maps from "./pages/AdminPages/Maps";
import Vegetables from "./pages/Vegetables";
import Profile from "./pages/AdminPages/Profile";
import Analysis from "./pages/AdminPages/Analysis";
import Farmer from "./profile/Farmer";
import FarmerRegister from "./components/userComponents/UserFarmerRegister";
import MainLayout from "./layouts/MainLayout";
import FarmerLayout from "./layouts/FarmerRegisterLayout";
import SignUpLayout from "./layouts/SignUpLayout";
import UserManagement from "./pages/AdminPages/UserManagement";
import Reports from "./pages/AdminPages/Reports";
import ErrorBoundary from "./ErrorBoundary";
import Settings from "./pages/AdminPages/Settings";
import LogOut from "./pages/AdminPages/Logout";
import DesasterReport from "./pages/AdminPages/DisasterReport";
import Drawmap from "./pages/AdminPages/DrawMap";
import SuggestFarmer from "./pages/AdminPages/FarmerVegetablePage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<SignIn />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/home" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="maps" element={<Maps />} />
          <Route path="vegetables" element={<Vegetables />} />
          <Route path="profile" element={<Profile />} />
          <Route path="drawmap" element={<Drawmap />} />
          <Route 
            path="analysis" 
            element={
              <ErrorBoundary>
                <Analysis />
              </ErrorBoundary>
            } 
          />
          {/* Dynamic farmer profile route under /home */}
          <Route path="farmer" element={<Farmer />} />
          <Route path="usermanagement" element={<UserManagement />} />
          <Route path="farmerregister" element={<FarmerRegister />} />
          <Route path="reports" element={<Reports />} />
           <Route path="suggest-farmer" element={<SuggestFarmer />} />
          <Route path="desaster" element={<DesasterReport />} />
          <Route path="settings" element={<Settings />} />
          <Route path="logout" element={<LogOut />} />
          <Route path="farmer" element={<Farmer />} />
        </Route>

        {/* Root-level fallback for farmer profile (optional, for non-admin access) */}
        <Route path="/farmer/:id" element={<Farmer />} />

        {/* Admin Signup Routes */}
        <Route path="/adminSignup" element={<SignUpLayout />}>
          <Route index element={<SignUp />} />
          <Route path="signup" element={<SignUp />} />
        </Route>

        {/* FarmerRegister Routes (renamed to avoid conflict) */}
        <Route path="/register" element={<FarmerLayout />}>
          <Route index element={<FarmerRegister />} />
          <Route path="farmerregister" element={<FarmerRegister />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;