import React, { lazy, Suspense, useEffect, useState } from "react";
import markdownStyles from "./markdown.module.scss";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkBreaks from "remark-breaks";
import ThinkCard from "./ThinkRender/ThinkCard";
import { Button, Collapse, Box } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

// const CodeRender = lazy(() => import("./CodeRender/CodeRender"));
import CodeRender from "./CodeRender/CodeRender";

type MarkdownProps = {
  content: string;
};

const extractThinkBlocks = (markdown: string): { cleaned: string; thinks: string[] } => {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const thinks: string[] = [];
  let cleaned = markdown;
  let match;

  while ((match = thinkRegex.exec(markdown)) !== null) {
    thinks.push(match[1].trim());
  }

  cleaned = markdown.replace(thinkRegex, "").trim();

  return { cleaned, thinks };
};

const ChatMarkdown = ({ content }: MarkdownProps) => {
  useEffect(() => {
    import("./CodeRender/CodeRender");
  }, []);

  const { cleaned, thinks } = extractThinkBlocks(
    content.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n")
  );

  const [showThinks, setShowThinks] = useState(false);

  return (
    <div className={markdownStyles.markdownWrapper}>
      {thinks.length > 0 && (
        <Box mb={2}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowThinks((prev) => !prev)}
            startIcon={showThinks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              borderColor: "#333",
              color: "#333",
              "&:hover": {
                borderColor: "#000",
                backgroundColor: "#f3f3f3",
              },
            }}
          >
            {showThinks ? "Hide thought process" : "Show thought process"}
          </Button>
          <Collapse in={showThinks}>
            <Box mt={2}>
              {thinks.map((block, idx) => (
                <ThinkCard key={idx} content={block} />
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      <ReactMarkdown
        children={cleaned}
        className={markdownStyles.md}
        remarkPlugins={[remarkBreaks, remarkGfm, remarkFrontmatter]}
        components={{
          p: ({ children, ...props }) => {
            const hasBlockElement = React.Children.toArray(children).some(
              (child) =>
                React.isValidElement(child) &&
                typeof child.type === "string" &&
                ["div", "h1", "h2", "h3", "ul", "ol", "table"].includes(child.type)
            );
            return hasBlockElement ? (
              <>{children}</>
            ) : (
              <p {...props} style={{ whiteSpace: "pre-wrap" }}>
                {children}
              </p>
            );
          },
          a: ({ children, ...props }) => (
            //@ts-ignore
            <a href={props.href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div
              className={markdownStyles.tableDiv}
              style={{ overflowX: "auto", padding: "10px" }}
            >
              <table {...props}>{children}</table>
            </div>
          ),
          code({ inline, className, children }) {
            const lang = /language-(\w+)/.exec(className || "");
            return (
              <Suspense fallback={<code>Loading Code Block...</code>}>
                {/*@ts-ignore*/}
                <CodeRender
                  cleanCode={children}
                  inline={inline}
                  language={(lang && lang[1]) || ""}
                />
              </Suspense>
            );
          },
        }}
      />
    </div>
  );
};

export default ChatMarkdown;
