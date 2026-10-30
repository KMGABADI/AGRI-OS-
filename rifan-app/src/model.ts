export const ROLES = [
  "Super Admin",
  "Admin",
  "Manager",
  "Field Agent",
  "Enumerator",
  "Data Entry Officer",
  "Viewer",
] as const;
export type Role = (typeof ROLES)[number];
export type Row = { id: string; [key: string]: any };
export type Entity =
  | "farmers"
  | "organizations"
  | "programs"
  | "warehouses"
  | "interventions"
  | "resources"
  | "alerts"
  | "templates"
  | "workbooks"
  | "imports"
  | "widgets"
  | "movements"
  | "chats"
  | "applications"
  | "payments"
  | "seasons"
  | "participations"
  | "fieldValidations"
  | "farmLocations"
  | "harvestTasks";
export const ENTITIES: Entity[] = [
  "farmers",
  "organizations",
  "programs",
  "warehouses",
  "interventions",
  "resources",
  "alerts",
  "templates",
  "workbooks",
  "imports",
  "widgets",
  "movements",
  "chats",
  "applications",
  "payments",
  "seasons",
  "participations",
  "fieldValidations",
  "farmLocations",
  "harvestTasks",
];
export interface Session {
  id: string;
  name: string;
  email: string;
  role: Role;
  space: string;
  demo: boolean;
  organizationId?: string;
  states?: string[];
  lgas?: string[];
  warehouseIds?: string[];
  plannerApproved?: boolean;
  mustChangePassword?: boolean;
}
export interface Snapshot {
  data: Record<Entity, Row[]>;
  settings: Record<string, any>;
  activity: Row[];
  integrations: { gemini: boolean; google: boolean; googleConnected: boolean };
  users: Row[];
  summary: Record<string, any>;
  farmerWindow: { loaded: number; total: number };
}
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "select"
    | "textarea"
    | "checkbox"
    | "email"
    | "password"
    | "multiselect";
  options?: string[];
  required?: boolean;
  group?: string;
  min?: number;
  max?: number;
};
export const names = (r: Row) =>
  [r.title, r.firstName, r.middleName, r.lastName].filter(Boolean).join(" ");
export const format = (v: number) =>
  new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 }).format(v || 0);
