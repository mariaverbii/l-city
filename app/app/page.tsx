import { db } from "./db";

export default async function Home() {
  const houses = await db.house.findMany({
    orderBy: { id: "asc" },
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "sans-serif",
        padding: "32px",
        gap: "16px",
      }}
    >
      <h1>Л-Сити</h1>
      <h2>Дома в управлении</h2>

      <ul style={{ listStyle: "none", padding: 0, width: "100%", maxWidth: "400px" }}>
        {houses.length === 0 && <p>Домов пока нет.</p>}
        {houses.map((house) => (
          <li
            key={house.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "8px",
            }}
          >
            {house.address}
          </li>
        ))}
      </ul>
    </main>
  );
}
