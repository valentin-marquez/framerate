import type { LoaderFunctionArgs } from "react-router";

export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const protocol = url.protocol;
  const host = url.host;

  const robotText = `
User-agent: *
Allow: /

Sitemap: ${protocol}//${host}/sitemap.xml
`.trim();

  return new Response(robotText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
};
