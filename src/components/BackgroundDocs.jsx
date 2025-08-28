// Reusable full-bleed background art with a soft blur.
// Put your image in /public and update the src below if needed.

export default function BackgroundDocs({
  src = "/docs-hero.png",   // <-- rename if your file is different
  blur = "blur-[10px]",
  opacity = "opacity-40",
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <img
        src={src}
        alt=""
        className={`h-full w-full object-cover ${blur} ${opacity}`}
      />
      {/* subtle white overlay for readability */}
      <div className="absolute inset-0 bg-white/40" />
    </div>
  );
}
