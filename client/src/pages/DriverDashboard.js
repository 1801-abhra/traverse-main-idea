import React, { useState, useEffect } from 'react';
import HimachalBackground from '../components/HimachalBackground';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { requestNotificationPermission } from '../firebase';
import Spinner from '../components/Spinner';
import AboutModal from '../components/AboutModal';

let socket;
const API = 'https://traverse-unicab-backend-2df13b58c562.herokuapp.com';

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function DriverDashboard() {
  const rideSound = React.useRef(new Audio('/notification.wav'));
  const pendingSoundRef = React.useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = React.useRef(true);

  React.useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const toggleSound = () => {
    // Play and immediately pause to unlock browser autoplay restriction
    try {
      const audio = new Audio('/notification.wav');
      audio.volume = 0.01;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(e => console.log('Audio unlock failed:', e));
      }
    } catch (e) {
      console.log('Audio unlock error:', e);
    }
    setSoundEnabled(prev => !prev);
  };

  const playRideSound = () => {
    if (!soundEnabledRef.current) return;
    // Try file first
    try {
      const audio = new Audio('/notification.wav');
      audio.volume = 1.0;
      audio.play().catch(() => {
        // Fallback to Web Audio API beep
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 1);
        } catch(e) { console.log('Audio fallback failed:', e); }
      });
    } catch(e) { console.log('Audio error:', e); }
    
    // Vibration on mobile
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
  };

  const tryPlaySound = () => {
    if (pendingSoundRef.current) {
      playRideSound();
      pendingSoundRef.current = false;
    }
  };

  const [activeTab, setActiveTab] = useState('instant');
  const [scheduledRides, setScheduledRides] = useState([]);
  const [myScheduledRides, setMyScheduledRides] = useState([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const isAvailableRef = React.useRef(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [myRating, setMyRating] = useState({ average: 0, total: 0 });
  const [rides, setRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [message, setMessage] = useState('');
  const lastLocationRef = React.useRef({ lat: null, lng: null, timestamp: 0 });
  const geoWatchIdRef = React.useRef(null);
  const activeRideRef = React.useRef(activeRide);
  React.useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  const GEO_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 3000
  };

  const handleGeoError = (err) => {
    console.warn('Geolocation tracking warning:', err?.message || err);
    if (err?.code === 1) {
      setMessage('⚠️ Location permission denied. Please allow GPS access for live tracking.');
    } else if (err?.code === 2) {
      setMessage('⚠️ GPS signal unavailable. Please ensure device location is active.');
    }
  };

  const sendThrottledLocation = (pos, ride) => {
    if (!pos?.coords || !ride || !socket) return;
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const now = Date.now();
    const last = lastLocationRef.current;

    const distMeters = last.lat !== null ? calculateDistanceMeters(last.lat, last.lng, lat, lng) : Infinity;
    const timeElapsedMs = now - last.timestamp;

    // Send update if first fix, or moved >= 10m, or >= 4s passed
    if (last.lat === null || distMeters >= 10 || timeElapsedMs >= 4000) {
      lastLocationRef.current = { lat, lng, timestamp: now };
      const studentId = ride.student?._id || ride.student;
      socket.emit('driver:location', {
        rideId: ride._id,
        studentId: studentId,
        sharedWithId: ride.sharedWith || null,
        passengers: ride.passengers || [],
        lat: lat,
        lng: lng
      });
    }
  };
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const userVehicleTypeRef = React.useRef(user?.vehicleType || '');
  const token = localStorage.getItem('token');
  const [accepting, setAccepting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const fetchAvailableRides = async () => {
    try {
      const res = await axios.get(`${API}/api/rides/available`, { headers: { Authorization: `Bearer ${token}` } });
      setRides(res.data);
    } catch (err) {
      console.log('Failed to fetch rides:', err.message);
    } finally {
      setPageLoading(false);
    }
  };

  const fetchMyRating = async () => {
    try {
      const res = await axios.get(`${API}/api/rides/my-rating`, { headers: { Authorization: `Bearer ${token}` } });
      setMyRating(res.data);
    } catch (err) { console.log('Rating fetch failed'); }
  };

  const fetchDriverActiveRide = async () => {
    try {
      const res = await axios.get(
        `${API}/api/rides/driver-active`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data) {
        setActiveRide(res.data);
      }
    } catch (err) {
      console.log('No active ride');
    } finally {
      setPageLoading(false);
    }
  };

  const fetchScheduledRides = async (showLoading = true) => {
    if (showLoading) setScheduledLoading(true);
    try {
      const [available, mine] = await Promise.all([
        axios.get(`${API}/api/rides/scheduled`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/api/rides/my-scheduled`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setScheduledRides(available.data);
      setMyScheduledRides(mine.data);
    } catch (err) {
      console.log('Failed to fetch scheduled rides');
    } finally {
      if (showLoading) setScheduledLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableRides();
    fetchMyRating();
    fetchScheduledRides();
    fetchDriverActiveRide();

    // Re-fetch when driver comes back to app
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAvailableRides();
        fetchDriverActiveRide();
        fetchScheduledRides(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const fetchAvailability = async () => {
      try {
        const res = await axios.get(
          `${API}/api/auth/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setIsAvailable(res.data.isAvailable);
        isAvailableRef.current = res.data.isAvailable;
        if (res.data.vehicleType) {
          userVehicleTypeRef.current = res.data.vehicleType;
          const currentUser = JSON.parse(localStorage.getItem('user')) || {};
          localStorage.setItem('user', JSON.stringify({ ...currentUser, vehicleType: res.data.vehicleType }));
        }
      } catch (err) {
        console.log('Failed to fetch availability');
      }
    };
    fetchAvailability();
    socket = io(API, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socket.emit('join', { userId: user._id, role: 'driver', vehicleType: userVehicleTypeRef.current || user.vehicleType });
    // Request notification permission
    requestNotificationPermission().then(fcmToken => {
      console.log('Driver FCM token:', fcmToken ? 'received' : 'null');
      if (fcmToken) {
        axios.post(
          `https://traverse-unicab-backend-2df13b58c562.herokuapp.com/api/auth/save-token`,
          { fcmToken },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    });
    socket.on('new:ride', (ride) => {
      if (isAvailableRef.current) {
        const myType = (userVehicleTypeRef.current || user?.vehicleType || '').toString().replace(/ /g, '+').trim();
        const incomingType = (ride?.vehicleType || '4+1').toString().replace(/ /g, '+').trim();
        if (myType && incomingType && myType !== incomingType) {
          return;
        }
        if (ride.isScheduled) {
          setScheduledRides(prev => {
            const exists = prev.some(r => r._id === ride._id);
            if (exists) return prev;
            const updated = [ride, ...prev];
            return updated.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
          });
        } else {
          setRides(prev => {
            const exists = prev.some(r => r._id === ride._id);
            if (exists) return prev;
            return [ride, ...prev];
          });
        }
        playRideSound();
      }
    });
    socket.on('ride:passenger-joined', ({ message, ride }) => {
      if (ride?.isScheduled && ride?.status === 'searching') {
        setMyScheduledRides(prev => prev.map(r => r._id === ride._id ? ride : r));
        setScheduledRides(prev => prev.map(r => r._id === ride._id ? ride : r));
        setMessage(message || 'A new passenger joined the scheduled ride!');
        rideSound.current.play().catch(() => { pendingSoundRef.current = true; });
      } else {
        setActiveRide(ride);
        setMessage(message);
      }
    });

    socket.on('ride:passenger-left', ({ message, ride }) => {
      if (ride?.isScheduled && ride?.status === 'searching') {
        setMyScheduledRides(prev => prev.map(r => r._id === ride._id ? ride : r));
        setScheduledRides(prev => prev.map(r => r._id === ride._id ? ride : r));
        setMessage(message || 'A passenger left the scheduled ride.');
      } else {
        setActiveRide(ride);
        setMessage(message);
      }
    });
    socket.on('ride:cancelled-by-party', ({ message }) => {
      setActiveRide(null);
      setMessage(message);
      setShowCancelPopup(false);
      fetchAvailableRides();
      fetchScheduledRides(false);
    });
    socket.on('ride:passenger-updated', ({ rideId, passengers, isFull, fare, ride }) => {
      const updateFn = r => {
        if (r._id === rideId) {
          return ride ? { ...r, ...ride } : { ...r, passengers, isFull, fare };
        }
        return r;
      };
      setRides(prev => prev.map(updateFn));
      setScheduledRides(prev => prev.map(updateFn));
      setMyScheduledRides(prev => prev.map(updateFn));
    });
    socket.on('ride:scheduled-claimed', ({ rideId, driverId }) => {
      if (driverId !== user?._id) {
        setScheduledRides(prev => prev.filter(r => r._id.toString() !== rideId.toString()));
      }
    });
        socket.on('ride:accepted-by-driver', ({ rideId, driverId }) => {
      // Only remove this specific ride from available lists
      setRides(prev => prev.filter(r => r._id.toString() !== rideId.toString()));
      setScheduledRides(prev => prev.filter(r => r._id.toString() !== rideId.toString()));
      setMyScheduledRides(prev => prev.filter(r => r._id.toString() !== rideId.toString()));
    });
    socket.on('ride:cancelled', ({ rideId }) => {
      setRides(prev => prev.filter(r => r._id.toString() !== rideId.toString()));
      setScheduledRides(prev => prev.filter(r => r._id.toString() !== rideId.toString()));
      setMyScheduledRides(prev => prev.filter(r => r._id.toString() !== rideId.toString()));
    });
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (geoWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
      if (socket) socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Clear any previous GPS watcher
    if (geoWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
    lastLocationRef.current = { lat: null, lng: null, timestamp: 0 };

    if (activeRide && isAvailable && socket) {
      socket.emit('join:ride', activeRide._id);

      if (navigator.geolocation) {
        // Immediate initial location snapshot
        navigator.geolocation.getCurrentPosition(
          (pos) => sendThrottledLocation(pos, activeRide),
          handleGeoError,
          GEO_OPTIONS
        );

        // High accuracy battery-friendly continuous tracking
        const watchId = navigator.geolocation.watchPosition(
          (pos) => sendThrottledLocation(pos, activeRide),
          handleGeoError,
          GEO_OPTIONS
        );
        geoWatchIdRef.current = watchId;

        return () => {
          if (navigator.geolocation && watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
          }
          if (geoWatchIdRef.current === watchId) {
            geoWatchIdRef.current = null;
          }
        };
      } else {
        setMessage('⚠️ Geolocation is not supported by your browser.');
      }
    }
  }, [activeRide?._id, isAvailable]);

  // Auto-poll fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeRide) {
        fetchAvailableRides();
        fetchScheduledRides(false);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeRide]);

    const showToast = (msg, type = 'info') => {
    setMessage(msg);
  };

  const cancelScheduledRide = async (rideId) => {
    try {
      await axios.put(
        `${API}/api/rides/cancel-accepted/${rideId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMyScheduledRides(prev => prev.filter(r => r._id !== rideId));
      showToast('Scheduled ride cancelled successfully', 'warning');
    } catch (err) {
      console.log('Cancel error:', err);
    }
  };

  const startScheduledRide = async (rideId) => {
    try {
      const res = await axios.put(
        `${API}/api/rides/start-scheduled/${rideId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveRide(res.data);
      fetchScheduledRides();
      setMyScheduledRides(prev => prev.filter(r => r._id !== rideId));
      setMessage('Scheduled ride started! Student has been notified.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to start ride');
    }
  };

const preAcceptRide = async (rideId) => {
    try {
      await axios.put(
        `${API}/api/rides/pre-accept/${rideId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchScheduledRides();
      setMessage('Scheduled ride confirmed! ✅');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Cannot pre-accept ride');
    }
  };

  const toggleAvailability = async () => {
    try {
      const res = await axios.put(
        `${API}/api/rides/toggle-availability`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsAvailable(res.data.isAvailable);
      isAvailableRef.current = res.data.isAvailable;
      if (!res.data.isAvailable) {
        if (geoWatchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(geoWatchIdRef.current);
          geoWatchIdRef.current = null;
        }
        lastLocationRef.current = { lat: null, lng: null, timestamp: 0 };
        setRides([]);
        setMessage('You are now Offline 🔴');
      } else {
        fetchAvailableRides();
        setMessage('You are now Online ✅');
      }
    } catch (err) {
      setMessage('Failed to update availability');
    }
  };
  const rejectRide = async (rideId) => {
    try {
      await axios.put(
        `${API}/api/rides/reject/${rideId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Remove from local state immediately
      setRides(prev => prev.filter(r => (r._id?.toString() || r._id) !== (rideId?.toString() || rideId)));
      setMessage('Ride rejected');
    } catch (err) {
      console.log('Reject error:', err);
      setMessage('Failed to reject ride');
    }
  };

  const acceptRide = async (rideId) => {
    if (accepting) return;
    setAccepting(true);
    try {
      const res = await axios.put(
        `${API}/api/rides/accept/${rideId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const rideData = res.data;
      setActiveRide(rideData);
      setRides([]);
      setMessage('Ride accepted! Head to pickup location.');

      if (socket) {
        socket.emit('join:ride', rideData._id);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => sendThrottledLocation(pos, rideData),
            handleGeoError,
            GEO_OPTIONS
          );
        }
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Cannot accept ride');
    }
    setAccepting(false);
  };

  const updateStatus = async (status) => {
    try {
      const res = await axios.put(`${API}/api/rides/status/${activeRide._id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      setActiveRide(res.data);
      if (status === 'completed') {
        setActiveRide(null);
        setMessage('Ride completed! ✅');
        fetchAvailableRides();
        fetchMyRating();
      }
    } catch (err) { setMessage(err.response?.data?.message || 'Failed to update status'); }
  };

  const cancelAcceptedRide = async () => {
    try {
      const res = await axios.put(
        `${API}/api/rides/cancel-accepted/${activeRide._id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveRide(null);
      setShowCancelPopup(false);
      fetchAvailableRides();
      setMessage('Ride cancelled.');
      if (res.data.warning) {
        setMessage(res.data.warning);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Cannot cancel');
      setShowCancelPopup(false);
    }
  };
  const logout = async () => {
    try {
      await axios.post(
        `${API}/api/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.log('Logout error:', err);
    }
    localStorage.clear();
    navigate('/login');
  };

  const statusColor = {
    searching: '#f59e0b', accepted: '#e63946',
    ontheway: '#e63946', completed: '#10b981', cancelled: '#666'
  };

  const statusLabel = {
    searching: 'Searching',
    accepted: 'Accepted ✓',
    ontheway: 'On The Way 🚗',
    completed: 'Completed ✓',
    cancelled: 'Cancelled'
  };

  if (pageLoading) {
    return (
      <div style={styles.container} onClick={tryPlaySound} onTouchStart={tryPlaySound}>
        <div style={styles.navbar}>
          <div style={styles.navBrand}>
            <span style={styles.navLogo}>🚖</span>
            <span style={styles.navTitle}>TRAVERSE</span>
          </div>
        </div>
        <Spinner text='Loading driver dashboard...' />
      </div>
    );
  }

  return (
    <div style={styles.container} onClick={tryPlaySound} onTouchStart={tryPlaySound}>
<HimachalBackground />
      <style>{`
        @keyframes bgGradientMove {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes pulseOnline {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          50% { transform: scale(1.08); opacity: 0.85; box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        }
        @keyframes pulseOffline {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          50% { transform: scale(1.08); opacity: 0.85; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
        @keyframes pulseActiveTrip {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(230, 57, 70, 0.7); }
          50% { transform: scale(1.1); opacity: 0.85; box-shadow: 0 0 0 9px rgba(230, 57, 70, 0); }
        }
        @keyframes slideUpIn {
          0% { opacity: 0; transform: translateY(18px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmerGlow {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .driver-card-hover {
          animation: slideUpIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .driver-card-hover:hover {
          border-color: rgba(230, 57, 70, 0.4) !important;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(230, 57, 70, 0.12) !important;
        }
        .toggle-btn-online:hover {
          filter: brightness(1.1);
          box-shadow: 0 4px 18px rgba(16, 185, 129, 0.45) !important;
        }
        .toggle-btn-offline:hover {
          filter: brightness(1.1);
          box-shadow: 0 4px 18px rgba(239, 68, 68, 0.45) !important;
        }
        .nav-btn-hover:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
          border-color: #444 !important;
        }
        .traverse-btn-accept:hover:not(:disabled) {
          box-shadow: 0 8px 24px rgba(230, 57, 70, 0.6) !important;
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        .traverse-btn-accept:active:not(:disabled) {
          transform: scale(0.97) translateY(1px) !important;
        }
        .traverse-btn-reject:hover {
          background: rgba(239, 68, 68, 0.1) !important;
          border-color: #ef4444 !important;
          color: #ef4444 !important;
        }
        .traverse-btn-reject:active {
          transform: scale(0.97);
        }
        @media (max-width: 480px) {
          .nav-text-desktop { display: none !important; }
          .nav-text-mobile { display: inline !important; }
          .nav-user-desktop { display: none !important; }
          .nav-btn-mobile { padding: 6px 8px !important; font-size: 11px !important; }
          .nav-toggle-mobile { padding: 5px 8px !important; font-size: 11px !important; min-width: auto !important; }
          .nav-btn-red-mobile { padding: 6px 9px !important; font-size: 11px !important; }
          .rating-card-mobile { flex-direction: column !important; align-items: stretch !important; gap: 14px !important; }
          .rating-stats-mobile { display: flex !important; justify-content: space-between !important; align-items: center !important; }
        }
        @media (min-width: 481px) {
          .nav-text-desktop { display: inline !important; }
          .nav-text-mobile { display: none !important; }
          .nav-user-desktop { display: flex !important; }
        }
      `}</style>

      {/* Sleek Dark Navbar - guaranteed single line on 375px mobile */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>
          <div style={styles.navLogoBox}>
            <span style={styles.navLogo}>🚖</span>
          </div>
          <span style={styles.navTitle}>TRAVERSE</span>
        </div>

        <div style={styles.navRight}>
          <span className="nav-user-desktop" style={styles.navUser}>
            <span style={{ opacity: 0.8 }}>🚗</span>
            <span style={{ fontWeight: '600', color: '#eee', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
          </span>

          {/* Audio Unlock & Notification Toggle */}
          <button
            onClick={toggleSound}
            className="nav-btn-hover nav-btn-mobile"
            style={{
              ...styles.navBtn,
              background: soundEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              borderColor: soundEnabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)',
              color: soundEnabled ? '#10b981' : '#888888'
            }}
            title={soundEnabled ? 'Sound alert enabled (Click to test/toggle)' : 'Sound alert muted (Click to enable)'}
          >
            <span>{soundEnabled ? '🔔' : '🔕'}</span>
            <span className="nav-text-desktop">{soundEnabled ? ' Sound' : ' Muted'}</span>
          </button>

          <button
            onClick={toggleAvailability}
            className={`nav-toggle-mobile ${isAvailable ? 'toggle-btn-online' : 'toggle-btn-offline'}`}
            style={{
              ...styles.toggleBtn,
              background: isAvailable
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              boxShadow: isAvailable ? '0 0 14px rgba(16, 185, 129, 0.4)' : '0 0 14px rgba(239, 68, 68, 0.35)',
              border: isAvailable ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid rgba(248, 113, 113, 0.4)'
            }}
            title={isAvailable ? 'Click to go Offline' : 'Click to go Online'}
          >
            <span
              style={{
                ...styles.statusPulseDot,
                background: isAvailable ? '#a7f3d0' : '#fecaca',
                animation: isAvailable ? 'pulseOnline 1.6s infinite' : 'pulseOffline 2.2s infinite'
              }}
            />
            <span className="nav-text-desktop" style={{ fontWeight: '700', letterSpacing: '0.3px' }}>
              {isAvailable ? 'Online' : 'Offline'}
            </span>
            <span className="nav-text-mobile" style={{ fontWeight: '700' }}>
              {isAvailable ? 'ON' : 'OFF'}
            </span>
          </button>

          <button onClick={() => navigate('/driver-earnings')} className="nav-btn-hover nav-btn-mobile" style={styles.navBtn} title="Driver Earnings">
            <span>💰</span><span className="nav-text-desktop"> Earnings</span>
          </button>
          <button onClick={() => navigate('/history')} className="nav-btn-hover nav-btn-mobile" style={styles.navBtn} title="Ride History">
            <span>📋</span><span className="nav-text-desktop"> History</span>
          </button>
          <button onClick={() => setShowAbout(true)} className="nav-btn-hover nav-btn-mobile" style={styles.navBtn} title="About Traverse">
            <span>ℹ️</span><span className="nav-text-desktop"> About</span>
          </button>
          <button onClick={logout} className="nav-btn-red-mobile" style={styles.navBtnRed} title="Logout">
            <span>🚪</span><span className="nav-text-desktop"> Logout</span><span className="nav-text-mobile"> Exit</span>
          </button>
        </div>
      </nav>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      <main style={styles.content}>
        {/* Driver Rating & Earnings Card (Uber Driver / Captain Style) */}
        <div className="driver-card-hover rating-card-mobile" style={styles.ratingCard}>
          <div style={styles.ratingLeft}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={styles.ratingBadgeIcon}>⚡</span>
              <p style={styles.ratingLabel}>Driver Score</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <p style={styles.ratingValue}>
                {myRating.average > 0 ? Number(myRating.average).toFixed(1) : '5.0'}
              </p>
              <span style={styles.ratingMax}>/5.0</span>
            </div>
          </div>

          <div style={styles.ratingStarsBox}>
            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map(s => {
                const isFilled = s <= Math.round(myRating.average || 5);
                return (
                  <span
                    key={s}
                    style={{
                      color: isFilled ? '#f59e0b' : '#333333',
                      fontSize: '18px',
                      textShadow: isFilled ? '0 0 8px rgba(245, 158, 11, 0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ★
                  </span>
                );
              })}
            </div>
            <p style={styles.ratingCount}>
              {myRating.total > 0 ? `${myRating.total} verified ratings` : 'Ready for first rating'}
            </p>
          </div>

          <div style={styles.ratingRight}>
            <div style={{
              ...styles.statusTag,
              background: myRating.average >= 4.5 || myRating.total === 0
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(230, 57, 70, 0.12)',
              border: myRating.average >= 4.5 || myRating.total === 0
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(230, 57, 70, 0.3)',
              color: myRating.average >= 4.5 || myRating.total === 0 ? '#10b981' : '#e63946'
            }}>
              <span style={{ fontSize: '13px' }}>
                {myRating.average >= 4.8 ? '👑' : myRating.average >= 4.5 ? '🏆' : myRating.average >= 4 ? '⭐' : myRating.average > 0 ? '👍' : '🚀'}
              </span>
              <span style={styles.ratingStatus}>
                {myRating.average >= 4.8 ? 'Elite Captain' : myRating.average >= 4.5 ? 'Top Rated' : myRating.average >= 4 ? 'Great Driver' : myRating.average > 0 ? 'Active Driver' : 'New Captain'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isAvailable ? '#10b981' : '#666' }} />
              <span style={{ color: '#888', fontSize: '11px', fontWeight: '500' }}>
                {isAvailable ? 'Receiving Dispatches' : 'Offline (Paused)'}
              </span>
            </div>
          </div>
        </div>

        {/* Status Message Notification Bar */}
        {message && (
          <div style={styles.messagebox}>
            <span style={styles.messageIcon}>🔔</span>
            <span style={{ flex: 1, lineHeight: '1.4' }}>{message}</span>
          </div>
        )}

        {/* Pill Tab Switchers (Instant vs Scheduled) */}
        {!activeRide && (
          <div style={styles.tabContainer}>
            <button
              onClick={() => setActiveTab('instant')}
              style={activeTab === 'instant' ? styles.tabActive : styles.tabInactive}
            >
              <span style={{ fontSize: '15px' }}>⚡</span>
              <span>Instant Rides</span>
              {rides.length > 0 && (
                <span style={styles.tabBadge}>{rides.length}</span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('scheduled'); fetchScheduledRides(); }}
              style={activeTab === 'scheduled' ? styles.tabActive : styles.tabInactive}
            >
              <span style={{ fontSize: '15px' }}>🕐</span>
              <span>Scheduled</span>
              {(scheduledRides.length + myScheduledRides.length) > 0 && (
                <span style={{ ...styles.tabBadge, background: '#10b981', color: 'white' }}>
                  {scheduledRides.length + myScheduledRides.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ACTIVE RIDE SCREEN (Uber Driver In-Progress Style) */}
        {activeRide && (
          <div className="driver-card-hover" style={styles.activeRideCard}>
            {/* Header Banner */}
            <div style={styles.activeCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    ...styles.statusPulseDot,
                    width: '12px',
                    height: '12px',
                    background: statusColor[activeRide.status] || '#e63946',
                    animation: 'pulseActiveTrip 1.8s infinite'
                  }}
                />
                <div>
                  <span style={styles.tripTypeLabel}>CURRENT TRIP</span>
                  <h3 style={styles.activeRideTitle}>
                    {activeRide.rideType === 'shared' ? 'Shared Shuttle Trip' : 'Private Ride Trip'}
                  </h3>
                </div>
              </div>
              <span style={{
                ...styles.statusBadge,
                background: `${statusColor[activeRide.status] || '#e63946'}20`,
                color: statusColor[activeRide.status] || '#e63946',
                border: `1px solid ${statusColor[activeRide.status] || '#e63946'}66`
              }}>
                {statusLabel[activeRide.status]}
              </span>
            </div>

            {/* Passenger Information */}
            {activeRide.rideType === 'shared' && activeRide.passengers?.length > 0 ? (
              <div style={styles.passengerGroup}>
                <div style={styles.passengerGroupHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px' }}>👥</span>
                    <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Pool Manifest ({activeRide.passengers.length}/{activeRide.maxPassengers || 4} Seats)
                    </span>
                  </div>
                  <span style={styles.poolFareTag}>
                    ₹{activeRide.fare} / seat
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeRide.passengers.map((p, i) => (
                    <div key={i} style={styles.passengerItem}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={styles.passengerAvatar}>
                          {i + 1}
                        </div>
                        <div>
                          <p style={styles.passengerName}>{p.name}</p>
                          <p style={styles.passengerRole}>Passenger {i + 1} • Confirmed Seat</p>
                        </div>
                      </div>
                      {p.phone && (
                        <a href={`tel:${p.phone}`} style={styles.callSmallBtn}>
                          <span>📞</span>
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                <div style={styles.totalFareBanner}>
                  <span style={{ color: '#999', fontSize: '13px' }}>Gross Fare Collection:</span>
                  <span style={{ color: '#e63946', fontSize: '16px', fontWeight: '800' }}>
                    ₹{activeRide.fare * activeRide.passengers.length}
                  </span>
                </div>
              </div>
            ) : (
              <div style={styles.studentCard}>
                <div style={styles.studentAvatar}>
                  <span>👤</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={styles.clientLabel}>RIDER DETAILS</span>
                  <p style={styles.studentName}>
                    {activeRide.student?.name || 'Student Passenger'}
                    {activeRide.student?.role === 'faculty' && (
                      <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600', marginLeft: '6px' }}>
                        (Faculty)
                      </span>
                    )}
                  </p>
                  <p style={styles.studentId}>Verified Campus Passenger</p>
                </div>
                {activeRide.student?.phone && (
                  <a href={`tel:${activeRide.student.phone}`} style={styles.callBtn}>
                    <span>📞</span>
                    <span>Call Passenger</span>
                  </a>
                )}
              </div>
            )}

            {/* Route Timeline Box */}
            <div style={styles.routeContainer}>
              <div style={styles.routeTimeline}>
                <div style={styles.routeDotPickup} />
                <div style={styles.routeVerticalLine} />
                <div style={styles.routeDotDropoff} />
              </div>
              <div style={styles.routeDetails}>
                <div style={styles.routeStop}>
                  <div style={styles.routeStopHeader}>
                    <span style={styles.routeTagPickup}>PICKUP</span>
                  </div>
                  <p style={styles.routeAddress}>{activeRide.pickup}</p>
                </div>
                <div style={styles.routeStop}>
                  <div style={styles.routeStopHeader}>
                    <span style={styles.routeTagDropoff}>DESTINATION</span>
                  </div>
                  <p style={styles.routeAddress}>{activeRide.dropoff}</p>
                </div>
              </div>
            </div>

            {/* Scheduled Tag */}
            {activeRide.isScheduled && activeRide.scheduledTime && (
              <div style={styles.scheduledBanner}>
                <span style={{ fontSize: '16px' }}>🕐</span>
                <span style={{ fontSize: '13px', color: '#f59e0b' }}>
                  Scheduled Departure: <b>{new Date(activeRide.scheduledTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</b>
                </span>
              </div>
            )}

            {/* CTA Action Buttons */}
            <div style={styles.activeBtnRow}>
              {activeRide.status === 'accepted' && (
                <button
                  onClick={() => updateStatus('ontheway')}
                  className="traverse-btn-accept"
                  style={styles.startTripBtn}
                >
                  <span style={{ fontSize: '18px' }}>🚗</span>
                  <span>Start Ride / On The Way</span>
                </button>
              )}

              {activeRide.status === 'ontheway' && (
                <button
                  onClick={() => updateStatus('completed')}
                  className="traverse-btn-accept"
                  style={styles.completeTripBtn}
                >
                  <span style={{ fontSize: '18px' }}>✅</span>
                  <span>Complete Ride & Collect ₹{activeRide.fare}</span>
                </button>
              )}

              {activeRide.status === 'accepted' && (
                <button
                  onClick={() => setShowCancelPopup(true)}
                  className="traverse-btn-reject"
                  style={styles.cancelTripBtn}
                >
                  Cancel Ride
                </button>
              )}
            </div>

            {/* Cancel Confirmation Modal */}
            {showCancelPopup && (
              <div style={styles.popup}>
                <div className="driver-card-hover" style={styles.popupCard}>
                  <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                    <div style={styles.popupWarningIcon}>⚠️</div>
                    <h3 style={{ color: 'white', margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700' }}>Cancel Accepted Ride?</h3>
                    <p style={{ color: '#999', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
                      Cancelling after accepting disrupts rider schedules. Repeated cancellations (5+) may result in account penalties.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={cancelAcceptedRide}
                      style={styles.confirmCancelBtn}
                    >
                      Yes, Cancel
                    </button>
                    <button
                      onClick={() => setShowCancelPopup(false)}
                      style={styles.keepRideBtn}
                    >
                      Keep Ride
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AVAILABLE RIDES LIST */}
        {!activeRide && (
          <div>
            {/* INSTANT RIDES TAB */}
            {activeTab === 'instant' && (
              <div>
                <div style={styles.header}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e63946' }} />
                      <h3 style={styles.sectionTitle}>Available Requests</h3>
                    </div>
                    <p style={styles.sectionSubtitle}>
                      {rides.length} ride request{rides.length !== 1 ? 's' : ''} in your queue
                    </p>
                  </div>
                  <button onClick={fetchAvailableRides} className="nav-btn-hover" style={styles.refreshBtn}>
                    <span>🔄</span>
                    <span>Refresh</span>
                  </button>
                </div>

                {rides.length === 0 && (
                  <div className="driver-card-hover" style={styles.empty}>
                    <div style={styles.emptyIconBox}>
                      <span style={{ fontSize: '32px' }}>🚖</span>
                    </div>
                    <h4 style={styles.emptyTitle}>No Rides in Queue</h4>
                    <p style={styles.emptySubtitle}>
                      {isAvailable
                        ? 'Looking for nearby passenger requests... Keep app open to receive instant alerts.'
                        : 'You are currently Offline. Turn Online in the navbar to start receiving rides.'}
                    </p>
                    {!isAvailable && (
                      <button
                        onClick={toggleAvailability}
                        className="toggle-btn-online"
                        style={styles.goOnlinePromptBtn}
                      >
                        🟢 Go Online Now
                      </button>
                    )}
                  </div>
                )}

                {rides.map(ride => (
                  <div key={ride._id} className="driver-card-hover" style={styles.rideCard}>
                    {/* Top Row: Rider Info & Fare */}
                    <div style={styles.requestCardTop}>
                      <div style={styles.studentInfo}>
                        <div style={styles.studentAvatarSmall}>👤</div>
                        <div>
                          <p style={styles.studentName}>
                            {ride.student?.name || 'Campus Rider'}
                            {ride.student?.role === 'faculty' && (
                              <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600', marginLeft: '6px' }}>
                                (Faculty)
                              </span>
                            )}
                          </p>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                            <span style={styles.vehicleTypeTag}>
                              🚗 {ride.vehicleType || 'Sedan'}
                            </span>
                            {ride.rideType === 'shared' ? (
                              <span style={styles.sharedBadge}>
                                👥 Pool ({ride.passengers?.length || 1}/{ride.maxPassengers || 4})
                              </span>
                            ) : (
                              <span style={styles.privateBadge}>
                                🔒 Private
                              </span>
                            )}
                            {ride.isFull && (
                              <span style={styles.fullBadge}>FULL</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={styles.fareHighlightBox}>
                        <span style={styles.fareLabel}>EST. FARE</span>
                        <p style={styles.fareAmount}>₹{ride.fare}</p>
                      </div>
                    </div>

                    {/* Middle: Route Info */}
                    <div style={styles.routeContainer}>
                      <div style={styles.routeTimeline}>
                        <div style={styles.routeDotPickup} />
                        <div style={styles.routeVerticalLine} />
                        <div style={styles.routeDotDropoff} />
                      </div>
                      <div style={styles.routeDetails}>
                        <div style={styles.routeStop}>
                          <div style={styles.routeStopHeader}>
                            <span style={styles.routeTagPickup}>PICKUP</span>
                          </div>
                          <p style={styles.routeAddress}>{ride.pickup}</p>
                        </div>
                        <div style={styles.routeStop}>
                          <div style={styles.routeStopHeader}>
                            <span style={styles.routeTagDropoff}>DROPOFF</span>
                          </div>
                          <p style={styles.routeAddress}>{ride.dropoff}</p>
                        </div>
                      </div>
                    </div>

                    {/* Timing details */}
                    <div style={styles.requestMetaRow}>
                      {ride.isScheduled && ride.scheduledTime ? (
                        <div style={styles.scheduledMetaTag}>
                          <span>📅 Scheduled:</span>
                          <b>{new Date(ride.scheduledTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</b>
                        </div>
                      ) : (
                        <div style={styles.timestampMetaTag}>
                          <span>⏰ Requested:</span>
                          <span>{new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons (Uber Driver Accept/Reject Style) */}
                    <div style={styles.actionBtns}>
                      <button
                        onClick={() => acceptRide(ride._id)}
                        className="traverse-btn-accept"
                        style={styles.acceptBtn}
                        disabled={accepting}
                      >
                        {accepting ? 'Connecting...' : '✓ Accept Ride'}
                      </button>
                      <button
                        onClick={() => rejectRide(ride._id)}
                        className="traverse-btn-reject"
                        style={styles.rejectBtn}
                      >
                        ✕ Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SCHEDULED RIDES TAB */}
            {activeTab === 'scheduled' && (
              <div>
                {/* My Confirmed Scheduled Rides */}
                {myScheduledRides.length > 0 && (
                  <div style={{ marginBottom: '28px' }}>
                    <div style={styles.scheduledHeaderConfirmed}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>✅</span>
                        <h3 style={{ ...styles.sectionTitle, color: '#10b981' }}>
                          My Confirmed Bookings ({myScheduledRides.length})
                        </h3>
                      </div>
                      <span style={styles.confirmedBadgeCount}>{myScheduledRides.length} Upcoming</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {myScheduledRides.map(ride => (
                        <div key={ride._id} className="driver-card-hover" style={{ ...styles.rideCard, border: '1px solid rgba(16, 185, 129, 0.45)', background: 'linear-gradient(145deg, #121814 0%, #111111 100%)' }}>
                          {/* Top Row: Rider Info, Badges, and Fare */}
                          <div style={styles.requestCardTop}>
                            <div style={styles.studentInfo}>
                              <div style={{ ...styles.studentAvatarSmall, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>👤</div>
                              <div>
                                <p style={styles.studentName}>
                                  {ride.student?.name || 'Campus Rider'}
                                  {ride.student?.role === 'faculty' && (
                                    <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600', marginLeft: '6px' }}>
                                      (Faculty)
                                    </span>
                                  )}
                                </p>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                                  <span style={styles.vehicleTypeTag}>
                                    🚗 {ride.vehicleType || '4+1'}
                                  </span>
                                  {ride.rideType === 'shared' ? (
                                    <span style={styles.sharedBadge}>
                                      👥 Pool ({ride.passengers?.length || 1}/{ride.maxPassengers || 4})
                                    </span>
                                  ) : (
                                    <span style={styles.privateBadge}>
                                      🔒 Private
                                    </span>
                                  )}
                                  {ride.isFull && (
                                    <span style={styles.fullBadge}>FULL</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span style={styles.confirmedBadge}>
                                CONFIRMED ✅
                              </span>
                              <div style={styles.fareHighlightBox}>
                                <span style={styles.fareLabel}>{ride.rideType === 'shared' ? 'PER SEAT' : 'FARE'}</span>
                                <p style={{ ...styles.fareAmount, color: '#10b981' }}>₹{ride.fare}</p>
                              </div>
                            </div>
                          </div>

                          {/* Shared Pool Passengers Manifest */}
                          {ride.rideType === 'shared' && ride.passengers?.length > 0 && (
                            <div style={{ ...styles.passengerGroup, margin: '10px 0 8px 0', padding: '10px 12px', borderRadius: '10px' }}>
                              <div style={styles.passengerGroupHeader}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '15px' }}>👥</span>
                                  <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Confirmed Pool Passengers ({ride.passengers.length}/{ride.maxPassengers || 4})
                                  </span>
                                </div>
                                <span style={styles.poolFareTag}>
                                  ₹{ride.fare} / seat
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                                {ride.passengers.map((p, i) => (
                                  <div key={i} style={{ ...styles.passengerItem, padding: '6px 8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ ...styles.passengerAvatar, width: '24px', height: '24px', fontSize: '11px' }}>
                                        {i + 1}
                                      </div>
                                      <div>
                                        <p style={{ ...styles.passengerName, fontSize: '13px' }}>{p.name || p.student?.name || 'Passenger'}</p>
                                        <p style={{ ...styles.passengerRole, fontSize: '10px' }}>
                                          {i === 0 ? 'Primary Booker' : `Joined Passenger ${i + 1}`}
                                        </p>
                                      </div>
                                    </div>
                                    {(p.phone || (i === 0 && ride.student?.phone)) && (
                                      <a href={`tel:${p.phone || ride.student?.phone}`} style={styles.callSmallBtn}>
                                        <span>📞</span>
                                        <span>Call</span>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div style={{ ...styles.totalFareBanner, marginTop: '8px', paddingTop: '6px' }}>
                                <span style={{ color: '#999', fontSize: '12px' }}>Total Fare Collection:</span>
                                <span style={{ color: '#10b981', fontSize: '15px', fontWeight: '800' }}>
                                  ₹{ride.fare * ride.passengers.length}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Private ride direct phone */}
                          {ride.rideType !== 'shared' && ride.student?.phone && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 8px 0' }}>
                              <a href={`tel:${ride.student.phone}`} style={styles.phoneLink}>
                                <span>📞 Call Rider:</span>
                                <span>{ride.student.phone}</span>
                              </a>
                            </div>
                          )}

                          {/* Middle: Route Info */}
                          <div style={styles.routeContainer}>
                            <div style={styles.routeTimeline}>
                              <div style={styles.routeDotPickup} />
                              <div style={styles.routeVerticalLine} />
                              <div style={styles.routeDotDropoff} />
                            </div>
                            <div style={styles.routeDetails}>
                              <div style={styles.routeStop}>
                                <div style={styles.routeStopHeader}><span style={styles.routeTagPickup}>PICKUP</span></div>
                                <p style={styles.routeAddress}>{ride.pickup}</p>
                              </div>
                              <div style={styles.routeStop}>
                                <div style={styles.routeStopHeader}><span style={styles.routeTagDropoff}>DROPOFF</span></div>
                                <p style={styles.routeAddress}>{ride.dropoff}</p>
                              </div>
                            </div>
                          </div>

                          <div style={styles.scheduledBannerConfirmed}>
                            <span>⏰ Scheduled Time:</span>
                            <b>{new Date(ride.scheduledTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</b>

                          {ride.student?.phone && (
                            <div style={{ marginTop: '10px' }}>
                              <a href={`tel:${ride.student.phone}`} style={styles.callBtn}>
                                📞 Call Student
                              </a>
                            </div>
                          )}
                          <button
                            onClick={() => startScheduledRide(ride._id)}
                            style={{ ...styles.acceptBtn, marginTop: '8px', width: '100%', justifyContent: 'center' }}>
                            🚗 Start Now — Begin This Ride
                          </button>
                          <button
                            onClick={() => cancelScheduledRide(ride._id)}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              background: 'rgba(230, 57, 70, 0.08)',
                              color: '#f87171',
                              border: '1.5px solid rgba(230, 57, 70, 0.5)',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '700',
                              marginTop: '8px',
                              fontFamily: 'inherit',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            Cancel Scheduled Ride
                          </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Scheduled Rides */}
                <div style={styles.header}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📅</span>
                      <h3 style={styles.sectionTitle}>Available Pre-Bookings</h3>
                    </div>
                    <p style={styles.sectionSubtitle}>Claim upcoming scheduled rides in advance</p>
                  </div>
                  <button onClick={fetchScheduledRides} className="nav-btn-hover" style={styles.refreshBtn}>
                    <span>🔄</span>
                    <span>Refresh</span>
                  </button>
                </div>

                {scheduledLoading && <Spinner text='Fetching scheduled trips...' />}

                {!scheduledLoading && scheduledRides.length === 0 && (
                  <div className="driver-card-hover" style={styles.empty}>
                    <div style={styles.emptyIconBox}>
                      <span style={{ fontSize: '32px' }}>📅</span>
                    </div>
                    <h4 style={styles.emptyTitle}>No Scheduled Trips</h4>
                    <p style={styles.emptySubtitle}>All upcoming rides are currently claimed or none posted.</p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {scheduledRides.map(ride => (
                    <div key={ride._id} className="driver-card-hover" style={styles.rideCard}>
                      <div style={styles.requestCardTop}>
                        <div style={styles.studentInfo}>
                          <div style={styles.studentAvatarSmall}>👤</div>
                          <div>
                            <p style={styles.studentName}>
                              {ride.student?.name || 'Campus Passenger'}
                              {ride.student?.role === 'faculty' && (
                                <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600', marginLeft: '6px' }}>
                                  (Faculty)
                                </span>
                              )}
                            </p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                              <span style={styles.vehicleTypeTag}>
                                🚗 {ride.vehicleType || '4+1'}
                              </span>
                              {ride.rideType === 'shared' ? (
                                <span style={styles.sharedBadge}>
                                  👥 Pool ({ride.passengers?.length || 1}/{ride.maxPassengers || 4})
                                </span>
                              ) : (
                                <span style={styles.privateBadge}>
                                  🔒 Private
                                </span>
                              )}
                              {ride.isFull && (
                                <span style={styles.fullBadge}>FULL</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          {ride.driver ? (
                            <span style={styles.alreadyTakenBadge}>Assigned</span>
                          ) : (
                            <span style={styles.openSlotBadge}>Open Booking</span>
                          )}
                          <div style={styles.fareHighlightBox}>
                            <span style={styles.fareLabel}>{ride.rideType === 'shared' ? 'PER SEAT' : 'EST. FARE'}</span>
                            <p style={styles.fareAmount}>₹{ride.fare}</p>
                          </div>
                        </div>
                      </div>

                      {/* Shared Pool Passengers Manifest */}
                      {ride.rideType === 'shared' && ride.passengers?.length > 0 && (
                        <div style={{ ...styles.passengerGroup, margin: '10px 0 8px 0', padding: '10px 12px', borderRadius: '10px' }}>
                          <div style={styles.passengerGroupHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '15px' }}>👥</span>
                              <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Joined Pool Passengers ({ride.passengers.length}/{ride.maxPassengers || 4})
                              </span>
                            </div>
                            <span style={styles.poolFareTag}>
                              ₹{ride.fare} / seat
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                            {ride.passengers.map((p, i) => (
                              <div key={i} style={{ ...styles.passengerItem, padding: '6px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ ...styles.passengerAvatar, width: '24px', height: '24px', fontSize: '11px' }}>
                                    {i + 1}
                                  </div>
                                  <div>
                                    <p style={{ ...styles.passengerName, fontSize: '13px' }}>{p.name || p.student?.name || 'Passenger'}</p>
                                    <p style={{ ...styles.passengerRole, fontSize: '10px' }}>
                                      {i === 0 ? 'Primary Booker' : `Joined Passenger ${i + 1}`}
                                    </p>
                                  </div>
                                </div>
                                {(p.phone || (i === 0 && ride.student?.phone)) && (
                                  <a href={`tel:${p.phone || ride.student?.phone}`} style={styles.callSmallBtn}>
                                    <span>📞</span>
                                    <span>Call</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>

                          <div style={{ ...styles.totalFareBanner, marginTop: '8px', paddingTop: '6px' }}>
                            <span style={{ color: '#999', fontSize: '12px' }}>Total Pool Collection:</span>
                            <span style={{ color: '#e63946', fontSize: '15px', fontWeight: '800' }}>
                              ₹{ride.fare * ride.passengers.length}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Private ride phone */}
                      {ride.rideType !== 'shared' && ride.student?.phone && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 8px 0' }}>
                          <a href={`tel:${ride.student.phone}`} style={styles.phoneLink}>
                            <span>📞</span>
                            <span>{ride.student.phone}</span>
                          </a>
                        </div>
                      )}

                      <div style={styles.routeContainer}>
                        <div style={styles.routeTimeline}>
                          <div style={styles.routeDotPickup} />
                          <div style={styles.routeVerticalLine} />
                          <div style={styles.routeDotDropoff} />
                        </div>
                        <div style={styles.routeDetails}>
                          <div style={styles.routeStop}>
                            <div style={styles.routeStopHeader}><span style={styles.routeTagPickup}>PICKUP</span></div>
                            <p style={styles.routeAddress}>{ride.pickup}</p>
                          </div>
                          <div style={styles.routeStop}>
                            <div style={styles.routeStopHeader}><span style={styles.routeTagDropoff}>DROPOFF</span></div>
                            <p style={styles.routeAddress}>{ride.dropoff}</p>
                          </div>
                        </div>
                      </div>

                      <div style={styles.scheduledBanner}>
                        <span>⏰ Trip Time:</span>
                        <b>{new Date(ride.scheduledTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</b>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        <span style={styles.vehicleTypeTag}>🚗 {ride.vehicleType || '4+1'}</span>
                        {!ride.driver && (
                          <button
                            onClick={() => preAcceptRide(ride._id)}
                            className="traverse-btn-accept"
                            style={styles.confirmPreAcceptBtn}
                          >
                            ✅ Claim Scheduled Ride
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#ffffff',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundImage: 'radial-gradient(circle at 50% 0%, #20080a 0%, #0a0a0a 65%)',
    backgroundAttachment: 'fixed',
    paddingBottom: '40px'
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 18px',
    background: 'rgba(17, 17, 17, 0.88)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.7)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  navLogoBox: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #1c1c1c 0%, #2a1114 100%)',
    border: '1px solid rgba(230, 57, 70, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 12px rgba(230, 57, 70, 0.3)'
  },
  navLogo: { fontSize: '20px' },
  navTitle: {
    fontSize: '18px',
    fontWeight: '900',
    letterSpacing: '2.5px',
    color: '#e63946',
    textShadow: '0 0 16px rgba(230, 57, 70, 0.5)'
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  navUser: {
    color: '#a0a0a0',
    fontSize: '13px',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  toggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#ffffff',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  statusPulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  navBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#a0a0a0',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '7px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  },
  navBtnRed: {
    background: 'rgba(230, 57, 70, 0.12)',
    color: '#e63946',
    border: '1px solid rgba(230, 57, 70, 0.35)',
    padding: '7px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  },
  content: {
    maxWidth: '680px',
    margin: '20px auto 0',
    padding: '0 14px',
    position: 'relative',
    zIndex: 1
  },
  ratingCard: {
    background: 'linear-gradient(145deg, #161616 0%, #111111 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '18px 20px',
    borderRadius: '16px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    position: 'relative',
    overflow: 'hidden'
  },
  ratingLeft: {
    display: 'flex',
    flexDirection: 'column'
  },
  ratingBadgeIcon: {
    fontSize: '12px',
    color: '#e63946'
  },
  ratingLabel: {
    color: '#888888',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: '700',
    margin: 0
  },
  ratingValue: {
    fontSize: '34px',
    fontWeight: '900',
    color: '#ffffff',
    margin: 0,
    lineHeight: '1.1',
    letterSpacing: '-0.5px'
  },
  ratingMax: {
    fontSize: '14px',
    color: '#666666',
    fontWeight: '600'
  },
  ratingStarsBox: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  ratingCount: {
    color: '#777777',
    fontSize: '11px',
    margin: '5px 0 0 0',
    fontWeight: '500'
  },
  ratingRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end'
  },
  statusTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    borderRadius: '20px'
  },
  ratingStatus: {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.3px'
  },
  messagebox: {
    background: 'linear-gradient(135deg, #1c1415 0%, #141414 100%)',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '18px',
    borderLeft: '4px solid #e63946',
    borderTop: '1px solid rgba(230, 57, 70, 0.2)',
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    fontSize: '13px',
    color: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
  },
  messageIcon: {
    fontSize: '16px'
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    background: '#121212',
    padding: '4px',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  tabActive: {
    flex: 1,
    padding: '12px 14px',
    background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 14px rgba(230, 57, 70, 0.45)',
    transition: 'all 0.2s ease'
  },
  tabInactive: {
    flex: 1,
    padding: '12px 14px',
    background: 'transparent',
    color: '#777777',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
  },
  tabBadge: {
    background: '#ffffff',
    color: '#c1121f',
    borderRadius: '12px',
    padding: '2px 7px',
    fontSize: '11px',
    fontWeight: '800'
  },
  activeRideCard: {
    background: 'linear-gradient(145deg, #181213 0%, #121212 100%)',
    border: '1px solid rgba(230, 57, 70, 0.35)',
    padding: '20px',
    borderRadius: '18px',
    marginBottom: '20px',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(230, 57, 70, 0.15)'
  },
  activeCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
    paddingBottom: '14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  tripTypeLabel: {
    color: '#e63946',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '1px',
    display: 'block'
  },
  activeRideTitle: {
    fontSize: '17px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.3px'
  },
  passengerGroup: {
    background: 'rgba(0, 0, 0, 0.45)',
    padding: '14px',
    borderRadius: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  passengerGroupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  poolFareTag: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700'
  },
  passengerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.04)',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.04)'
  },
  passengerAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e63946 0%, #991b1b 100%)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '800'
  },
  passengerName: {
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    margin: '0 0 2px 0'
  },
  passengerRole: {
    color: '#777777',
    fontSize: '11px',
    margin: 0
  },
  callSmallBtn: {
    background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
    color: '#ffffff',
    padding: '6px 12px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    boxShadow: '0 2px 8px rgba(230, 57, 70, 0.4)'
  },
  totalFareBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
  },
  studentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(0, 0, 0, 0.45)',
    padding: '14px 16px',
    borderRadius: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  studentAvatar: {
    width: '42px',
    height: '42px',
    background: 'linear-gradient(135deg, #222 0%, #181818 100%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px'
  },
  clientLabel: {
    color: '#777777',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.8px',
    display: 'block'
  },
  studentName: {
    fontWeight: '700',
    margin: '0 0 2px 0',
    fontSize: '14px',
    color: '#ffffff'
  },
  studentId: {
    color: '#888888',
    fontSize: '11px',
    margin: 0
  },
  callBtn: {
    background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
    color: '#ffffff',
    padding: '8px 14px',
    borderRadius: '10px',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 4px 14px rgba(230, 57, 70, 0.4)'
  },
  routeContainer: {
    display: 'flex',
    gap: '12px',
    background: 'rgba(0, 0, 0, 0.4)',
    padding: '14px',
    borderRadius: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  routeTimeline: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '6px',
    paddingBottom: '6px'
  },
  routeDotPickup: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)'
  },
  routeVerticalLine: {
    width: '2px',
    flex: 1,
    minHeight: '26px',
    background: 'linear-gradient(to bottom, #10b981 0%, #e63946 100%)',
    margin: '4px 0'
  },
  routeDotDropoff: {
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    background: '#e63946',
    boxShadow: '0 0 8px rgba(230, 57, 70, 0.6)'
  },
  routeDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '10px'
  },
  routeStop: {
    display: 'flex',
    flexDirection: 'column'
  },
  routeStopHeader: {
    marginBottom: '2px'
  },
  routeTagPickup: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: '0.8px'
  },
  routeTagDropoff: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#e63946',
    letterSpacing: '0.8px'
  },
  routeAddress: {
    color: '#f0f0f0',
    fontSize: '13px',
    fontWeight: '600',
    margin: 0
  },
  scheduledBanner: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#f59e0b',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  activeBtnRow: {
    display: 'flex',
    gap: '10px',
    flexDirection: 'column'
  },
  startTripBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '800',
    letterSpacing: '0.3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 6px 20px rgba(230, 57, 70, 0.5)',
    transition: 'all 0.2s ease'
  },
  completeTripBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '800',
    letterSpacing: '0.3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 6px 20px rgba(16, 185, 129, 0.5)',
    transition: 'all 0.2s ease'
  },
  cancelTripBtn: {
    padding: '11px',
    background: 'transparent',
    color: '#e63946',
    border: '1px solid rgba(230, 57, 70, 0.5)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.2s ease'
  },
  popup: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.82)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px'
  },
  popupCard: {
    background: '#161616',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '24px',
    borderRadius: '18px',
    maxWidth: '340px',
    width: '100%',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)'
  },
  popupWarningIcon: {
    fontSize: '36px',
    marginBottom: '8px'
  },
  confirmCancelBtn: {
    flex: 1,
    padding: '12px',
    background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '13px'
  },
  keepRideBtn: {
    flex: 1,
    padding: '12px',
    background: '#222222',
    color: '#a0a0a0',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: '800',
    margin: '0 0 2px 0',
    color: '#ffffff',
    letterSpacing: '-0.3px'
  },
  sectionSubtitle: {
    color: '#777777',
    fontSize: '12px',
    margin: 0
  },
  refreshBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#a0a0a0',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '8px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease'
  },
  empty: {
    background: 'linear-gradient(145deg, #141414 0%, #0f0f0f 100%)',
    border: '1px dashed rgba(255, 255, 255, 0.12)',
    padding: '44px 20px',
    borderRadius: '18px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  emptyIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(230, 57, 70, 0.08)',
    border: '1px solid rgba(230, 57, 70, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px'
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '700',
    margin: '0 0 6px 0',
    color: '#ffffff'
  },
  emptySubtitle: {
    color: '#777777',
    fontSize: '12px',
    margin: '0 0 16px 0',
    maxWidth: '320px',
    lineHeight: '1.4'
  },
  goOnlinePromptBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
  },
  rideCard: {
    background: 'linear-gradient(145deg, #161616 0%, #111111 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '16px',
    borderRadius: '16px',
    marginBottom: '14px',
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
    position: 'relative'
  },
  requestCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px'
  },
  studentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  studentAvatarSmall: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px'
  },
  vehicleTypeTag: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#bbb',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600'
  },
  sharedBadge: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700'
  },
  privateBadge: {
    background: 'rgba(230, 57, 70, 0.12)',
    color: '#e63946',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700'
  },
  fullBadge: {
    background: '#e63946',
    color: '#ffffff',
    padding: '2px 5px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '800'
  },
  fareHighlightBox: {
    textAlign: 'right',
    background: 'rgba(230, 57, 70, 0.08)',
    border: '1px solid rgba(230, 57, 70, 0.25)',
    padding: '6px 12px',
    borderRadius: '10px'
  },
  fareLabel: {
    fontSize: '9px',
    color: '#e63946',
    fontWeight: '800',
    letterSpacing: '0.8px',
    display: 'block'
  },
  fareAmount: {
    fontSize: '18px',
    fontWeight: '900',
    color: '#ffffff',
    margin: 0,
    lineHeight: '1.1'
  },
  requestMetaRow: {
    marginBottom: '14px'
  },
  scheduledMetaTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.08)',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(245, 158, 11, 0.2)'
  },
  timestampMetaTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#777777'
  },
  actionBtns: {
    display: 'flex',
    gap: '8px'
  },
  acceptBtn: {
    flex: 2,
    padding: '12px',
    background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '800',
    boxShadow: '0 4px 16px rgba(230, 57, 70, 0.4)',
    transition: 'all 0.2s ease',
    letterSpacing: '0.2px'
  },
  rejectBtn: {
    flex: 1,
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#888888',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.2s ease'
  },
  scheduledHeaderConfirmed: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px'
  },
  confirmedBadgeCount: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '700'
  },
  confirmedBadge: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.5px'
  },
  phoneLink: {
    color: '#e63946',
    fontSize: '12px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '600',
    marginTop: '2px'
  },
  scheduledBannerConfirmed: {
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: '#10b981',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  openSlotBadge: {
    background: 'rgba(230, 57, 70, 0.12)',
    color: '#e63946',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '700'
  },
  alreadyTakenBadge: {
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#f59e0b',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '700'
  },
  confirmPreAcceptBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '0 3px 10px rgba(16, 185, 129, 0.35)',
    transition: 'all 0.2s ease'
  }
};

export default DriverDashboard;