import { db } from "./db";
import Dashboard from "./dashboard";

export default async function Home() {
  const [houses, employees, completedWorks] = await Promise.all([
    db.house.findMany({
      select: { id: true, address: true },
      orderBy: { id: "asc" },
    }),
    db.employee.findMany({
      select: { id: true, fullName: true, role: true, phone: true },
      orderBy: { id: "asc" },
    }),
    db.completedWork.findMany({
      select: {
        id: true,
        description: true,
        location: true,
        volume: true,
        materials: true,
        beforePhotoKey: true,
        afterPhotoKey: true,
        createdAt: true,
        house: { select: { id: true, address: true } },
        employee: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <Dashboard
      completedWorks={completedWorks}
      employees={employees}
      houses={houses}
    />
  );
}
