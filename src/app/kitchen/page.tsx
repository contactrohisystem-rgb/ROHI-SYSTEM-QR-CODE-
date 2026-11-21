import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { KitchenDisplay } from "@/components/kitchen/kitchen-display";

export const metadata = { title: "ROHI — Kitchen Display" };

export default async function KitchenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!session.user.activeRestaurantId) redirect("/");

  const restaurantId = session.user.activeRestaurantId;
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, brandPrimary: true, logoUrl: true, appearance: true },
  });

  return <KitchenDisplay restaurantId={restaurantId} restaurantName={restaurant?.name ?? "ROHI"} />;
}
