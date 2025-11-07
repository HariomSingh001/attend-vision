
export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
        <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
        <div className="h-3 w-3 animate-bounce rounded-full bg-primary"></div>
      </div>
    </div>
  );
}
