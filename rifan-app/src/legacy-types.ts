export interface BrandingData {
  appName: string;
  logo: string;
  primaryColor: string;
}

export interface BrandingState extends BrandingData {
  updateBranding: (data: Partial<BrandingData>) => void;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role:
    | "Super Admin"
    | "Admin"
    | "Manager"
    | "Viewer"
    | "Field Agent"
    | "Enumerator"
    | "Data Entry Officer";
  organizationId?: string;
  photoURL?: string;
  permissions?: string[];
  accessLevel?: number;
}

export interface Program {
  id: string;
  name: string;
  organizationId?: string;
  description: string;
  status: "Active" | "Completed";
  startDate: string;
}

export interface ProgramState {
  programs: Program[];
  addProgram: (program: Program) => void;
}

export interface DashboardSettings {
  showStats: boolean;
  showCropChart: boolean;
  showScoreChart: boolean;
  showRecentInterventions: boolean;
}

export interface ThemeConfig {
  id: string;
  name: string;
  primaryColor: string;
  bgClass: string;
  borderClass?: string;
  gradient1: string;
  gradient2: string;
  gradient3: string;
  mode?: "light" | "dark";
}

export interface SystemFeatures {
  enableFoodBank: boolean;
  enableMonitoring: boolean;
  enableActivityLog: boolean;
  enableMap: boolean;
  enableFarmerTemplate?: boolean;
}

export interface SettingsState {
  dashboard: DashboardSettings;
  theme: ThemeConfig;
  features: SystemFeatures;
  updateDashboard: (settings: Partial<DashboardSettings>) => void;
  setTheme: (theme: ThemeConfig) => void;
  updateFeatures: (features: Partial<SystemFeatures>) => void;
}

export interface Warehouse {
  capacityMT?: number;
  id: string;
  name: string;
  commodity: string;
  capacity: number; // e.g. metric tons
  currentInventory: number;
  latitude: number;
  longitude: number;
  status: "Active" | "Maintenance" | "Closed";
  manager: string;
  note?: string;
}

export interface WarehouseState {
  warehouses: Warehouse[];
  addWarehouse: (warehouse: Warehouse) => void;
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => void;
  deleteWarehouse: (id: string) => void;
}

export interface Intervention {
  id: string;
  name: string;
  type: string;
  status: "Planned" | "In Progress" | "Completed";
  dateApplied: string;
  impactScore?: number;
}

export interface CreditScoreDetail {
  score: number;
  factors: {
    farmSize: number;
    experience: number;
    kycComplete: number;
    repaymentHistory: number;
  };
  lastUpdated: string;
}

export interface DocumentUpload {
  status?: string;
  id: string;
  name: string;
  type: string;
  url: string;
  uploadDate: string;
}

export interface ResourceInventoryItem {
  id: string;
  type: "Seed" | "Fertilizer" | "Pesticide" | "Water" | "Fuel" | "Other";
  name: string;
  quantity: number;
  unit: string;
  lastUpdated: string;
}

export interface Farmer {
  id: string;
  walletBalance?: number;
  bankName?: string;
  accountNumber?: string;
  bvn?: string;
  nin?: string;
  farmerID?: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName?: string;
  gender: string;
  phone?: string;
  primaryPhone: string;
  state?: string;
  lga?: string;
  ward?: string;
  community?: string;
  country?: string;
  crop?: string;
  farmSize?: number;
  farmingType?: "Organic" | "Conventional";
  plantingDate?: string;
  date?: string;
  yield_amount?: number;
  latitude?: number;
  longitude?: number;
  documents?: DocumentUpload[];
  status?: string;
  profileStatus: "Active" | "Pending" | "Suspended";
  kycComplete?: boolean;
  phase?: string;
  dob?: string;
  marital?: string;
  education?: string;
  address?: string;
  landOwnership?: string;
  soilType?: string;
  soilFertility?: string;
  irrigation?: string;
  mechanization?: string;
  variety?: string;
  loanReq?: number;
  loanApproved?: number;
  insurance?: string;
  insurer?: string;
  anchor?: string;
  organizationId?: string;
  programId?: string;
  remarks?: string;
  experience?: number;
  interventions?: any[];
  agent?: string;
  registrationDate: string;
  photo?: string;
  farmBoundary?: any;

  creditScore?: CreditScoreDetail;
  inventory?: ResourceInventoryItem[];
}

export interface FarmerState {
  farmers: Farmer[];
  isLoading: boolean;
  addFarmer: (farmer: Farmer) => void;
  updateFarmer: (id: string, updates: Partial<Farmer>) => void;
  bulkAddFarmers: (farmers: Farmer[]) => void;
  deleteFarmer: (id: string) => void;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "BULK_IMPORT" | "EXPORT";
  entityType:
    | "FARMER"
    | "INTERVENTION"
    | "ORGANIZATION"
    | "PROGRAM"
    | "WAREHOUSE"
    | "USER";
  entityId: string;
  details: string;
  timestamp: string;
  changes?: { field: string; oldValue: any; newValue: any }[];
}

export interface ActivityLogState {
  logs: ActivityLog[];
  logActivity: (
    log: Omit<
      ActivityLog,
      "id" | "timestamp" | "userId" | "userName" | "userRole"
    >,
  ) => Promise<void>;
}

export interface Organization {
  programs?: any[];
  id: string;
  name: string;
  type: "Cooperative" | "Anchor" | "NGO" | "Government" | "Programme";
  region: string;
  states?: string[];
  lgas?: string[];
  contactPerson: string;
  contactPhone: string;
  status: "Active" | "Inactive";
}

export interface OrganizationState {
  organizations: Organization[];
  addOrganization: (org: Organization) => void;
}

export interface FarmerSensitive {
  bvn?: string;
  nin?: string;
}

export interface SystemConfig {
  features: SystemFeatures;
}

export interface InterventionDoc {
  id: string;
  name: string;
  type: string;
  status: "Planned" | "In Progress" | "Completed";
  dateApplied: string;
  impactScore?: number;
}
