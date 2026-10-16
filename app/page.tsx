import { ClientApp } from "@/components/client-app"
import { loadMissionPlanningRecords } from "@/lib/config/load-mission-planning"

export default function Page() {
  const missionRecords = loadMissionPlanningRecords()
  return <ClientApp missionRecords={missionRecords} />
}
