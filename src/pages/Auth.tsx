import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'react-toastify';
import api from '@/src/lib/api';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { saveSession } from '@/src/lib/session';

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
        className={`pr-11 ${className}`}
      />
      <button
        type="button"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        onClick={() => setShowPassword((current) => !current)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#EEF6FF] hover:text-[#1F2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F9CF9]"
      >
        <i className={`ki-outline ${showPassword ? 'ki-eye-slash' : 'ki-eye'} text-base`} aria-hidden="true" />
      </button>
    </div>
  );
}

type AuthNoteProps = {
  icon: string;
  title: string;
  description: string;
};

function AuthNote({ icon, title, description }: AuthNoteProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#EAFBF0] bg-[#EAFBF0] p-3 text-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#34C759]">
        <i className={`ki-outline ${icon} text-base`} aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-[#1F2937]">{title}</p>
        <p className="mt-0.5 text-[#6B7280]">{description}</p>
      </div>
    </div>
  );
}

export default function Auth() {
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const toastId = toast.loading('Sending verification OTP...');

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await api.post('/auth/register', data);
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
        type: 'success',
        isLoading: false,
        autoClose: 3500,
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
        autoClose: 3500,
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
      const response = await api.post('/auth/register/verify-otp', { email: registerEmail, otp: otpCode });
      saveSession(response.data.token, response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: 3500,
      });
      navigate('/');
    } catch (error: any) {
      const message = getApiMessage(error, 'Failed to verify OTP.');
      toast.update(toastId, {
        render: message,
        type: 'error',
        isLoading: false,
        autoClose: 3500,
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
      const response = await api.post('/auth/login', data);
      saveSession(response.data.token, response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome back, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: 3500,
      });
      navigate('/'); 
    } catch (error: any) {
      const message = getApiMessage(error, 'Failed to login.');
      toast.update(toastId, {
        render: message,
        type: 'error',
        isLoading: false,
        autoClose: 3500,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Sending password reset OTP...');
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') || '').trim();

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setResetEmail(email);
      setOtpCode('');
      setResetPassword('');
      setLoginStep('reset');
      setResendTimer(300);
      e.currentTarget.reset();
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
        type: 'success',
        isLoading: false,
        autoClose: 3500,
      });
    } catch (error: any) {
      toast.update(toastId, {
        render: getApiMessage(error, 'Failed to send password reset OTP.'),
        type: 'error',
        isLoading: false,
        autoClose: 3500,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Resetting password...');

    try {
      const response = await api.post('/auth/reset-password', { email: resetEmail, otp: otpCode, password: resetPassword });
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'Password reset successfully.'),
        type: 'success',
        isLoading: false,
        autoClose: 3500,
      });
      setOtpCode('');
      setResetPassword('');
      setResetEmail('');
      setResendTimer(0);
      e.currentTarget.reset();
      setLoginStep('login');
    } catch (error: any) {
      toast.update(toastId, {
        render: getApiMessage(error, 'Failed to reset password.'),
        type: 'error',
        isLoading: false,
        autoClose: 3500,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (!lastRegisterForm) return;

    setLoading(true);
    const toastId = toast.loading('Resending verification OTP...');
    api.post('/auth/register', lastRegisterForm)
      .then((response) => {
        setOtpCode('');
        setResendTimer(300);
        toast.update(toastId, {
          render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
          type: 'success',
          isLoading: false,
          autoClose: 3500,
        });
      })
      .catch((error) => {
        toast.update(toastId, {
          render: getApiMessage(error, 'Failed to resend OTP.'),
          type: 'error',
          isLoading: false,
          autoClose: 3500,
        });
      })
      .finally(() => setLoading(false));
  };

  const handleResendResetOTP = () => {
    if (!resetEmail) return;

    setLoading(true);
    const toastId = toast.loading('Resending password reset OTP...');
    api.post('/auth/forgot-password', { email: resetEmail })
      .then((response) => {
        setOtpCode('');
        setResendTimer(300);
        toast.update(toastId, {
          render: getApiSuccessMessage(response.data, 'OTP sent to your email.'),
          type: 'success',
          isLoading: false,
          autoClose: 3500,
        });
      })
      .catch((error) => {
        toast.update(toastId, {
          render: getApiMessage(error, 'Failed to resend OTP.'),
          type: 'error',
          isLoading: false,
          autoClose: 3500,
        });
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] p-4 text-[#1F2937] lg:p-8">
      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-4 z-10"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      >
        <i className={`ki-solid ${theme === 'dark' ? 'ki-sun' : 'ki-moon'} text-base`} aria-hidden="true" />
      </Button>
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_30px_90px_rgba(31,41,55,0.12)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className="relative hidden bg-cover bg-center p-10 text-white lg:flex lg:flex-col lg:justify-between"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #4F9CF9, #34C759)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-xl font-black text-[#4F9CF9]">F</div>
            <div>
              <h1 className="text-2xl font-black">FinSight AI</h1>
              <p className="text-sm text-white/85">Financial clarity, faster.</p>
            </div>
          </div>

          <div className="max-w-lg space-y-5">
            <p className="text-sm font-semibold uppercase text-white/85">Expense command center</p>
            <h2 className="text-5xl font-black leading-tight">Track spending, import bills, and ask AI what changed.</h2>
            <div className="grid grid-cols-3 gap-3 pt-4">
              {[
                ['ki-receipt', 'Bills'],
                ['ki-stars', 'Insights'],
                ['ki-shield-tick', 'Secure'],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <i className={`ki-outline ${icon} text-xl text-white/85`} aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md space-y-7">
            <div>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#4F9CF9] text-lg font-black text-white lg:hidden">F</div>
              <p className="text-sm font-semibold uppercase text-[#34C759]">Welcome</p>
              <h1 className="mt-2 text-3xl font-black text-[#1F2937]">FinSight AI</h1>
              <p className="mt-2 text-[#6B7280]">Login with your password or verify your email to create a new account.</p>
            </div>

            <Tabs
              value={currentTab}
              onValueChange={(value) => {
                setCurrentTab(value as 'login' | 'register');
                setOtpCode('');
              }}
              className="w-full"
            >
              <TabsList className="mb-6 grid w-full grid-cols-2 rounded-lg bg-[#EEF6FF] p-1">
                <TabsTrigger
                  value="login"
                  className="h-9 text-[#6B7280] hover:text-[#1F2937] data-active:bg-[#4F9CF9] data-active:text-white"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="h-9 text-[#6B7280] hover:text-[#1F2937] data-active:bg-[#4F9CF9] data-active:text-white"
                >
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Card className="border-[#E5E7EB] shadow-none">
                  {loginStep === 'login' ? (
                    <form onSubmit={handleLogin}>
                      <CardHeader>
                        <CardTitle className="text-xl font-bold">Welcome back</CardTitle>
                        <CardDescription>Enter your email and password to continue.</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <AuthNote
                          icon="ki-lock-2"
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
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">Password</Label>
                          <PasswordInputWithToggle
                            inputId="login-password"
                            name="password"
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

                      <CardFooter>
                        <Button className="w-full bg-[#4F9CF9] text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
                          {loading ? 'Logging in...' : 'Login'}
                        </Button>
                      </CardFooter>
                    </form>
                  ) : loginStep === 'forgot' ? (
                    <form onSubmit={handleForgotPassword}>
                      <CardHeader>
                        <CardTitle className="text-xl font-bold">Reset password</CardTitle>
                        <CardDescription>Enter your registered email to receive an OTP.</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <AuthNote
                          icon="ki-sms"
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
                            required
                          />
                        </div>
                      </CardContent>

                      <CardFooter className="grid gap-3">
                        <Button className="w-full bg-[#4F9CF9] text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
                          {loading ? 'Sending OTP...' : 'Send Reset OTP'}
                        </Button>
                        <Button
                          className="w-full"
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
                      <CardHeader>
                        <CardTitle className="text-xl font-bold">Apply new password</CardTitle>
                        <CardDescription>Enter the 6-digit code sent to {resetEmail}.</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <AuthNote
                          icon="ki-shield-tick"
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
                            <i className="ki-outline ki-left text-sm" aria-hidden="true" />
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

                      <CardFooter>
                        <Button className="w-full bg-[#4F9CF9] text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading || otpCode.length !== 6}>
                          {loading ? 'Resetting...' : 'Reset Password'}
                        </Button>
                      </CardFooter>
                    </form>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="register">
                <Card className="border-[#E5E7EB] shadow-none">
                  {registerStep === 'details' ? (
                    <form onSubmit={handleRegister}>
                      <CardHeader>
                        <CardTitle className="text-xl font-bold">Create account</CardTitle>
                        <CardDescription>Verify your email, then use this password for login.</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reg-name">Full Name</Label>
                          <Input id="reg-name" name="name" placeholder="John Doe" required minLength={2} />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reg-email">Email</Label>
                          <Input id="reg-email" name="email" type="email" placeholder="name@example.com" required />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reg-password">Password</Label>
                          <PasswordInputWithToggle inputId="reg-password" name="password" required />
                        </div>
                      </CardContent>

                      <CardFooter>
                        <Button className="w-full bg-[#4F9CF9] text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
                          {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                        </Button>
                      </CardFooter>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyRegisterOTP}>
                      <CardHeader>
                        <CardTitle className="text-xl font-bold">Verify email</CardTitle>
                        <CardDescription>Enter the 6-digit code sent to {registerEmail}</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
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

                      <CardFooter>
                        <Button className="w-full bg-[#4F9CF9] text-white hover:bg-[#3F8BE5]" type="submit" disabled={loading || otpCode.length !== 6}>
                          {loading ? 'Verifying...' : 'Verify & Create Account'}
                        </Button>
                      </CardFooter>
                    </form>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
