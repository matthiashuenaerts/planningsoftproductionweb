import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { User, Lock, Shield, RefreshCw, ArrowRight } from "lucide-react";
import { logLoginAttempt } from "@/services/loginLogService";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const Login: React.FC = () => {
  const [nameOrEmail, setNameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Developer 2FA state
  const [otpStep, setOtpStep] = useState(false);
  const otpPendingRef = React.useRef(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [resendingOtp, setResendingOtp] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated, isDeveloper, refetchEmployee } = useAuth();
  const location = useLocation();
  const { tenant } = useParams<{ tenant: string }>();

  const isDeveloperPortal = location.pathname.startsWith("/dev/login");

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || otpStep || otpPendingRef.current) return;

    const redirectPath = sessionStorage.getItem("redirectAfterLogin");
    if (redirectPath) {
      sessionStorage.removeItem("redirectAfterLogin");
      navigate(redirectPath);
      return;
    }

    if (isDeveloper) {
      navigate("/dev");
    } else if (tenant) {
      navigate(`/${tenant}/nl/`);
    } else {
      navigate("/");
    }
  }, [isAuthenticated, isDeveloper, navigate, tenant, otpStep]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !loading && !verifyingOtp) {
        e.preventDefault();
        if (otpStep) {
          if (otpCode.length === 6) handleVerifyOtp();
        } else {
          const form = document.querySelector("form");
          if (form) form.requestSubmit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [loading, verifyingOtp, otpStep, otpCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameOrEmail || !password) {
      toast({
        title: "Error",
        description: isDeveloperPortal
          ? "Please enter email and password"
          : "Please enter both employee name and password",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (isDeveloperPortal) {
        const { data: devData, error: devError } = await supabase.rpc(
          "authenticate_developer_by_name",
          { p_name: nameOrEmail, p_password: password }
        );

        if (devError) throw new Error(devError.message);

        const devRow = Array.isArray(devData) ? devData[0] : devData;
        if (!devRow || !devRow.email || !devRow.auth_user_id) {
          throw new Error("Invalid developer credentials");
        }

        otpPendingRef.current = true;

        const loginResult = await login(devRow.email, password);
        if (loginResult.error) {
          otpPendingRef.current = false;
          throw new Error(loginResult.error);
        }

        try {
          const { data: otpResult, error: otpError } = await supabase.functions.invoke(
            "developer-otp",
            { body: { action: "send" } }
          );

          if (otpError) throw otpError;

          setOtpEmail(otpResult?.email || devRow.email);
          setOtpStep(true);

          toast({
            title: "Verification required",
            description: `A verification code has been sent to ${otpResult?.email || "your email"}`,
          });
        } catch (otpSendError: any) {
          console.error("OTP send error:", otpSendError);
          toast({
            title: "Warning",
            description: "Could not send verification email. Please try again.",
            variant: "destructive",
          });
          otpPendingRef.current = false;
          await supabase.auth.signOut();
        }

        return;
      }

      if (!tenant) {
        throw new Error("No tenant specified in URL");
      }

      const { data, error } = await supabase.rpc(
        "authenticate_employee_for_tenant",
        {
          p_employee_name: nameOrEmail,
          p_employee_password: password,
          p_slug: tenant,
          p_domain: null,
        }
      );

      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) throw new Error("Invalid username or password");

      if (!row.auth_user_id || !row.email) {
        throw new Error(
          "Your account needs to be migrated. Please contact your administrator."
        );
      }

      const loginResult = await login(row.email, password);
      if (loginResult.error) throw new Error(loginResult.error);

      const { data: devRoleCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", row.employee_id)
        .eq("role", "developer" as any)
        .maybeSingle();

      if (devRoleCheck) {
        await supabase.rpc("set_developer_active_tenant", {
          p_tenant_id: row.tenant_id,
        });
        // Re-fetch employee data so AuthContext picks up the effective tenant_id
        await refetchEmployee();
      }

      logLoginAttempt({
        tenantId: row.tenant_id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        loginMethod: "password",
        success: true,
      });

      toast({
        title: "Login successful",
        description: `Welcome, ${row.employee_name}!`,
      });

      const preferredLanguage = row.preferred_language || "nl";
      const redirectPath = sessionStorage.getItem("redirectAfterLogin");
      if (redirectPath) {
        sessionStorage.removeItem("redirectAfterLogin");
        navigate(redirectPath);
      } else {
        navigate(`/${tenant}/${preferredLanguage}/`);
      }
    } catch (error: any) {
      console.error("Login error:", error);

      if (tenant) {
        const { data: tenantData } = await supabase.rpc("resolve_tenant", { p_slug: tenant, p_domain: null });
        const resolvedTenant = Array.isArray(tenantData) ? tenantData[0] : tenantData;
        if (resolvedTenant?.id) {
          logLoginAttempt({
            tenantId: resolvedTenant.id,
            employeeName: nameOrEmail,
            loginMethod: "password",
            success: false,
            errorMessage: error.message || "Login failed",
          });
        }
      }

      toast({
        title: "Login failed",
        description: error.message || "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke("developer-otp", {
        body: { action: "verify", code: otpCode },
      });

      if (error) throw error;

      if (data?.verified) {
        await supabase.rpc("clear_developer_active_tenant");

        toast({
          title: "Verified!",
          description: "Welcome to the Developer Portal",
        });
        navigate("/dev");
      } else {
        toast({
          title: "Invalid code",
          description: data?.error || "The verification code is invalid or expired",
          variant: "destructive",
        });
        setOtpCode("");
      }
    } catch (error: any) {
      console.error("OTP verify error:", error);
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setResendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke("developer-otp", {
        body: { action: "resend" },
      });

      if (error) throw error;

      toast({
        title: "Code resent",
        description: `A new code has been sent to ${data?.email || "your email"}`,
      });
      setOtpCode("");
    } catch (error: any) {
      toast({
        title: "Failed to resend",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResendingOtp(false);
    }
  };

  // OTP verification screen
  if (otpStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div
          className={`w-full max-w-md space-y-8 transform transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 backdrop-blur-sm">
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Two-Factor Authentication
              </h1>
              <p className="text-slate-400 mt-2">
                A verification code has been sent to{" "}
                <span className="text-blue-400 font-medium">{otpEmail}</span>
              </p>
            </div>
          </div>

          <Card className="bg-white/[0.03] border-white/[0.08] backdrop-blur-xl shadow-2xl">
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="bg-white/[0.06] border-white/[0.12] text-white text-lg w-12 h-14 rounded-xl" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpCode.length !== 6}
              >
                {verifyingOtp ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">Verify & Continue <ArrowRight className="h-4 w-4" /></span>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white"
                  onClick={handleResendOtp}
                  disabled={resendingOtp}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${resendingOtp ? "animate-spin" : ""}`} />
                  Resend code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white"
                  onClick={async () => {
                    otpPendingRef.current = false;
                    await supabase.auth.signOut();
                    setOtpStep(false);
                    setOtpCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-slate-600">
            Code expires in 5 minutes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-4 relative overflow-hidden bg-[#0f1729]">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#1a6b96]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#42A5DB]/15 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-violet-500/10 rounded-full blur-[80px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div
        className={`w-full max-w-[420px] relative z-10 transform transition-all duration-700 ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        {/* Logo Section */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 bg-[#42A5DB]/20 blur-2xl rounded-full scale-150" />
            <img
              src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
              alt="Company Logo"
              className="relative w-16 sm:w-20 h-auto mx-auto rounded-2xl shadow-2xl shadow-black/30"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                AutoMattiOn
              </h1>
              <h1 className="font-extrabold text-2xl sm:text-3xl text-[#42A5DB] tracking-tight">Compass</h1>
            </div>
            <p className="text-[#42A5DB]/70 text-xs sm:text-sm font-medium tracking-wide">
              Guiding your production to perfection
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="bg-white/[0.04] border-white/[0.08] backdrop-blur-xl shadow-2xl shadow-black/20 rounded-2xl">
          <CardHeader className="space-y-1 text-center pb-2 pt-6 sm:pt-8 px-5 sm:px-8">
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">
              {isDeveloperPortal ? "Developer Sign in" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              {isDeveloperPortal
                ? "Sign in to manage tenants"
                : `Sign in to ${tenant || "your workspace"}`}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 sm:space-y-5 px-5 sm:px-8 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                  {isDeveloperPortal ? "Developer Name" : "Gebruikersnaam"}
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="name"
                    type="text"
                    value={nameOrEmail}
                    onChange={(e) => setNameOrEmail(e.target.value)}
                    placeholder={
                      isDeveloperPortal
                        ? "Enter your developer name"
                        : "Enter your employee name"
                    }
                    disabled={loading}
                    className="pl-11 h-11 sm:h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-[#42A5DB]/50 focus:ring-[#42A5DB]/20 rounded-xl transition-all text-sm sm:text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Paswoord
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    className="pl-11 h-11 sm:h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-[#42A5DB]/50 focus:ring-[#42A5DB]/20 rounded-xl transition-all text-sm sm:text-base"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 sm:space-y-4 pt-2 pb-6 sm:pb-8 px-5 sm:px-8">
              <Button
                className="w-full h-11 sm:h-12 bg-gradient-to-r from-[#1a6b96] to-[#42A5DB] hover:from-[#195f85] hover:to-[#3994c4] text-white font-semibold rounded-xl shadow-lg shadow-[#1a6b96]/30 hover:shadow-xl hover:shadow-[#1a6b96]/40 transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              {!isDeveloperPortal && tenant && (
                <Link
                  to={`/${tenant}/forgot-password`}
                  className="text-xs text-center text-slate-400 hover:text-[#42A5DB] transition-colors"
                >
                  Forgot your password?
                </Link>
              )}
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-600 mt-6">
          Secure access to your production planning system
        </p>
      </div>
    </div>
  );
};

export default Login;
