import { notFound } from "next/navigation";
import { EnableNotifications } from "@/ui/EnableNotifications";

// Development-only host so screenshots can render the component on its own.
export default function NotificationsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-[480px] p-4">
      <EnableNotifications />
    </main>
  );
}
