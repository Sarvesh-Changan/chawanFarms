import { redirect } from "next/navigation";

export default function AccommodationTrashPage() { redirect("/admin/accommodation?trash=1"); }
