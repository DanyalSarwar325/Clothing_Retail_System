/**
 * Transform raw Shopify fulfillment webhook data into structured format
 */

export interface TransformedFulfillment {
  orderId: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    city: string;
    address: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  product: {
    name: string;
    variant: string;
    sku?: string;
    quantity: number;
    price: number;
  };
  payment: {
    method: string;
    status: string;
  };
  fulfillment: {
    status: string;
    trackingCompany: string;
    trackingNumber: string;
    trackingUrl: string;
  };
  pricing: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    currency: string;
  };
  createdAt: string;
}

/**
 * Transforms Shopify fulfillment webhook data into structured format
 * @param shopifyData - Raw data from Shopify webhook
 * @returns Transformed fulfillment object
 */
export function transformShopifyFulfillmentData(
  shopifyData: any
): TransformedFulfillment {
  console.log("Starting transformation of Shopify data...");

  // Extract order information
  const order = shopifyData.order || shopifyData;
  const fulfillment = shopifyData.fulfillment || shopifyData;
  const lineItems = order.line_items || [];
  const firstLineItem = lineItems[0] || {};

  // Helper function to extract numeric value
  const parseNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    return parseFloat(String(value).replace(/[^\d.-]/g, "")) || 0;
  };

  // Helper function to format address
  const formatFullAddress = (addr: any): string => {
    if (!addr) return "";
    const parts = [addr.address1, addr.address2]
      .filter(Boolean)
      .join(" ");
    return parts || "";
  };

  // Extract customer information
  const customer = order.customer || {};
  const shippingAddr = order.shipping_address || order.destination || {};
  const billingAddr = order.billing_address || {};

  // Extract payment information - fallback chain for finding payment method
  let paymentMethod = "COD"; // Default to Cash on Delivery
  if (order.financial_status) {
    paymentMethod =
      order.financial_status.charAt(0).toUpperCase() +
      order.financial_status.slice(1);
  }
  // Check for payment method in custom fields
  if (shopifyData.payment_method) {
    paymentMethod = shopifyData.payment_method;
  }

  // Extract fulfillment information
  const trackingInfo = fulfillment.tracking_info || {};
  const trackingNumber =
    fulfillment.tracking_number ||
    trackingInfo.number ||
    (fulfillment.tracking_numbers && fulfillment.tracking_numbers[0]) ||
    "";
  const trackingCompany =
    fulfillment.tracking_company ||
    trackingInfo.company ||
    "N/A";
  const trackingUrl = trackingInfo.url || "";

  // Build tracking URL if not provided
  let finalTrackingUrl = trackingUrl;
  if (!finalTrackingUrl && trackingNumber) {
    // Create tracking URL based on common carriers
    if (trackingCompany.toLowerCase().includes("postex")) {
      finalTrackingUrl = `https://postex.pk/tracking?cn=${trackingNumber}`;
    } else if (trackingCompany.toLowerCase().includes("tcs")) {
      finalTrackingUrl = `https://www.tcscourier.com/tracking/`;
    } else if (trackingCompany.toLowerCase().includes("leopards")) {
      finalTrackingUrl = `https://www.leopardscourier.com/tracking`;
    }
  }

  // Extract pricing information
  const subtotal = parseNumber(order.subtotal_price);
  const totalTax = parseNumber(order.total_tax);
  const totalShipping = parseNumber(order.total_shipping || order.shipping_lines?.[0]?.price || 0);
  const totalPrice = parseNumber(order.total_price);

  // Extract product information - get first line item as main product
  const productName = firstLineItem.title || "Product";
  const productVariant = firstLineItem.variant_title || "Default";
  const productSku = firstLineItem.sku || firstLineItem.product_id || "";
  const quantity = firstLineItem.quantity || 1;
  const productPrice = parseNumber(firstLineItem.price);

  // Extract order date
  const createdAt =
    order.created_at ||
    order.processed_at ||
    fulfillment.created_at ||
    new Date().toISOString();

  // Extract order number/name
  const orderNumber = String(order.order_number || order.name || order.id || "")
    .replace("#", "")
    .trim();
  const orderId = String(order.id || order.order_id || "").trim();

  const transformedData: TransformedFulfillment = {
    orderId: orderId,
    orderNumber: orderNumber,
    customer: {
      name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "N/A",
      email: customer.email || order.email || "N/A",
      phone:
        shippingAddr.phone ||
        billingAddr.phone ||
        customer.phone ||
        "N/A",
    },
    shippingAddress: {
      city: shippingAddr.city || "N/A",
      address: formatFullAddress(shippingAddr) || "N/A",
      province: shippingAddr.province || shippingAddr.province_code,
      postalCode: shippingAddr.zip,
      country: shippingAddr.country || "Pakistan",
    },
    product: {
      name: productName,
      variant: productVariant,
      sku: productSku,
      quantity: quantity,
      price: productPrice > 0 ? productPrice : totalPrice / quantity,
    },
    payment: {
      method: paymentMethod,
      status:
        order.financial_status ||
        order.payment_status ||
        fulfillment.status ||
        "pending",
    },
    fulfillment: {
      status: fulfillment.status || "fulfilled",
      trackingCompany: trackingCompany,
      trackingNumber: trackingNumber,
      trackingUrl: finalTrackingUrl,
    },
    pricing: {
      subtotal: subtotal,
      tax: totalTax,
      shipping: totalShipping,
      total: totalPrice,
      currency: order.currency || "PKR",
    },
    createdAt: new Date(createdAt).toISOString(),
  };

  console.log("Transformation completed:", {
    orderId: transformedData.orderId,
    orderNumber: transformedData.orderNumber,
    customerName: transformedData.customer.name,
    total: transformedData.pricing.total,
  });

  return transformedData;
}
