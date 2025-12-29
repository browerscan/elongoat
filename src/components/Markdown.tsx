import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-headings:scroll-mt-24 prose-a:text-white prose-a:underline prose-code:text-white prose-strong:text-white/95 prose-p:text-white/75 prose-li:text-white/75 prose-blockquote:text-white/70 prose-hr:border-white/10">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
