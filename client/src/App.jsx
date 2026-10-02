import { useEffect, useState } from "react";
import IndiaMap, { INDIA_AREAS } from "./components/IndiaMap.jsx";
import PropertyList from "./components/PropertyList.jsx";
import AuthPage from "./components/AuthPage.jsx";
import DealerDashboard from "./components/DealerDashboard.jsx";
import "./App.css";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const area = INDIA_AREAS[0];

function BuyerApp({ user, onLogout }) {
  const [listingType, setListingType] = useState("all");
  const [state, setState] = useState("");
  const [states, setStates] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const selectedProperty = properties.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    fetch("/api/states").then((response) => response.json()).then(setStates).catch(() => setStates([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProperties() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (listingType !== "all") params.set("listingType", listingType);
      if (state) params.set("state", state);
      try {
        const response = await fetch(`/api/properties?${params}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load properties.");
        if (!cancelled) {
          setProperties(data);
          setSelectedId((current) => data.some((item) => item.id === current) ? current : null);
        }
      } catch (requestError) {
        if (!cancelled) { setError(requestError.message); setProperties([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProperties();
    return () => { cancelled = true; };
  }, [listingType, state]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-copy"><p className="brand">GharMap India</p><p className="lede">Homes for sale and rent across India, sourced from local dealers.</p></div>
        <div className="account-actions"><span>Hi, {user.username}</span><button type="button" className="quiet-btn" onClick={onLogout}>Log out</button></div>
      </header>
      <div className="filter-row">
        <label className="state-search">Search by state<input list="state-options" value={state} onChange={(event) => setState(event.target.value)} placeholder="All states" /><datalist id="state-options">{states.map((item) => <option key={item} value={item} />)}</datalist></label>
        <div className="filters" role="tablist" aria-label="Listing type">{[{ id: "all", label: "All" }, { id: "sale", label: "For sale" }, { id: "rent", label: "For rent" }].map((option) => <button key={option.id} type="button" role="tab" aria-selected={listingType === option.id} className={`filter-btn ${listingType === option.id ? "is-active" : ""}`} onClick={() => setListingType(option.id)}>{option.label}</button>)}</div>
      </div>
      <div className="workspace">
        <section className="map-pane" aria-label="Map"><div className="map-frame"><IndiaMap apiKey={API_KEY} area={area} selectedProperty={selectedProperty} useKeylessFallback /></div></section>
        <section className="list-pane" aria-label="Listings"><div className="list-header"><div><h1>{state || "All India"}</h1><p>Customer view</p></div><p>{loading ? "Updating..." : `${properties.length} listing${properties.length === 1 ? "" : "s"}`}</p></div><PropertyList properties={properties} selectedId={selectedId} onSelect={setSelectedId} loading={loading && properties.length === 0} error={error} /></section>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const token = localStorage.getItem("gharmap-token");

  useEffect(() => {
    if (!token) { setCheckingSession(false); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("expired")))
      .then(setSession)
      .catch(() => localStorage.removeItem("gharmap-token"))
      .finally(() => setCheckingSession(false));
  }, [token]);

  function logout() {
    fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem("gharmap-token");
    setSession(null);
  }

  if (checkingSession) return <div className="loading-screen">Opening your account...</div>;
  if (!session) return <AuthPage onAuthenticated={setSession} />;
  return session.user.role === "dealer"
    ? <DealerDashboard token={token} user={session.user} onLogout={logout} />
    : <BuyerApp user={session.user} onLogout={logout} />;
}
