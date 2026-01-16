export const IS_STATIC_EXPORT = process.env.NEXT_BUILD_TARGET === "export";

export function staticExportDisabledResponse(message?: string): Response {
  return Response.json(
    {
      error: "disabled_in_static_export",
      message: message ?? "This endpoint is disabled in static exports.",
    },
    { status: 404 },
  );
}
