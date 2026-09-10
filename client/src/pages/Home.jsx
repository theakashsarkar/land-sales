import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import { usePageTitle } from "../utils.js";
import Icon from "../components/Icons.jsx";
import Reveal from "../components/Reveal.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import ProjectCard from "../components/ProjectCard.jsx";
import PlotCard from "../components/PlotCard.jsx";
import SearchPanel from "../components/SearchPanel.jsx";
import MapEmbed from "../components/MapEmbed.jsx";
import Gallery from "../components/Gallery.jsx";
import TestimonialCarousel from "../components/TestimonialCarousel.jsx";
import CTABand from "../components/CTABand.jsx";
import ContactSection from "../components/ContactSection.jsx";

const TRUST = [
  { icon: "badge", label: "Approved Projects" },
  { icon: "pin", label: "Prime Locations" },
  { icon: "shield", label: "Secure Investment" },
  { icon: "heart", label: "Trusted Service" },
];

const HIGHLIGHT_FEATURES = [
  "Prime location on the Purbachal axis",
  "60 ft & 40 ft wide roads",
  "Planned underground infrastructure",
  "Dedicated residential zones",
  "Active commercial zone",
  "24/7 gated security",
  "Parks, lake & green spaces",
];

export default function Home() {
  usePageTitle(null);
  const { data } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState({
    project: "",
    type: "",
    size: "",
    minPrice: "",
    maxPrice: "",
    status: "",
  });

  if (!data) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        Loading Bhumi Landmarks…
      </div>
    );
  }

  const { settings, stats, projects, plots, categories, amenities, whyChooseUs, testimonials, homeLocation, investmentPoints, gallery } = data;
  const flagship = projects[0];
  const featuredPlots = [...plots]
    .sort((a, b) => (a.status === "available" ? -1 : 1) - (b.status === "available" ? -1 : 1))
    .slice(0, 6);
  const projectById = (id) => projects.find((p) => p.id === id);

  const runSearch = () => {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(search).filter(([, v]) => v))
    ).toString();
    navigate(`/plots${params ? `?${params}` : ""}`);
  };

  return (
    <>
      {/* ------------------------------------------------ Hero */}
      <section className="hero">
        <div className="hero__bg" style={{ backgroundImage: "url(/images/hero.jpg)" }} />
        <div className="hero__overlay" />
        <div className="container hero__content">
          <span className="hero__eyebrow">{settings.brand.approval} · Est. {settings.brand.established}</span>
          <h1 className="hero__title">
            Premium Land. Prime Location. <em>Better Future.</em>
          </h1>
          <p className="hero__text">
            Discover thoughtfully planned residential and commercial plots in
            promising locations — backed by clear titles, honest pricing and
            15 years of trust.
          </p>
          <div className="hero__actions">
            <Link to="/projects" className="btn btn--ghost btn--lg">
              Explore Projects
            </Link>
            <Link to="/plots" className="btn btn--gold btn--lg">
              Find Your Plot
              <Icon name="arrow-right" size={17} />
            </Link>
          </div>
        </div>
        <div className="hero__trust">
          <div className="container hero__trust-inner">
            {TRUST.map((t) => (
              <div className="hero__trust-item" key={t.label}>
                <Icon name={t.icon} size={20} />
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ About / intro */}
      <section className="section" id="about">
        <div className="container about__grid">
          <Reveal className="about__media">
            <img src="/images/about.jpg" alt="The Bhumi Landmarks team on site" />
            <div className="about__badge">
              <Icon name="badge" size={30} />
              <div>
                <strong>{stats[0].value}+</strong>
                <span>Years of trusted development</span>
              </div>
            </div>
          </Reveal>
          <div className="about__content">
            <SectionHeading
              eyebrow="Who We Are"
              title="A Land Developer You Can Build Your Life On"
            />
            <Reveal>
              <p className="about__lead">
                Since {settings.brand.established}, {settings.brand.name} has
                helped more than a thousand families and investors own a piece
                of Dhaka's future. We don't just sell plots — we plan
                townships: roads, parks, schools and utilities first, so the
                land you buy today is ready for the life you build tomorrow.
              </p>
              <p className="about__lead">
                Every project carries approved layouts and clear titles, and
                every client works with a dedicated advisor from first
                inquiry to final mutation.
              </p>
              <div className="stats">
                {stats.map((s) => (
                  <div className="stat" key={s.label}>
                    <strong>
                      {s.value.toLocaleString("en-US")}
                      {s.suffix}
                    </strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="about__cta">
                <Link to="/projects" className="btn btn--primary">
                  Explore Our Projects
                  <Icon name="arrow-right" size={16} />
                </Link>
                <Link to="/contact" className="text-link">
                  Talk to our team <Icon name="arrow-up-right" size={15} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Featured projects */}
      <section className="section section--warm" id="projects">
        <div className="container">
          <div className="projects__head">
            <SectionHeading
              eyebrow="Our Projects"
              title="Explore Our Projects"
              description="Master-planned communities in Dhaka's fastest-growing corridors — each one selected for location, legality and long-term value."
            />
            <Reveal>
              <Link to="/projects" className="btn btn--outline">
                View All Projects
              </Link>
            </Reveal>
          </div>
          <div className="projects__grid">
            {projects.filter((p) => p.featured).map((p, i) => (
              <ProjectCard key={p.id} project={p} delay={i * 90} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Highlight (flagship) */}
      <section className="section">
        <div className="container highlight__grid">
          <Reveal className="highlight__media">
            <img src="/images/highlight.jpg" alt={`${flagship.name} — planned landscape`} />
            <span className="highlight__chip">
              <Icon name="layers" size={17} />
              {flagship.totalPlots}+ Plots · {flagship.totalArea}
            </span>
          </Reveal>
          <div>
            <SectionHeading
              eyebrow={`Featured Project — ${flagship.name}`}
              title="A Better Place to Build Your Future"
              description={flagship.shortDescription}
            />
            <Reveal delay={120}>
              <ul className="highlight__list">
                {HIGHLIGHT_FEATURES.map((f) => (
                  <li key={f}>
                    <Icon name="check-circle" size={17} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to={`/projects/${flagship.slug}`} className="btn btn--primary btn--lg">
                Explore Project
                <Icon name="arrow-right" size={16} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Categories */}
      {/* <section className="section section--warm"> */}
      {/*   <div className="container"> */}
      {/*     <SectionHeading */}
      {/*       align="center" */}
      {/*       eyebrow="Land / Plots" */}
      {/*       title="Find the Right Plot for Your Future" */}
      {/*       description="Whatever your goal — a family home, a business address or a long-term asset — there is a plot here with your name on it." */}
      {/*     /> */}
      {/*     <div className="cats__grid"> */}
      {/*       {categories.map((cat, i) => ( */}
      {/*         <Reveal className="cat-card" key={cat.type} delay={i * 80}> */}
      {/*           <div className="cat-card__media"> */}
      {/*             <img src={cat.image} alt={cat.title} loading="lazy" /> */}
      {/*             <span className="cat-card__icon"> */}
      {/*               <Icon name={cat.icon} size={22} /> */}
      {/*             </span> */}
      {/*           </div> */}
      {/*           <div className="cat-card__body"> */}
      {/*             <h3 className="cat-card__title">{cat.title}</h3> */}
      {/*             <p className="cat-card__desc">{cat.description}</p> */}
      {/*             <Link to={`/plots?type=${cat.type}`} className="text-link"> */}
      {/*               Explore <Icon name="arrow-right" size={15} /> */}
      {/*             </Link> */}
      {/*           </div> */}
      {/*         </Reveal> */}
      {/*       ))} */}
      {/*     </div> */}
      {/*   </div> */}
      {/* </section> */}

      {/* ------------------------------------------------ Available plots */}
      <section className="section">
        <div className="container">
          <div className="plots__head">
            <SectionHeading
              eyebrow="Available Now"
              title="Handpicked Plots, Ready to Register"
              description="Live availability, honest pricing and full documentation on every listing."
            />
            <Reveal>
              <Link to="/plots" className="btn btn--outline">
                Browse All Plots
              </Link>
            </Reveal>
          </div>
          <div className="plots__grid">
            {featuredPlots.map((plot, i) => (
              <PlotCard key={plot.id} plot={plot} project={projectById(plot.projectId)} delay={(i % 3) * 80} />
            ))}
          </div>
        </div>
      </section>

      {/* {/* ------------------------------------------------ Search */}
      {/* <section className="section section--warm"> */}
      {/*   <div className="container"> */}
      {/*     <SectionHeading */}
      {/*       align="center" */}
      {/*       eyebrow="Plot Finder" */}
      {/*       title="Search Plots That Match Your Plan" */}
      {/*       description="Filter by project, type, size, price and availability — we'll show you exactly what's on the table." */}
      {/*     /> */}
      {/*     <Reveal> */}
      {/*       <SearchPanel */}
      {/*         projects={projects} */}
      {/*         values={search} */}
      {/*         onChange={setSearch} */}
      {/*         onSearch={runSearch} */}
      {/*       /> */}
      {/*     </Reveal> */}
      {/*   </div> */}
      {/* </section> */}

      {/* ------------------------------------------------ Location */}
      <section className="section" id="location">
        <div className="container">
          <div className="loc__grid">
            <Reveal>
              <SectionHeading
                eyebrow={homeLocation.eyebrow}
                title={homeLocation.heading}
                description={homeLocation.description}
              />
              <div className="loc__points">
                {homeLocation.points.map((pt) => (
                  <div className="loc__point" key={pt.name}>
                    <span className="loc__point-icon">
                      <Icon name={pt.icon} size={19} />
                    </span>
                    <span className="loc__point-name">{pt.name}</span>
                    <span className="loc__point-time">{pt.time}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={120}>
              <MapEmbed
                coords={homeLocation.coordinates}
                span={0.03}
                title="Project location map"
                className="loc__map"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* {/* ------------------------------------------------ Amenities */}
      {/* <section className="section section--warm" id="amenities"> */}
      {/*   <div className="container"> */}
      {/*     <SectionHeading */}
      {/*       align="center" */}
      {/*       eyebrow="Amenities" */}
      {/*       title="Everything a Community Needs" */}
      {/*       description="Our townships are planned around real life — faith, education, health, play and commerce are all within a short walk." */}
      {/*     /> */}
      {/*     <div className="amen__grid"> */}
      {/*       {amenities.map((a, i) => ( */}
      {/*         <Reveal className="amen-card" key={a.name} delay={(i % 5) * 60}> */}
      {/*           <span className="amen-card__icon"> */}
      {/*             <Icon name={a.icon} size={24} /> */}
      {/*           </span> */}
      {/*           <h3 className="amen-card__title">{a.name}</h3> */}
      {/*           <p className="amen-card__desc">{a.description}</p> */}
      {/*         </Reveal> */}
      {/*       ))} */}
      {/*     </div> */}
      {/*   </div> */}
      {/* </section> */}

      {/* ------------------------------------------------ Why choose us */}
      <section className="section">
        <div className="container">
          <SectionHeading
            align="center"
            eyebrow="Why Us"
            title="Why Invest With Us?"
            description="Buying land is a decision measured in decades. Here is how we protect yours."
          />
          <div className="why__grid">
            {whyChooseUs.map((w, i) => (
              <Reveal className="why-card" key={w.title} delay={(i % 3) * 80}>
                <span className="why-card__num">{String(i + 1).padStart(2, "0")}</span>
                <span className="why-card__icon">
                  <Icon name={w.icon} size={24} />
                </span>
                <h3 className="why-card__title">{w.title}</h3>
                <p className="why-card__desc">{w.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Investment */}
      {/* <section className="section invest"> */}
      {/*   <div className="container invest__grid"> */}
      {/*     <div> */}
      {/*       <SectionHeading */}
      {/*         light */}
      {/*         eyebrow="Investment" */}
      {/*         title="Invest in Land. Build Your Future." */}
      {/*         description="Bricks depreciate, well-located land compounds. Here's why our clients treat plots as the cornerstone of their portfolio." */}
      {/*       /> */}
      {/*       <Reveal delay={100}> */}
      {/*         <div className="invest__points"> */}
      {/*           {investmentPoints.map((pt) => ( */}
      {/*             <div className="invest__point" key={pt.title}> */}
      {/*               <span className="invest__point-icon"> */}
      {/*                 <Icon name={pt.icon} size={20} /> */}
      {/*               </span> */}
      {/*               <div> */}
      {/*                 <strong>{pt.title}</strong> */}
      {/*                 <span>{pt.description}</span> */}
      {/*               </div> */}
      {/*             </div> */}
      {/*           ))} */}
      {/*         </div> */}
      {/*         <div className="invest__stat"> */}
      {/*           <strong>12–15%</strong> */}
      {/*           <span> */}
      {/*             historical annual appreciation for planned-township land in */}
      {/*             greater Dhaka over the last decade (illustrative). */}
      {/*           </span> */}
      {/*         </div> */}
      {/*       </Reveal> */}
      {/*     </div> */}
      {/*     <Reveal delay={180}> */}
      {/*       <div className="invest__side"> */}
      {/*         <img */}
      {/*           src="/images/invest-city.jpg" */}
      {/*           alt="Dhaka's eastern growth corridor" */}
      {/*           style={{ borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)" }} */}
      {/*         /> */}
      {/*         <div style={{ marginTop: 28 }}> */}
      {/*           <Link to="/contact?interest=advisor" className="btn btn--gold btn--lg"> */}
      {/*             <Icon name="phone" size={17} /> */}
      {/*             Talk to an Investment Advisor */}
      {/*           </Link> */}
      {/*         </div> */}
      {/*       </div> */}
      {/*     </Reveal> */}
      {/*   </div> */}
      {/* </section> */}

      {/* ------------------------------------------------ Testimonials */}
      <section className="section section--warm">
        <div className="container">
          <SectionHeading
            align="center"
            eyebrow="Testimonials"
            title="Families & Investors Who Built With Us"
          />
          <TestimonialCarousel testimonials={testimonials} />
        </div>
      </section>

      {/* {/* ------------------------------------------------ Gallery */}
      {/* <section className="section"> */}
      {/*   <div className="container"> */}
      {/*     <SectionHeading */}
      {/*       align="center" */}
      {/*       eyebrow="Gallery" */}
      {/*       title="Life Inside Our Communities" */}
      {/*       description="Roads, landscapes, site visits and progress — an honest look at how our projects grow." */}
      {/*     /> */}
      {/*     <Gallery images={gallery} columns={3} aspect="4/3" /> */}
      {/*   </div> */}
      {/* </section> */}

      {/* ------------------------------------------------ Site visit CTA */}
      <CTABand />

      {/* ------------------------------------------------ Contact */}
      <ContactSection id="contact" />
    </>
  );
}
