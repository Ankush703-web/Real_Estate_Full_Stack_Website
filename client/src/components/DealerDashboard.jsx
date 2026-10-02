import { useEffect, useState } from "react";

const initialForm = {
  title: "",
  price: "",
  listingType: "sale",
  bedrooms: "",
  address: "",
  state: "",
  image: "",
  contactNumber: "",
  latitude: "",
  longitude: "",
};

export default function DealerDashboard({ token, user, onLogout }) {
  const [form, setForm] = useState(initialForm);
  const [properties, setProperties] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProperties();
  }, []);

  async function readApiResponse(response, fallbackMessage) {
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      throw new Error("The running server is outdated. Stop and restart it with npm start in the server folder.");
    }
    if (!response.ok) throw new Error(data?.error || fallbackMessage);
    return data;
  }

  async function loadProperties() {
    try {
      const response = await fetch("/api/dealer/properties", { headers: { Authorization: `Bearer ${token}` } });
      const data = await readApiResponse(response, "Could not load your properties.");
      setProperties(data);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const response = await fetch(editingId ? `/api/properties/${editingId}` : "/api/properties", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await readApiResponse(response, editingId ? "Could not update property." : "Could not publish property.");
      setForm(initialForm);
      setEditingId(null);
      setMessage(editingId ? `Updated ${data.title}.` : `Published ${data.title}. It is now visible to customers.`);
      await loadProperties();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function editProperty(property) {
    setEditingId(property.id);
    setForm({
      title: property.title,
      price: property.price,
      listingType: property.listingType,
      bedrooms: property.bedrooms,
      address: property.address,
      state: property.state,
      image: property.image,
      contactNumber: property.contactNumber,
      latitude: property.coordinates.latitude,
      longitude: property.coordinates.longitude,
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeProperty(property) {
    if (!window.confirm(`Delete ${property.title}?`)) return;
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/properties/${property.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        await readApiResponse(response, "Could not delete property.");
      }
      if (editingId === property.id) {
        setEditingId(null);
        setForm(initialForm);
      }
      setMessage(`${property.title} was deleted.`);
      await loadProperties();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
    setError("");
  }

  return (
    <main className="dealer-shell">
      <header className="dealer-header">
        <div><p className="brand">GharMap India</p><p className="eyebrow">Dealer workspace</p></div>
        <div className="account-actions"><span>{user.username}</span><button type="button" className="quiet-btn" onClick={onLogout}>Log out</button></div>
      </header>
      <section className="dealer-content">
        <div className="dealer-intro"><p className="eyebrow">New listing</p><h1>Put the right home on the map.</h1><p>Enter the details customers need to compare, locate, and contact you about a property.</p></div>
        <form className="property-form" onSubmit={submit}>
          <div className="form-heading wide-field"><p className="eyebrow">{editingId ? "Edit listing" : "Listing details"}</p><h2>{editingId ? "Update this property" : "Publish a property"}</h2></div>
          <label className="wide-field">Property title<input name="title" value={form.title} onChange={updateField} placeholder="e.g. Sea-facing 3BHK in Bandra West" required /></label>
          <label>Price in INR<input name="price" type="number" min="1" value={form.price} onChange={updateField} required /></label>
          <label>Listing type<select name="listingType" value={form.listingType} onChange={updateField}><option value="sale">For sale</option><option value="rent">For rent</option></select></label>
          <label>Bedrooms<input name="bedrooms" type="number" min="1" value={form.bedrooms} onChange={updateField} required /></label>
          <label>State<input name="state" value={form.state} onChange={updateField} placeholder="Maharashtra" required /></label>
          <label className="wide-field">Full address<input name="address" value={form.address} onChange={updateField} placeholder="Street, neighbourhood, city, state" required /></label>
          <label className="wide-field">Image URL<input name="image" type="url" value={form.image} onChange={updateField} placeholder="https://..." required /></label>
          <label className="wide-field">Dealer contact number<input name="contactNumber" type="tel" value={form.contactNumber} onChange={updateField} placeholder="+91 98765 43210" pattern="[+0-9 ()-]{8,}" required /></label>
          <label>Latitude<input name="latitude" type="number" step="any" value={form.latitude} onChange={updateField} required /></label>
          <label>Longitude<input name="longitude" type="number" step="any" value={form.longitude} onChange={updateField} required /></label>
          {message && <p className="form-success wide-field">{message}</p>}
          {error && <p className="form-error wide-field">{error}</p>}
          <div className="form-actions wide-field">
            <button className="primary-btn" type="submit">{editingId ? "Save changes" : "Publish property"}</button>
            {editingId && <button className="quiet-btn" type="button" onClick={cancelEdit}>Cancel edit</button>}
          </div>
        </form>
      </section>
      <section className="dealer-listings">
        <div className="dealer-listings-heading"><div><p className="eyebrow">Your inventory</p><h2>Published properties</h2></div><span>{properties.length} listing{properties.length === 1 ? "" : "s"}</span></div>
        {properties.length === 0 ? <p className="status">You have not published a property yet.</p> : <div className="dealer-property-grid">{properties.map((property) => <article className="dealer-property-card" key={property.id}><img src={property.image} alt="" /><div><span className={`badge badge-${property.listingType}`}>{property.listingType === "sale" ? "For sale" : "For rent"}</span><h3>{property.title}</h3><p>{property.address}</p><div className="dealer-card-actions"><button type="button" className="quiet-btn" onClick={() => editProperty(property)}>Edit</button><button type="button" className="danger-btn" onClick={() => removeProperty(property)}>Delete</button></div></div></article>)}</div>}
      </section>
    </main>
  );
}
