'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LockKeyhole,
  UserRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  ArrowRight,
  Building2,
  Mail,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'signup';
  onSuccess: (user: any) => void;
}

export default function AuthModal({
  open,
  onOpenChange,
  defaultTab = 'login',
  onSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'signup' | 'confirm'>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign up form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [role, setRole] = useState<'applicant' | 'reviewer'>('applicant');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Verification code state (Cognito)
  const [confirmEmail, setConfirmEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Quick fill helper for testing & evaluation
  const quickFill = (type: 'applicant' | 'officer') => {
    if (type === 'applicant') {
      setLoginEmail('applicant@example.com');
      setLoginPassword('Applicant@1234');
    } else {
      setLoginEmail('officer@bi.gov.ph');
      setLoginPassword('Officer@1234');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Invalid email or password.');
      }

      if (data.requiresConfirmation) {
        setConfirmEmail(loginEmail.trim().toLowerCase());
        setTab('confirm');
        toast.info('Please enter the verification code sent to your email.');
        return;
      }

      if (data.token) {
        localStorage.setItem('bi_token', data.token);
        localStorage.setItem('bi_user_email', data.user.email);
        document.cookie = `bi_auth_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
      }

      toast.success(`Welcome back, ${data.user.displayName || data.user.email}!`);
      onSuccess(data.user);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First name and Last name are required.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName.trim() || undefined,
          email: signupEmail.trim().toLowerCase(),
          contactNumber: contactNumber.trim() || undefined,
          role,
          password: signupPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to create account.');
      }

      if (data.requiresConfirmation) {
        setConfirmEmail(signupEmail.trim().toLowerCase());
        setTab('confirm');
        toast.info('Verification code sent! Please check your email to complete activation.');
        return;
      }

      if (data.token) {
        localStorage.setItem('bi_token', data.token);
        localStorage.setItem('bi_user_email', data.user.email);
        document.cookie = `bi_auth_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
      }

      toast.success(`Account created successfully! Welcome, ${data.user.displayName}!`);
      onSuccess(data.user);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Account registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      toast.error('Please enter the 6-digit confirmation code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: confirmEmail.trim().toLowerCase(),
          code: verificationCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Invalid confirmation code.');
      }

      toast.success('Account confirmed! You can now sign in.');
      setLoginEmail(confirmEmail);
      setTab('login');
    } catch (err: any) {
      toast.error(err.message || 'Confirmation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!confirmEmail) return;
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: confirmEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('New verification code sent to your email.');
      } else {
        toast.error(data.message || 'Could not resend code.');
      }
    } catch {
      toast.error('Failed to request new code.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="auth-dialog-content max-w-[500px] p-0 overflow-hidden bg-white border border-[#dfe7f1] shadow-2xl rounded-2xl">
        {/* Header with Official Philippine Bureau of Immigration Seal */}
        <div className="auth-modal-banner bg-[#102033] text-white p-6 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <img
              src="/bi-seal.jpg"
              alt="Official Seal"
              className="w-14 h-14 rounded-full border-2 border-[#dfaa2c] shadow-lg flex-shrink-0 object-cover"
            />
            <div>
              <small className="text-[#8da6c2] text-[10px] tracking-wider uppercase font-semibold block">
                Republic of the Philippines
              </small>
              <h2 className="text-xl font-serif text-white font-medium leading-tight">
                Bureau of Immigration
              </h2>
              <span className="text-[#dfaa2c] text-xs font-semibold tracking-wider">
                eSERVICES PORTAL · AWS COGNITO AUTH
              </span>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        <div className="p-6 pt-4">
          {tab !== 'confirm' ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-6 bg-[#edf2f8] p-1 rounded-lg">
                <TabsTrigger
                  value="login"
                  className="font-medium text-sm data-[state=active]:bg-[#173b69] data-[state=active]:text-white transition-all"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="font-medium text-sm data-[state=active]:bg-[#173b69] data-[state=active]:text-white transition-all"
                >
                  Create Account
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: SIGN IN */}
              {tab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider">
                        Password
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#778b9f] hover:text-[#18304c]"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 bg-[#173b69] hover:bg-[#102746] text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <LockKeyhole size={16} />}
                    Sign In to Workspace
                  </button>

                  {/* Quick Demo Fill Options */}
                  <div className="mt-4 pt-4 border-t border-[#e5ecf4]">
                    <p className="text-xs text-[#6e8297] font-medium mb-2 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#dfaa2c]" /> Quick Demo Accounts (One-Click):
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => quickFill('applicant')}
                        className="text-left p-2.5 bg-[#f0f4f9] hover:bg-[#e4ebf5] border border-[#d6e0ec] rounded-lg text-xs font-medium text-[#1e3a5f] transition cursor-pointer"
                      >
                        <strong className="block text-[#173b69]">👤 Applicant</strong>
                        <span className="text-[11px] text-[#62778e]">applicant@example.com</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => quickFill('officer')}
                        className="text-left p-2.5 bg-[#f0f4f9] hover:bg-[#e4ebf5] border border-[#d6e0ec] rounded-lg text-xs font-medium text-[#1e3a5f] transition cursor-pointer"
                      >
                        <strong className="block text-[#173b69]">👮 Officer Reviewer</strong>
                        <span className="text-[11px] text-[#62778e]">officer@bi.gov.ph</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 2: SIGN UP */}
              {tab === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                  {/* Account Type Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1.5">
                      Account Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('applicant')}
                        className={`p-2.5 text-left border rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                          role === 'applicant'
                            ? 'border-[#173b69] bg-[#173b69]/10 text-[#173b69] font-bold'
                            : 'border-[#cfdae7] bg-white text-[#62778e]'
                        }`}
                      >
                        <UserRound size={16} /> Individual Applicant
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('reviewer')}
                        className={`p-2.5 text-left border rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                          role === 'reviewer'
                            ? 'border-[#173b69] bg-[#173b69]/10 text-[#173b69] font-bold'
                            : 'border-[#cfdae7] bg-white text-[#62778e]'
                        }`}
                      >
                        <Building2 size={16} /> Immigration Officer
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Juan"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Dela Cruz"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1">
                        Middle Name
                      </label>
                      <input
                        type="text"
                        placeholder="Santos"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+63 917 123 4567"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1">
                      Official Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="juan.delacruz@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1">
                        Password (min 6) *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#cfdae7] rounded-lg text-sm text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-3 px-4 bg-[#173b69] hover:bg-[#102746] text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={16} />}
                    Complete Registration & Sign In
                  </button>
                </form>
              )}
            </Tabs>
          ) : (
            /* COGNITO CONFIRMATION CODE STEP */
            <form onSubmit={handleConfirmCode} className="space-y-4">
              <div className="text-center py-2">
                <span className="w-12 h-12 rounded-full bg-[#edf3fb] text-[#173b69] inline-grid place-items-center mb-3">
                  <Mail size={24} />
                </span>
                <h3 className="text-base font-bold text-[#18304c]">Verify Your Email</h3>
                <p className="text-xs text-[#6e8297] mt-1 max-w-sm mx-auto">
                  AWS Cognito sent a 6-digit verification code to <strong>{confirmEmail}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3b516a] uppercase tracking-wider mb-1.5">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="123456"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full text-center text-xl tracking-widest font-mono py-3 bg-white border border-[#cfdae7] rounded-lg text-[#18304c] focus:border-[#173b69] focus:ring-2 focus:ring-[#173b69]/20 outline-none transition"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="flex-1 py-2.5 px-3 border border-[#cfdae7] rounded-lg text-xs font-semibold text-[#375270] hover:bg-[#f3f7fb] transition cursor-pointer"
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-3 bg-[#173b69] hover:bg-[#102746] text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={15} /> : <KeyRound size={15} />}
                  Verify & Activate
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="text-xs text-[#315d8b] hover:underline font-medium inline-flex items-center gap-1"
                >
                  <RefreshCw size={13} /> Didn't receive code? Resend
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
