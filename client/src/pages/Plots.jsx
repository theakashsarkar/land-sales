import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import { usePageTitle } from "../utils.js";
import Icon from "../components/Icons.jsx";
import PlotCard from "../components/PlotCard.jsx";
import SearchPanel from "../components/SearchPanel.jsx";
import CTABand from "../components/CTABand.jsx";

export default function Plots() {
  usePageTitle("Land & Plots");
  const { data } = useData();
  const [params, setParams] = useSearchParams();

  const values = {
    project: params.get("project") || "",
    type: params.get("type") || "",
    size: params.get("size") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    status: params.get("status") || "",
  };

  const setValues = (next) => {
    const clean = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== "" && v != null)
    );
    setParams(clean, { replace: true });
  };

  const results = useMemo(() => {
    if (!data) return [];
    let list = [...data.plots];
    if (values.project) list = list.filter((p) => p.projectId === values.project);
    if (values.type) list = list.filter((p) => p.type === values.type);
    if (values.status) list = list.filter((p) => p.status === values.status);
    if (values.size) list = list.filter((p) => p.size >= Number(values.size));
    if (values.minPrice) list = list.filter((p) => p.price >= Number(values.minPrice));
    if (values.maxPrice) list = list.filter((p) => p.price <= Number(values.maxPrice));
    return list.sort((a, b) => (a.status === "available" ? -1 : 1) - (b.status === "available" ? -1 : 1));
  }, [data, params]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        Loading plots…
      </div>
    );
  }

  const projectById = (id) => data.projects.find((p) => p.id === id);
  const hasFilters = Object.values(values).some(Boolean);

  return (
    <>
      <section className="page-hero" style={{ paddingBottom: 110 }}>
        <div className="page-hero__bg" style={{ backgroundImage: "url(/images/gallery-boulevard.jpg)" }} />
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <Icon name="chevron-right" size={13} />
            <span>Land / Plots</span>
          </nav>
          <h1 className="page-hero__title">Find Your Plot</h1>
          <p style={{ marginTop: 18, maxWidth: 560, color: "rgba(240,240,230,.85)", fontSize: 17 }}>
            Live availability across all our projects. Every listing shows the
            real status — no bait listings, ever.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="plots-page__bar">
            <SearchPanel projects={data.projects} values={values} onChange={setValues} compact />
          </div>

          <div className="plots-page__results">
            <p className="plots-page__count">
              Showing <strong>{results.length}</strong> of {data.plots.length} plots
              {values.project && projectById(values.project)
                ? ` in ${projectById(values.project).name}`
                : ""}
            </p>
            {hasFilters && (
              <button className="text-link" onClick={() => setParams({}, { replace: true })}>
                <Icon name="x" size={14} />
                Clear all filters
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="plots-page__empty">
              <h3>No plots match those filters — yet.</h3>
              <p>
                New plots open up every month. Try widening your range, or let
                us find one for you.
              </p>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn--outline" onClick={() => setParams({}, { replace: true })}>
                  Reset Filters
                </button>
                <Link to="/contact" className="btn btn--primary">
                  Request a Match
                </Link>
              </div>
            </div>
          ) : (
            <div className="plots__grid">
              {results.map((plot, i) => (
                <PlotCard
                  key={plot.id}
                  plot={plot}
                  project={projectById(plot.projectId)}
                  delay={(i % 3) * 70}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <CTABand
        title="Can't Decide? Walk the Land."
        text="Join a guided site visit and stand on the exact plots you're considering."
      />
    </>
  );
}
