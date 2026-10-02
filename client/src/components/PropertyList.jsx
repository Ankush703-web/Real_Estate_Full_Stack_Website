function formatPrice(price, listingType) {
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

  return listingType === "rent" ? `${formatted}/mo` : formatted;
}

export default function PropertyList({
  properties,
  selectedId,
  onSelect,
  loading,
  error,
}) {
  if (loading) {
    return <p className="status">Loading listings in this area…</p>;
  }

  if (error) {
    return <p className="status error">{error}</p>;
  }

  if (properties.length === 0) {
    return (
      <p className="status">
        No properties are currently stored for this filter.
      </p>
    );
  }

  return (
    <ul className="listings">
      {properties.map((property) => (
        <li key={property.id}>
          <div
            className={`listing ${selectedId === property.id ? "is-selected" : ""}`}
            onClick={() => onSelect(property.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(property.id);
            }}
            role="button"
            tabIndex={0}
          >
            <img
              src={property.image}
              alt=""
              className="listing-image"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="listing-body">
              <div className="listing-meta">
                <span className={`badge badge-${property.listingType}`}>
                  {property.listingType === "sale" ? "For sale" : "For rent"}
                </span>
                <span className="beds">{property.bedrooms} BHK</span>
              </div>
              <h2>{property.title}</h2>
              <p className="price">
                {formatPrice(property.price, property.listingType)}
              </p>
              <p className="address">{property.address}</p>
              <a className="contact-link" href={`tel:${property.contactNumber}`} onClick={(event) => event.stopPropagation()}>
                Call dealer: {property.contactNumber}
              </a>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
