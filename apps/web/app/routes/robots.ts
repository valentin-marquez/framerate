import type { LoaderFunctionArgs } from "react-router";

export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const protocol = url.protocol;
  const host = url.host;

  const robotText = `
User-agent: *
Allow: /

# Block API and admin routes
Disallow: /api/
Disallow: /admin/
Disallow: /action/
Disallow: /auth/

# Block internal routes
Disallow: /_actions/
Disallow: /_data/

Sitemap: ${protocol}//${host}/sitemap.xml
`.trim();

  return new Response(robotText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
