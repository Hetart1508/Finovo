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

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'login' | 'register'>('login');
  const [loginError, setLoginError] = useState('');
  const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();

  const clearLoginError = () => setLoginError('');

  // OTP resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);
  const [otpEmail, setOtpEmail] = useState('');

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const toastId = toast.loading('Creating account...');

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await api.post('/auth/register', data);
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'Account created successfully.'),
        type: 'success',
        isLoading: false,
        autoClose: 3500,
      });
      setCurrentTab('login');
      setOtpEmail(data.email as string);
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

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Sending OTP...');
    try {
      const response = await api.post('/auth/send-otp', { email: otpEmail });
      setOtpStep('verify');
      setResendTimer(300);
      toast.update(toastId, {
        render: getApiSuccessMessage(response.data, 'OTP sent successfully'),
        type: 'success',
        isLoading: false,
        autoClose: 3500,
      });
    } catch (error: any) {
      const message = getApiMessage(error, 'Failed to send OTP.');
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

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Verifying OTP...');
    try {
      const response = await api.post('/auth/verify-otp', { email: otpEmail, otp: otpCode });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.update(toastId, {
        render: `Welcome back, ${response.data.user.name}!`,
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

if (message.toLowerCase().includes('otp')) {
  setOtpStep('email');
}

    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    handleSendOTP({ preventDefault: () => {} } as any);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-950 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-xl bg-white shadow-[0_30px_90px_rgba(2,6,23,0.35)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className="relative hidden bg-cover bg-center p-10 text-white lg:flex lg:flex-col lg:justify-between"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(20,83,45,0.7)), url(/src/assets/auth-bg.jpg)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-400 text-xl font-black text-slate-950">F</div>
            <div>
              <h1 className="text-2xl font-black">FinSight AI</h1>
              <p className="text-sm text-emerald-100">Financial clarity, faster.</p>
            </div>
          </div>

          <div className="max-w-lg space-y-5">
            <p className="text-sm font-semibold uppercase text-emerald-200">Expense command center</p>
            <h2 className="text-5xl font-black leading-tight">Track spending, import bills, and ask AI what changed.</h2>
            <div className="grid grid-cols-3 gap-3 pt-4">
              {[
                ['bi-receipt-cutoff', 'Bills'],
                ['bi-graph-up-arrow', 'Insights'],
                ['bi-shield-check', 'Secure'],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <i className={`bi ${icon} text-xl text-emerald-200`} />
                  <p className="mt-2 text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md space-y-7">
            <div>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-lg font-black text-emerald-300 lg:hidden">F</div>
              <p className="text-sm font-semibold uppercase text-emerald-600">Welcome</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">FinSight AI</h1>
              <p className="mt-2 text-slate-500">Login with OTP or create a new account to continue.</p>
            </div>

            <Tabs
              value={currentTab}
              onValueChange={(value) => {
                setCurrentTab(value as 'login' | 'register');
                clearLoginError();
              }}
              className="w-full"
            >
              <TabsList className="mb-6 grid w-full grid-cols-2 rounded-lg bg-slate-100 p-1">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Card className="border-slate-200 shadow-none">
                  {otpStep === 'email' ? (
                    <form onSubmit={handleSendOTP}>
                      <CardHeader>
                        <CardTitle className="text-xl font-bold">Welcome back</CardTitle>
                        <CardDescription>Enter your email to receive OTP.</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={otpEmail}
                            onChange={(e) => setOtpEmail(e.target.value)}
                            required
                          />
                        </div>
                      </CardContent>

                      <CardFooter>
                        <Button className="w-full bg-slate-950 text-white hover:bg-slate-800" type="submit" disabled={loading || !otpEmail}>
                          {loading ? 'Sending...' : 'Send OTP'}
                        </Button>
                      </CardFooter>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOTP}>
                      <CardHeader>
                        <CardTitle className="text-xl font-bold">Verify OTP</CardTitle>
                        <CardDescription>Enter the 6-digit code sent to {otpEmail}</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="otp">OTP Code</Label>
                          <Input
                            id="otp"
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            required
                          />
                        </div>

                        <div className="text-center text-sm text-slate-500">
                          Didn't receive?{' '}
                          {resendTimer > 0 ? (
                            `Resend in ${resendTimer}s`
                          ) : (
                            <button type="button" onClick={handleResendOTP} className="font-semibold text-emerald-700 hover:text-emerald-600 underline">
                              Resend OTP
                            </button>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter>
                        <Button className="w-full bg-slate-950 text-white hover:bg-slate-800" type="submit" disabled={loading || otpCode.length !== 6}>
                          {loading ? 'Verifying...' : 'Verify & Login'}
                        </Button>
                      </CardFooter>
                    </form>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="register">
                <Card className="border-slate-200 shadow-none">
                  <form onSubmit={handleRegister}>
                    <CardHeader>
                      <CardTitle className="text-xl font-bold">Create account</CardTitle>
                      <CardDescription>Start your journey to better financial health.</CardDescription>
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
                        <Input id="reg-password" name="password" type="password" required />
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button className="w-full bg-slate-950 text-white hover:bg-slate-800" type="submit" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
