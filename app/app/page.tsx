import { db } from "./db";
import Dashboard from "./dashboard";

export default async function Home() {
  const [houses, employees] = await Promise.all([
    db.house.findMany({
      select: { id: true, address: true },
      orderBy: { id: "asc" },
    }),
    db.employee.findMany({
      select: { id: true, fullName: true, role: true, phone: true },
      orderBy: { id: "asc" },
    }),
  ]);

  return <Dashboard employees={employees} houses={houses} />;
}
