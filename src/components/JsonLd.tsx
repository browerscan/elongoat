import { Fragment } from "react";

export interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Render JSON-LD structured data scripts
 * Use this component in pages to add schema.org markup
 */
export function JsonLd({ data }: JsonLdProps) {
  const schemas = Array.isArray(data) ? data : [data];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema),
          }}
        />
      ))}
    </>
  );
}

/**
 * HOC wrapper for adding JSON-LD to a page
 * Usage:
 *   export default withJsonLd(MyPage, generateMySchema());
 */
export function withJsonLd<P extends object>(
  Component: React.ComponentType<P>,
  schemaData: Record<string, unknown> | Record<string, unknown>[],
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    return (
      <>
        <JsonLd data={schemaData} />
        <Component {...props} />
      </>
    );
  };
}
