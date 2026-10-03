import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { JourneyProvider } from './context/JourneyContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SearchResults from './pages/SearchResults'
import JourneyBuilder from './pages/JourneyBuilder'
import OrderSummary from './pages/OrderSummary'
import Payment from './pages/Payment'
import Confirmation from './pages/Confirmation'
import MyTrips from './pages/MyTrips'
import Profile from './pages/Profile'
import AlgorithmDemo from './pages/AlgorithmDemo'

function AlgoButton() {
  const location = useLocation()
  
  // Hide on algorithm page itself
  if (location.pathname === '/algorithm') 
    return null

  return (
    <div
      onClick={() => window.location.href = '/algorithm'}
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        zIndex: 9999,
        backgroundColor: '#0F172A',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '999px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        fontSize: '13px',
        fontWeight: '700',
        border: '1px solid #334155',
        transition: 'all 0.2s ease',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = '#1A56DB'
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = '#0F172A'
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <span style={{ fontSize: '16px' }}>🧮</span>
      <span>Algorithm Demo</span>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <JourneyProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/algorithm" element={<AlgorithmDemo />} />
          <Route path="/journey-builder"
            element={<JourneyBuilder />} />
          <Route path="/order-summary"
            element={<OrderSummary />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/confirmation"
            element={<Confirmation />} />
          <Route path="/my-trips" element={<MyTrips />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
        <AlgoButton />
      </JourneyProvider>
    </BrowserRouter>
  )
}

export default App