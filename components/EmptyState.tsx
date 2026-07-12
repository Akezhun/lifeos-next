export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="life-card p-8 text-center">
      <div className="text-xl font-black">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/55">{text}</p>
    </div>
  );
}
