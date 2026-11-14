import { ErrorState } from "@/components/error-state";

export default function NotFound() {
  return (
    <ErrorState
      code="404 · PAGE NOT FOUND"
      title="You look misdirected."
      description="The page you were looking for isn’t here. It may have moved, or the address may be off."
    />
  );
}
