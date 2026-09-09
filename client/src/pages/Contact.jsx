import { Link } from "react-router-dom";
import { usePageTitle } from "../utils.js";
import Icon from "../components/Icons.jsx";
import ContactSection from "../components/ContactSection.jsx";

export default function Contact() {
  usePageTitle("Contact Us");

  return (
    <>
      <section className="page-hero" style={{ paddingBottom: 84 }}>
        <div className="page-hero__bg" style={{ backgroundImage: "url(/images/cta-home.jpg)" }} />
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <Icon name="chevron-right" size={13} />
            <span>Contact</span>
          </nav>
          <h1 className="page-hero__title">Let's Find Your Land</h1>
          <p style={{ marginTop: 18, maxWidth: 560, color: "rgba(240,240,230,.85)", fontSize: 17 }}>
            Call, message or visit — a senior advisor (never a call centre)
            will help you plan the next step.
          </p>
        </div>
      </section>

      <ContactSection heading={false} />
    </>
  );
}
