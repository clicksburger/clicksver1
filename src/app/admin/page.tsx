import { redirect } from "next/navigation";
import { BUSINESS_SLUG } from "@/constants/business";
import { routes } from "@/constants/routes";

export default function AdminPage() {
  redirect(routes.dashboard(BUSINESS_SLUG));
}
