import { loadOpenCards } from "@/lib/open/load";

// GET /api/open/cards: Parampara's practice library as open data (CC BY 4.0) for DIKSHA style
// systems. Public, no sign in, cached for an hour. Shape: docs/open/parampara-card.schema.json;
// what it is and how to use it: docs/open/README.md.
export async function GET() {
  try {
    const body = await loadOpenCards();
    return Response.json(body, {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=600",
        "access-control-allow-origin": "*",
        link: '<https://creativecommons.org/licenses/by/4.0/>; rel="license"',
      },
    });
  } catch {
    return Response.json(
      {
        error: "unavailable",
        message: "The open library could not be read just now. Please try again soon.",
      },
      { status: 503, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } },
    );
  }
}
