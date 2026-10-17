import './product-details-card.css';

export default function Productdetailscard() {
  return (
    <div className="baroque-screen-product-details-card">
      <div className="product-content">
        <div className="product-meta-head">
          <span className="product-serial">// ARCHIVE-01</span>
          <span className="product-price">$890 USD</span>
        </div>
        <h3>VX-01 AEROLITH</h3>
        <p>
          Low-profile technical runner featuring exposed composite exo-spine, Japanese micro-ballistic nylon, and hydro-dipped matte TPU mudguards.
        </p>
        <div className="spec-table">
          <div className="spec-row">
            <span className="spec-lbl">CHASSIS</span>
            <span className="spec-val">Titanium Shank</span>
            <span className="spec-stat live">ACTIVE</span>
          </div>
          <div className="spec-row">
            <span className="spec-lbl">WEIGHT</span>
            <span className="spec-val">385g (EU 42)</span>
            <span className="spec-stat">SPEC</span>
          </div>
          <div className="spec-row">
            <span className="spec-lbl">CAPACITY</span>
            <span className="spec-val">42 / 120 CLAIMED</span>
            <span className="spec-stat live">INVITE</span>
          </div>
        </div>
        <div className="product-card-action">
          <a href="#invite-portal" className="card-link">Reserve Allocation</a>
        </div>
      </div>
    </div>
  );
}
