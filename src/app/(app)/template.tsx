import { PageTurn } from "@/components/app/page-turn";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTurn>{children}</PageTurn>;
}
