import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
export type UserRole =
  | "admin"
  | "accountant"
  | "sewing"
  | "quality"
  | "handmade"
  | "adda_work"
  | "patching"
  | "press"
  | "overlock"
  | "clipping"
  | "packing"
  | "store";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

export interface UserPayload {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  department: string;
}

export async function createToken(payload: UserPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<UserPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  
  if (!token) return null;
  
  return await verifyToken(token);
}

// Role-based access configuration
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: [
    "/",
    "/accounting",
    "/print-barcodes",
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
    "/rates",
  ],
  accountant: [
    "/accounting",
    "/payments",
    "/raw-materials",
    "/job-costing",
    "/revenue",
    "/invoices",
    "/reports",
  ],
  sewing: ["/sewing"],
  quality: ["/quality"],
  handmade: ["/handmade"],
  adda_work: ["/adda-work"],
  patching: ["/patching"],
  press: ["/press"],
  overlock: ["/orders"],
  clipping: ["/orders"],
  packing: ["/packing"],
  store: ["/store", "/print-barcodes", "/product"],
};

// Default redirect route for each role after login
export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: "/",
  accountant: "/accounting",
  sewing: "/sewing",
  quality: "/quality",
  handmade: "/handmade",
  adda_work: "/adda-work",
  patching: "/patching",
  press: "/press",
  overlock: "/",
  clipping: "/",
  packing: "/packing",
  store: "/store",
};

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const allowedRoutes = ROLE_ROUTES[role] || [];
  
  // Check if the pathname starts with any of the allowed routes
  return allowedRoutes.some(route => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname === route || pathname.startsWith(route + "/");
  });
}
