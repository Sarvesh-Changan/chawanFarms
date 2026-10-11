"use client";

import { Loader2, LogOut } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/auth/actions";

export type AdminLogoutButtonProps = {
  className?: string;
  variant?: "outline" | "ghost" | "secondary" | "destructive" | "primary" | "default";
  size?: "default" | "sm" | "xs" | "icon" | "icon-sm";
  showLabel?: boolean;
};

export function AdminLogoutButton({
  className,
  variant = "outline",
  size = "sm",
  showLabel = true,
}: AdminLogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await logoutAction();
        toast.success("Logged out successfully");
        window.location.href = "/login";
      } catch {
        toast.error("Failed to log out. Please try again.");
      }
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={isPending}
      className={cn("gap-2", className)}
      title="Log out of admin workspace"
      aria-label="Log out of admin workspace"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-4" aria-hidden />
      )}
      {showLabel ? <span>{isPending ? "Logging out..." : "Log out"}</span> : null}
    </Button>
  );
}
