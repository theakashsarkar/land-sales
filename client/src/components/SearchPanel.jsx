import Icon from "./Icons.jsx";

const SIZES = [3, 5, 7.5, 10];
const PRICES = [50, 75, 100, 150, 200, 300, 500];

const empty = { project: "", type: "", size: "", minPrice: "", maxPrice: "", status: "" };

export default function SearchPanel({ projects, values = empty, onChange, onSearch, compact = false }) {
  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });

  const field = (label, key, children) => (
    <label className="search-panel__field">
      <span>{label}</span>
      <div className="select-wrap">
        <select value={values[key] || ""} onChange={set(key)}>
          {children}
        </select>
        <Icon name="chevron-down" size={15} />
      </div>
    </label>
  );

  return (
    <div className={`search-panel ${compact ? "search-panel--compact" : ""}`}>
      <div className="search-panel__grid">
        {field("Project", "project", (
          <>
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </>
        ))}
        {field("Property Type", "type", (
          <>
            <option value="">Residential &amp; Commercial</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="investment">Investment</option>
            <option value="large">Large / Estate</option>
          </>
        ))}
        {field("Min Plot Size", "size", (
          <>
            <option value="">Any Size</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s} Katha &amp; up
              </option>
            ))}
          </>
        ))}
        {field("Price Range", "minPrice", (
          <>
            <option value="">Min Price</option>
            {PRICES.map((p) => (
              <option key={p} value={p}>
                ৳ {p >= 100 ? `${p / 100} Cr` : `${p} Lac`} +
              </option>
            ))}
          </>
        ))}
        {field("Max Price", "maxPrice", (
          <>
            <option value="">Max Price</option>
            {PRICES.map((p) => (
              <option key={p} value={p}>
                Up to ৳ {p >= 100 ? `${p / 100} Cr` : `${p} Lac`}
              </option>
            ))}
          </>
        ))}
        {field("Availability", "status", (
          <>
            <option value="">Any Status</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
          </>
        ))}
      </div>
      {onSearch && (
        <button className="btn btn--primary btn--lg search-panel__submit" onClick={onSearch}>
          <Icon name="search" size={17} />
          Search Plots
        </button>
      )}
    </div>
  );
}
