"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = ({ error, reset }: ErrorPageProps) => {
  const handleClick = () => {
    reset();
  };

  return (
    <div className="space-y-3">
      <h1 className="font-serif text-3xl text-white">Algo salió mal</h1>
      <p className="text-[#99aabb]">{error.message}</p>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-full bg-[#00e054] px-4 py-2 text-sm font-semibold text-[#14181c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Reintentar
      </button>
    </div>
  );
};

export default ErrorPage;
