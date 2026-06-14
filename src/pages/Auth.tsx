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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 relative">
        {/* Background */}
        <div
          className="absolute inset-0 -z-10 overflow-hidden rounded-3xl"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(99,102,241,0.35), rgba(16,185,129,0.18)), url(/src/assets/auth-bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Subtle overlay for better contrast */}
        <div className="absolute inset-0 -z-9 rounded-3xl bg-gradient-to-b from-white/70 to-white/30 dark:from-slate-950/70 dark:to-slate-950/40 backdrop-blur-md" />


        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-indigo-600 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-indigo-500/20">F</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">FinSight AI</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">Intelligent expense tracking for the modern era.</p>
        </div>


        <Tabs
          value={currentTab}
          onValueChange={(value) => {
            setCurrentTab(value as 'login' | 'register');
            clearLoginError();
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="glass border-white/20">

              {otpStep === 'email' ? (
                <form onSubmit={handleSendOTP}>
                  <CardHeader>
                    <CardTitle>Welcome Back</CardTitle>
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
                    </div> {/* Added missing closing div here */}
                  </CardContent>

                  <CardFooter>
                    <Button className="w-full" type="submit" disabled={loading || !otpEmail}>
                      {loading ? 'Sending...' : 'Send OTP'}
                    </Button>
                  </CardFooter>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP}>
                  <CardHeader>
                    <CardTitle>Verify OTP</CardTitle>
                    <CardDescription>
                      Enter the 6-digit code sent to {otpEmail}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp">OTP Code</Label>
                      <Input
                        id="otp"
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) =>
                          setOtpCode(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="123456"
                        required
                      />
                    </div>

                    <div className="text-center text-sm text-slate-500">
                      Didn't receive?{' '}
                      {resendTimer > 0 ? (
                        `Resend in ${resendTimer}s`
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          className="text-indigo-600 hover:text-indigo-500 underline"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                    >
                      {loading ? 'Verifying...' : 'Verify & Login'}
                    </Button>
                  </CardFooter>
                </form>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card className="glass border-white/20">

              <form onSubmit={handleRegister}>
                <CardHeader>
                  <CardTitle>Create Account</CardTitle>
                  <CardDescription>
                    Start your journey to better financial health.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input id="reg-name" name="name" placeholder="John Doe" required minLength={2} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      name="password"
                      type="password"
                      required
                    />
                  </div>
                </CardContent>

                <CardFooter>
                  <Button className="w-full" type="submit" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
