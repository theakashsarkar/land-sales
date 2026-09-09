import { Link } from "react-router-dom";
import Icon from "./Icons.jsx";
import { usePageTitle } from "../utils.js";

export default function NotFound({ label = "page" }) {
  usePageTitle("Not Found");
  return (
    <div className="page-loading" style={{ textAlign: "center", padding: "120px 24px" }}>
      <Icon name="map-pin" size={40} className="gold" />
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 40, margin: "18px 0 10px" }}>
        We couldn't find that {label}.
      </h1>
      <p style={{ color: "var(--body)", maxWidth: 420, margin: "0 auto 28px" }}>
        It may have been sold, renamed or moved. Browse our available plots or
        reach out and we'll find you something better.
      </p>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <Link to="/plots" className="btn btn--primary">
          Browse Plots
        </Link>
        <Link to="/contact" className="btn btn--outline">
          Contact Us
        </Link>
      </div>
    </div>
  );
}
