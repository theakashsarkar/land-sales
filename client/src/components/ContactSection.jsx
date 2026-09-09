import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "./Icons.jsx";
import SectionHeading from "./SectionHeading.jsx";
import Reveal from "./Reveal.jsx";
import MapEmbed from "./MapEmbed.jsx";
import { useData } from "../context/DataContext.jsx";
import { sendInquiry } from "../api.js";
import { telHref, waHref } from "../utils.js";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  project: "",
  plot: "",
  message: "",
};

export default function ContactSection({ id = "contact", heading = true }) {
  const { data } = useData();
  const [params] = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [errorMsg, setErrorMsg] = useState("");

  const c = data?.settings.contact;
  const projects = data?.projects ?? [];
  const plots = data?.plots ?? [];

  const presetProject = params.get("project") || "";
  const presetPlot = params.get("plot") || "";
  const presetMessage =
    params.get("interest") === "visit" ? "I would like to book a site visit." : "";

  const effective = useMemo(
    () => ({
      ...form,
      project: form.project || presetProject,
      plot: form.plot || presetPlot,
      message: form.message || presetMessage,
    }),
    [form, presetProject, presetPlot, presetMessage]
  );

  const projectPlots = plots.filter(
    (p) => !effective.project || p.projectId === effective.project
  );

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setState("sending");
    try {
      await sendInquiry(effective);
      setState("done");
    } catch (err) {
      setErrorMsg(err.message);
      setState("error");
    }
  };

  if (!data) return null;

  return (
    <section className="section contact" id={id}>
      <div className="container">
        {heading && (
          <SectionHeading
            eyebrow="Contact"
            title="Start a Conversation With Our Team"
            description="Tell us what you're looking for — a family plot, an investment, or a visit this weekend. We'll respond within one business day."
          />
        )}

        <div className="contact__grid">
          <Reveal className="contact__form-wrap">
            {state === "done" ? (
              <div className="contact__success">
                <Icon name="check-circle" size={44} />
                <h3>Inquiry received</h3>
                <p>
                  Thank you, {effective.name.split(" ")[0] || "friend"}. A member
                  of our team will call you within one business day.
                </p>
                <button
                  className="btn btn--outline"
                  onClick={() => {
                    setForm(initialForm);
                    setState("idle");
                  }}
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form className="contact__form" onSubmit={submit} noValidate={false}>
                <div className="form-row">
                  <label>
                    Name <em>*</em>
                    <input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={effective.name}
                      onChange={set("name")}
                    />
                  </label>
                  <label>
                    Phone <em>*</em>
                    <input
                      type="tel"
                      required
                      placeholder="+880 1XXX-XXXXXX"
                      value={effective.phone}
                      onChange={set("phone")}
                    />
                  </label>
                </div>
                <label>
                  Email
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={effective.email}
                    onChange={set("email")}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Interested Project
                    <div className="select-wrap">
                      <select value={effective.project} onChange={set("project")}>
                        <option value="">Select a project</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Icon name="chevron-down" size={15} />
                    </div>
                  </label>
                  <label>
                    Interested Plot
                    <div className="select-wrap">
                      <select value={effective.plot} onChange={set("plot")}>
                        <option value="">Any plot</option>
                        {projectPlots.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.id} — {p.size} Katha
                          </option>
                        ))}
                      </select>
                      <Icon name="chevron-down" size={15} />
                    </div>
                  </label>
                </div>
                <label>
                  Message
                  <textarea
                    rows="4"
                    placeholder="Tell us about your requirements…"
                    value={effective.message}
                    onChange={set("message")}
                  />
                </label>
                {state === "error" && (
                  <p className="form-error">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  className="btn btn--primary btn--lg btn--block"
                  disabled={state === "sending"}
                >
                  {state === "sending" ? "Sending…" : "Send Inquiry"}
                  <Icon name="send" size={16} />
                </button>
                <p className="form-note">
                  No spam, ever. Your details stay with our advisory team only.
                </p>
              </form>
            )}
          </Reveal>

          <Reveal className="contact__aside" delay={120}>
            <div className="contact__card">
              <h3>Reach us directly</h3>
              <a href={telHref(c.phoneHref)} className="contact__line">
                <span className="contact__line-icon"><Icon name="phone" size={17} /></span>
                <span>
                  <em>Phone</em>
                  {c.phoneDisplay}
                </span>
              </a>
              <a href={`mailto:${c.email}`} className="contact__line">
                <span className="contact__line-icon"><Icon name="mail" size={17} /></span>
                <span>
                  <em>Email</em>
                  {c.email}
                </span>
              </a>
              <a
                href={waHref(c.whatsapp, "Hello, I'm interested in your land projects.")}
                className="contact__line"
                target="_blank"
                rel="noreferrer"
              >
                <span className="contact__line-icon contact__line-icon--wa"><Icon name="whatsapp" size={17} /></span>
                <span>
                  <em>WhatsApp</em>
                  Chat with an advisor
                </span>
              </a>
              <div className="contact__line">
                <span className="contact__line-icon"><Icon name="map-pin" size={17} /></span>
                <span>
                  <em>Head Office</em>
                  {c.address}
                </span>
              </div>
              <div className="contact__line">
                <span className="contact__line-icon"><Icon name="clock" size={17} /></span>
                <span>
                  <em>Open Hours</em>
                  {c.hours}
                </span>
              </div>
              <MapEmbed coords={c.coordinates} span={0.012} title="Office map" className="contact__map" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
