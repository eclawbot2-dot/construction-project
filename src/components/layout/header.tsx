import { TenantSwitcher } from "./tenant-switcher";
import { SunlightToggle } from "@/components/ui/sunlight-toggle";
import { CommandPalette } from "@/components/ui/command-palette";
import { MobileNavToggle } from "./mobile-nav-toggle";

type HeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
};

export function Header({ title, eyebrow, description }: HeaderProps) {
  return (
    <header className="border-b border-white/10 bg-slate-950/60 px-6 py-5 backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <MobileNavToggle />
          <div>
            {eyebrow ? <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</div> : null}
            <h1 className="mt-1 text-2xl font-semibold text-white lg:text-3xl">{title}</h1>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CommandPalette />
          <SunlightToggle />
          <TenantSwitcher />
        </div>
      </div>
    </header>
  );
}
