import type { SpecificationDataType } from "./types";

export interface DefaultSpecificationDefinition {
  category: string;
  key: string;
  label: string;
  dataType: SpecificationDataType;
  unit?: string;
  required?: boolean;
  config?: Record<string, unknown>;
}

export const DEFAULT_SPECIFICATION_DEFINITIONS: DefaultSpecificationDefinition[] = [
  { category: "CPU", key: "brand", label: "Brand", dataType: "STRING", required: true },
  { category: "CPU", key: "series", label: "Series", dataType: "STRING" },
  { category: "CPU", key: "generation", label: "Generation", dataType: "STRING" },
  { category: "CPU", key: "socket", label: "Socket", dataType: "STRING", required: true },
  { category: "CPU", key: "tdp", label: "TDP", dataType: "NUMBER", unit: "W", required: true },
  { category: "CPU", key: "integratedGraphics", label: "Integrated graphics", dataType: "BOOLEAN" },
  { category: "CPU", key: "supportedMemoryType", label: "Supported memory type", dataType: "STRING", required: true },

  { category: "Motherboard", key: "brand", label: "Brand", dataType: "STRING", required: true },
  { category: "Motherboard", key: "socket", label: "Socket", dataType: "STRING", required: true },
  { category: "Motherboard", key: "chipset", label: "Chipset", dataType: "STRING", required: true },
  { category: "Motherboard", key: "memoryType", label: "Memory type", dataType: "STRING", required: true },
  { category: "Motherboard", key: "formFactor", label: "Form factor", dataType: "STRING", required: true },
  { category: "Motherboard", key: "pcieVersion", label: "PCIe version", dataType: "STRING" },
  { category: "Motherboard", key: "m2Slots", label: "M.2 slots", dataType: "NUMBER" },
  { category: "Motherboard", key: "maxMemory", label: "Max memory", dataType: "NUMBER", unit: "GB" },

  { category: "RAM", key: "brand", label: "Brand", dataType: "STRING", required: true },
  { category: "RAM", key: "memoryType", label: "Memory type", dataType: "STRING", required: true },
  { category: "RAM", key: "capacityGb", label: "Capacity", dataType: "NUMBER", unit: "GB", required: true },
  { category: "RAM", key: "speedMhz", label: "Speed", dataType: "NUMBER", unit: "MHz" },
  { category: "RAM", key: "modules", label: "Modules", dataType: "NUMBER" },

  { category: "GPU", key: "brand", label: "Brand", dataType: "STRING", required: true },
  { category: "GPU", key: "chipset", label: "Chipset", dataType: "STRING", required: true },
  { category: "GPU", key: "lengthMm", label: "Length", dataType: "NUMBER", unit: "mm" },
  { category: "GPU", key: "tdp", label: "TDP", dataType: "NUMBER", unit: "W" },
  { category: "GPU", key: "recommendedPsuW", label: "Recommended PSU", dataType: "NUMBER", unit: "W" },
  { category: "GPU", key: "pcieVersion", label: "PCIe version", dataType: "STRING" },

  { category: "PSU", key: "brand", label: "Brand", dataType: "STRING", required: true },
  { category: "PSU", key: "wattage", label: "Wattage", dataType: "NUMBER", unit: "W", required: true },
  { category: "PSU", key: "efficiency", label: "Efficiency", dataType: "STRING" },
  { category: "PSU", key: "formFactor", label: "Form factor", dataType: "STRING" },

  { category: "Case", key: "formFactorSupport", label: "Form factor support", dataType: "STRING_ARRAY", required: true },
  { category: "Case", key: "maxGpuLengthMm", label: "Max GPU length", dataType: "NUMBER", unit: "mm" },
  { category: "Case", key: "maxCoolerHeightMm", label: "Max cooler height", dataType: "NUMBER", unit: "mm" },
  { category: "Case", key: "psuSupport", label: "PSU support", dataType: "STRING_ARRAY" },

  { category: "Cooler", key: "supportedSockets", label: "Supported sockets", dataType: "STRING_ARRAY", required: true },
  { category: "Cooler", key: "coolerType", label: "Cooler type", dataType: "STRING" },
  { category: "Cooler", key: "heightMm", label: "Height", dataType: "NUMBER", unit: "mm" },
  { category: "Cooler", key: "radiatorSizeMm", label: "Radiator size", dataType: "NUMBER", unit: "mm" },
  { category: "Cooler", key: "tdpCapacity", label: "TDP capacity", dataType: "NUMBER", unit: "W" },

  { category: "Storage", key: "brand", label: "Brand", dataType: "STRING", required: true },
  { category: "Storage", key: "storageType", label: "Storage type", dataType: "STRING", required: true },
  { category: "Storage", key: "capacityGb", label: "Capacity", dataType: "NUMBER", unit: "GB", required: true },
  { category: "Storage", key: "interface", label: "Interface", dataType: "STRING", required: true },
  { category: "Storage", key: "formFactor", label: "Form factor", dataType: "STRING" },
  { category: "Storage", key: "pcieVersion", label: "PCIe version", dataType: "STRING" },
  { category: "Storage", key: "readSpeedMbps", label: "Read speed", dataType: "NUMBER", unit: "MB/s" },
  { category: "Storage", key: "writeSpeedMbps", label: "Write speed", dataType: "NUMBER", unit: "MB/s" },
];

const STEP_CATEGORY_BY_NAME: Record<string, string> = {
  processor: "CPU",
  cpu: "CPU",
  motherboard: "Motherboard",
  memory: "RAM",
  ram: "RAM",
  "graphics card": "GPU",
  gpu: "GPU",
  "power supply": "PSU",
  psu: "PSU",
  case: "Case",
  cooler: "Cooler",
  storage: "Storage",
};

export function inferSpecificationCategory(stepName: string): string {
  const normalized = stepName.trim().toLowerCase();
  return STEP_CATEGORY_BY_NAME[normalized] ?? stepName.trim();
}
