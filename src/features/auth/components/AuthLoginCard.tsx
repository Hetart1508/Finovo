import type { FormEvent } from 'react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  RiArrowLeftLine,
  RiLock2Line,
  RiLoginCircleLine,
  RiMailLine,
  RiShieldUserLine,
} from 'react-icons/ri';
import { AuthNote } from './AuthNote';
import { PasswordInputWithToggle } from './PasswordInputWithToggle';

type LoginStep = 'login' | 'forgot' | 'reset';

type AuthLoginCardProps = {
  loginStep: LoginStep;
  loading: boolean;
  otpCode: string;
  resetEmail: string;
  resetPassword: string;
  resendTimer: number;
  onForgotPassword: (event: FormEvent<HTMLFormElement>) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onResetPassword: (event: FormEvent<HTMLFormElement>) => void;
  onResendResetOtp: () => void;
  onShowForgotPassword: () => void;
  onBackToLogin: () => void;
  onEditResetEmail: () => void;
  onOtpCodeChange: (value: string) => void;
  onResetPasswordChange: (value: string) => void;
};

const authInputClass = 'h-10 rounded-lg px-3 text-sm';
const passwordInputClass = 'h-10 rounded-lg px-3 pr-12 text-sm';
const cardHeaderClass = 'gap-0.5 px-4 pt-4 sm:px-5 sm:pt-4';
const cardContentClass = 'space-y-3 px-4 sm:px-5';
const cardFooterClass = 'px-4 pb-4 sm:px-5 sm:pb-4';

export function AuthLoginCard({
  loginStep,
  loading,
  otpCode,
  resetEmail,
  resetPassword,
  resendTimer,
  onForgotPassword,
  onLogin,
  onResetPassword,
  onResendResetOtp,
  onShowForgotPassword,
  onBackToLogin,
  onEditResetEmail,
  onOtpCodeChange,
  onResetPasswordChange,
}: AuthLoginCardProps) {
  return (
    <Card className="relative z-0 w-full rounded-xl border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(31,41,55,0.08)] dark:border-[#334155] dark:bg-[#111827]">
      {loginStep === 'login' ? (
        <form onSubmit={onLogin}>
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
                onClick={onShowForgotPassword}
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
        <form onSubmit={onForgotPassword}>
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
              onClick={onBackToLogin}
              disabled={loading}
            >
              Back to Login
            </Button>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={onResetPassword}>
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
                onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, ''))}
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
                onChange={(event) => onResetPasswordChange(event.target.value)}
                placeholder="New password"
                className={passwordInputClass}
                minLength={10}
                required
              />
            </div>
            <div className="flex items-center justify-between text-sm text-[#6B7280]">
              <button
                type="button"
                onClick={onEditResetEmail}
                className="inline-flex items-center gap-1 font-semibold text-[#1F2937] underline hover:text-[#1F2937]"
              >
                <RiArrowLeftLine className="text-sm" aria-hidden="true" />
                Edit email
              </button>
              {resendTimer > 0 ? (
                <span>Resend in {resendTimer}s</span>
              ) : (
                <button type="button" onClick={onResendResetOtp} className="font-semibold text-[#34C759] underline hover:text-[#34C759]">
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
  );
}
