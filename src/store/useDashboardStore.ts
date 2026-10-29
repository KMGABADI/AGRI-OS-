import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  type: string;
  dataSource: string;
  dataFunction: string;
  refreshInterval: number; // in seconds
  permissions: string[]; // Roles that can view
  visibilityStatus: boolean; // ON/OFF
  defaultPosition: { x: number, y: number, w: number, h: number };
  colorTheme: string;
  exportPermissions: string[];
  assignedDashboards: string[]; // Which dashboards it appears in
}

interface DashboardState {
  widgets: WidgetConfig[];
  dashboards: string[]; // List of available dashboards
  addWidget: (widget: WidgetConfig) => void;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  removeWidget: (id: string) => void;
  addDashboard: (name: string) => void;
  removeDashboard: (name: string) => void;
}

const defaultWidgets: WidgetConfig[] = [
  {
    id: 'w_total_beneficiaries',
    name: 'Total Beneficiaries',
    description: 'Display total registered beneficiaries KPI',
    type: 'kpi_card',
    dataSource: 'Beneficiaries DB',
    dataFunction: 'countAll',
    refreshInterval: 300,
    permissions: ['Super Admin', 'Admin', 'Programme Manager', 'Viewer'],
    visibilityStatus: true,
    defaultPosition: { x: 0, y: 0, w: 3, h: 2 },
    colorTheme: 'primary',
    exportPermissions: ['Super Admin', 'Admin'],
    assignedDashboards: ['Executive Dashboard'],
  },
  {
    id: 'w_project_status',
    name: 'Project Status Overview',
    description: 'Bar chart showing status of all projects',
    type: 'bar_chart',
    dataSource: 'Projects DB',
    dataFunction: 'aggregateByStatus',
    refreshInterval: 600,
    permissions: ['Super Admin', 'Admin', 'Project Officer'],
    visibilityStatus: true,
    defaultPosition: { x: 3, y: 0, w: 6, h: 4 },
    colorTheme: 'secondary',
    exportPermissions: ['Super Admin'],
    assignedDashboards: ['Executive Dashboard'],
  },
  {
    id: 'w_gis_map',
    name: 'Farmer Geographic Distribution',
    description: 'Interactive map of farmer locations',
    type: 'geo_chart',
    dataSource: 'Farmers DB',
    dataFunction: 'getCoordinates',
    refreshInterval: 3600,
    permissions: ['Super Admin', 'Admin', 'GIS Officer'],
    visibilityStatus: true,
    defaultPosition: { x: 0, y: 2, w: 12, h: 6 },
    colorTheme: 'default',
    exportPermissions: ['Super Admin', 'GIS Officer'],
    assignedDashboards: ['Executive Dashboard'],
  },
  {
    id: 'w_farmer_gender',
    name: 'Farmer Gender Distribution',
    description: 'Pie chart showing gender distribution',
    type: 'pie_chart',
    dataSource: 'Farmers DB',
    dataFunction: 'aggregateByGender',
    refreshInterval: 600,
    permissions: ['Super Admin', 'Admin', 'Viewer'],
    visibilityStatus: true,
    defaultPosition: { x: 9, y: 0, w: 3, h: 2 },
    colorTheme: 'primary',
    exportPermissions: ['Super Admin', 'Admin'],
    assignedDashboards: ['Executive Dashboard'],
  }
];

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: defaultWidgets,
      dashboards: [
        'Executive Dashboard'
      ],
      addWidget: (widget) => set((state) => ({ widgets: [...state.widgets, widget] })),
      updateWidget: (id, updates) => set((state) => ({
        widgets: state.widgets.map((w) => (w.id === id ? { ...w, ...updates } : w))
      })),
      removeWidget: (id) => set((state) => ({
        widgets: state.widgets.filter((w) => w.id !== id)
      })),
      addDashboard: (name) => set((state) => ({
        dashboards: state.dashboards.includes(name) ? state.dashboards : [...state.dashboards, name]
      })),
      removeDashboard: (name) => set((state) => ({
        dashboards: state.dashboards.filter((d) => d !== name)
      }))
    }),
    {
      name: 'dashboard-config-storage-v2',
    }
  )
);
