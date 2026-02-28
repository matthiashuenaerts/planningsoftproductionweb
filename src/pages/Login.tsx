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
import { User, Lock, Shield, RefreshCw } from "lucide-react";
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
  const { login, isAuthenticated, isDeveloper } = useAuth();
  const location = useLocation();
  const { tenant } = useParams<{ tenant: string }>();

  const isDeveloperPortal = location.pathname.startsWith("/dev/login");

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if already authenticated (but not if waiting for OTP)
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

  // Global Enter key handler
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

      // Developer portal login with 2FA
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

        // Mark OTP pending BEFORE login to prevent redirect race condition
        otpPendingRef.current = true;

        // Authenticate with Supabase Auth first
        const loginResult = await login(devRow.email, password);
        if (loginResult.error) {
          otpPendingRef.current = false;
          throw new Error(loginResult.error);
        }

        // Send OTP for 2FA
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
          // Sign out since 2FA failed
          otpPendingRef.current = false;
          await supabase.auth.signOut();
        }

        return;
      }

      // Tenant portal login
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

      // If user is a developer logging into a tenant, activate that tenant context
      // We need to check roles - use a quick query
      const { data: devRoleCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", row.employee_id)
        .eq("role", "developer" as any)
        .maybeSingle();

      if (devRoleCheck) {
        // Developer logging into a tenant - set active tenant
        await supabase.rpc("set_developer_active_tenant", {
          p_tenant_id: row.tenant_id,
        });
      }

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
        // Clear developer active tenant for dev portal access
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

  // OTP verification screen for developer 2FA
  if (otpStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div
          className={`w-full max-w-md space-y-8 transform transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20">
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Two-Factor Authentication
              </h1>
              <p className="text-slate-400 mt-2">
                A verification code has been sent to{" "}
                <span className="text-blue-400">{otpEmail}</span>
              </p>
            </div>
          </div>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="bg-white/10 border-white/20 text-white text-lg w-12 h-14" />
                    <InputOTPSlot index={1} className="bg-white/10 border-white/20 text-white text-lg w-12 h-14" />
                    <InputOTPSlot index={2} className="bg-white/10 border-white/20 text-white text-lg w-12 h-14" />
                    <InputOTPSlot index={3} className="bg-white/10 border-white/20 text-white text-lg w-12 h-14" />
                    <InputOTPSlot index={4} className="bg-white/10 border-white/20 text-white text-lg w-12 h-14" />
                    <InputOTPSlot index={5} className="bg-white/10 border-white/20 text-white text-lg w-12 h-14" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpCode.length !== 6}
              >
                {verifyingOtp ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  "Verify & Continue"
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

          <p className="text-center text-xs text-slate-500">
            Code expires in 5 minutes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[fade-in_2s_ease-out]"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[fade-in_2s_ease-out_0.5s_both]"></div>
        <div className="absolute top-40 left-40 w-60 h-60 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[fade-in_2s_ease-out_1s_both]"></div>
      </div>

      <div
        className={`w-full max-w-md space-y-8 relative z-10 transform transition-all duration-1000 ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0"
        }`}
      >
        {/* Logo Section */}
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <img
              src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
              alt="Company Logo"
              className="relative w-32 h-auto mx-auto rounded-lg shadow-lg hover:scale-105 transition-transform duration-300"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <h1 className="font-bold text-4xl text-[#195F85]">
                AutoMattiOn
              </h1>
              <h1 className="font-bold text-4xl text-[#42A5DB]">Compass</h1>
            </div>

            <p className="text-[#42A5DB] text-lg font-bold">
              Guiding your production to perfection!
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl ring-1 ring-gray-200/50 hover:shadow-3xl transition-all duration-500">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              {isDeveloperPortal ? "Developer Sign in" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {isDeveloperPortal
                ? "Sign in to manage tenants"
                : `Sign in to ${tenant || "your workspace"}`}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-gray-700"
                >
                  {isDeveloperPortal ? "Developer Name" : "Gebruikersnaam"}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                    className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  Paswoord
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-6 pb-8">
              <Button
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Sign in"
                )}
              </Button>

              {!isDeveloperPortal && tenant && (
                <Link
                  to={`/${tenant}/forgot-password`}
                  className="text-sm text-center text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot your password?
                </Link>
              )}
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Secure access to your production planning system</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
