import { useEffect, useRef, useState } from "react";
import axios from "axios";
import LoginForm from "./components/LoginForm";
import MarketSearch from "./components/MarketSearch";
import Overview from "./components/Overview";
import ListingsTable from "./components/ListingsTable";
import RunList from "./components/RunList";
import FlavorBreakdown from "./components/FlavorBreakdown";
import { buildFlavorReport, familyIdFromText, FAMILIES } from "./classifyListing";
import { relativeTime } from "./marketMath";
import "./styles.css";
import "./analytics.css";

const API = "http://127.0.0.1:5001";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "flavors", label: "Flavors" },
  { id: "listings", label: "Listings" },
  { id: "collect", label: "Refresh" },
];

function LiveMark({ at }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="sp-live">
      <i />
      Live · updated {relativeTime(at)}
    </span>
  );
}

function sortRuns(list) {
  return [...list].sort(
    (a, b) => new Date(String(b.scraped_at).replace(" ", "T")) - new Date(String(a.scraped_at).replace(" ", "T"))
  );
}

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem("username") || true));
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "user3");
  const [view, setView] = useState("overview");
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState(null);
  const [rows, setRows] = useState(null);
  const [previousRows, setPreviousRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyReady, setHistoryReady] = useState(false);
  const [activeFamily, setActiveFamily] = useState("almond");
  const [focusFlavor, setFocusFlavor] = useState("all");
  const [retrying, setRetrying] = useState("");
  const [retryError, setRetryError] = useState("");
  const [liveAt, setLiveAt] = useState(null);
  const followLatest = useRef(true);
  const runIdRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("username");
    if (stored) {
      setIsLoggedIn(true);
      setUsername(stored);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancel = false;
    axios
      .get(`${API}/live_product_history`)
      .then((response) => {
        if (cancel) return;
        const list = sortRuns(Array.isArray(response.data) ? response.data : []);
        setRuns(list);
        setRunId((current) => {
          if (current && list.some((run) => run.product_id === current)) return current;
          return list[0]?.product_id || null;
        });
        setHistoryReady(true);
      })
      .catch(() => {
        if (!cancel) {
          setHistoryReady(true);
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const run = runs.find((item) => item.product_id === runId);
    if (!run) return undefined;
    let cancel = false;
    setLoading(true);
    axios
      .get(`${API}/latest_scraped_entries/${run.product_id}?pincode=${run.pincode}&product_type=2`)
      .then((response) => {
        if (!cancel) setRows(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (!cancel) setRows([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });

    const index = runs.findIndex((item) => item.product_id === runId);
    const previous = runs.slice(index + 1).find((item) => item.name === run.name && item.pincode === run.pincode);
    if (!previous) {
      setPreviousRows(null);
    } else {
      axios
        .get(`${API}/latest_scraped_entries/${previous.product_id}?pincode=${previous.pincode}&product_type=2`)
        .then((response) => {
          if (!cancel) setPreviousRows(Array.isArray(response.data) ? response.data : null);
        })
        .catch(() => {
          if (!cancel) setPreviousRows(null);
        });
    }

    return () => {
      cancel = true;
    };
  }, [runId]);

  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);

  useEffect(() => {
    if (!isLoggedIn || !historyReady) return undefined;
    const timer = setInterval(() => {
      axios.get(`${API}/live_product_history`).then((response) => {
        const list = sortRuns(Array.isArray(response.data) ? response.data : []);
        if (!list.length) return;
        setRuns(list);
        const newest = list[0];
        const viewing = list.find((item) => item.product_id === runIdRef.current) || newest;
        if (followLatest.current && newest.product_id !== runIdRef.current) {
          setRunId(newest.product_id);
          const family = familyIdFromText(newest.name);
          if (family) setActiveFamily(family);
          setFocusFlavor("all");
          setView("overview");
        }
        axios
          .get(`${API}/latest_scraped_entries/${viewing.product_id}?pincode=${viewing.pincode}&product_type=2`)
          .then((entries) => {
            if (runIdRef.current === viewing.product_id && Array.isArray(entries.data)) {
              setRows(entries.data);
            }
          })
          .catch(() => {});
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [isLoggedIn, historyReady]);

  const handleLoginSuccess = (user) => {
    setIsLoggedIn(true);
    setUsername(user);
    localStorage.setItem("username", user);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    localStorage.removeItem("username");
  };

  const retryPlatform = async (platformName) => {
    if (!run || retrying) return;
    const family = FAMILIES.find((entry) => entry.id === (report?.baseId || familyIdFromText(run.name))) || FAMILIES[0];
    setRetrying(platformName);
    setRetryError("");
    try {
      await axios.post(`${API}/scrape`, {
        pincode: run.pincode,
        product: run.name,
        synonyms: run.synonyms || family.synonyms,
        category: family.category,
        platforms: [platformName],
        product_id: run.product_id,
      });
      const entries = await axios.get(
        `${API}/latest_scraped_entries/${run.product_id}?pincode=${run.pincode}&product_type=2`
      );
      if (Array.isArray(entries.data)) setRows(entries.data);
      setLiveAt(new Date().toISOString());
    } catch (error) {
      setRetryError(`${platformName} did not finish. Try again in a moment.`);
    } finally {
      setRetrying("");
    }
  };

  const selectRun = (run) => {
    setLiveAt(null);
    setRetryError("");
    followLatest.current = !runs.length || runs[0].product_id === run.product_id;
    setRunId(run.product_id);
    const family = familyIdFromText(run.name);
    if (family) setActiveFamily(family);
    setFocusFlavor("all");
    setView("overview");
  };

  const run = runs.find((item) => item.product_id === runId);
  const previousRun = (() => {
    if (!run) return null;
    const index = runs.findIndex((item) => item.product_id === runId);
    return runs.slice(index + 1).find((item) => item.name === run.name && item.pincode === run.pincode) || null;
  })();
  const report = Array.isArray(rows) && rows.length ? buildFlavorReport(rows) : null;
  const previousReport = Array.isArray(previousRows) && previousRows.length ? buildFlavorReport(previousRows) : null;
  const detected = FAMILIES.find((entry) => entry.id === report?.baseId);
  const selected = FAMILIES.find((entry) => entry.id === activeFamily);
  const mismatch =
    detected && selected && detected.id !== selected.id
      ? `This run is ${detected.name.toLowerCase()}, not ${selected.name.toLowerCase()}. The prices below belong to ${detected.name.toLowerCase()}. Refresh ${selected.name.toLowerCase()} to open that file.`
      : "";

  if (!isLoggedIn) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="sp-app">
      <header className="sp-top">
        <div className="sp-brand">
          <span className="sp-mark">P</span>
          <strong>Pricebench</strong>
        </div>
        <nav className="sp-nav" aria-label="Sections">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sp-account">
          <span>{username}</span>
          <button type="button" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="sp-body">
        <aside className="sp-rail">
          <RunList runs={runs} runId={runId} onSelect={selectRun} />
          <label className="sp-run-picker">
            Saved run
            <select
              value={runId || ""}
              onChange={(event) => {
                const next = runs.find((item) => item.product_id === event.target.value);
                if (next) selectRun(next);
              }}
            >
              {runs.map((item) => (
                <option key={item.product_id} value={item.product_id}>
                  {item.name} · {item.pincode}
                </option>
              ))}
            </select>
          </label>
        </aside>

        <main className="sp-main">
          {!historyReady && <p className="sp-empty">Reading the latest shelf…</p>}
          {historyReady && view === "collect" && (
            <div className="sp-stack">
              <header className="sp-page-head">
                <div>
                  <p className="sp-kicker">Collection</p>
                  <div className="sp-title-line">
                    <h2>Refresh the shelf</h2>
                    {run && <LiveMark at={liveAt || run.scraped_at} />}
                  </div>
                </div>
                <p className="sp-lead">
                  Type one word, such as makhana. That is the only thing searched. Flavors are sorted afterwards, on the Flavors tab.
                </p>
              </header>
              <MarketSearch
                embedded
                activeFamily={activeFamily}
                onFamily={setActiveFamily}
                onFocusFlavor={setFocusFlavor}
                onScraped={(productId) => {
                  setRunId(productId);
                  setFocusFlavor("all");
                  setView("overview");
                  axios.get(`${API}/live_product_history`).then((response) => {
                    const list = sortRuns(Array.isArray(response.data) ? response.data : []);
                    setRuns(list);
                  });
                }}
              />
            </div>
          )}
          {historyReady && view !== "collect" && loading && <p className="sp-empty">Reading the latest shelf…</p>}
          {historyReady && !loading && view !== "collect" && !report && (
            <p className="sp-empty">No listings in this run. Refresh almonds, cashews, or makhana to open a file.</p>
          )}
          {historyReady && !loading && report && view === "overview" && (
            <Overview
              report={report}
              run={run}
              previousReport={previousReport}
              previousRun={previousRun}
              live={<LiveMark at={liveAt || run?.scraped_at} />}
              onRetry={retryPlatform}
              retrying={retrying}
              retryError={retryError}
              onRefresh={() => setView("collect")}
              onOpenFlavor={(flavorId) => {
                setFocusFlavor(flavorId);
                setView("listings");
              }}
            />
          )}
          {historyReady && !loading && report && view === "flavors" && (
            <div className="sp-stack">
              <header className="sp-page-head">
                <div>
                  <p className="sp-kicker">Flavor economics</p>
                  <div className="sp-title-line">
                    <h2>What each flavor costs</h2>
                    <LiveMark at={liveAt || run?.scraped_at} />
                  </div>
                </div>
                <p className="sp-lead">
                  Salt & pepper is not salted, and salted is not plain. Each card is that flavor’s own median, range, and cheapest pack.
                </p>
              </header>
              <FlavorBreakdown
                report={report}
                flavorFilter={focusFlavor}
                onFocusFlavor={setFocusFlavor}
                onOpenListings={(flavorId) => {
                  setFocusFlavor(flavorId);
                  setView("listings");
                }}
                familyMismatch={mismatch}
              />
            </div>
          )}
          {historyReady && !loading && report && view === "listings" && (
            <ListingsTable
              classified={report.classified}
              flavorFilter={focusFlavor}
              onFocusFlavor={setFocusFlavor}
              filename={`pricebench-${(run?.name || "listings").replace(/\s+/g, "-")}-${run?.pincode || "all"}.csv`}
              liveMark={<LiveMark at={liveAt || run?.scraped_at} />}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
