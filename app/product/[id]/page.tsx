"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Product {
  _id: string;
  name: string;
  type: string;
  createdAt: string;
  status: string;
}

export default function ProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${params.id}`);
        if (!res.ok) {
          throw new Error("Product not found");
        }
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch product");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!product) {
    return <div className="p-4">Product not found</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{product.name}</h1>
      <div className="space-y-2">
        <p><strong>Type:</strong> {product.type}</p>
        <p><strong>Status:</strong> {product.status}</p>
        <p><strong>Created:</strong> {new Date(product.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
