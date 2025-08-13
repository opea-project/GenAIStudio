// components/ThinkCard.tsx
import { Card, CardContent, Typography } from "@mui/material";

type ThinkCardProps = {
  content: string;
};

const ThinkCard = ({ content }: ThinkCardProps) => {
  // Safety net: if </think> is leaked, do not display the text before it
  const cleanContent = (text: string): string => {
    const thinkEndIndex = text.lastIndexOf('</think>');
    if (thinkEndIndex !== -1) {
      // Return everything after the last </think> tag
      return text.substring(thinkEndIndex + 8).trim();
    }
    return text;
  };

  const safeContent = cleanContent(content);
  
  // Don't render the card if there's no content after filtering
  if (!safeContent.trim()) {
    return null;
  }

  return (
    <Card
      variant="outlined"
      sx={{
        backgroundColor: "#eef6ff",
        borderLeft: "4px solid #1976d2",
        mb: 2,
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
        borderRadius: 2,
      }}
    >
      <CardContent>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "#333" }}>
          {safeContent}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ThinkCard;
