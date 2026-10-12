import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium">Page not found</p>
      <Link href="/" className="text-sm text-primary hover:underline">
        Go to overview
      </Link>
    </div>
  );
}
