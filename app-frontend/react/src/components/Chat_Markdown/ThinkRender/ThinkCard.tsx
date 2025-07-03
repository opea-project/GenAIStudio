// components/ThinkCard.tsx
import { Card, CardContent, Typography } from "@mui/material";

type ThinkCardProps = {
  content: string;
};

const ThinkCard = ({ content }: ThinkCardProps) => {
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
          {content}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ThinkCard;