export const money = (v: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(v || 0);
export const canEdit = (role: Role, entity: Entity | "settings" | "users") => {
  if (["Super Admin", "Admin"].includes(role)) return true;
  if (role === "Viewer") return false;
  if (["settings", "users", "widgets"].includes(entity)) return false;
  if (role === "Manager") return true;
  if (["Field Agent", "Enumerator"].includes(role))
    return [
      "farmers",
      "resources",
      "fieldValidations",
      "farmLocations",
      "harvestTasks",
    ].includes(entity);
  return (
    role === "Data Entry Officer" && ["farmers", "imports"].includes(entity)
  );
};
export const DEFAULT_SETTINGS = {
  appName: "RIFAN Connect",
  tagline: "Growing together. Feeding a nation.",
  primaryColor: "#194c2b",
  goldColor: "#b49a46",
  logo: "/rifan-logo.png",
  theme: "light",
  enableFoodBank: true,
  enableMap: true,
  enableMonitoring: true,
  enableActivityLog: true,
  enableFarmerTemplate: true,
  showStats: true,
  showGrowth: true,
  showRegions: true,
  showActivity: true,
  registrationFee: 0,
  membershipFee: 0,
  membershipCycle: "Annual",
  publicRegistrationEnabled: false,
  paymentProvider: "Not configured",
  requireTwoFactor: false,
};
export const farmerFields: Field[] = [
  {
    key: "firstName",
    label: "First name",
    required: true,
    group: "Personal details",
  },
  { key: "middleName", label: "Middle name" },
  { key: "lastName", label: "Last name", required: true },
  {
    key: "title",
    label: "Title",
    type: "select",
    options: ["Mr", "Mrs", "Ms", "Dr", "Alhaji", "Hajiya"],
  },
  {
    key: "gender",
    label: "Gender",
    type: "select",
    options: ["Male", "Female", "Other"],
    required: true,
  },
  { key: "dob", label: "Date of birth", type: "date" },
  {
    key: "marital",
    label: "Marital status",
    type: "select",
    options: ["Single", "Married", "Widowed", "Divorced"],
  },
  {
    key: "education",
    label: "Education",
    type: "select",
    options: ["None", "Primary", "Secondary", "Tertiary"],
  },
  {
    key: "primaryPhone",
    label: "Primary phone",
    required: true,
    group: "Contact & location",
  },
  { key: "phone", label: "Alternative phone" },
  {
    key: "country",
    label: "Country",
    type: "select",
    options: ["Nigeria", "Niger", "Cameroon", "Chad", "Benin"],
  },
  { key: "state", label: "State / region", required: true },
  { key: "lga", label: "LGA / department", required: true },
  { key: "ward", label: "Ward" },
  { key: "community", label: "Community" },
  { key: "address", label: "Address", type: "textarea" },
  { key: "latitude", label: "Latitude", type: "number", min: -90, max: 90 },
  { key: "longitude", label: "Longitude", type: "number", min: -180, max: 180 },
  {
    key: "crop",
    label: "Primary crop",
    type: "select",
    options: [
      "Rice",
      "Maize",
      "Cassava",
      "Sorghum",
      "Millet",
      "Soybean",
      "Yam",
      "Vegetables",
      "Cotton",
      "Groundnut",
    ],
    group: "Farm & production",
  },
  { key: "farmSize", label: "Farm size (hectares)", type: "number", min: 0 },
  {
    key: "farmingType",
    label: "Farming type",
    type: "select",
    options: ["Conventional", "Organic"],
  },
  { key: "variety", label: "Crop variety" },
  {
    key: "landOwnership",
    label: "Land ownership",
    type: "select",
    options: ["Owned", "Leased", "Communal", "Family"],
  },
  { key: "soilType", label: "Soil type" },
  {
    key: "soilFertility",
    label: "Soil fertility",
    type: "select",
    options: ["Low", "Medium", "High"],
  },
  {
    key: "irrigation",
    label: "Irrigation",
    type: "select",
    options: ["Rain-fed", "Irrigated", "Mixed"],
  },
  {
    key: "mechanization",
    label: "Mechanization",
    type: "select",
    options: ["Manual", "Partial", "Full"],
  },
  { key: "experience", label: "Years of farming", type: "number", min: 0 },
  { key: "plantingDate", label: "Planting date", type: "date" },
  { key: "harvestDate", label: "Expected harvest", type: "date" },
  { key: "yield_amount", label: "Harvest yield (kg)", type: "number", min: 0 },
  {
    key: "organizationId",
    label: "Cooperative / organization",
    type: "select",
    group: "Membership & verification",
  },
  { key: "programId", label: "Programme", type: "select" },
  {
    key: "profileStatus",
    label: "Membership status",
    type: "select",
    options: ["Active", "Pending", "Suspended"],
  },
  { key: "registrationDate", label: "Registration date", type: "date" },
  { key: "phase", label: "Season / phase" },
  { key: "agent", label: "Registration officer" },
  { key: "kycComplete", label: "Identity verified", type: "checkbox" },
  { key: "bvn", label: "BVN (11 digits)", group: "Finance & insurance" },
  { key: "nin", label: "NIN (11 digits)" },
  { key: "bankName", label: "Bank name" },
  { key: "accountNumber", label: "Account number (10 digits)" },
  { key: "loanReq", label: "Loan requested (₦)", type: "number", min: 0 },
  { key: "loanApproved", label: "Loan approved (₦)", type: "number", min: 0 },
  { key: "insurance", label: "Insurance cover" },
  { key: "insurer", label: "Insurer" },
  { key: "anchor", label: "Anchor partner" },
  { key: "remarks", label: "Notes", type: "textarea" },
];
export const entityFields: Partial<Record<Entity, Field[]>> = {
  farmers: farmerFields,
  organizations: [
    { key: "name", label: "Organization name", required: true },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: ["Cooperative", "Anchor", "NGO", "Government", "Programme"],
    },
    { key: "region", label: "Region / state" },
    { key: "states", label: "Coverage states", type: "multiselect" },
    { key: "lgas", label: "Coverage LGAs (comma separated)" },
    { key: "contactPerson", label: "Contact person" },
    { key: "contactPhone", label: "Contact phone" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Active", "Inactive"],
    },
  ],
  programs: [
    { key: "name", label: "Programme name", required: true },
    { key: "organizationId", label: "Organization", type: "select" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "target", label: "Target beneficiaries", type: "number", min: 0 },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Active", "Planned", "Completed"],
    },
  ],
  warehouses: [
    { key: "name", label: "Warehouse name", required: true },
    { key: "state", label: "State" },
    {
      key: "commodity",
      label: "Commodity",
      type: "select",
      options: ["Rice", "Maize", "Sorghum", "Mixed grains"],
    },
    {
      key: "capacity",
      label: "Capacity (MT)",
      type: "number",
      required: true,
      min: 1,
    },
    { key: "latitude", label: "Latitude", type: "number", min: -90, max: 90 },
    {
      key: "longitude",
      label: "Longitude",
      type: "number",
      min: -180,
      max: 180,
    },
    { key: "manager", label: "Warehouse manager" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Active", "Maintenance", "Closed"],
    },
    { key: "note", label: "Notes", type: "textarea" },
  ],
  interventions: [
    { key: "name", label: "Intervention name", required: true },
    {
      key: "programId",
      label: "Parent programme",
      type: "select",
      required: true,
    },
    { key: "seasonId", label: "Season", type: "select", required: true },
    { key: "warehouseId", label: "Linked warehouse", type: "select" },
    {
      key: "crop",
      label: "Crop",
      type: "select",
      options: [
        "Rice",
        "Maize",
        "Cassava",
        "Sorghum",
        "Millet",
        "Soybean",
        "Yam",
        "Vegetables",
        "Cotton",
        "Groundnut",
      ],
    },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        "Seed support",
        "Fertilizer",
        "Training",
        "Irrigation",
        "Finance",
        "Extension visit",
      ],
    },
    { key: "dateApplied", label: "Date", type: "date", required: true },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Planned", "In Progress", "Completed"],
    },
    {
      key: "impactScore",
      label: "Observed impact score (0–100)",
      type: "number",
      min: 0,
      max: 100,
    },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  resources: [
    { key: "name", label: "Resource name", required: true },
    { key: "farmerId", label: "Farmer", type: "select", required: true },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: ["Seed", "Fertilizer", "Pesticide", "Water", "Fuel", "Other"],
    },
    {
      key: "quantity",
      label: "Quantity",
      type: "number",
      min: 0,
      required: true,
    },
    {
      key: "unit",
      label: "Unit",
      type: "select",
      options: ["kg", "bags", "litres", "units"],
    },
  ],
  alerts: [
    { key: "title", label: "Alert title", required: true },
    { key: "message", label: "Message", type: "textarea", required: true },
    { key: "farmerId", label: "Farmer (optional)", type: "select" },
    {
      key: "severity",
      label: "Priority",
      type: "select",
      options: ["High", "Medium", "Low"],
    },
    {
      key: "category",
      label: "Category",
      type: "select",
      options: ["Harvest", "Verification", "Weather", "Storage", "General"],
    },
    { key: "dueDate", label: "Due date", type: "date" },
  ],
  templates: [
    { key: "name", label: "Template name", required: true },
    { key: "organizationId", label: "Partner organization", type: "select" },
    {
      key: "mapping",
      label: "Column mapping (JSON object)",
      type: "textarea",
      required: true,
    },
    { key: "requiredFields", label: "Required fields (comma separated)" },
  ],
  workbooks: [
    { key: "name", label: "Workbook name", required: true },
    { key: "url", label: "Google Sheets URL", required: true },
    { key: "organizationId", label: "Organization", type: "select" },
  ],
  widgets: [
    { key: "name", label: "Widget name", required: true },
    {
      key: "type",
      label: "Display type",
      type: "select",
      options: ["kpi", "bar", "pie", "table"],
    },
    {
      key: "dataSource",
      label: "Data source",
      type: "select",
      options: ["farmers", "warehouses", "programs", "interventions"],
    },
    {
      key: "groupBy",
      label: "Group by",
      type: "select",
      options: ["state", "gender", "crop", "status", "profileStatus"],
    },
    { key: "dashboard", label: "Dashboard name" },
    { key: "roles", label: "Allowed roles (comma separated)" },
    {
      key: "refreshInterval",
      label: "Refresh seconds",
      type: "number",
      min: 15,
    },
    { key: "enabled", label: "Visible", type: "checkbox" },
  ],
};

