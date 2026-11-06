import { apiResponse } from "@/lib/api";

export async function POST(request: Request) {
  const response = apiResponse({ loggedOut: true });
  response.cookies.set("conflux_session", "", {
    httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 0,
  });
  return response;
}
