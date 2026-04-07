import { Sidebar } from "./sidebar";
import { Header } from "./header";

type AppLayoutProps = {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  description?: string;
};

export async function AppLayout({ children, title, eyebrow, description }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-transparent text-white lg:grid lg:grid-cols-[18rem_1fr]">
      <Sidebar />
      <div className="min-w-0">
        <Header title={title} eyebrow={eyebrow} description={description} />
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
