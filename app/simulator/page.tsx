import React, { Suspense } from "react";
import { SimulatorClient } from "@/components/simulator/SimulatorClient";
import SimulatorLoading from "./loading";

export default function SimulatorPage() {
  return (
    <Suspense fallback={<SimulatorLoading />}>
      <SimulatorClient />
    </Suspense>
  );
}
