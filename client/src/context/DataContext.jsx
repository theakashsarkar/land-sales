import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchBootstrap } from "../api.js";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchBootstrap()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => {
    if (!data) return { data: null, error, loading: true };
    return {
      data,
      error,
      loading: false,
      getProject: (slug) => data.projects.find((p) => p.slug === slug),
      getPlot: (id) =>
        data.plots.find((p) => p.id.toUpperCase() === String(id).toUpperCase()),
      plotsForProject: (projectId) =>
        data.plots.filter((p) => p.projectId === projectId),
    };
  }, [data, error]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
