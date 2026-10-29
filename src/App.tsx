/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Farmers from './pages/Farmers';
import Settings from './pages/Settings';
import DataUpload from './pages/DataUpload';
import Organizations from './pages/Organizations';
import Warehouses from './pages/Warehouses';
import Monitoring from './pages/Monitoring';
import FarmerProfile from './pages/FarmerProfile';
import ActivityLog from './pages/ActivityLog';
import DistributionMap from './pages/DistributionMap';
import HarvestCalendar from './pages/HarvestCalendar';
import Alerts from './pages/Alerts';
import Profile from './pages/Profile';
import UserManagement from './pages/UserManagement';
import FoodBank from './pages/FoodBank';
import Login from './pages/Login';
import Advisor from './pages/Advisor';
import { AuthProvider, useAuth } from './lib/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-slate-100">Loading...</div>;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="advisor" element={<Advisor />} />
            <Route path="profile" element={<Profile />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="farmers" element={<Farmers />} />
            <Route path="farmers/:id" element={<FarmerProfile />} />
            <Route path="map" element={<DistributionMap />} />
            <Route path="calendar" element={<HarvestCalendar />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="food-bank" element={<FoodBank />} />
            <Route path="orgs" element={<Organizations />} />
            <Route path="warehouses" element={<Warehouses />} />
            <Route path="upload" element={<DataUpload />} />
            <Route path="monitoring" element={<Monitoring />} />
            <Route path="activity" element={<ActivityLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
