import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, Wheat } from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import { PageHeading, Badge, Empty } from "../components/ui";
import WeatherOutlook from "../components/WeatherOutlook";
import { names, format } from "../model";
export default function Calendar() {
  const { snapshot } = useWorkspace();
  const [month, setMonth] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }),
    [view, setView] = useState("Calendar");
  const [calendarRows, setCalendarRows] = useState(snapshot.data.farmers);
  useEffect(() => {
    api(
      "/api/calendar?month=" +
        `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
    )
      .then(setCalendarRows)
      .catch(() => {});
  }, [month, snapshot.summary.totalFarmers]);
  const events = calendarRows
    .flatMap((f) =>
      [
        ["Planting", f.plantingDate],
        ["Harvest", f.harvestDate],
      ]
        .filter(([, date]) => date)
        .map(([type, date]) => ({
          id: f.id + "-" + type,
          farmer: f,
          type,
          date: String(date),
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const current = events.filter((e) => e.date.startsWith(prefix));
  return (
    <>
      <PageHeading
        title="Harvest planner"
        eyebrow="EVERY SEASON, A SHARED PLAN"
        description="Coordinate planting, prepare for harvest, and keep your chapter one step ahead."
      />
      <section className="panel">
        <div className="calendar-toolbar">
          <div>
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <h2>
              {month.toLocaleDateString("en-NG", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="button small-button"
              onClick={() =>
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
            >
              Today
            </button>
          </div>
          <div className="segmented">
            {["Calendar", "Agenda"].map((v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {view === "Calendar" ? (
          <div className="calendar-scroll">
            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="calendar-weekday">
                  {d}
                </div>
              ))}
              {Array.from({ length: month.getDay() }, (_, i) => (
                <div className="calendar-day blank" key={"blank" + i} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = prefix + "-" + String(i + 1).padStart(2, "0");
                const entries = current.filter((e) => e.date === date);
                return (
                  <div
                    className={
                      "calendar-day " +
                      (date === new Date().toISOString().slice(0, 10)
                        ? "today"
                        : "")
                    }
                    key={date}
                  >
                    <b>{i + 1}</b>
                    {entries.slice(0, 3).map((e) => (
                      <Link
                        key={e.id}
                        className={
                          e.type === "Harvest" ? "harvest" : "planting"
                        }
                        to={"/farmers/" + e.farmer.id}
                      >
                        <span />
                        {e.farmer.firstName} · {e.type}
                      </Link>
                    ))}
                    {entries.length > 3 && (
                      <button
                        className="text-button"
                        onClick={() => setView("Agenda")}
                      >
                        +{entries.length - 3} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="agenda-list">
            {current.length ? (
              current.map((e) => (
                <Link to={"/farmers/" + e.farmer.id} key={e.id}>
                  <span className="agenda-date">
                    <b>{e.date.slice(-2)}</b>
                    {month.toLocaleDateString("en-NG", { month: "short" })}
                  </span>
                  <span>
                    <strong>{names(e.farmer)}</strong>
                    <small>
                      {e.farmer.state} · {format(e.farmer.farmSize)} ha ·{" "}
                      {e.farmer.crop}
                    </small>
                  </span>
                  <Badge tone={e.type === "Harvest" ? "gold" : "green"}>
                    {e.type}
                  </Badge>
                </Link>
              ))
            ) : (
              <Empty
                title="No dates recorded this month"
                description="Add planting and expected harvest dates to farmer profiles."
              />
            )}
          </div>
        )}
        <div className="calendar-legend">
          <span>
            <i />
            Planting
          </span>
          <span>
            <i />
            Expected harvest
          </span>
          <small>
            Dates are recorded by your team; no maturity dates are invented.
          </small>
        </div>
      </section>
      <WeatherOutlook />
    </>
  );
}
