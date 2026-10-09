import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { Control } from "@/models/Control";
import { threats, vulnerabilities, controls } from "@/data";

export async function runSeed() {
  await Threat.deleteMany({ organizationId: null });
  await Vulnerability.deleteMany({ organizationId: null });
  await Control.deleteMany({ organizationId: null });

  const mappedControls = controls.map(c => ({ ...c, key: c.id, organizationId: null }));
  await Control.insertMany(mappedControls);

  const mappedVuls = vulnerabilities.map(v => ({ ...v, key: v.id, recommendedControlKeys: v.recommendedControlIds, organizationId: null }));
  await Vulnerability.insertMany(mappedVuls);

  const mappedThreats = threats.map(t => ({ ...t, key: t.id, vulnerabilityKeys: t.vulnerabilityIds, organizationId: null }));
  await Threat.insertMany(mappedThreats);
}
