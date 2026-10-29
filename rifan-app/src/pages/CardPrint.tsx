import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { cardMembers } from "../lib/id-cards";
import { useWorkspace, api } from "../lib/workspace";
import type { Row } from "../model";
import MemberCard from "../components/MemberCard";
export default function CardPrint() {
  const [params] = useSearchParams();
  const { snapshot } = useWorkspace();
  const [farmers, setFarmers] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("rifan-print-" + params.get("job"));
      const ids = stored
        ? JSON.parse(stored)
        : params.get("id")
          ? [params.get("id")]
          : [];
      if (!ids.length)
        throw new Error(
          "Choose members from the farmer registry before opening the print sheet.",
        );
      cardMembers(ids)
        .then(setFarmers)
        .catch((e) => setError(e.message));
    } catch (e: any) {
      setError(e.message);
    }
  }, [params]);
  return (
    <div className="print-page">
      <div className="print-toolbar">
        <Link to="/farmers" className="button">
          <ArrowLeft size={16} />
          Farmer registry
        </Link>
        <span>
          {farmers.length} member card(s) · Print at 100% scale on A4 paper
        </span>
        <button
          className="button primary"
          disabled={!farmers.length}
          onClick={async () => {
            await api("/api/cards/log", {
              method: "POST",
              body: JSON.stringify({
                ids: farmers.map((f) => f.id),
                kind: "Print",
              }),
            });
            window.print();
          }}
        >
          <Printer size={17} />
          Print cards
        </button>
      </div>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <div className="print-card-grid">
        {farmers.map((f) => (
          <MemberCard key={f.id} farmer={f} logo={snapshot.settings.logo} />
        ))}
      </div>
    </div>
  );
}
