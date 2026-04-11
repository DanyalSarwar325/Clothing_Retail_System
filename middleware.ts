import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

// Public routes that don't require authentication
const publicRoutes = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/seed", "/api/shopify/order-created", "/api/shopify/order-fulfilled"];

// Role-based access configuration
const ROLE_ROUTES: Record<string, string[]> = {
  
    admin: [
      "/",
      "/generate-barcodes",
      "/reports",
      "/add-user",
      "/cutting",
      "/print-barcodes",
      "/print-final-stickers",
      "/create-product",
      "/product",
      "/users",
      "/quality",
      "/sewing",
      "/handmade",
      "/adda-work",
      "/patching",
      "/press",
      "/packing",
      "/store",
      "/payments",
      "/job-costing",
      "/raw-materials",
      "/revenue",
      "/outpass",
      "/orders",
      "/api",
      "/admin/shopify-orders",
      "/admin/fulfillment-orders",
      "/invoices",
    ],
  cutting: ["/cutting", "/orders", "/api"],
  sewing: ["/sewing", "/orders", "/api"],
  quality: ["/quality", "/orders", "/api"],
  handmade: ["/handmade", "/orders", "/api"],
  adda_work: ["/adda-work", "/orders", "/api"],
  patching: ["/patching", "/orders", "/api"],
  press: ["/press", "/orders", "/api"],
  packing: ["/packing", "/orders", "/api"],
  store: ["/store", "/print-barcodes", "/product", "/orders", "/api"],
};

// Default redirect route for each role
const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  admin: "/",
  cutting: "/cutting",
  sewing: "/sewing",
  quality: "/quality",
  handmade: "/handmade",
  adda_work: "/adda-work",
  patching: "/patching",
  press: "/press",
  packing: "/packing",
  store: "/store",
};

function canAccessRoute(role: string, pathname: string): boolean {
  const allowedRoutes = ROLE_ROUTES[role] || [];

  return allowedRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname === route || pathname.startsWith(route + "/");
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
    return NextResponse.next();
  }

  // Get the auth token from cookies
  const token = request.cookies.get("auth-token")?.value;

  // If no token, redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify the token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    // Check if user can access this route
    if (!canAccessRoute(role, pathname)) {
      // Redirect to their default route if they can't access
      const defaultRoute = ROLE_DEFAULT_ROUTE[role] || "/login";
      const redirectUrl = new URL(defaultRoute, request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Add user info to headers for API routes
    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.id as string);
    response.headers.set("x-user-role", role);
    response.headers.set("x-user-department", payload.department as string);

    return response;
  } catch {
    // Token is invalid, redirect to login
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("auth-token");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
