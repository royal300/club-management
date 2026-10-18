import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  group,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  /** For radio groups and other composite controls: the control uses aria-labelledby={`${htmlFor}-label`}. */
  group?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const text = (
    <>
      {label}
      {required ? <span className="text-destructive" aria-hidden> *</span> : null}
    </>
  );
  return (
    <div className={cn("space-y-1.5", className)}>
      {group ? (
        <p id={`${htmlFor}-label`} className="flex items-center gap-2 text-[13px] leading-none font-medium select-none">
          {text}
        </p>
      ) : (
        <Label htmlFor={htmlFor} className="text-[13px]">
          {text}
        </Label>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-x-8 gap-y-4 border-b py-6 first:pt-0 last:border-0 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormMessage({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        ok ? "border-income/30 bg-income/10 text-income" : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {message}
    </p>
  );
}
