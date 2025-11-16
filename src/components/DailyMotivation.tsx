// src/components/DailyMotivation.tsx
import React, { useEffect, useState } from "react";

interface Quote {
  quote: string;
  author: string;
}

export const DailyMotivation: React.FC = () => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch("https://api.api-ninjas.com/v2/quoteoftheday", {
          headers: {
            "X-Api-Key": import.meta.env.VITE_API_NINJAS_KEY,
            "Accept": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Error fetching quote: ${res.status}`);
        }

        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          const q = data[0];
          setQuote({
            quote: q.quote,
            author: q.author || "Unknown",
          });
        } else {
          console.error("No quote found in API response", data);
        }
      } catch (err) {
        console.error("Failed to fetch quote:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, []);

  if (loading) return <div>Loading motivation...</div>;
  if (!quote) return <div>Failed to load quote.</div>;

  return (
    <div className="p-3 border rounded bg-light mb-3" style={{ maxWidth: 400 }}>
      <h5>Daily Motivation</h5>
      <blockquote className="mb-0">{quote.quote}</blockquote>
      <small className="text-muted text-light">— {quote.author}</small>
    </div>
  );
};
