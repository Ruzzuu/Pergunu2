// Login Component - Halaman login untuk user dan admin PERGUNU
// Komponen ini menangani autentikasi dengan fitur:
// - Dual role authentication (user dan admin)
// - Password visibility toggle untuk UX
// - Loading states dan error handling
// - Auto-redirect berdasarkan role
// - Session management dengan localStorage
// - Integration dengan apiService untuk backend calls
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";   // Router hooks untuk navigasi
import "./Login.css";                                   // Styling untuk login page
import logo from "../../assets/logo.png";               // Logo PERGUNU untuk branding
import PasswordVisibilityField from '../../componen/PasswordVisibilityField/PasswordVisibilityField';
import { apiService } from '../../services/apiService'; // Core service untuk API communication
import Turnstile from '../../../Turnstile';
import { validateLoginCredentials, checkRateLimit, resetRateLimit } from '../../utils/validation'; // Security utilities

const Login = () => {
  const [turnstileToken, setTurnstileToken] = useState('');
  // Hook untuk navigasi programmatic (redirect after login)
  const navigate = useNavigate();
  
  // State untuk loading indicator saat proses login (prevent double submit)
  const [isLoading, setIsLoading] = useState(false);
  
  // State untuk menampilkan pesan dari API (error/success feedback)
  const [apiMessage, setApiMessage] = useState('');
  
  // State untuk data form login dengan controlled components
  const [loginData, setLoginData] = useState({
    username: '',  // Username atau email (flexible login)
    password: ''   // Password user (akan di-hash server-side)
  });

  // Handler untuk perubahan input form dengan auto-trim
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: name === 'password' ? value : value.trim()
    }));
    setApiMessage(''); // Clear message ketika user mulai mengetik (UX improvement)
  };

  // === MAIN LOGIN HANDLER ===
  
  // Handler untuk submit form login dengan role-based redirect
  const handleSubmit = async (e) => {
    e.preventDefault();         // Prevent default form submission behavior
    setIsLoading(true);         // Show loading indicator untuk UX feedback
    setApiMessage('');          // Clear previous messages untuk clean UI
    
    try {
      // === STEP 1: INPUT VALIDATION ===
      // Validate dan sanitize credentials sebelum mengirim ke API
      const validation = validateLoginCredentials(loginData);
      
      if (!validation.isValid) {
        setApiMessage(`❌ ${validation.errors.join(', ')}`);
        return;
      }
      
      // === STEP 2: RATE LIMITING ===
      // Check rate limiting untuk prevent brute force attacks
      const userIdentifier = validation.sanitizedData.username;
      const rateLimitCheck = checkRateLimit(`login_${userIdentifier}`, 5, 900000); // 5 attempts per 15 minutes
      
      if (!rateLimitCheck.allowed) {
        setApiMessage(`❌ Too many login attempts. Please try again in ${rateLimitCheck.resetInMinutes} minutes.`);
        return;
      }
      
      console.log('🔐 Starting login process...');
      console.log('ℹ️ Attempts remaining:', rateLimitCheck.attemptsRemaining);
      
      // === STEP 3: API AUTHENTICATION ===
      // Panggil API login dengan sanitized credentials
      const result = await apiService.login({ ...validation.sanitizedData, password: loginData.password, turnstileToken });
      
      console.log('✅ Login successful:', result.user);
      
      // === STEP 4: RESET RATE LIMIT ON SUCCESS ===
      // Clear rate limit setelah login berhasil
      resetRateLimit(`login_${userIdentifier}`);
      
      // === STEP 2: ROLE-BASED ROUTING ===
      // Cek role user untuk menentukan redirect destination
      if (result.user.role === 'admin') {
        console.log('🔑 Admin login detected, redirecting to admin dashboard...');
        
        // === ADMIN SESSION MANAGEMENT ===
        // Simpan session admin di localStorage untuk persistence across browser sessions
        localStorage.setItem('adminAuth', JSON.stringify({
          username: result.user.username,           // Username untuk identification
          role: 'admin',                           // Role untuk authorization
          fullName: result.user.fullName,          // Display name untuk UI
          userId: result.user.id,                  // User ID untuk API calls
          email: result.user.email,                // Email untuk communication
          loginTime: new Date().toISOString()      // Login timestamp untuk session tracking
        }));
        
        // Navigate ke admin dashboard dengan replace: true untuk security
        navigate('/admin', { replace: true });
        
      } else {
        console.log('👤 User login detected, redirecting to user dashboard...');
        
        // === USER SESSION MANAGEMENT ===
        // Store user session dengan data lengkap untuk user dashboard
        localStorage.setItem('userAuth', JSON.stringify({
          username: result.user.username,           // Username untuk identification
          role: result.user.role || 'user',        // Role dengan fallback ke 'user'
          fullName: result.user.fullName,          // Display name untuk UI
          email: result.user.email,                // Email untuk profile
          userId: result.user.id,                  // User ID untuk API calls
          loginTime: new Date().toISOString()      // Login timestamp untuk session tracking
        }));
        
        // Navigate ke user dashboard dengan replace: true untuk clean history
        navigate('/user-dashboard', { replace: true });
      }
      
    } catch (error) {
      // === ERROR HANDLING ===
      // Handle semua errors dari API atau network issues
      console.error('❌ Login failed:', error);
      setApiMessage(`❌ Login failed: ${error.message}`); // Display error ke user
    } finally {
      // === CLEANUP ===
      // Reset loading state untuk enable form kembali
      setIsLoading(false);
    }
  };

  // === COMPONENT RENDER ===
  
  return (
    <div className="login-container">
      <Link to="/" className="back-home">← Back to Home</Link>
      {/* === LEFT SECTION (BRANDING) === */}
      <div className="login-left">
        <div className="login-overlay">
          <img src={logo} alt="Logo PERGUNU" className="login-logo" />
          <h2>Hey! Welcome</h2>
          <p>Join us and give information to people</p>
        </div>
      </div>

      {/* === RIGHT SECTION (LOGIN FORM) === */}
      <div className="login-right">
        <div className="login-box">
          <h2>Log in</h2>
          <form onSubmit={handleSubmit}>
            {/* Username/Email input dengan validation */}
            <input 
              type="text" 
              id="login-username"
              name="username"
              placeholder="Username or Email" 
              value={loginData.username}
              onChange={handleInputChange}
              required                          // HTML5 validation
              autoComplete="username"
            />
            
            <PasswordVisibilityField
              id="login-password"
              name="password"
              label="Password"
              placeholder="Password"
              value={loginData.password}
              onChange={handleInputChange}
              required
              autoComplete="current-password"
            />

            {/* Additional login options */}
            <div className="login-options">
              <Link to="/lupa-password">Forgot Password?</Link>
            </div>

            {/* Submit button dengan loading state */}
            <Turnstile onToken={setTurnstileToken} />
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log in'} {/* Dynamic text based on state */}
            </button>
            
            {/* === API STATUS MESSAGE === */}
            {/* Display API response messages dengan conditional styling */}
            {apiMessage && (
              <div className={`api-message ${apiMessage.includes('✅') ? 'success' : 'error'}`}>
                {apiMessage}
              </div>
            )}

            {/* Removed social login (G+/Facebook/Twitter) */}
          </form>

          {/* Registration information untuk users */}
          <p className="create-account">
            <span style={{color: '#6b7280', fontSize: '0.9rem'}}>
              Belum punya akun?
            </span>{' '}
            <Link to="/daftar" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0F7536' }}>
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
