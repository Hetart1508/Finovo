import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/src/api/authApi';
import { getApiMessage, getApiSuccessMessage, TOAST_AUTO_CLOSE_MS } from '@/src/lib/toastMessages';
import { saveSession } from '@/src/lib/session';
import { decodeGoogleRedirectPayload, getGoogleRedirectLoginUri, isAppleMobileDevice } from '@/src/features/auth/auth.utils';
import { AuthBrandPanel } from '@/src/features/auth/components/AuthBrandPanel';
import { AuthLoginCard } from '@/src/features/auth/components/AuthLoginCard';
import { AuthRegisterCard } from '@/src/features/auth/components/AuthRegisterCard';
import { AuthTabSwitch } from '@/src/features/auth/components/AuthTabSwitch';
import { GoogleAuthSection } from '@/src/features/auth/components/GoogleAuthSection';

export default function Auth() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
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

      if (!session.user) {
        throw new Error('Google sign-in did not return a valid session.');
      }

      queryClient.clear();
      saveSession(session.user, session.expiresAt ?? null);
      toast.success(`Welcome, ${session.user.name}!`);
      navigate('/', { replace: true });
    } catch {
      toast.error('Failed to finish Google sign-in.');
    }
  }, [navigate, queryClient]);

  const handleGoogleCredential = useCallback(async (credential?: string) => {
    if (!credential) {
      toast.error('Google sign-in did not return a credential.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Signing in with Google...');

    try {
      const response = await authApi.googleLogin(credential);
      queryClient.clear();
      saveSession(response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      navigate('/');
    } catch (error: unknown) {
      toast.update(toastId, {
        render: getApiMessage(error, 'Failed to sign in with Google.'),
        type: 'error',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, queryClient]);

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
      const response = await authApi.register(data);
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
    } catch (error: unknown) {
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
      const response = await authApi.verifyRegistrationOtp(registerEmail, otpCode);
      queryClient.clear();
      saveSession(response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      navigate('/');
    } catch (error: unknown) {
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
      const response = await authApi.login(data);
      queryClient.clear();
      saveSession(response.data.user, response.data.expiresAt);
      toast.update(toastId, {
        render: `Welcome back, ${response.data.user.name}!`,
        type: 'success',
        isLoading: false,
        autoClose: TOAST_AUTO_CLOSE_MS,
      });
      navigate('/'); 
    } catch (error: unknown) {
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
      const response = await authApi.forgotPassword(email);
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
    } catch (error: unknown) {
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
      const response = await authApi.resetPassword(resetEmail, otpCode, resetPassword);
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
    } catch (error: unknown) {
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
    authApi.register(lastRegisterForm)
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
    authApi.forgotPassword(resetEmail)
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

  return (
    <div className="flex h-dvh items-start justify-center overflow-y-auto bg-[#FAFBFC] p-4 text-[#1F2937] sm:p-6 lg:p-4">
      {/* Theme toggle hidden for now. */}
      <div className="mx-auto grid w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_30px_90px_rgba(31,41,55,0.12)] sm:max-w-lg lg:max-w-6xl lg:grid-cols-[1.05fr_0.95fr] lg:rounded-xl">
        <AuthBrandPanel />

        <div className="flex min-h-0 items-start justify-center bg-[radial-gradient(circle_at_top,#EEF6FF,transparent_42%)] px-4 py-8 sm:px-8 lg:bg-none lg:p-7 xl:p-8">
          <div className="flex w-full max-w-md flex-col items-center space-y-5">
            <div className="w-full text-center lg:text-left">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4F9CF9] text-lg font-black text-white shadow-[0_12px_30px_rgba(79,156,249,0.28)] lg:hidden">F</div>
              <p className="text-sm font-semibold uppercase text-[#34C759]">Welcome</p>
              <h1 className="mt-1 text-3xl font-black leading-tight text-[#1F2937] sm:text-4xl lg:text-3xl">Finovo AI</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#6B7280] lg:mx-0 lg:mt-1">Login with your password or verify your email to create a new account.</p>
            </div>

            <div className="mx-auto w-full max-w-sm space-y-3">
                <AuthTabSwitch
                  currentTab={currentTab}
                  onChange={(tab) => {
                    setCurrentTab(tab);
                    setOtpCode('');
                  }}
                />

                <GoogleAuthSection googleClientId={googleClientId} googleButtonRef={googleButtonRef} />

                {currentTab === 'login' ? (
                  <AuthLoginCard
                    loginStep={loginStep}
                    loading={loading}
                    otpCode={otpCode}
                    resetEmail={resetEmail}
                    resetPassword={resetPassword}
                    resendTimer={resendTimer}
                    onLogin={handleLogin}
                    onForgotPassword={handleForgotPassword}
                    onResetPassword={handleResetPassword}
                    onResendResetOtp={handleResendResetOTP}
                    onShowForgotPassword={() => {
                      setLoginStep('forgot');
                      setOtpCode('');
                    }}
                    onBackToLogin={() => setLoginStep('login')}
                    onEditResetEmail={() => {
                      setLoginStep('forgot');
                      setOtpCode('');
                      setResetPassword('');
                      setResetEmail('');
                    }}
                    onOtpCodeChange={setOtpCode}
                    onResetPasswordChange={setResetPassword}
                  />
                ) : (
                  <AuthRegisterCard
                    registerStep={registerStep}
                    loading={loading}
                    otpCode={otpCode}
                    registerEmail={registerEmail}
                    resendTimer={resendTimer}
                    onRegister={handleRegister}
                    onVerifyRegisterOtp={handleVerifyRegisterOTP}
                    onEditDetails={() => {
                      setRegisterStep('details');
                      setOtpCode('');
                    }}
                    onResendOtp={handleResendOTP}
                    onOtpCodeChange={setOtpCode}
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
