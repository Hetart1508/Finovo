import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import api from '@/src/lib/api';

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
const getErrorMessage = (error: any) => {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong'
  );
};

  const handleAuth = async (type: 'login' | 'register', e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const toastId = toast.loading('Authenticating...');

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const endpoint = type === 'register' ? '/auth/register' : '/auth/login';

      const response = await api.post(endpoint, data);

      if (type === 'register') {
        toast.success('Account created! Check your email for login OTP.', { id: toastId });
        toast.dismiss(toastId);
        setCurrentTab('login');
        setOtpEmail(data.email as string);
        return;
      }

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success(`Welcome back, ${response.data.user.name}!`, { id: toastId });
      toast.dismiss(toastId);
      navigate('/'); 
    } catch (error: any) {
     const message = getErrorMessage(error);
     toast.error(message, { id: toastId });
     toast.dismiss(toastId);
} finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Sending OTP...');
    try {
      await api.post('/auth/send-otp', { email: otpEmail });
      setOtpStep('verify');
      setResendTimer(300);
      toast.success('OTP sent to your email!', { id: toastId });
      toast.dismiss(toastId);
    } catch (error: any) {
      const message = getErrorMessage(error);
      toast.error(message, { id: toastId });
      toast.dismiss(toastId);

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
      toast.success(`Welcome back, ${response.data.user.name}!`, { id: toastId });
      toast.dismiss(toastId);
      navigate('/'); 
    } catch (error: any) {
      const message = getErrorMessage(error);
      toast.error(message, { id: toastId });
      toast.dismiss(toastId);

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-4">F</div>
          <h1 className="text-3xl font-bold tracking-tight">FinSmart AI</h1>
          <p className="text-slate-500 mt-2">Intelligent expense tracking for the modern era.</p>
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
            <Card>
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
            <Card>
              <form onSubmit={(e) => handleAuth('register', e)}>
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