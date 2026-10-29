import React, { useEffect, useState } from "react";
import type { Row } from "../model";
import { names } from "../model";
export default function MemberCard({
  farmer,
  logo = "/rifan-logo.png",
}: {
  farmer: Row;
  logo?: string;
}) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    import("qrcode")
      .then((m) =>
        m.toDataURL("RIFAN:" + farmer.farmerID, {
          margin: 0,
          width: 140,
          color: { dark: "#194c2b", light: "#ffffff" },
        }),
      )
      .then(setQr)
      .catch(() => {});
  }, [farmer.farmerID]);
  return (
    <article className="member-id-card">
      <img className="id-watermark" src={logo} alt="" aria-hidden="true" />
      <header>
        <img src={logo} alt="RIFAN logo" />
        <div>
          <strong>RIFAN CONNECT</strong>
          <small>RICE FARMERS ASSOCIATION OF NIGERIA</small>
          <span>FARMER MEMBERSHIP IDENTITY CARD</span>
        </div>
      </header>
      <div className="id-card-body">
        <div className="id-photo">
          {farmer.photo ? (
            <img src={farmer.photo} alt={"Portrait of " + names(farmer)} />
          ) : (
            <span>
              {farmer.firstName?.[0]}
              {farmer.lastName?.[0]}
            </span>
          )}
        </div>
        <section>
          <h3>{names(farmer)}</h3>
          <b>{farmer.farmerID}</b>
          <p>
            {farmer.state} / {farmer.lga}
          </p>
          <p>PHONE: {farmer.primaryPhone || "NOT RECORDED"}</p>
        </section>
      </div>
      <div className="id-card-bottom">
        <div>
          <p>
            REGISTERED:{" "}
            {farmer.registrationDate ||
              farmer.registrationYear ||
              "NOT RECORDED"}
          </p>
          <p>
            STATUS:{" "}
            {farmer.membershipStatus || farmer.profileStatus || "PENDING"}
          </p>
        </div>
        {qr && (
          <img
            src={qr}
            alt={"QR code containing member reference " + farmer.farmerID}
          />
        )}
      </div>
      <footer>GROWING TOGETHER. FEEDING A NATION.</footer>
    </article>
  );
}
