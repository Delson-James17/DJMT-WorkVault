// src/components/DailyTrivia.tsx
import React, { useEffect, useState } from "react";

interface Trivia {
  question: string;
  answer: string;
}

export const DailyTrivia: React.FC = () => {
  const [trivia, setTrivia] = useState<Trivia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrivia = async () => {
      try {
        const res = await fetch("https://api.api-ninjas.com/v1/triviaoftheday", {
          headers: {
            "X-Api-Key": import.meta.env.VITE_API_NINJAS_KEY,
            "Accept": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Error fetching trivia: ${res.status}`);
        }

        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          setTrivia({
            question: data[0].question,
            answer: data[0].answer,
          });
        } else {
          console.error("No trivia found in API response", data);
        }
      } catch (err) {
        console.error("Failed to fetch trivia:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrivia();
  }, []);

  if (loading) return <div>Loading trivia...</div>;
  if (!trivia) return <div>Failed to load trivia.</div>;

  return (
    <div className="p-3 border rounded bg-light mb-3" style={{ maxWidth: 400 }}>
      <h5>Trivia for Today</h5>
      <blockquote className="mb-2">{trivia.question}</blockquote>
      <small className="text-white" >Answer: {trivia.answer}</small>
    </div>
  );
};
