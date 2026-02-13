import axios from 'axios';

const API = axios.create({ 
    // Use environment variable for production, fallback to local for dev
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:5050/api' 
});

API.interceptors.request.use((req) => {
    const token = localStorage.getItem('token');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

// Global response interceptor: handle expired/invalid tokens (401)
API.interceptors.response.use(
    (res) => res,
    (err) => {
        try {
            if (err && err.response && err.response.status === 401) {
                // Clear auth state and notify app -> ensures a clean logout flow
                try { localStorage.setItem('logout', Date.now().toString()); } catch (e) {}
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                localStorage.removeItem('tokenExpiry');
                window.dispatchEvent(new Event('authChanged'));
                // Redirect to login
                window.location.href = '/login';
            }
        } catch (e) {
            // swallow any errors here to avoid masking original error
        }
        return Promise.reject(err);
    }
);

export default API;