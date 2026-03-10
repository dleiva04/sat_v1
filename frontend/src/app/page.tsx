import SetupForm from "../components/SetupForm";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <SetupForm />
      </div>
    </div>
  );
}
