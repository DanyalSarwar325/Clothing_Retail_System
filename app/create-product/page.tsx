"use client";

import { useState } from "react";
import QRCode from "qrcode";

export default function CreateProduct() {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [qr, setQr] = useState("");

  const createProduct = async () => {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });

    const data = await res.json();

    // QR contains product URL
    const productUrl = `${window.location.origin}/product/${data.productId}`;
    const qrCode = await QRCode.toDataURL(productUrl);
    setQr(qrCode);
  };

  return (
    <div>
      <h2 className="text-3xl">Create Product</h2>

      <input
        placeholder="Product Name"
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Product Type"
        onChange={(e) => setType(e.target.value)}
      />

      <button onClick={createProduct}>Generate Barcode</button>

      {qr && (
        <>
          <img src={qr} />
          <button onClick={() => window.print()}>Print</button>
        </>
      )}
    </div>
  );
}
