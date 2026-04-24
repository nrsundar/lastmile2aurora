export default function PresentationPage() {
  return (
    <iframe
      src="/presentation.html"
      style={{ width: "100vw", height: "100vh", border: "none", position: "fixed", top: 0, left: 0, zIndex: 9999 }}
      title="LastMile2Aurora Presentation"
    />
  );
}
