import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-toastify';
import api, { apiBaseUrl } from '@/src/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiMessage, getApiSuccessMessage, TOAST_AUTO_CLOSE_MS } from '@/src/lib/toastMessages';
import { saveSession } from '@/src/lib/session';
import { cn } from '@/lib/utils';
import {
  RiArrowLeftLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileList3Line,
  RiLock2Line,
  RiLoginCircleLine,
  RiMailLine,
  RiMoonLine,
  RiShieldKeyholeLine,
  RiShieldUserLine,
  RiSparkling2Line,
  RiSunLine,
  RiUserAddLine,
} from 'react-icons/ri';

type PasswordInputProps = React.ComponentProps<typeof Input> & {
  inputId: string;
};

function PasswordInputWithToggle({ inputId, className = '', ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        id={inputId}
        type={showPassword ? 'text' : 'password'}
        className={`pr-12 ${className}`}
      />
      <button
        type="button"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        onClick={() => setShowPassword((current) => !current)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#EEF6FF] hover:text-[#1F2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F9CF9]"
      >
        {showPassword ? <RiEyeOffLine className="text-base" aria-hidden="true" /> : <RiEyeLine className="text-base" aria-hidden="true" />}
      </button>
    </div>
  );
}

type AuthNoteProps = {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  title: string;
  description: string;
};

const isAppleMobileDevice = () => {
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const getGoogleRedirectLoginUri = () => {
  const redirectPath = `${apiBaseUrl.replace(/\/$/, '')}/auth/google/redirect`;
  return new URL(redirectPath, window.location.origin).toString();
};

const decodeGoogleRedirectPayload = (payload: string) => {
  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4), '=');
  const bytes = Uint8Array.from(atob(paddedPayload), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

function AuthNote({ icon: Icon, title, description }: AuthNoteProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#EAFBF0] bg-[#EAFBF0] p-3 text-sm sm:p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#34C759]">
        <Icon className="text-base" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[#1F2937]">{title}</p>
        <p className="mt-0.5 text-[#6B7280]">{description}</p>
      </div>
    </div>
  );
}

export default function Auth() {
  const queryClient = useQueryClient();
  const { mutateAsync: authRequest } = useMutation({
    mutationFn: ({ path, payload }: { path: string; payload: unknown }) => api.post(path, payload),
  });
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => (
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  ));
  const [currentTab, setCurrentTab] = useState<'login' | 'register'>('login');
  const [registerStep, setRegisterStep] = useState<'details' | 'verify'>('details');
  const [loginStep, setLoginStep] = useState<'login' | 'forgot' | 'reset'>('login');
  const [otpCode, setOtpCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();

  // OTP resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);
  const [registerEmail, setRegisterEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [lastRegisterForm, setLastRegisterForm] = useState<Record<string, FormDataEntryValue> | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const googleAuthPayload = params.get('google_auth');
    const googleAuthError = params.get('google_auth_error');

    if (!googleAuthPayload && !googleAuthError) return;

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);

    if (googleAuthError) {
      toast.error(googleAuthError);
      return;
    }

    try {
      const session = decodeGoogleRedirectPayload(googleAuthPayload || '');

      if (!session.token || !session.user) {
        throw new Error('Google sign-in did not return a valid session.');
      }

      queryClient.clear();
      saveSession(session.token, session.user, session.expiresAt ?? null);
      toast.success(`Welcome, ${session.user.name}!`);
      navigate('/', { replace: true });
    } catch {
      toast.error('Failed to finish Google sign-in.');
    }
  }, [navigate, queryClient]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleGoogleCredential = useCallback(async (credential?: string) => {
    if (!credential) {
      toast.error('Google sign-in did not return a credential.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Signing in with Google...');

    try {
      const response = await authRequest({ path: '/auth/google', payload: { credential } });
      queryClient.clear();
      saveSession(response.data.token, response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      navigate('/');
    } catch (error: any) {
      toast.update(toastId, {
        render: getApiMessage(error, 'Failed to sign in with Google.'),
        type: 'error',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
    } finally {
      setLoading(false);
    }
  }, [authRequest, navigate, queryClient]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;

      googleButtonRef.current.innerHTML = '';
      const useRedirectMode = isAppleMobileDevice();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => handleGoogleCredential(response.credential),
        itp_support: true,
        ...(useRedirectMode ? {
          ux_mode: 'redirect',
          login_uri: getGoogleRedirectLoginUri(),
        } : {}),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: currentTab === 'register' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        width: Math.min(384, Math.floor(googleButtonRef.current.getBoundingClientRect().width || 384)),
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton, { once: true });
      return () => existingScript.removeEventListener('load', renderGoogleButton);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);
  }, [currentTab, googleClientId, handleGoogleCredential]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const toastId = toast.loading('Sending verification OTP...');

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await authRequest({ path: '/auth/register', payload: data });
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      setRegisterEmail(data.email as string);
      setLastRegisterForm(data);
      setOtpCode('');
      setRegisterStep('verify');
      setResendTimer(300);
    } catch (error: any) {
      const message = getApiMessage(error, 'Failed to create account.');
      toast.update(toastId, {
        render: message,
        type: 'error',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegisterOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Verifying email...');
    try {
      const response = await authRequest({ path: '/auth/register/verify-otp', payload: { email: registerEmail, otp: otpCode } });
      queryClient.clear();
      saveSession(response.data.token, response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      navigate('/');
    } catch (error: any) {
      const message = getApiMessage(error, 'Failed to verify OTP.');
      toast.update(toastId, {
        render: message,
        type: 'error',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });

    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Logging in...');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await authRequest({ path: '/auth/login', payload: data });
      queryClient.clear();
      saveSession(response.data.token, response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome back, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      navigate('/'); 
    } catch (error: any) {
      const message = getApiMessage(error, 'Failed to login.');
      toast.update(toastId, {
        render: message,
        type: 'error',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    const toastId = toast.loading('Sending password reset OTP...');
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();

    try {
      const response = await authRequest({ path: '/auth/forgot-password', payload: { email } });
      setResetEmail(email);
      setOtpCode('');
      setResetPassword('');
      setLoginStep('reset');
      setResendTimer(300);
      form.reset();
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
    } catch (error: any) {
      toast.update(toastId, {
        render: getApiMessage(error, 'Failed to send password reset OTP.'),
        type: 'error',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    const toastId = toast.loading('Resetting password...');

    try {
      const response = await authRequest({ path: '/auth/reset-password', payload: { email: resetEmail, otp: otpCode, password: resetPassword } });
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'Password reset successfully.'),
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      setOtpCode('');
      setResetPassword('');
      setResetEmail('');
      setResendTimer(0);
      form.reset();
      setLoginStep('login');
    } catch (error: any) {
      toast.update(toastId, {
        render: getApiMessage(error, 'Failed to reset password.'),
        type: 'error',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (!lastRegisterForm) return;

    setLoading(true);
    const toastId = toast.loading('Resending verification OTP...');
    authRequest({ path: '/auth/register', payload: lastRegisterForm })
      .then((response) => {
        setOtpCode('');
        setResendTimer(300);
        toast.update(toastId, {
          render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
          type: 'success',
          isLoading: false,
          autoClose: TOAST_AUTO_CLOSE_MS,
        });
      })
      .catch((error) => {
        toast.update(toastId, {
          render: getApiMessage(error, 'Failed to resend OTP.'),
          type: 'error',
          isLoading: false,
          autoClose: TOAST_AUTO_CLOSE_MS,
        });
      })
      .finally(() => setLoading(false));
  };

  const handleResendResetOTP = () => {
    if (!resetEmail) return;

    setLoading(true);
    const toastId = toast.loading('Resending password reset OTP...');
    authRequest({ path: '/auth/forgot-password', payload: { email: resetEmail } })
      .then((response) => {
        setOtpCode('');
        setResendTimer(300);
        toast.update(toastId, {
          render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
          type: 'success',
          isLoading: false,
          autoClose: TOAST_AUTO_CLOSE_MS,
        });
      })
      .catch((error) => {
        toast.update(toastId, {
          render: getApiMessage(error, 'Failed to resend OTP.'),
          type: 'error',
          isLoading: false,
          autoClose: TOAST_AUTO_CLOSE_MS,
        });
      })
      .finally(() => setLoading(false));
  };

  const authInputClass = "h-10 rounded-lg px-3 text-sm";
  const passwordInputClass = "h-10 rounded-lg px-3 pr-12 text-sm";
  const cardHeaderClass = "gap-0.5 px-4 pt-4 sm:px-5 sm:pt-4";
  const cardContentClass = "space-y-3 px-4 sm:px-5";
  const cardFooterClass = "px-4 pb-4 sm:px-5 sm:pb-4";

  return (
    <div className="flex min-h-dvh items-start justify-center bg-[#FAFBFC] p-4 text-[#1F2937] sm:p-6 lg:items-center lg:overflow-hidden lg:p-4">
      <Button
        variant="outline"
        size="icon"
        className="fixed right-4 top-4 z-10 bg-white/90 shadow-sm backdrop-blur"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <RiSunLine className="text-base" aria-hidden="true" /> : <RiMoonLine className="text-base" aria-hidden="true" />}
      </Button>
      <div className="mx-auto grid w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_30px_90px_rgba(31,41,55,0.12)] sm:max-w-lg lg:h-[calc(100vh-2rem)] lg:max-w-6xl lg:grid-cols-[1.05fr_0.95fr] lg:overflow-hidden lg:rounded-xl">
        <div
          className="relative hidden bg-cover bg-center p-7 text-white lg:flex lg:flex-col lg:justify-between xl:p-8"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #4F9CF9, #34C759)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-[#4F9CF9]">F</div>
            <div>
              <h1 className="text-xl font-black">Finovo AI</h1>
              <p className="text-sm text-white/85">Financial clarity, faster.</p>
            </div>
          </div>

          <div className="max-w-lg space-y-4">
            <p className="text-sm font-semibold uppercase text-white/85">Expense command center</p>
            <h2 className="text-4xl font-black leading-tight xl:text-[2.65rem]">Track spending, import bills, and ask AI what changed.</h2>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { Icon: RiFileList3Line, label: 'Bills' },
                { Icon: RiSparkling2Line, label: 'Insights' },
                { Icon: RiShieldKeyholeLine, label: 'Secure' },
              ].map(({ Icon, label }) => (
                <div key={label} className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur">
                  <Icon className="text-lg text-white/85" aria-hidden="true" />
                  <p className="mt-1.5 text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-[radial-gradient(circle_at_top,#EEF6FF,transparent_42%)] px-4 py-8 sm:px-8 lg:min-h-0 lg:bg-none lg:p-7 xl:p-8">
          <div className="flex w-full max-w-md flex-col items-center space-y-5">
            <div className="w-full text-center lg:text-left">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4F9CF9] text-lg font-black text-white shadow-[0_12px_30px_rgba(79,156,249,0.28)] lg:hidden">F</div>
              <p className="text-sm font-semibold uppercase text-[#34C759]">Welcome</p>
              <h1 className="mt-1 text-3xl font-black leading-tight text-[#1F2937] sm:text-4xl lg:text-3xl">Finovo AI</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#6B7280] lg:mx-0 lg:mt-1">Login with your password or verify your email to create a new account.</p>
            </div>

            <div className="mx-auto w-full max-w-sm space-y-3">
                <div className="grid h-11 w-full grid-cols-2 overflow-hidden rounded-lg bg-[#EEF6FF] p-1 dark:bg-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('login');
                      setOtpCode('');
                    }}
                    className={cn(
                      "h-9 rounded-md text-sm font-bold transition-colors",
                      currentTab === 'login'
                        ? "bg-[#4F9CF9] text-white"
                        : "text-[#6B7280] hover:text-[#1F2937] dark:text-[#CBD5E1] dark:hover:text-white"
                    )}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('register');
                      setOtpCode('');
                    }}
                    className={cn(
                      "h-9 rounded-md text-sm font-bold transition-colors",
                      currentTab === 'register'
                        ? "bg-[#4F9CF9] text-white"
                        : "text-[#6B7280] hover:text-[#1F2937] dark:text-[#CBD5E1] dark:hover:text-white"
                    )}
                  >
                    Register
                  </button>
                </div>

                <div className="space-y-3">
                  {googleClientId ? (
                    <div className="flex min-h-10 w-full justify-center overflow-hidden" ref={googleButtonRef} />
                  ) : (
                    <Button className="h-10 w-full" type="button" variant="outline" disabled>
                      Google sign-in not configured
                    </Button>
                  )}
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase text-[#94A3B8]">
                    <span className="h-px flex-1 bg-[#E5E7EB]" />
                    <span>or</span>
                    <span className="h-px flex-1 bg-[#E5E7EB]" />
                  </div>
                </div>

                {currentTab === 'login' ? (
                  <Card className="relative z-0 w-full rounded-xl border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(31,41,55,0.08)] dark:border-[#334155] dark:bg-[#111827]">
                  {loginStep === 'login' ? (
                    <form onSubmit={handleLogin}>
                      <CardHeader className={cardHeaderClass}>
                        <CardTitle className="text-xl font-bold">Welcome back</CardTitle>
                        <CardDescription>Enter your email and password to continue.</CardDescription>
                      </CardHeader>

                      <CardContent className={cardContentClass}>
                        <AuthNote
                          icon={RiLock2Line}
                          title="Password login"
                          description="Use the password you created after verifying your email."
                        />
                        <div className="space-y-2">
                          <Label htmlFor="login-email">Email</Label>
                          <Input
                            id="login-email"
                            name="email"
                            type="email"
                            placeholder="name@example.com"
                            className={authInputClass}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">Password</Label>
                          <PasswordInputWithToggle
                            inputId="login-password"
                            name="password"
                            className={passwordInputClass}
                            required
                          />
                        </div>
                        <div className="text-right text-sm">
                          <button
                            type="button"
                            onClick={() => {
                              setLoginStep('forgot');
                              setOtpCode('');
                            }}
                            className="font-semibold text-[#34C759] underline hover:text-[#34C759]"
                          >
                            Forgot password?
                          </button>
                        </div>
                      </CardContent>

                      <CardFooter className={cardFooterClass}>
                        <Button className="h-10 w-full bg-[#4F9CF9] text-sm text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
                          <RiLoginCircleLine className="mr-2 text-base" aria-hidden="true" />
                          {loading ? 'Logging in...' : 'Login'}
                        </Button>
                      </CardFooter>
                    </form>
                  ) : loginStep === 'forgot' ? (
                    <form onSubmit={handleForgotPassword}>
                      <CardHeader className={cardHeaderClass}>
                        <CardTitle className="text-xl font-bold">Reset password</CardTitle>
                        <CardDescription>Enter your registered email to receive an OTP.</CardDescription>
                      </CardHeader>

                      <CardContent className={cardContentClass}>
                        <AuthNote
                          icon={RiMailLine}
                          title="Reset by email"
                          description="We will send a 6-digit OTP to your registered email."
                        />
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input
                            id="reset-email"
                            name="email"
                            type="email"
                            placeholder="name@example.com"
                            className={authInputClass}
                            required
                          />
                        </div>
                      </CardContent>

                      <CardFooter className={`${cardFooterClass} grid gap-3`}>
                        <Button className="h-10 w-full bg-[#4F9CF9] text-sm text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
                          <RiMailLine className="mr-2 text-base" aria-hidden="true" />
                          {loading ? 'Sending OTP...' : 'Send Reset OTP'}
                        </Button>
                        <Button
                          className="h-10 w-full"
                          type="button"
                          variant="outline"
                          onClick={() => setLoginStep('login')}
                          disabled={loading}
                        >
                          Back to Login
                        </Button>
                      </CardFooter>
                    </form>
                  ) : (
                    <form onSubmit={handleResetPassword}>
                      <CardHeader className={cardHeaderClass}>
                        <CardTitle className="text-xl font-bold">Apply new password</CardTitle>
                        <CardDescription>Enter the 6-digit code sent to {resetEmail}.</CardDescription>
                      </CardHeader>

                      <CardContent className={cardContentClass}>
                        <AuthNote
                          icon={RiShieldUserLine}
                          title="OTP verified reset"
                          description="Enter the code from your email, then choose a fresh password."
                        />
                        <div className="space-y-2">
                          <Label htmlFor="reset-otp">OTP Code</Label>
                          <Input
                            id="reset-otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            className={authInputClass}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <PasswordInputWithToggle
                            inputId="new-password"
                            name="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="New password"
                            className={passwordInputClass}
                            required
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm text-[#6B7280]">
                          <button
                            type="button"
                            onClick={() => {
                              setLoginStep('forgot');
                              setOtpCode('');
                              setResetPassword('');
                              setResetEmail('');
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-[#1F2937] underline hover:text-[#1F2937]"
                          >
                            <RiArrowLeftLine className="text-sm" aria-hidden="true" />
                            Edit email
                          </button>
                          {resendTimer > 0 ? (
                            <span>Resend in {resendTimer}s</span>
                          ) : (
                            <button type="button" onClick={handleResendResetOTP} className="font-semibold text-[#34C759] underline hover:text-[#34C759]">
                              Resend OTP
                            </button>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className={cardFooterClass}>
                        <Button className="h-10 w-full bg-[#4F9CF9] text-sm text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading || otpCode.length !== 6}>
                          <RiShieldUserLine className="mr-2 text-base" aria-hidden="true" />
                          {loading ? 'Resetting...' : 'Reset Password'}
                        </Button>
                      </CardFooter>
                    </form>
                  )}
                  </Card>
                ) : null}

                {currentTab === 'register' ? (
                  <Card className="relative z-0 w-full rounded-xl border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(31,41,55,0.08)] dark:border-[#334155] dark:bg-[#111827]">
                  {registerStep === 'details' ? (
                    <form onSubmit={handleRegister}>
                      <CardHeader className={cardHeaderClass}>
                        <CardTitle className="text-xl font-bold">Create account</CardTitle>
                        <CardDescription>Verify your email, then use this password for login.</CardDescription>
                      </CardHeader>

                      <CardContent className={cardContentClass}>
                        <div className="space-y-2">
                          <Label htmlFor="reg-name">Full Name</Label>
                          <Input id="reg-name" name="name" placeholder="John Doe" className={authInputClass} required minLength={2} />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reg-email">Email</Label>
                          <Input id="reg-email" name="email" type="email" placeholder="name@example.com" className={authInputClass} required />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reg-password">Password</Label>
                          <PasswordInputWithToggle inputId="reg-password" name="password" className={passwordInputClass} required />
                        </div>
                      </CardContent>

                      <CardFooter className={cardFooterClass}>
                        <Button className="h-10 w-full bg-[#4F9CF9] text-sm text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
                          <RiUserAddLine className="mr-2 text-base" aria-hidden="true" />
                          {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                        </Button>
                      </CardFooter>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyRegisterOTP}>
                      <CardHeader className={cardHeaderClass}>
                        <CardTitle className="text-xl font-bold">Verify email</CardTitle>
                        <CardDescription>Enter the 6-digit code sent to {registerEmail}</CardDescription>
                      </CardHeader>

                      <CardContent className={cardContentClass}>
                        <div className="space-y-2">
                          <Label htmlFor="reg-otp">OTP Code</Label>
                          <Input
                            id="reg-otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            className={authInputClass}
                            required
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm text-[#6B7280]">
                          <button
                            type="button"
                            onClick={() => {
                              setRegisterStep('details');
                              setOtpCode('');
                            }}
                            className="font-semibold text-[#1F2937] underline hover:text-[#1F2937]"
                          >
                            Edit details
                          </button>
                          {resendTimer > 0 ? (
                            <span>Resend in {resendTimer}s</span>
                          ) : (
                            <button type="button" onClick={handleResendOTP} className="font-semibold text-[#34C759] underline hover:text-[#34C759]">
                              Resend OTP
                            </button>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className={cardFooterClass}>
                        <Button className="h-10 w-full bg-[#4F9CF9] text-sm text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading || otpCode.length !== 6}>
                          <RiShieldUserLine className="mr-2 text-base" aria-hidden="true" />
                          {loading ? 'Verifying...' : 'Verify & Create Account'}
                        </Button>
                      </CardFooter>
                    </form>
                  )}
                  </Card>
                ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