const cropOptions = [
  "Rice",
  "Maize",
  "Cassava",
  "Sorghum",
  "Millet",
  "Soybean",
  "Yam",
  "Vegetables",
  "Cotton",
  "Groundnut",
];
entityFields.seasons = [
  { key: "name", label: "Season name", required: true },
  { key: "organizationId", label: "Organization", type: "select" },
  { key: "programId", label: "Programme", type: "select", required: true },
  {
    key: "type",
    label: "Season type",
    type: "select",
    options: ["Wet", "Dry", "Mixed"],
  },
  {
    key: "year",
    label: "Year",
    type: "number",
    min: 1900,
    max: 2200,
    required: true,
  },
  { key: "crop", label: "Crop", type: "select", options: cropOptions },
  { key: "startDate", label: "Start date", type: "date", required: true },
  { key: "endDate", label: "End date", type: "date", required: true },
  { key: "warehouseIds", label: "Storage facilities", type: "multiselect" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Planned", "Active", "Completed", "Archived"],
  },
  { key: "notes", label: "Notes", type: "textarea" },
];
entityFields.fieldValidations = [
  { key: "farmerId", label: "Farmer", type: "select", required: true },
  { key: "programId", label: "Programme", type: "select", required: true },
  { key: "seasonId", label: "Season", type: "select", required: true },
  { key: "interventionId", label: "Intervention", type: "select" },
  { key: "state", label: "State", required: true },
  { key: "lga", label: "LGA", required: true },
  { key: "address", label: "Farm address" },
  {
    key: "crop",
    label: "Observed crop",
    type: "select",
    options: cropOptions,
    required: true,
  },
  { key: "farmSize", label: "Verified area (ha)", type: "number", min: 0 },
  { key: "latitude", label: "GPS latitude", type: "number", min: -90, max: 90 },
  {
    key: "longitude",
    label: "GPS longitude",
    type: "number",
    min: -180,
    max: 180,
  },
  {
    key: "status",
    label: "Validation status",
    type: "select",
    options: ["Pending", "Verified", "Rejected"],
    required: true,
  },
  {
    key: "validationDate",
    label: "Field visit date",
    type: "date",
    required: true,
  },
  {
    key: "notes",
    label: "Evidence / observations",
    type: "textarea",
    required: true,
  },
];
entityFields.harvestTasks = [
  { key: "name", label: "Activity name", required: true },
  { key: "programId", label: "Programme", type: "select", required: true },
  { key: "seasonId", label: "Season", type: "select", required: true },
  { key: "interventionId", label: "Intervention", type: "select" },
  { key: "farmerId", label: "Farmer (optional)", type: "select" },
  { key: "locationId", label: "Recorded farm site", type: "select" },
  { key: "warehouseId", label: "Aggregation warehouse", type: "select" },
  {
    key: "stage",
    label: "Activity stage",
    type: "select",
    options: [
      "Land preparation",
      "Planting",
      "Irrigation",
      "Fertilizer",
      "Scouting",
      "Harvest",
      "Drying",
      "Storage",
      "Dispatch",
    ],
    required: true,
  },
  { key: "startDate", label: "Start date", type: "date", required: true },
  { key: "endDate", label: "End date", type: "date", required: true },
  { key: "assignedTo", label: "Assigned officer" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Planned", "In Progress", "Completed", "Cancelled"],
  },
  {
    key: "expectedYield",
    label: "Expected yield (kg)",
    type: "number",
    min: 0,
  },
  { key: "actualYield", label: "Actual yield (kg)", type: "number", min: 0 },
  { key: "notes", label: "Notes", type: "textarea" },
];
entityFields.farmLocations = [
  { key: "farmerId", label: "Farmer", type: "select", required: true },
  { key: "programId", label: "Programme", type: "select", required: true },
  { key: "seasonId", label: "Season", type: "select", required: true },
  { key: "interventionId", label: "Intervention", type: "select" },
  { key: "state", label: "State", required: true },
  { key: "lga", label: "LGA", required: true },
  { key: "address", label: "Farm address" },
  { key: "crop", label: "Crop", type: "select", options: cropOptions },
  { key: "farmSize", label: "Area (ha)", type: "number", min: 0 },
  { key: "latitude", label: "Latitude", type: "number", min: -90, max: 90 },
  { key: "longitude", label: "Longitude", type: "number", min: -180, max: 180 },
  {
    key: "observedAt",
    label: "Observation date",
    type: "date",
    required: true,
  },
  { key: "notes", label: "Location / boundary notes", type: "textarea" },
];
