import { createFileRoute } from "@tanstack/react-router";
import { DiceConverter } from "@/components/dice-converter";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DiceConverter />;
}
