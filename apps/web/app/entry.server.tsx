import { env } from "cloudflare:workers";
import crypto from "node:crypto";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext, HandleErrorFunction } from "react-router";
import { isRouteErrorResponse, ServerRouter } from "react-router";
import { NonceProvider } from "./shared/hooks/use-nonce";
import { buildContentSecurityPolicy } from "./shared/lib/csp";
import { isDevelopment } from "./shared/services/env.server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  const nonce = crypto.randomBytes(16).toString("hex");
  const apiOrigin = import.meta.env.VITE_API_URL ?? env.VITE_API_URL ?? (isDevelopment ? "http://127.0.0.1:8787" : "");
  const oauthProviders = [
    "https://discord.com",
    "https://accounts.google.com",
    "https://appleid.apple.com",
    "https://www.facebook.com",
  ];
  const contentSecurityPolicy = buildContentSecurityPolicy({
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    connectSrc: ["'self'", "data:", isDevelopment ? "ws:" : "", apiOrigin],
    scriptSrc: [
      "'self'",
      "'wasm-unsafe-eval'",
      "'unsafe-eval'",
      `'nonce-${nonce}'`,
      isDevelopment ? "'unsafe-inline'" : "",
    ],
    workerSrc: ["'self'", isDevelopment ? "blob:" : ""],
    scriptSrcAttr: [`'nonce-${nonce}'`],
    imgSrc: ["'self'", "data:", "blob:", "https:", apiOrigin],
    // Las fuentes son de @fontsource (propias). `data:` porque Vite incrusta en el CSS los subsets de menos de 4 KB
    // (assetsInlineLimit), p. ej. jetbrains-mono cyrillic-ext.
    fontSrc: ["'self'", "data:"],
    frameSrc: ["'self'"],
    // El formulario de login redirige al proveedor OAuth, y el navegador aplica form-action a toda la cadena: si el
    // proveedor ya tiene el consentimiento (Google) responde 302 directo al callback de la API.
    formAction: ["'self'", ...oauthProviders, apiOrigin],
  });

  const body = await renderToReadableStream(
    <NonceProvider value={nonce}>
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
    </NonceProvider>,
    {
      onError(error: unknown) {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error);
        }
      },
      signal: request.signal,
      nonce,
    },
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

// Error Reporting
// https://reactrouter.com/how-to/error-reporting
export const handleError: HandleErrorFunction = (error, { request }) => {
  // Don't log aborted requests - they're expected
  if (request.signal.aborted) {
    return;
  }

  // Don't log 404's - they're usually just bot noise
  if (isRouteErrorResponse(error) && error.status === 404) {
    return;
  }

  if (error instanceof Error) {
    console.error(error.stack);
  } else {
    console.error(error);
  }
};
