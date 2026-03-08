import { supabase } from "@/integrations/supabase/client";

export async function logLoginAttempt(params: {
  tenantId: string;
  employeeId?: string;
  employeeName: string;
  loginMethod?: string;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await supabase.from("login_logs" as any).insert({
      tenant_id: params.tenantId,
      employee_id: params.employeeId || null,
      employee_name: params.employeeName,
      login_method: params.loginMethod || "password",
      success: params.success,
      error_message: params.errorMessage || null,
    });
  } catch (e) {
    console.error("Failed to log login attempt:", e);
  }
}
