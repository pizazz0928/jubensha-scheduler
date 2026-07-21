import type { Metadata } from "next";
import DispatchApp from "./dispatch-app";

export const metadata: Metadata = {
  title: "归来剧场 · 今日调度",
  description: "面向剧本杀门店的实时开本、换 DM 与补位调度台。",
};

export default function Home() {
  return <DispatchApp />;
}
