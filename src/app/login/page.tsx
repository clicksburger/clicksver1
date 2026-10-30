import { redirect } from "next/navigation";
import { BUSINESS_SLUG } from "@/constants/business";
import { routes } from "@/constants/routes";

export default function LoginPage() {
  redirect(routes.login(BUSINESS_SLUG));
}
