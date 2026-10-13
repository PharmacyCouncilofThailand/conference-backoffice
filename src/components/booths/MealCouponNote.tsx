export function MealCouponNote({
  eligible,
}: {
  eligible: boolean | null | undefined;
}) {
  if (eligible !== true) return null;
  return (
    <p className="my-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
      มีสิทธิ์รับคูปองอาหาร
    </p>
  );
}
