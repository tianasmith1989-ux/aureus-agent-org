import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(1200px 500px at 80% -10%, rgba(201,162,39,.10), transparent 60%), #0B0A07",
        padding: 24,
      }}
    >
      <SignUp />
    </div>
  );
}
