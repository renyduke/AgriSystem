import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ adminOnly = false }) => {
  const { currentUser, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    // Not logged in, redirect to login page
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !isAdmin) {
    // Logged in but not an admin, redirect to home or unauthorized page
    // For now, redirecting to root or you could create an Unauthorized page
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
