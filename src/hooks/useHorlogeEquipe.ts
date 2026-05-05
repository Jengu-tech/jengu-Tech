import { useEffect, useState } from "react";
import { calculerEquipe, type Equipe } from "@/lib/types";

export function useHorlogeEquipe() {
  const [now, setNow] = useState(new Date());
  const [equipe, setEquipe] = useState<Equipe>(calculerEquipe());

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d);
      setEquipe(calculerEquipe(d));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { now, equipe };
}
