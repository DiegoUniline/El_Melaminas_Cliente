// Tipos personalizados para el sistema ISP
// Complementan los tipos auto-generados de Supabase

export type AppRole = 'admin' | 'employee';
export type ProspectStatus = 'pending' | 'finalized' | 'cancelled';
export type ClientStatus = 'active' | 'cancelled';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Prospect {
  id: string;
  first_name: string;
  last_name_paterno: string;
  last_name_materno: string | null;
  phone1: string;
  phone2: string | null;
  phone3_signer: string | null;
  street: string;
  exterior_number: string;
  interior_number: string | null;
  neighborhood: string;
  city: string;
  postal_code: string | null;
  work_type: string | null;
  request_date: string;
  assigned_date: string | null;
  assigned_to: string | null;
  ssid: string | null;
  antenna_ip: string | null;
  notes: string | null;
  status: ProspectStatus;
  finalized_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name_paterno: string;
  last_name_materno: string | null;
  phone1: string;
  phone2: string | null;
  phone3: string | null;
  street: string;
  exterior_number: string;
  interior_number: string | null;
  neighborhood: string;
  city: string;
  postal_code: string | null;
  status: ClientStatus;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  ine_subscriber_front: string | null;
  ine_subscriber_back: string | null;
  ine_other_front: string | null;
  ine_other_back: string | null;
  contract_page1: string | null;
  contract_page2: string | null;
  prospect_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  client_id: string;
  antenna_mac: string | null;
  antenna_brand: string | null;
  antenna_model: string | null;
  antenna_ip: string | null;
  antenna_ssid: string | null;
  router_mac: string | null;
  router_brand: string | null;
  router_model: string | null;
  router_ip: string | null;
  router_serial: string | null;
  router_network_name: string | null;
  router_password: string | null;
  installer_name: string | null;
  installation_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientBilling {
  id: string;
  client_id: string;
  installation_cost: number;
  monthly_fee: number;
  installation_date: string;
  first_billing_date: string;
  balance: number;
  billing_day: number;
  plan_id: string | null;
  prorated_amount: number | null;
  additional_charges: number | null;
  additional_charges_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  period_month: number | null;
  period_year: number | null;
  payer_name: string | null;
  payer_phone: string | null;
  receipt_number: string | null;
  bank_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ServicePlan {
  id: string;
  name: string;
  monthly_fee: number;
  speed_download: string | null;
  speed_upload: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentHistory {
  id: string;
  client_id: string;
  equipment_id: string | null;
  change_type: 'installation' | 'antenna_change' | 'router_change' | 'relocation';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  charge_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PlanChangeHistory {
  id: string;
  client_id: string;
  old_plan_id: string | null;
  new_plan_id: string | null;
  old_monthly_fee: number | null;
  new_monthly_fee: number | null;
  effective_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// Tipos para formularios
export type ProspectFormData = Omit<Prospect, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'finalized_at' | 'cancelled_at'>;
export type ClientFormData = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'cancelled_at'>;
export type EquipmentFormData = Omit<Equipment, 'id' | 'created_at' | 'updated_at'>;
export type PaymentFormData = Omit<Payment, 'id' | 'created_at' | 'created_by'>;

// Cliente con datos relacionados
export interface ClientWithDetails extends Client {
  equipment?: Equipment;
  billing?: ClientBilling;
  payments?: Payment[];
}

// Ciudades
export interface City {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCity {
  id: string;
  user_id: string;
  city_id: string;
  created_at: string;
}