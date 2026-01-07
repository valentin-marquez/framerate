import { unstable_useRoute as useRoute } from "react-router";
export function useRequestInfo() {
  const data = useRoute("root");

  if (!data?.loaderData?.requestInfo) {
    console.log(data?.loaderData?.requestInfo);
    throw new Error("Request info is not available");
  }

  return data.loaderData.requestInfo;
}

export function useOptionalRequestInfo() {
  const data = useRoute("root");
  return data?.loaderData?.requestInfo;
}
