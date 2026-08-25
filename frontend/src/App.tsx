import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "./lib/api";
import { Timeline } from "./components/Timeline";

export default function App() {
  const meQ = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false });
  if (meQ.isLoading) return <div className="p-6 text-neutral-400">Loading…</div>;
  if (meQ.isError) return <div className="p-6 text-red-400">Auth required.</div>;
  return <Timeline />;
}
