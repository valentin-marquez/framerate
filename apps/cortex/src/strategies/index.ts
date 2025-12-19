import { CaseStrategy } from "@/strategies/case";
import { CaseFanStrategy } from "@/strategies/case-fan";
import { CpuStrategy } from "@/strategies/cpu";
import { CpuCoolerStrategy } from "@/strategies/cpu-cooler";
import { DefaultStrategy } from "@/strategies/default";
import { GpuStrategy } from "@/strategies/gpu";
import { HddStrategy } from "@/strategies/hdd";
import { MotherboardStrategy } from "@/strategies/motherboard";
import { PsuStrategy } from "@/strategies/psu";
import { RamStrategy } from "@/strategies/ram";
import { SsdStrategy } from "@/strategies/ssd";

type Strategy =
  | GpuStrategy
  | CpuStrategy
  | HddStrategy
  | SsdStrategy
  | RamStrategy
  | PsuStrategy
  | CaseStrategy
  | CaseFanStrategy
  | CpuCoolerStrategy
  | MotherboardStrategy
  | DefaultStrategy;

const strategies: Record<string, Strategy> = {
  gpu: new GpuStrategy(),
  cpu: new CpuStrategy(),
  hdd: new HddStrategy(),
  ssd: new SsdStrategy(),
  ram: new RamStrategy(),
  psu: new PsuStrategy(),
  case: new CaseStrategy(),
  case_fan: new CaseFanStrategy(),
  cpu_cooler: new CpuCoolerStrategy(),
  motherboard: new MotherboardStrategy(),
  default: new DefaultStrategy(),
};

export function getStrategy(category: string) {
  return strategies[category] ?? strategies.default;
}
