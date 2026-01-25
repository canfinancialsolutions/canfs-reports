
export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>CANFS Reports</h1>
      <p>
        Go to <a href="/auth">/auth</a> to sign in.
      </p>
      <p>
        Protected pages: <a href="/dashboard">/dashboard</a>,{" "}
        <a href="/prospect">/prospect</a>, <a href="/fna">/fna</a>
      </p>
    </main>
  );
}
