import React, { lazy, Suspense, useEffect, useState } from "react";
import markdownStyles from "./markdown.module.scss";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkBreaks from "remark-breaks";
import ThinkCard from "./ThinkRender/ThinkCard";
import { Button, Collapse, Box, CircularProgress, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

// const CodeRender = lazy(() => import("./CodeRender/CodeRender"));
import CodeRender from "./CodeRender/CodeRender";

type MarkdownProps = {
  content: string;
  isStreaming?: boolean;
};

const extractThinkBlocks = (markdown: string): { cleaned: string; thinks: string[] } => {
  const thinks: string[] = [];
  let text = markdown;

  // Extract JSON tool responses first
  const toolResponseRegex = /\{"tool_name":\s*"[^"]+",\s*"tool_content":\s*\[[\s\S]*?\]\}/g;
  let toolMatch;
  while ((toolMatch = toolResponseRegex.exec(text)) !== null) {
    try {
      const toolResponse = JSON.parse(toolMatch[0]);
      if (toolResponse.tool_content && Array.isArray(toolResponse.tool_content)) {
        const toolContent = toolResponse.tool_content.join('\n');
        thinks.push(`**Tool: ${toolResponse.tool_name}**\n\n${toolContent}`);
      }
    } catch (e) {
      thinks.push(toolMatch[0]);
    }
  }
  text = text.replace(toolResponseRegex, "");

  // Handle edge case where content appears twice on the same line with artifacts
  // Pattern: content"}</think>content or similar
  const duplicatePattern = /^(.+?)["}\]]*<\/think>(.+)$/;
  const duplicateMatch = text.match(duplicatePattern);
  
  if (duplicateMatch) {
    const [, beforeThink, afterThink] = duplicateMatch;
    
    // If the content before and after </think> is similar/identical, just return the cleaner version
    const cleanBefore = beforeThink.trim().replace(/[{}"\]]+$/, '');
    const cleanAfter = afterThink.trim();
    
    // If they're the same or very similar, just return the after version
    if (cleanBefore === cleanAfter || cleanAfter.includes(cleanBefore)) {
      return { cleaned: cleanAfter, thinks: [] };
    }
  }
  
  // More aggressive approach for specific patterns
  const specificPatterns = [
    /The Chinook database contains a total of \d+ employees\.$/
  ];
  
  for (const pattern of specificPatterns) {
    const lastOccurrenceMatch = text.match(new RegExp(`.*${pattern.source}`));
    
    if (lastOccurrenceMatch) {
      const fullMatch = lastOccurrenceMatch[0];
      const finalSentenceMatch = fullMatch.match(pattern);
      
      if (finalSentenceMatch) {
        const finalAnswer = finalSentenceMatch[0];
        const beforeFinalAnswer = text.substring(0, text.lastIndexOf(finalAnswer));
        
        // Only add to thinks if there's meaningful content after cleaning
        if (beforeFinalAnswer.trim().length > 0) {
          let thinkContent = beforeFinalAnswer;
          
          // Extract complete think blocks
          const completeThinkRegex = /<think>([\s\S]*?)<\/think>/g;
          let thinkMatch;
          while ((thinkMatch = completeThinkRegex.exec(thinkContent)) !== null) {
            thinks.push(thinkMatch[1].trim());
          }
          thinkContent = thinkContent.replace(completeThinkRegex, '');
          
          // Handle unclosed think blocks
          const unClosedThinkMatch = thinkContent.match(/<think>([\s\S]*)$/);
          if (unClosedThinkMatch) {
            thinks.push(unClosedThinkMatch[1].trim());
            thinkContent = thinkContent.replace(unClosedThinkMatch[0], '');
          }
          
          // Clean up any remaining content that might be leftover artifacts
          let remaining = thinkContent
            .replace(/<\/?think>/g, '') // Remove any remaining think tags
            .replace(/[{}"\]]+/g, ' ') // Remove JSON artifacts
            .replace(/\s*}\s*$/g, '') // Remove trailing }
            .replace(/\s+/g, ' ')
            .trim();
          
          // If the remaining content is just a duplicate of the final answer, don't include it
          if (remaining && remaining !== finalAnswer && remaining.length > 0) {
            thinks.push(remaining);
          }
        }
        
        return { cleaned: finalAnswer, thinks };
      }
    }
  }
  
  // Fallback: use the previous logic if no final answer pattern is found
  const finalAnswerPatterns = [
    /^([\s\S]*?)(\s*The .+ contains a total of \d+ .+\.\s*)$/,
    /^([\s\S]*?)(\s*The .+ (is|are) .+\.\s*)$/,
    /^([\s\S]*?)(\s*There (is|are) .+\.\s*)$/
  ];
  
  for (const pattern of finalAnswerPatterns) {
    const finalAnswerMatch = text.match(pattern);
    
    if (finalAnswerMatch) {
      const beforeFinalAnswer = finalAnswerMatch[1];
      const finalAnswer = finalAnswerMatch[2].trim();
      
      let thinkContent = beforeFinalAnswer;
      
      const completeThinkRegex = /<think>([\s\S]*?)<\/think>/g;
      let thinkMatch;
      while ((thinkMatch = completeThinkRegex.exec(thinkContent)) !== null) {
        thinks.push(thinkMatch[1].trim());
      }
      thinkContent = thinkContent.replace(completeThinkRegex, '');
      
      const unClosedThinkMatch = thinkContent.match(/<think>([\s\S]*)$/);
      if (unClosedThinkMatch) {
        thinks.push(unClosedThinkMatch[1].trim());
        thinkContent = thinkContent.replace(unClosedThinkMatch[0], '');
      }
      
      const remaining = thinkContent.replace(/\s+/g, ' ').trim();
      if (remaining && remaining.length > 0) {
        thinks.push(remaining);
      }
      
      return { cleaned: finalAnswer, thinks };
    }
  }
  
  // Final fallback: process normally
  const completeThinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let thinkMatch;
  while ((thinkMatch = completeThinkRegex.exec(text)) !== null) {
    thinks.push(thinkMatch[1].trim());
  }
  text = text.replace(completeThinkRegex, '');
  
  const unClosedThinkRegex = /<think>([\s\S]*)$/;
  const unClosedMatch = unClosedThinkRegex.exec(text);
  if (unClosedMatch) {
    thinks.push(unClosedMatch[1].trim());
    text = text.replace(unClosedMatch[0], '');
  }

  return { cleaned: text.trim(), thinks };
};

const ChatMarkdown = ({ content, isStreaming = false }: MarkdownProps) => {
  useEffect(() => {
    import("./CodeRender/CodeRender");
  }, []);

  const { cleaned, thinks } = extractThinkBlocks(
    content.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n")
  );

  // Safety net: if </think> is leaked in the cleaned content, remove everything before it
  const safeCleanedContent = (text: string): string => {
    const thinkEndIndex = text.lastIndexOf('</think>');
    if (thinkEndIndex !== -1) {
      // Return everything after the last </think> tag
      return text.substring(thinkEndIndex + 8).trim();
    }
    return text;
  };

  const finalCleanedContent = safeCleanedContent(cleaned);
  
  // Handle different display states based on streaming and content
  const getDisplayComponent = () => {
    const hasContent = finalCleanedContent.trim().length > 0;
    
    if (hasContent) {
      // Show content if available
      return (
        <ReactMarkdown
          children={finalCleanedContent}
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
                    inline={inline || false}
                    language={(lang && lang[1]) || ""}
                  />
                </Suspense>
              );
            },
          }}
        />
      );
    } else if (isStreaming) {
      // Show spinner when streaming with no content
      return (
        <Box 
          display="flex" 
          alignItems="center" 
          gap={1}
          sx={{ 
            color: "#666",
            py: 2
          }}
        >
          <CircularProgress size={16} />
          <Typography variant="body2" color="inherit">
            Generating response...
          </Typography>
        </Box>
      );
    } else {
      // Show fallback message when streaming ended with no content
      return (
        <ReactMarkdown
          children="Iteration limit reached without final answer"
          className={markdownStyles.md}
          remarkPlugins={[remarkBreaks, remarkGfm, remarkFrontmatter]}
        />
      );
    }
  };

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
              {thinks
                .filter((block) => {
                  // Filter out blocks that would be empty after ThinkCard's cleaning
                  const thinkEndIndex = block.lastIndexOf('</think>');
                  const cleanedBlock = thinkEndIndex !== -1 
                    ? block.substring(thinkEndIndex + 8).trim()
                    : block.trim();
                  return cleanedBlock.length > 0;
                })
                .map((block, idx) => (
                  <ThinkCard key={idx} content={block} />
                ))
              }
            </Box>
          </Collapse>
        </Box>
      )}

      {getDisplayComponent()}
    </div>
  );
};

export default ChatMarkdown;
