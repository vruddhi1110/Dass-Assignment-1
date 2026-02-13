import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar'; // <--- 1. ADD THIS IMPORT
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateEvent from './pages/CreateEvent';
import MyTickets from './pages/MyTickets';
import EventRegistration from './pages/EventRegistration';
import RegistrationView from './pages/RegistrationView';
import Register from './components/Register';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile'; // New
import Onboarding from './pages/Onboarding'; // New
import Organizers from './pages/Organizers'; // New
import ManageClubs from './pages/ManageClubs'; // New
import ManageEvents from './pages/ManageEvents'; // NEW
import OngoingEvents from './pages/OngoingEvents';
import OrganizerDetails from './pages/OrganizerDetails';
import OrganizerResetRequest from './pages/OrganizerResetRequest';
import AdminResetRequests from './pages/AdminResetRequests';
import AttendanceAudit from './pages/AttendanceAudit'; // NEW
import AttendanceDashboard from './pages/AttendanceDashboard';

// Check access token validity by decoding the JWT expiry (exp)
const isTokenValid = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    return payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
};

const PrivateRoute = ({ children }) => {
  const location = useLocation();
  return isTokenValid() ? children : <Navigate to="/login" state={{ from: location, message: 'Please login to continue' }} replace />;
};

// Role-based route guard: allowedRoles is an array like ['Organizer'] or ['Participant']
const RoleRoute = ({ children, allowedRoles = [] }) => {
  const role = localStorage.getItem('role');
  const location = useLocation();
  if (!isTokenValid()) return <Navigate to="/login" state={{ from: location, message: 'Please login to continue' }} replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // If role not permitted, redirect to login with helpful message
    return <Navigate to="/login" state={{ from: location, message: `Unauthorized: requires role ${allowedRoles.join(', ')}` }} replace />;
  }
  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(!!localStorage.getItem('token'));

  React.useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
    };
    window.addEventListener('authChanged', handleAuthChange);
    return () => window.removeEventListener('authChanged', handleAuthChange);
  }, []);

  return (
    <Router>
      <div className="App">
        {/* 2. ADD NAVBAR HERE - It will show up on every page if logged in */}
       {isAuthenticated && <Navbar />}

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          
          {/* New Routes */}
          <Route path="/onboarding" element={<RoleRoute allowedRoles={['Participant']}><Onboarding /></RoleRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/ongoing-events" element={<RoleRoute allowedRoles={['Organizer']}><OngoingEvents /></RoleRoute>} />
          <Route path="/organizers" element={<PrivateRoute><Organizers /></PrivateRoute>} />
          <Route path="/organizer/:id" element={<PrivateRoute><OrganizerDetails /></PrivateRoute>} /> {/* NEW */}
          <Route path="/manage-clubs" element={<RoleRoute allowedRoles={['Admin']}><ManageClubs /></RoleRoute>} />
          <Route path="/manage-events" element={<RoleRoute allowedRoles={['Admin','Organizer']}><ManageEvents /></RoleRoute>} />
          <Route path="/events/:id/audit" element={<RoleRoute allowedRoles={['Admin','Organizer']}><AttendanceAudit /></RoleRoute>} />
          <Route path="/events/:id/live" element={<RoleRoute allowedRoles={['Admin','Organizer']}><AttendanceDashboard /></RoleRoute>} />

          <Route path="/create-event" element={<RoleRoute allowedRoles={[ 'Organizer' ]}><CreateEvent /></RoleRoute>} />
          <Route path="/my-reset-requests" element={<RoleRoute allowedRoles={['Organizer']}><OrganizerResetRequest /></RoleRoute>} />
          <Route path="/admin/reset-requests" element={<RoleRoute allowedRoles={['Admin']}><AdminResetRequests /></RoleRoute>} />
          <Route path="/my-tickets" element={<RoleRoute allowedRoles={[ 'Participant', 'Organizer', 'Admin' ]}><MyTickets /></RoleRoute>} />
          <Route path="/registration/:id" element={<RoleRoute allowedRoles={[ 'Organizer','Participant' ]}><RegistrationView /></RoleRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/event/:id" element={<PrivateRoute><EventRegistration /></PrivateRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;