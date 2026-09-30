import { unstable_useRoute as useRoute } from "react-router";

export function useRequestInfo() {
  const data = useRoute("root");

  if (!data?.loaderData?.requestInfo) {
    throw new Error("Request info is not available");
  }

  return data.loaderData.requestInfo;
}

// El root no tiene datos cuando se renderiza su ErrorBoundary (ruta inexistente o loader del root caído): todo lo
// que se monta en Layout debe usar esta variante.
export function useOptionalRequestInfo() {
  const data = useRoute("root");
  return data?.loaderData?.requestInfo;
}
