import createApp from "../server/app.js";

// Vercel serverless entry — same API as server/app.js, without file persistence.
const app = createApp({ mode: "serverless", persistInquiries: false });

export default app;
