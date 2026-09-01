import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-3xl text-white">No encontrado</h1>
      <p className="text-[#99aabb]">Ese título o lista no existe.</p>
      <Link
        href="/"
        className="inline-block text-[#00e054] underline-offset-2 hover:underline"
      >
        Volver al diario
      </Link>
    </div>
  );
}
