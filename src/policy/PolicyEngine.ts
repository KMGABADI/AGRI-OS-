export interface User {
  id: string;
  role: string;
  organizationId?: string;
  geofenceStates?: string[];
  geofenceLGAs?: string[];
  assignedWarehouses?: string[];
}

export type Action = 
  | 'manage_users'
  | 'manage_settings'
  | 'manage_orgs_programs'
  | 'register_edit_farmers'
  | 'view_farmers'
  | 'manage_warehouses'
  | 'view_warehouses'
  | 'log_interventions'
  | 'view_interventions'
  | 'bulk_upload'
  | 'manage_connectors'
  | 'view_audit_log'
  | 'export_data';

export interface Resource {
  type?: 'Farmer' | 'Organization' | 'User' | 'FoodBank' | 'Intervention' | 'DataUpload' | 'Settings' | 'AuditLog' | 'Program';
  organizationId?: string;
  state?: string;
  lga?: string;
  warehouseId?: string;
  targetRole?: string; // For checking "below own level"
}

export class PolicyEngine {
  can(user: User, action: Action, resource: Resource = {}): boolean {
    const role = user.role;

    // Super Admin can do everything
    if (role === 'Super Admin') return true;

    // Admin Level
    if (role === 'Admin') {
      if (action === 'manage_users') {
        // Admin can only manage roles below Admin (cannot manage Super Admin or Admin)
        if (resource.targetRole === 'Super Admin' || resource.targetRole === 'Admin') return false;
        return true;
      }
      return true; // Admin can do everything else
    }

    // Manager Level
    if (role === 'Manager') {
      if (action === 'manage_users') return false;
      if (action === 'manage_settings') return false;
      
      if (action === 'manage_orgs_programs') {
        return !resource.organizationId || resource.organizationId === user.organizationId;
      }
      
      if (action === 'register_edit_farmers' || action === 'view_farmers' || action === 'export_data') {
        if (resource.organizationId && resource.organizationId !== user.organizationId) return false;
        return this.checkGeofence(user, resource);
      }
      
      if (action === 'manage_warehouses' || action === 'view_warehouses') {
        if (resource.warehouseId && user.assignedWarehouses) {
          return user.assignedWarehouses.includes(resource.warehouseId);
        }
        return true; // If no specific warehouse provided, allow general access
      }
      
      if (action === 'log_interventions' || action === 'view_interventions') return true;
      
      if (action === 'bulk_upload' || action === 'manage_connectors') {
        return !resource.organizationId || resource.organizationId === user.organizationId;
      }
      
      if (action === 'view_audit_log') {
        return !resource.organizationId || resource.organizationId === user.organizationId;
      }

      return false;
    }

    // Field Agent & Enumerator Level
    if (role === 'Field Agent' || role === 'Enumerator') {
      if (action === 'register_edit_farmers' || action === 'view_farmers') {
        return this.checkGeofence(user, resource);
      }
      if (action === 'log_interventions' || action === 'view_interventions') return true;
      
      return false;
    }

    // Data Entry Officer
    if (role === 'Data Entry Officer') {
      if (action === 'register_edit_farmers') return true;
      if (action === 'view_farmers') return this.checkGeofence(user, resource);
      if (action === 'bulk_upload') return true;
      // Cannot manage connectors, export data, etc.
      return false;
    }

    // Viewer
    if (role === 'Viewer') {
      if (action === 'view_farmers') return this.checkGeofence(user, resource);
      if (action === 'view_warehouses') return true;
      if (action === 'view_interventions') return true;
      if (action === 'export_data') return true; // read-only export
      return false;
    }

    return false;
  }

  private checkGeofence(user: User, resource: Resource): boolean {
    if (!resource.state) return true; // If resource has no location, we can't restrict it here or it's a global query
    
    if (user.geofenceStates && user.geofenceStates.length > 0) {
      if (!user.geofenceStates.includes(resource.state)) return false;
      
      if (user.geofenceLGAs && user.geofenceLGAs.length > 0 && resource.lga) {
        if (!user.geofenceLGAs.includes(resource.lga)) return false;
      }
    }
    return true;
  }
}

export const policyEngine = new PolicyEngine();
