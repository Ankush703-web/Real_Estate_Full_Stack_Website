import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProperty,
  createSession,
  createUser,
  databaseReady,
  deleteProperty,
  deleteSession,
  getDealerProperties,
  getProperties,
  getStates,
  getUserBySession,
  updateProperty,
  verifyUser,
} from "../db.js";

await databaseReady;

function uniqueUsername(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function propertyInput(overrides = {}) {
  return {
    title: "Test Sea View Apartment",
    price: 12500000,
    listingType: "sale",
    bedrooms: 3,
    address: "Test Road, Panaji",
    state: "Goa",
    image: "https://images.unsplash.com/test-property.jpg",
    contactNumber: "+91 98765 43210",
    latitude: 15.4909,
    longitude: 73.8278,
    ...overrides,
  };
}

test("authentication, dealer CRUD, ownership, filters, and map coordinates", async () => {
  const dealer = createUser(uniqueUsername("dealer_test"), "DealerPass123!", "dealer");
  const otherDealer = createUser(uniqueUsername("other_dealer_test"), "DealerPass123!", "dealer");
  const customer = createUser(uniqueUsername("customer_test"), "CustomerPass123!", "customer");
  const dealerToken = createSession(dealer.id, dealer.role);
  const customerToken = createSession(customer.id, customer.role);
  let property;

  try {
    assert.deepEqual(verifyUser(dealer.username, "DealerPass123!", "dealer"), dealer);
    assert.equal(verifyUser(dealer.username, "wrong-password", "dealer"), null);
    assert.deepEqual(getUserBySession(`Bearer ${dealerToken}`), dealer);
    assert.deepEqual(getUserBySession(`Bearer ${customerToken}`), customer);

    property = createProperty(propertyInput(), dealer.id);
    assert.equal(property.contactNumber, "+91 98765 43210");
    assert.deepEqual(property.coordinates, { latitude: 15.4909, longitude: 73.8278 });

    const dealerProperties = getDealerProperties(dealer.id);
    assert.ok(dealerProperties.some((item) => item.id === property.id), "dealer can read their property");
    assert.ok(!getDealerProperties(otherDealer.id).some((item) => item.id === property.id), "dealer cannot read another dealer's property");

    const stateMatches = getProperties({ state: "Goa" });
    assert.ok(stateMatches.some((item) => item.id === property.id), "state filter reads from SQLite");
    const mapMatches = getProperties({ north: 15.6, south: 15.4, east: 73.95, west: 73.7 });
    assert.ok(mapMatches.some((item) => item.id === property.id), "map bounding box includes stored coordinates");
    assert.ok(getStates().includes("Goa"), "states come from stored properties");

    assert.throws(
      () => updateProperty(property.id, propertyInput({ title: "Should not update" }), otherDealer.id),
      /not found or not owned/
    );
    const updated = updateProperty(property.id, propertyInput({ title: "Updated Goa Villa", listingType: "rent", contactNumber: "+91 90000 11111" }), dealer.id);
    assert.equal(updated.title, "Updated Goa Villa");
    assert.equal(updated.listingType, "rent");
    assert.equal(updated.contactNumber, "+91 90000 11111");

    assert.equal(deleteProperty(property.id, otherDealer.id), false, "another dealer cannot delete this property");
    assert.equal(deleteProperty(property.id, dealer.id), true, "owner can delete their property");
    assert.ok(!getDealerProperties(dealer.id).some((item) => item.id === property.id), "deleted property is no longer readable");
    deleteSession(`Bearer ${dealerToken}`);
    assert.equal(getUserBySession(`Bearer ${dealerToken}`), null, "logout invalidates the dealer session");

    assert.throws(() => createProperty(propertyInput({ image: "javascript:alert(1)" }), dealer.id), /HTTPS/);
    assert.throws(() => createProperty(propertyInput({ title: "x".repeat(161) }), dealer.id), /at most 160/);
  } finally {
    if (property) deleteProperty(property.id, dealer.id);
    deleteSession(`Bearer ${dealerToken}`);
    deleteSession(`Bearer ${customerToken}`);
  }
});
