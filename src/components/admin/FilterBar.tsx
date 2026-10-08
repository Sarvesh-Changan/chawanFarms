"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterBarProps = {
  placeholder?: string;
  fields?: Array<{ name: string; label: string; placeholder?: string }>;
};

export function FilterBar({ placeholder = "Search", fields = [] }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [values, setValues] = useState<Map<string, string>>(() => {
    const initial = new Map(fields.map(({ name }) => [name, searchParams.get(name) ?? ""]));
    if (!fields.length) initial.set("q", searchParams.get("q") ?? "");
    return initial;
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    for (const [key, value] of values) {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
      {fields.map(({ name, label, placeholder: fieldPlaceholder }) => (
        <label key={name} className="grid min-w-40 flex-1 gap-1 text-xs font-medium text-muted-foreground">
          {label}
          <Input value={values.get(name) ?? ""} placeholder={fieldPlaceholder} onChange={(event) => setValues((current) => new Map(current).set(name, event.target.value))} />
        </label>
      ))}
      {!fields.length ? (
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">{placeholder}</span>
          <Search aria-hidden className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input className="pl-9" value={values.get("q") ?? ""} placeholder={placeholder} onChange={(event) => setValues((current) => new Map(current).set("q", event.target.value))} />
        </label>
      ) : null}
      <Button type="submit" variant="outline">Apply filters</Button>
    </form>
  );
}
