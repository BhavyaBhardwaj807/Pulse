import { useState } from 'react';
import { loginUser, registerUser } from '../services/authService';
import { useSettings } from '../context/SettingsContext';
import type { LanguageCode } from '../context/SettingsContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Pill,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type Mode = 'login' | 'register';

const friendlyError = (code: string | undefined, fallback: string): string => {
  if (!code) return fallback;
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password — please try again.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password is too weak — use at least 6 characters.',
    'auth/network-request-failed': 'Network issue — check your connection.',
    'auth/too-many-requests': 'Too many attempts — please wait a minute.',
  };
  return map[code] || fallback;
};

export default function Login() {
  const { language, setLanguage } = useSettings();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isLogin = mode === 'login';

  const tagline =
    language === 'hi'
      ? 'आपका साथी, हर खुराक पर'
      : language === 'ta'
      ? 'ஒவ்வொரு டோசிலும் உங்கள் துணை'
      : 'Your companion, every dose of the way';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginUser(email, password);
      } else {
        const res = await registerUser(email, password);
        console.log('REGISTER SUCCESS:', res.user.email);
        setSuccess('Account created — signing you in…');
      }
    } catch (err: any) {
      console.log('AUTH ERROR:', err?.code, err);
      setError(friendlyError(err?.code, err?.message || 'Authentication failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
    setConfirmPassword('');
  };

  const featureBullets = [
    {
      icon: Pill,
      title: language === 'hi' ? 'स्मार्ट दवाई ट्रैकिंग' : 'Smart medicine tracking',
      desc:
        language === 'hi'
          ? 'सुबह से रात तक हर खुराक स्वतः लॉग करें।'
          : 'Log every dose from morning to night, automatically.',
    },
    {
      icon: FileText,
      title: language === 'hi' ? 'दस्तावेज़ AI' : 'Document AI',
      desc:
        language === 'hi'
          ? 'पर्चे और रिपोर्ट्स से सीधे सवाल पूछें।'
          : 'Ask questions about your prescriptions and lab reports.',
    },
    {
      icon: Sparkles,
      title: language === 'hi' ? '9 भारतीय भाषाएँ' : '9 Indian languages',
      desc:
        language === 'hi'
          ? 'हिंदी, तमिल, गुजराती और बहुत कुछ — आपकी भाषा में।'
          : 'Hindi, Tamil, Gujarati and more — in your language.',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-navy-950 text-navy-50 flex flex-col lg:flex-row">
      {/* ===== Hero / Branding panel — desktop only ===== */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 relative overflow-hidden border-r border-navy-800">
        {/* Glowing background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-accent-dark/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-success/5 rounded-full blur-3xl" />

        <div className="relative z-10 p-12 flex flex-col w-full">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-card bg-accent flex items-center justify-center font-bold text-white text-2xl shadow-lg shadow-accent/30">
              ⚡
            </div>
            <div className="leading-tight">
              <h1 className="text-2xl font-bold text-white tracking-wide">
                {language === 'hi' ? 'पल्स (PULSE)' : 'PULSE'}
              </h1>
              <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">
                Medication Tracker
              </span>
            </div>
          </div>

          {/* Hero copy */}
          <div className="mt-16">
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight">
              {tagline}
            </h2>
            <p className="text-navy-100 text-base mt-4 leading-relaxed max-w-md">
              {language === 'hi'
                ? 'PULSE आपकी दवाइयों, पर्चों और स्वास्थ्य रिपोर्ट्स को एक सुरक्षित, बहुभाषी डैशबोर्ड में लाता है — परिवार के लिए डिज़ाइन किया गया।'
                : 'PULSE brings your medicines, prescriptions, and health reports into one secure, multilingual dashboard — designed for the whole family.'}
            </p>
          </div>

          {/* Feature bullets */}
          <div className="mt-12 space-y-4">
            {featureBullets.map(({ icon: Icon, title, desc }, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 bg-navy-900/60 border border-navy-800 rounded-card backdrop-blur-sm hover:border-accent/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-card bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">{title}</div>
                  <div className="text-xs text-navy-100 mt-0.5 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer trust badge */}
          <div className="mt-auto pt-12 flex items-center gap-2 text-xs text-navy-700">
            <ShieldCheck size={14} className="text-success" />
            <span className="font-semibold">
              {language === 'hi'
                ? 'Firebase से एन्क्रिप्टेड • भारत में बनाया गया'
                : 'Encrypted by Firebase • Made in India'}
            </span>
          </div>
        </div>
      </div>

      {/* ===== Form panel ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        {/* Top-right language selector — visible on all sizes */}
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="bg-navy-900 text-navy-50 font-medium text-sm px-3 py-2 rounded-card border border-navy-800 outline-none cursor-pointer hover:border-navy-750 focus:border-accent"
          >
            <option value="hi">हिंदी</option>
            <option value="ta">தமிழ்</option>
            <option value="gu">ગુજરાતી</option>
            <option value="mr">मराठी</option>
            <option value="te">తెలుగు</option>
            <option value="bn">বাংলা</option>
            <option value="kn">ಕನ್ನಡ</option>
            <option value="ml">മലയാളം</option>
            <option value="en">EN</option>
          </select>
        </div>

        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-card bg-accent flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-accent/30">
              ⚡
            </div>
            <div className="leading-tight">
              <h1 className="text-xl font-bold text-white tracking-wide">
                {language === 'hi' ? 'पल्स (PULSE)' : 'PULSE'}
              </h1>
              <span className="text-[10px] font-semibold text-accent uppercase tracking-widest">
                Medication Tracker
              </span>
            </div>
          </div>

          {/* Auth card */}
          <div className="card-navy">
            {/* Mode toggle */}
            <div className="flex p-1 bg-navy-950 border border-navy-800 rounded-card mb-6">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all tactile-btn ${
                  isLogin ? 'bg-accent text-white shadow-md shadow-accent/20' : 'text-navy-100 hover:text-white'
                }`}
              >
                {language === 'hi' ? 'लॉग इन' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all tactile-btn ${
                  !isLogin ? 'bg-accent text-white shadow-md shadow-accent/20' : 'text-navy-100 hover:text-white'
                }`}
              >
                {language === 'hi' ? 'रजिस्टर' : 'Create Account'}
              </button>
            </div>

            {/* Heading */}
            <h2 className="text-xl font-bold text-white">
              {isLogin
                ? language === 'hi'
                  ? 'वापसी पर स्वागत है'
                  : 'Welcome back'
                : language === 'hi'
                ? 'अपना अकाउंट बनाएँ'
                : 'Create your account'}
            </h2>
            <p className="text-sm text-navy-700 mt-1 mb-6">
              {isLogin
                ? language === 'hi'
                  ? 'अपनी दवाइयाँ और स्वास्थ्य रिकॉर्ड एक्सेस करें।'
                  : 'Access your medications and health records.'
                : language === 'hi'
                ? 'मिनट भर में शुरू करें — कोई क्रेडिट कार्ड नहीं।'
                : 'Get started in under a minute — no credit card.'}
            </p>

            {/* Status banners */}
            {error && (
              <div className="mb-4 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-card p-3 text-xs text-rose-300 animate-fade-in">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 flex items-start gap-2 bg-success/10 border border-success/30 rounded-card p-3 text-xs text-success animate-fade-in">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold text-navy-100 uppercase tracking-widest mb-1.5">
                  {language === 'hi' ? 'ईमेल' : 'Email'}
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700"
                  />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-navy-700 outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-navy-100 uppercase tracking-widest">
                    {language === 'hi' ? 'पासवर्ड' : 'Password'}
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-accent hover:text-accent-light tactile-btn"
                      onClick={() =>
                        setError(
                          language === 'hi'
                            ? 'पासवर्ड रीसेट के लिए अपनी ईमेल जाँच करें।'
                            : 'Password reset coming soon — please contact support.'
                        )
                      }
                    >
                      {language === 'hi' ? 'भूल गए?' : 'Forgot?'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 pl-9 pr-10 text-sm text-white placeholder:text-navy-700 outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-navy-700 hover:text-white tactile-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {!isLogin && (
                  <div className="mt-1.5 text-[10px] text-navy-700">
                    {language === 'hi'
                      ? 'कम से कम 6 अक्षर होने चाहिए'
                      : 'Use at least 6 characters'}
                  </div>
                )}
              </div>

              {/* Confirm password (register only) */}
              {!isLogin && (
                <div className="animate-slide-up">
                  <label className="block text-[10px] font-bold text-navy-100 uppercase tracking-widest mb-1.5">
                    {language === 'hi' ? 'पासवर्ड पुष्टि करें' : 'Confirm Password'}
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-navy-700 outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-3 rounded-card shadow-lg shadow-accent/20 border border-accent text-sm tactile-btn disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {isLogin
                        ? language === 'hi'
                          ? 'साइन इन हो रहा है…'
                          : 'Signing you in…'
                        : language === 'hi'
                        ? 'अकाउंट बना रहे हैं…'
                        : 'Creating account…'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {isLogin
                        ? language === 'hi'
                          ? 'लॉग इन करें'
                          : 'Sign In'
                        : language === 'hi'
                        ? 'अकाउंट बनाएँ'
                        : 'Create Account'}
                    </span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Mode swap CTA */}
            <div className="text-center mt-5 pt-5 border-t border-navy-800">
              <span className="text-xs text-navy-700">
                {isLogin
                  ? language === 'hi'
                    ? 'अकाउंट नहीं है? '
                    : "Don't have an account? "
                  : language === 'hi'
                  ? 'पहले से अकाउंट है? '
                  : 'Already have an account? '}
              </span>
              <button
                type="button"
                onClick={() => switchMode(isLogin ? 'register' : 'login')}
                className="text-xs font-bold text-accent hover:text-accent-light tactile-btn"
              >
                {isLogin
                  ? language === 'hi'
                    ? 'नया अकाउंट बनाएँ →'
                    : 'Create one →'
                  : language === 'hi'
                  ? 'साइन इन करें →'
                  : 'Sign in instead →'}
              </button>
            </div>
          </div>

          {/* Tiny legal */}
          <p className="text-[10px] text-navy-700 text-center mt-5 leading-relaxed">
            {language === 'hi'
              ? 'जारी रखकर, आप PULSE की उपयोग की शर्तें और गोपनीयता नीति स्वीकार करते हैं।'
              : 'By continuing, you agree to PULSE’s Terms of Use and Privacy Policy.'}
          </p>
        </div>
      </div>
    </div>
  );
}
