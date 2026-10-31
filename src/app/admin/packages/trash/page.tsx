import { redirect } from "next/navigation";

export default function PackageTrashPage() { redirect("/admin/packages?trash=1"); }
